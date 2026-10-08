/** Installed Codex app-server, v2 JSON-RPC over stdio. No auth or global config writes. */
import { spawn, type ChildProcessWithoutNullStreams } from 'node:child_process';
import { createInterface } from 'node:readline';
import { z } from 'zod';
import { resolveCodexPath } from './codexModels.js';
import type { Question, QuestionDecision } from './questionBroker.js';
import { listUserPermissionHooks, permissionHookConfig, runPermissionHooks, type PermissionHook } from './codexPermissionHooks.js';

export type CodexPermissionMode = 'default' | 'bypassPermissions';
export interface CodexUsage { input_tokens: number; cached_input_tokens: number; output_tokens: number }
export interface CodexItem { id: string; type: string; text?: string; [key: string]: unknown }
export type CodexEvent =
  | { type: 'thread.started'; thread_id: string }
  | { type: 'item.started' | 'item.updated' | 'item.completed'; item: CodexItem }
  | { type: 'turn.completed'; usage?: CodexUsage }
  | { type: 'turn.failed'; error: { message: string } };
export interface CodexApproval {
  toolName: string; input: Record<string, unknown>; reason?: string; toolUseId?: string; signal: AbortSignal;
}
export interface CodexQuestionRequest {
  questions: Question[]; toolUseId: string; signal: AbortSignal;
}
export interface CodexTurnOptions {
  threadId: string | null; workingDirectory: string; model: string; permissionMode: CodexPermissionMode;
  message: string; signal: AbortSignal;
  approve: (request: CodexApproval) => Promise<{ decision: 'allow' | 'deny' }>;
  ask: (request: CodexQuestionRequest) => Promise<QuestionDecision>;
}
type Wire = Record<string, any>;
type Decision = { from: 'koda' | 'hook'; allow: boolean };
type RequestId = string | number;
const UserInputQuestionsSchema = z.array(z.object({
  id: z.string().min(1), header: z.string(), question: z.string().min(1),
  isOther: z.boolean(), isSecret: z.boolean(),
  options: z.array(z.object({ label: z.string().min(1), description: z.string() })).nullable(),
})).min(1);

class EventQueue<T> {
  private values: T[] = [];
  private wake?: () => void;
  private ended = false;
  private error?: Error;
  push(value: T): void { if (!this.ended) { this.values.push(value); this.wake?.(); } }
  end(error?: Error): void { this.ended = true; this.error = error; this.wake?.(); }
  async *read(): AsyncGenerator<T> {
    while (true) {
      if (this.values.length) { yield this.values.shift()!; continue; }
      if (this.error) throw this.error;
      if (this.ended) return;
      await new Promise<void>(resolve => { this.wake = resolve; });
      this.wake = undefined;
    }
  }
}

/** Kept separate from turn mapping so framing, errors and process lifetime are testable. */
export class CodexAppServer {
  private child: ChildProcessWithoutNullStreams;
  private reader: ReturnType<typeof createInterface>;
  private nextId = 0;
  private closed = false;
  private closePromise?: Promise<void>;
  private failure?: Error;
  private incoming = new Set<RequestId>();
  private pending = new Map<RequestId, { resolve: (value: any) => void; reject: (error: Error) => void; timer: NodeJS.Timeout }>();
  onNotification: (method: string, params: Wire) => void = () => {};
  onRequest: (method: string, params: Wire, id: RequestId) => Promise<unknown> = async method => { throw new Error(`Unsupported Codex request: ${method}`); };
  onFailure: (error: Error) => void = () => {};

