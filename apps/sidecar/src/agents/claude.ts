/** Durable Claude sessions backed by the official Agent SDK and installed CLI. */
import { randomUUID } from 'node:crypto';
import { realpathSync } from 'node:fs';
import { and, asc, eq, sql } from 'drizzle-orm';
import { z } from 'zod';
import { query, type Options, type Query } from '@anthropic-ai/claude-agent-sdk';
import { getDb } from '../db/index.js';
import { sessions, sessionMessages, worktrees } from '../db/schema.js';
import { getNotificationEmitter } from '../rpc/notifications.js';
import { saveCheckpoint } from '../checkpoint/service.js';
import { resolveClaudePath } from './claudeModels.js';
import { ApprovalBroker, getApprovalBroker, normalizePermissionMode, SessionPermissionModeSchema, type SessionPermissionMode } from './approvalBroker.js';

// Shared normalized event shape also used by Codex and the collaboration relay.
export type ClaudeStreamEvent = { type: string; [key: string]: unknown };
export interface TokenUsage {
  input_tokens: number; output_tokens: number;
  cache_creation_input_tokens?: number; cache_read_input_tokens?: number;
}
export const ClaudeStartParamsSchema = z.object({
  worktreeId: z.string().uuid().optional(), workspaceId: z.string().uuid().optional(),
  workingDirectory: z.string().optional(), model: z.string().min(1).optional(),
  permissionMode: SessionPermissionModeSchema.optional(),
  // Accept the old start-with-prompt call while new clients use start then send.
  prompt: z.string().min(1).optional(),
  options: z.object({ model: z.string().optional(), workingDirectory: z.string().optional() }).optional(),
}).refine(input => !!(input.worktreeId || input.workspaceId), 'worktreeId is required');
export const ClaudeSendParamsSchema = z.object({
  sessionId: z.string().uuid(), message: z.string().min(1), stream: z.boolean().optional(),
  model: z.string().min(1).optional(), authorName: z.string().optional(), authorMachineId: z.string().optional(),
});
export const ClaudeGetSessionParamsSchema = z.object({ sessionId: z.string().uuid() });
export const ClaudeCancelParamsSchema = ClaudeGetSessionParamsSchema;
export const ClaudeResumeParamsSchema = ClaudeGetSessionParamsSchema.extend({ prompt: z.string().min(1).optional() });
export const ClaudeGetMessagesParamsSchema = ClaudeGetSessionParamsSchema.extend({ fromIndex: z.number().int().nonnegative().optional() });
export const ClaudeListParamsSchema = z.object({ worktreeId: z.string().uuid() });
export const ClaudeContinueParamsSchema = ClaudeGetSessionParamsSchema.extend({ prompt: z.string().min(1) });
export const ClaudeUpdateSettingsParamsSchema = ClaudeGetSessionParamsSchema.extend({
  model: z.string().min(1).optional(), permissionMode: SessionPermissionModeSchema.optional(),
}).refine(input => input.model !== undefined || input.permissionMode !== undefined, 'A setting is required');
export type ClaudeStartParams = z.infer<typeof ClaudeStartParamsSchema>;
export type ClaudeSendParams = z.infer<typeof ClaudeSendParamsSchema>;
export type SessionStatus = 'idle' | 'running' | 'cancelled';
export interface ClaudeSession {
  id: string; sessionId: string; worktreeId: string; workspaceId: string; workingDirectory: string;
  agentType: 'claude'; model: string; permissionMode: SessionPermissionMode; status: SessionStatus; threadId: string | null;
  createdAt: string; updatedAt: string;
}
export interface StoredMessage { id: string; index: number; timestamp: number; event: ClaudeStreamEvent }
interface ActiveTurn { controller: AbortController; query?: Query; finished?: Promise<unknown> }