  constructor(workingDirectory?: string) {
    // Local shell snapshots use an executor-managed sandbox in the installed CLI.
    // Use its native sandbox path so the requested per-chat policy is enforced.
    this.child = spawn(resolveCodexPath(), ['app-server', '--disable', 'shell_snapshot', '--disable', 'shell_snapshot_v2', '--enable', 'default_mode_request_user_input'], { cwd: workingDirectory, stdio: ['pipe', 'pipe', 'pipe'] });
    this.reader = createInterface({ input: this.child.stdout });
    // CLI stderr may contain private configuration; expose only structured protocol failures.
    this.child.stderr.resume();
    this.child.once('error', error => this.fail(new Error(`Cannot start Codex: ${error.message}`)));
    this.child.once('exit', (code, signal) => this.fail(new Error(`Codex app-server exited (${signal ?? code ?? 'unknown'})`)));
    this.child.stdin.on('error', () => this.fail(new Error('Codex app-server closed its input')));
    this.reader.on('line', line => {
      let message: Wire;
      try { message = JSON.parse(line); }
      catch { this.fail(new Error('Codex app-server returned invalid JSON')); return; }
      if (!message || typeof message !== 'object') { this.fail(new Error('Codex app-server returned an invalid message')); return; }
      if (typeof message.method === 'string') {
        if (message.id !== undefined) {
          if (this.incoming.has(message.id)) { this.fail(new Error('Codex reused a pending request ID')); return; }
          this.incoming.add(message.id);
          void this.onRequest(message.method, message.params ?? {}, message.id).then(
            result => this.respond(message.id, result),
            error => {
              this.incoming.delete(message.id);
              this.write({ id: message.id, error: { code: -32601, message: error instanceof Error ? error.message : String(error) } });
              this.fail(error instanceof Error ? error : new Error(String(error)));
            },
          ).catch(error => this.fail(error instanceof Error ? error : new Error(String(error))));
        } else {
          try { this.onNotification(message.method, message.params ?? {}); }
          catch (error) { this.fail(error instanceof Error ? error : new Error(String(error))); }
        }
      } else if (message.id !== undefined) {
        const request = this.pending.get(message.id);
        if (!request) return;
        this.pending.delete(message.id);
        clearTimeout(request.timer);
        if (message.error) request.reject(new Error(String(message.error.message ?? 'Codex request failed')));
        else request.resolve(message.result);
      }
    });
  }
  respond(id: RequestId, result: unknown): void {
    if (!this.incoming.delete(id)) return;
    this.write({ id, result });
  }
  forgetRequest(id: RequestId): void { this.incoming.delete(id); }
  private write(message: unknown): void {
    if (!this.closed && !this.child.stdin.destroyed) this.child.stdin.write(JSON.stringify(message) + '\n');
  }
  request(method: string, params: unknown, timeoutMs = 30_000): Promise<any> {
    if (this.closed || this.failure) return Promise.reject(this.failure ?? new Error('Codex app-server is closed'));
    const id = ++this.nextId;
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        this.pending.delete(id);
        reject(new Error(`Codex ${method} timed out`));
      }, timeoutMs);
      this.pending.set(id, { resolve, reject, timer });
      this.write({ id, method, params });
    });
  }
  async initialize(): Promise<void> {
    await this.request('initialize', { clientInfo: { name: 'koda', title: 'Koda', version: '0.1.0' }, capabilities: { experimentalApi: false } });
    this.write({ method: 'initialized', params: {} });
  }
  private fail(error: Error): void {
    if (this.closed || this.failure) return;
    this.failure = error;
    for (const request of this.pending.values()) { clearTimeout(request.timer); request.reject(error); }
    this.pending.clear();
    this.onFailure(error);
  }
  close(): Promise<void> {
    return this.closePromise ??= this.closeProcess();
  }
  private async closeProcess(): Promise<void> {
    this.fail(new Error('Codex app-server closed'));
    this.closed = true;
    this.reader.close();
    this.child.stdin.end();
    if (this.child.exitCode !== null || this.child.signalCode !== null || this.child.pid === undefined) return;
    await new Promise<void>(resolve => {
      const finish = () => {
        clearTimeout(timer);
        this.child.removeListener('exit', finish);
        this.child.removeListener('close', finish);
        resolve();
      };
      const timer = setTimeout(() => { this.child.kill('SIGKILL'); }, 2_000);
      this.child.once('exit', finish);
      this.child.once('close', finish);
      this.child.kill('SIGTERM');
    });
  }
}

export function codexPermissionOptions(mode: CodexPermissionMode, cwd: string) {
  return mode === 'bypassPermissions'
    ? { approvalPolicy: 'never', approvalsReviewer: 'user', sandbox: 'danger-full-access', sandboxPolicy: { type: 'dangerFullAccess' } }
    : { approvalPolicy: 'on-request', approvalsReviewer: 'user', sandbox: 'workspace-write', sandboxPolicy: {
      type: 'workspaceWrite', writableRoots: [cwd], networkAccess: false, excludeTmpdirEnvVar: true, excludeSlashTmp: true,
    } };
}

/** Codex's patch text for a file change, rebuilt from the item the approval refers to. */
function patchText(item: Wire | undefined): string {
  const changes = Array.isArray(item?.changes) ? item.changes : [];
  const body = changes.map((change: Wire) => {
    const kind = change.kind?.type ?? change.kind;
    const diff = typeof change.diff === 'string' ? change.diff : '';
    if (kind === 'add') return `*** Add File: ${change.path}\n${diff.split('\n').filter(line => line.length).map(line => line.startsWith('+') ? line : `+${line}`).join('\n')}`;
    if (kind === 'delete') return `*** Delete File: ${change.path}`;
    return `*** Update File: ${change.path}\n${diff}`;
  });
  return ['*** Begin Patch', ...body, '*** End Patch'].join('\n');
}

function normalizeItem(item: Wire): CodexItem {
  if (item.type === 'agentMessage') {
    // Question forms and direct answers are host-local; ordinary assistant text
    // remains part of the shared transcript.
    const { questions: _questions, ...message } = item;
    return { ...message, type: 'agent_message' } as CodexItem;
  }
  if (item.type === 'commandExecution') return { ...item, id: item.id, type: 'command_execution', aggregated_output: item.aggregatedOutput ?? '', exit_code: item.exitCode, status: item.status === 'inProgress' ? 'in_progress' : item.status };
  if (item.type === 'fileChange') return { ...item, id: item.id, type: 'file_change', changes: item.changes?.map((change: Wire) => ({ ...change, kind: change.kind?.type ?? change.kind })) };
  return { ...item, type: String(item.type).replace(/[A-Z]/g, char => '_' + char.toLowerCase()) } as CodexItem;
}