/** The SDK decides which calls need review, including explicit ask rules in bypass mode. */
export function claudeToolPermissions(
  sessionId: string,
  turnSignal: AbortSignal,
  approvals: ApprovalBroker = getApprovalBroker(),
  onQuestion: (message: string) => void = message => getNotificationEmitter().emitQueryError(sessionId, message),
): NonNullable<Options['canUseTool']> {
  return async (toolName, input, options) => {
    if (toolName === 'AskUserQuestion') {
      const questions = Array.isArray(input.questions) ? input.questions
        .map(question => typeof question === 'object' && question !== null && 'question' in question ? String(question.question) : '')
        .filter(Boolean).join('\n') : '';
      const message = `Claude needs your answer${questions ? `:\n${questions}` : '.'}\nStructured question forms are not supported yet. Reply in the chat to continue.`;
      onQuestion(message);
      return { behavior: 'deny', interrupt: true, message: `${message} Ask the user directly in ordinary chat instead of using AskUserQuestion.`, toolUseID: options.toolUseID };
    }
    const reason = [options.title, options.description, options.decisionReason,
      options.blockedPath ? `Requested path: ${options.blockedPath}` : undefined].filter(Boolean).join('\n');
    const result = await approvals.request({
      sessionId, agentType: 'claude', toolName, input,
      ...(reason ? { reason } : {}), toolUseId: options.toolUseID,
      signal: AbortSignal.any([turnSignal, options.signal]),
    });
    return result.decision === 'allow'
      ? { behavior: 'allow', updatedInput: input, toolUseID: options.toolUseID }
      : { behavior: 'deny', message: result.reason ?? 'Denied by user', toolUseID: options.toolUseID };
  };
}

export class ClaudeHandler {
  private active = new Map<string, ActiveTurn>();
  constructor(private readonly approvals: ApprovalBroker = getApprovalBroker()) {}

  async start(params: ClaudeStartParams): Promise<ClaudeSession> {
    const worktreeId = params.worktreeId ?? params.workspaceId!;
    const worktree = getDb().select().from(worktrees).where(eq(worktrees.id, worktreeId)).get();
    if (!worktree?.worktreePath) throw new Error('Worktree not found');
    const cwd = realpathSync(worktree.worktreePath);
    const suppliedCwd = params.workingDirectory ?? params.options?.workingDirectory;
    if (suppliedCwd && realpathSync(suppliedCwd) !== cwd) throw new Error('Working directory must match the selected worktree');
    resolveClaudePath();
    const id = randomUUID();
    const now = new Date().toISOString();
    getDb().insert(sessions).values({ id, worktreeId, agentType: 'claude', model: params.model ?? params.options?.model ?? 'default',
      permissionMode: normalizePermissionMode(params.permissionMode), status: 'idle', createdAt: now, updatedAt: now }).run();
    getDb().update(worktrees).set({ activeSessionId: id }).where(eq(worktrees.id, worktreeId)).run();
    if (params.prompt) this.startTurn({ sessionId: id, message: params.prompt, stream: true });
    return this.getSession(id);
  }

  getSession(sessionId: string): ClaudeSession {
    const row = getDb().select().from(sessions).where(and(eq(sessions.id, sessionId), eq(sessions.agentType, 'claude'))).get();
    if (!row?.worktreeId) throw new Error('Session not found');
    const worktree = getDb().select().from(worktrees).where(eq(worktrees.id, row.worktreeId)).get();
    if (!worktree?.worktreePath) throw new Error('Worktree not found');
    let status = (row.status ?? 'idle') as SessionStatus;
    if (status === 'running' && !this.active.has(sessionId)) {
      status = 'idle';
      getDb().update(sessions).set({ status }).where(eq(sessions.id, sessionId)).run();
    }
    return { id: row.id, sessionId: row.id, worktreeId: row.worktreeId, workspaceId: row.worktreeId,
      workingDirectory: worktree.worktreePath, agentType: 'claude', model: row.model ?? 'default', status,
      permissionMode: normalizePermissionMode(row.permissionMode),
      threadId: row.claudeSessionId, createdAt: row.createdAt, updatedAt: row.updatedAt };
  }

  list(worktreeId: string): ClaudeSession[] {
    return getDb().select().from(sessions).where(and(eq(sessions.worktreeId, worktreeId), eq(sessions.agentType, 'claude')))
      .orderBy(asc(sessions.createdAt)).all().map(row => this.getSession(row.id));
  }

  getMessages(sessionId: string, fromIndex = 0): StoredMessage[] {
    this.getSession(sessionId);
    return getDb().select().from(sessionMessages).where(eq(sessionMessages.sessionId, sessionId)).orderBy(sql`rowid`).all()
      .map((row, index) => ({ id: row.id, index, timestamp: Date.parse(row.createdAt), event: JSON.parse(row.fullMessageJson!) as ClaudeStreamEvent }))
      .slice(fromIndex);
  }

  private status(sessionId: string, status: SessionStatus): void {
    getDb().update(sessions).set({ status, updatedAt: new Date().toISOString() }).where(eq(sessions.id, sessionId)).run();
    getNotificationEmitter().emitSessionStatus(sessionId, status);
  }

  private emit(sessionId: string, turnId: string, event: ClaudeStreamEvent): void {
    const id = randomUUID();
    const now = new Date().toISOString();
    const enriched = { ...event, eventId: id, turnId };
    const content = event.type === 'text_delta' ? String(event.text ?? '')
      : event.type === 'user' ? String((event.message as { content?: unknown })?.content ?? '') : '';
    getDb().insert(sessionMessages).values({ id, sessionId, role: event.type === 'user' ? 'user' : 'assistant', content,
      fullMessageJson: JSON.stringify(enriched), turnId, createdAt: now, sentAt: now }).run();
    getNotificationEmitter().emitMessage(sessionId, enriched);
  }

  private checkpoint(session: ClaudeSession, turnId: string, stage: string): void {
    try { saveCheckpoint(getDb(), { worktreeId: session.worktreeId, repoPath: session.workingDirectory, turnId: `${turnId}-${stage}` }); }
    catch { console.warn(`[Claude] Could not save ${stage} checkpoint for session ${session.id}`); }
  }

  private prepare(input: ClaudeSendParams): { session: ClaudeSession; turn: ActiveTurn; turnId: string } {
    const session = this.getSession(input.sessionId);
    if (this.active.has(session.id)) throw new Error('Session is already running');
    session.workingDirectory = realpathSync(session.workingDirectory);
    if (input.model) {
      session.model = input.model;
      getDb().update(sessions).set({ model: input.model }).where(eq(sessions.id, session.id)).run();
    }
    const turnId = randomUUID();
    const turn = { controller: new AbortController() };
    this.active.set(session.id, turn);
    this.status(session.id, 'running');
    this.emit(session.id, turnId, { type: 'user', message: { type: 'text', content: input.message }, authorName: input.authorName, authorMachineId: input.authorMachineId });
    getDb().update(sessions).set({ title: input.message.slice(0, 80), lastUserMessageAt: new Date().toISOString() }).where(eq(sessions.id, session.id)).run();
    return { session, turn, turnId };
  }

  startTurn(input: ClaudeSendParams): { sessionId: string; status: 'running'; turnId: string } {
    const prepared = this.prepare(input);
    prepared.turn.finished = this.run(input, prepared).catch(() => { /* persisted and notified */ });
    return { sessionId: input.sessionId, status: 'running', turnId: prepared.turnId };
  }

  async send(input: ClaudeSendParams) {
    const prepared = this.prepare(input);
    const running = this.run(input, prepared);
    prepared.turn.finished = running;
    return running;
  }