export async function* runCodexTurn(options: CodexTurnOptions): AsyncGenerator<CodexEvent> {
  if (options.signal.aborted) throw new Error('Codex turn cancelled');
  // Start the CLI in the selected worktree as well as passing cwd in the protocol.
  const server = new CodexAppServer(options.workingDirectory);
  const queue = new EventQueue<CodexEvent>();
  const items = new Map<string, Wire>();
  const approvals = new Map<RequestId, AbortController>();
  const questions = new Map<RequestId, AbortController>();
  const questionItemIds = new Set<string>();
  let threadId: string | null = null;
  let threadPath: string | null = null;
  let turnId: string | null = null;
  let activeModel = options.model;
  let permissionHooks: PermissionHook[] = [];
  let usage: CodexUsage | undefined;
  let completed = false;
  let startRequested = false;
  let interrupt: Promise<unknown> | undefined;
  const denyPending = () => {
    for (const [requestId, controller] of approvals) {
      server.respond(requestId, { decision: 'decline' });
      controller.abort();
    }
    approvals.clear();
    for (const [requestId, controller] of questions) {
      server.respond(requestId, { answers: {} });
      controller.abort();
    }
    questions.clear();
  };
  const cancel = () => {
    denyPending();
    if (threadId && turnId) interrupt = server.request('turn/interrupt', { threadId, turnId }, 1_000).catch(() => {});
    queue.end(new Error('Codex turn cancelled'));
    // Cancellation during startup also closes pending initialization/resume RPCs.
    if (!turnId) void server.close();
  };
  options.signal.addEventListener('abort', cancel, { once: true });
  server.onFailure = error => { denyPending(); queue.end(error); };
  server.onRequest = async (method, params, requestId) => {
    const isQuestion = method === 'item/tool/requestUserInput';
    if (!isQuestion && method !== 'item/commandExecution/requestApproval' && method !== 'item/fileChange/requestApproval') {
      throw new Error(`Koda does not support this Codex request yet: ${method}. The turn was stopped without approval.`);
    }
    if (!threadId || params.threadId !== threadId || !turnId || params.turnId !== turnId) throw new Error('Codex request did not match the active turn');
    if (completed || options.signal.aborted) return isQuestion ? { answers: {} } : { decision: 'decline' };
    const controller = new AbortController();
    if (isQuestion) {
      const parsed = UserInputQuestionsSchema.safeParse(params.questions);
      if (!parsed.success || typeof params.itemId !== 'string') throw new Error('Codex returned an invalid question form');
      questionItemIds.add(params.itemId);
      questions.set(requestId, controller);
      try {
        const result = await options.ask({ toolUseId: params.itemId, signal: controller.signal, questions: parsed.data.map(question => ({
          id: question.id, header: question.header, question: question.question, options: question.options ?? [],
          multiSelect: false, allowOther: question.isOther || !question.options?.length, isSecret: question.isSecret,
        })) });
        if (result.decision !== 'submit' || controller.signal.aborted || options.signal.aborted) return { answers: {} };
        return { answers: Object.fromEntries(Object.entries(result.answers).map(([id, answer]) => [id, { answers: [...answer.selected, ...(answer.text ? [answer.text] : [])] }])) };
      } finally { questions.delete(requestId); }
    }
    approvals.set(requestId, controller);
    const hooksDone = new AbortController();
    try {
      const item = items.get(params.itemId);
      const fileChange = method === 'item/fileChange/requestApproval';
      const command = params.command ?? item?.command;
      const hookInput = {
        session_id: threadId, turn_id: turnId, transcript_path: threadPath, cwd: options.workingDirectory,
        hook_event_name: 'PermissionRequest', model: activeModel, permission_mode: options.permissionMode,
        tool_name: fileChange ? 'apply_patch' : 'Bash',
        tool_input: fileChange ? { command: patchText(item) }
          : { command: Array.isArray(command) ? command.join(' ') : command, ...(typeof params.reason === 'string' ? { description: params.reason } : {}) },
      };
      const external = runPermissionHooks(permissionHooks, hookInput, hooksDone.signal);
      const inKoda = options.approve({
        toolName: fileChange ? 'file_change' : params.networkApprovalContext ? 'network_access' : 'command_execution',
        input: { ...params, ...(item ? { item } : {}) }, reason: params.reason ?? undefined,
        toolUseId: params.itemId, signal: controller.signal,
      }).then((result): Decision => ({ from: 'koda', allow: result.decision === 'allow' }));
      const fromHook = external.then((decision): Decision | Promise<Decision> => decision ? { from: 'hook', allow: decision === 'allow' } : inKoda);
      const first = await Promise.race<Decision>([inKoda, fromHook]);
      // The other side stops: a hook decision withdraws Koda's card, and a Koda decision ends the hook.
      if (first.from === 'hook') controller.abort();
      const withdrawn = first.from === 'koda' && controller.signal.aborted;
      return { decision: first.allow && !withdrawn && !options.signal.aborted ? 'accept' : 'decline' };
    } finally { hooksDone.abort(); approvals.delete(requestId); }
  };
  server.onNotification = (method, params) => {
    if (params.threadId && params.threadId !== threadId) return;
    if (params.turnId && turnId && params.turnId !== turnId) return;
    // Completion notifications carry their turn ID inside `turn`, unlike
    // item/delta notifications. A resumed thread may deliver older turn state.
    if (method === 'turn/completed' && (!turnId || params.turn?.id !== turnId)) return;
    if (method === 'serverRequest/resolved') {
      server.forgetRequest(params.requestId);
      approvals.get(params.requestId)?.abort(); approvals.delete(params.requestId);
      questions.get(params.requestId)?.abort(); questions.delete(params.requestId);
    } else if (method === 'turn/started') {
      if (!startRequested || (turnId && params.turn?.id !== turnId)) return;
      turnId = params.turn.id;
    } else if (method === 'item/started' || method === 'item/completed') {
      const item = params.item;
      items.set(item.id, item);
      if (questionItemIds.has(item.id) || item.name === 'request_user_input' || item.tool === 'request_user_input') return;
      if (item.type !== 'userMessage') queue.push({ type: method === 'item/started' ? 'item.started' : 'item.completed', item: normalizeItem(item) });
    } else if (method === 'item/agentMessage/delta') {
      const item = { ...(items.get(params.itemId) ?? { id: params.itemId, type: 'agentMessage' }), text: String(items.get(params.itemId)?.text ?? '') + params.delta };
      items.set(params.itemId, item);
      queue.push({ type: 'item.updated', item: normalizeItem(item) });
    } else if (method === 'thread/tokenUsage/updated') {
      const last = params.tokenUsage.last;
      usage = { input_tokens: last.inputTokens, cached_input_tokens: last.cachedInputTokens, output_tokens: last.outputTokens };
    } else if (method === 'turn/completed') {
      completed = true;
      denyPending();
      if (params.turn.status === 'completed') { queue.push({ type: 'turn.completed', usage }); queue.end(); }
      else queue.end(new Error(params.turn.error?.message ?? `Codex turn ${params.turn.status}`));
    } else if (method === 'error' && !params.willRetry) {
      queue.end(new Error(params.error?.message ?? 'Codex turn failed'));
    }
  };
  try {
    await server.initialize();
    let model = options.model;
    permissionHooks = await listUserPermissionHooks(server, options.workingDirectory);
    if (model === 'default') {
      const catalog = await server.request('model/list', { limit: 100, includeHidden: false });
      model = catalog.data?.find((entry: Wire) => entry.isDefault)?.model;
      if (!model) throw new Error('Codex did not report its default model');
    }
    const permissions = codexPermissionOptions(options.permissionMode, options.workingDirectory);
    activeModel = model;
    const thread = await server.request(options.threadId ? 'thread/resume' : 'thread/start', {
      ...(options.threadId ? { threadId: options.threadId, excludeTurns: true } : {}), ...permissionHookConfig(permissionHooks),
      cwd: options.workingDirectory, model, approvalPolicy: permissions.approvalPolicy,
      approvalsReviewer: permissions.approvalsReviewer, sandbox: permissions.sandbox,
    });
    if (thread.approvalPolicy !== permissions.approvalPolicy || thread.approvalsReviewer !== permissions.approvalsReviewer || thread.sandbox?.type !== permissions.sandboxPolicy.type) {
      throw new Error('Codex did not apply the selected sandbox and approval settings. No turn was started.');
    }
    threadId = thread.thread.id;
    threadPath = typeof thread.thread.path === 'string' ? thread.thread.path : null;
    if (options.threadId && threadId !== options.threadId) throw new Error('Codex resumed a different thread');
    yield { type: 'thread.started', thread_id: threadId! };
    startRequested = true;
    const started = await server.request('turn/start', {
      threadId, input: [{ type: 'text', text: options.message }], cwd: options.workingDirectory, model,
      approvalPolicy: permissions.approvalPolicy, approvalsReviewer: permissions.approvalsReviewer, sandboxPolicy: permissions.sandboxPolicy,
    });
    turnId = started.turn.id;
    if (options.signal.aborted) cancel();
    yield* queue.read();
  } finally {
    options.signal.removeEventListener('abort', cancel);
    denyPending();
    if (interrupt) await interrupt;
    await server.close();
  }
}