  private async run(input: ClaudeSendParams, { session, turn, turnId }: ReturnType<ClaudeHandler['prepare']>) {
    const textByMessage = new Map<string, string>();
    const tools = new Map<string, string>();
    const toolResults = new Set<string>();
    const streamedMessages = new Set<string>();
    const assistantFrames = new Set<string>();
    let streamingMessage = '';
    let completed = false;
    let reportedError = false;
    let usage: TokenUsage | undefined;
    const appendText = (id: string, text: string) => {
      if (!text) return;
      const prefix = !textByMessage.has(id) && textByMessage.size ? '\n\n' : '';
      textByMessage.set(id, (textByMessage.get(id) ?? '') + text);
      this.emit(session.id, turnId, { type: 'text_delta', text: prefix + text });
    };
    try {
      this.checkpoint(session, turnId, 'start');
      const sdkOptions: Options = {
        pathToClaudeCodeExecutable: resolveClaudePath(), cwd: session.workingDirectory,
        abortController: turn.controller, includePartialMessages: true, persistSession: true,
        ...(session.threadId ? { resume: session.threadId } : {}),
        ...(session.model === 'default' ? {} : { model: session.model }),
        systemPrompt: { type: 'preset', preset: 'claude_code' },
        settingSources: ['user', 'project', 'local'], permissionMode: session.permissionMode,
        ...(session.permissionMode === 'bypassPermissions'
          ? { allowDangerouslySkipPermissions: true, sandbox: { enabled: false } }
          : { sandbox: { enabled: true, failIfUnavailable: true, autoAllowBashIfSandboxed: true, allowUnsandboxedCommands: true,
            filesystem: { allowWrite: [session.workingDirectory] } } }),
        canUseTool: claudeToolPermissions(session.id, turn.controller.signal, this.approvals, message => {
          this.emit(session.id, turnId, { type: 'error', error: message });
          getNotificationEmitter().emitQueryError(session.id, message);
        }),
      };
      const sdk = query({ prompt: input.message, options: sdkOptions });
      turn.query = sdk;
      for await (const message of sdk) {
        if (turn.controller.signal.aborted) break;
        if (((message.type === 'system' && message.subtype === 'init') || message.type === 'result')
          && message.session_id && message.session_id !== session.threadId) {
          session.threadId = message.session_id;
          getDb().update(sessions).set({ claudeSessionId: message.session_id }).where(eq(sessions.id, session.id)).run();
        }
        if (message.type === 'system' && message.subtype === 'init') {
          this.emit(session.id, turnId, { type: 'system', subtype: 'init', session_id: message.session_id, model: message.model });
        } else if (message.type === 'stream_event' && !message.parent_tool_use_id) {
          const event = message.event;
          if (event.type === 'message_start') streamingMessage = event.message.id;
          else if (event.type === 'content_block_delta' && event.delta.type === 'text_delta') {
            const id = streamingMessage || 'stream';
            streamedMessages.add(id);
            appendText(id, event.delta.text);
          }
        } else if (message.type === 'assistant') {
          if (assistantFrames.has(message.uuid)) continue;
          assistantFrames.add(message.uuid);
          for (const block of message.message.content) {
            if (block.type === 'tool_use' && !tools.has(block.id)) {
              tools.set(block.id, block.name);
              this.emit(session.id, turnId, { type: 'tool_use', tool: block.name, input: block.input, id: block.id, tool_id: block.id });
            } else if (block.type === 'text' && !message.parent_tool_use_id && !streamedMessages.has(message.message.id)) {
              appendText(message.message.id, block.text);
            }
          }
        } else if (message.type === 'user' && Array.isArray(message.message.content)) {
          for (const block of message.message.content) {
            if (block.type === 'tool_result' && !toolResults.has(block.tool_use_id)) {
              toolResults.add(block.tool_use_id);
              this.emit(session.id, turnId, { type: 'tool_result', tool: tools.get(block.tool_use_id) ?? 'tool',
                id: block.tool_use_id, tool_use_id: block.tool_use_id, output: block.content,
                ...(block.is_error ? { error: typeof block.content === 'string' ? block.content : 'Tool failed' } : {}) });
            }
          }
        } else if (message.type === 'result') {
          completed = true;
          usage = message.usage;
          const error = message.is_error || message.subtype !== 'success';
          const result = error ? ('errors' in message ? message.errors.join('\n') : message.result)
            : [...textByMessage.values()].join('\n\n') || ('result' in message ? message.result : '');
          this.emit(session.id, turnId, { type: 'result', result, is_error: error, usage, session_id: message.session_id });
          getDb().update(sessions).set({ contextTokenCount: usage.input_tokens + usage.output_tokens }).where(eq(sessions.id, session.id)).run();
          if (error) { reportedError = true; throw new Error(result || 'Claude turn failed'); }
        }
      }
      if (!completed && !turn.controller.signal.aborted) throw new Error('Claude stream ended before the turn completed');
      if (turn.controller.signal.aborted) this.emit(session.id, turnId, { type: 'result', result: 'Cancelled', cancelled: true });
      this.checkpoint(session, turnId, 'end');
      return { sessionId: session.id, response: [...textByMessage.values()].join('\n\n'), turnId, usage };
    } catch (error) {
      if (turn.controller.signal.aborted) {
        this.emit(session.id, turnId, { type: 'result', result: 'Cancelled', cancelled: true });
      } else {
        const message = error instanceof Error ? error.message : String(error);
        if (!reportedError) this.emit(session.id, turnId, { type: 'error', error: message });
        getNotificationEmitter().emitQueryError(session.id, message);
      }
      throw error;
    } finally {
      this.approvals.denySession(session.id, 'Turn finished');
      try { turn.query?.close(); }
      finally {
        this.active.delete(session.id);
        this.status(session.id, turn.controller.signal.aborted ? 'cancelled' : 'idle');
      }
    }
  }

  async cancel(params: { sessionId: string }) {
    this.getSession(params.sessionId);
    const active = this.active.get(params.sessionId);
    this.approvals.denySession(params.sessionId, 'Session cancelled');
    active?.controller.abort();
    try { active?.query?.close(); }
    finally { this.status(params.sessionId, 'cancelled'); }
    // A successful Stop response means the SDK turn has released the session.
    // Its abort rejection is expected; the turn itself persists any other error.
    await active?.finished?.catch(() => {});
    return { success: true, sessionId: params.sessionId };
  }

  async resume(params: z.infer<typeof ClaudeResumeParamsSchema>) {
    const session = this.getSession(params.sessionId);
    return params.prompt ? this.startTurn({ sessionId: session.id, message: params.prompt }) : session;
  }
  async continue(params: z.infer<typeof ClaudeContinueParamsSchema>) { return this.startTurn({ sessionId: params.sessionId, message: params.prompt }); }
  async updateSettings(sessionId: string, settings: { model?: string; permissionMode?: SessionPermissionMode }) {
    this.getSession(sessionId);
    if (this.active.has(sessionId)) throw new Error('Wait for the current turn before changing its settings');
    getDb().update(sessions).set({
      ...(settings.model !== undefined ? { model: settings.model } : {}),
      ...(settings.permissionMode !== undefined ? { permissionMode: settings.permissionMode } : {}),
      updatedAt: new Date().toISOString(),
    }).where(eq(sessions.id, sessionId)).run();
    return this.getSession(sessionId);
  }
  async dispose(): Promise<void> {
    const turns = [...this.active.values()];
    for (const [sessionId, turn] of this.active) {
      this.approvals.denySession(sessionId, 'Session stopped');
      turn.controller.abort();
      try { turn.query?.close(); } catch { /* Still wait for every active turn to finish. */ }
    }
    await Promise.allSettled(turns.map(turn => turn.finished));
    this.active.clear();
  }
}

let handlerInstance: ClaudeHandler | undefined;
export function getClaudeHandler(): ClaudeHandler { return handlerInstance ??= new ClaudeHandler(); }
export async function claudeStart(params: ClaudeStartParams) { return getClaudeHandler().start(params); }
export async function claudeSend(params: ClaudeSendParams) { return params.stream ? getClaudeHandler().startTurn(params) : getClaudeHandler().send(params); }
export async function claudeResume(params: z.infer<typeof ClaudeResumeParamsSchema>) { return getClaudeHandler().resume(params); }
export async function claudeCancel(params: z.infer<typeof ClaudeCancelParamsSchema>) { return getClaudeHandler().cancel(params); }
export async function claudeGetSession(params: z.infer<typeof ClaudeGetSessionParamsSchema>) { return getClaudeHandler().getSession(params.sessionId); }
export async function claudeList(params: z.infer<typeof ClaudeListParamsSchema>) { return getClaudeHandler().list(params.worktreeId); }
export async function claudeGetMessages(params: z.infer<typeof ClaudeGetMessagesParamsSchema>) { return getClaudeHandler().getMessages(params.sessionId, params.fromIndex); }
export async function claudeContinue(params: z.infer<typeof ClaudeContinueParamsSchema>) { return getClaudeHandler().continue(params); }
export async function claudeUpdateSettings(params: z.infer<typeof ClaudeUpdateSettingsParamsSchema>) { return getClaudeHandler().updateSettings(params.sessionId, params); }
