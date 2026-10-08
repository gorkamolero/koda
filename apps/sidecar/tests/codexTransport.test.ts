import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { EventEmitter } from 'node:events';
import { PassThrough, Writable } from 'node:stream';
import { CodexAppServer, runCodexTurn, type CodexApproval, type CodexQuestionRequest, type CodexTurnOptions } from '../src/agents/codexTransport.js';

const mocks = vi.hoisted(() => ({ spawn: vi.fn(), runHooks: vi.fn() }));
vi.mock('node:child_process', () => ({ spawn: mocks.spawn }));
vi.mock('../src/agents/codexPermissionHooks.js', async (original) => ({ ...await original<object>(), runPermissionHooks: mocks.runHooks }));
vi.mock('../src/agents/codexModels.js', () => ({ resolveCodexPath: () => '/trusted/codex' }));

describe('Codex app-server turn transport', () => {
  let child: EventEmitter & Record<string, any>;
  let sent: any[];
  let onTurn: () => void;
  let onReply: (message: any) => void;
  let threadOverrides: Record<string, unknown>;
  let hooksList: unknown;
  let holdInitialize: boolean;
  let controller: AbortController;
  let options: CodexTurnOptions;
  const write = (message: unknown) => child.stdout.write(JSON.stringify(message) + '\n');
  const notify = (method: string, params: object) => write({ method, params: { threadId: 'thread-1', turnId: 'turn-1', ...params } });
  const finish = () => {
    notify('item/started', { item: { type: 'agentMessage', id: 'answer', text: '' } });
    notify('item/agentMessage/delta', { itemId: 'answer', delta: 'Done' });
    notify('item/completed', { item: { type: 'agentMessage', id: 'answer', text: 'Done' } });
    notify('thread/tokenUsage/updated', { tokenUsage: { last: { inputTokens: 5, cachedInputTokens: 1, outputTokens: 2 } } });
    notify('turn/completed', { turn: { id: 'turn-1', status: 'completed' } });
  };
  const ask = (method = 'item/commandExecution/requestApproval', id: string | number = 'server-approval') => write({ id, method, params: { threadId: 'thread-1', turnId: 'turn-1', itemId: 'tool-1', command: 'touch /elsewhere/proof', reason: 'Write outside workspace' } });
  const question = (overrides: Record<string, unknown> = {}) => write({ id: 'server-question', method: 'item/tool/requestUserInput', params: {
    threadId: 'thread-1', turnId: 'turn-1', itemId: 'question-1', isBlocking: true, autoResolutionMs: null,
    questions: [{ id: 'color', header: 'Color', question: 'Which color?', isOther: true, isSecret: false, options: [{ label: 'Blue', description: 'Cool tone' }, { label: 'Red', description: 'Warm tone' }] }], ...overrides,
  } });
  const collect = async () => { const events = []; for await (const event of runCodexTurn(options)) events.push(event); return events; };
  beforeEach(() => {
    sent = [];
    onTurn = finish;
    onReply = () => {};
    threadOverrides = {};
    hooksList = { data: [] };
    mocks.runHooks.mockImplementation(async () => undefined);
    holdInitialize = false;
    child = Object.assign(new EventEmitter(), { pid: 1234, stdout: new PassThrough(), stderr: new PassThrough(), exitCode: null, signalCode: null });
    child.stdin = new Writable({ write(chunk, _encoding, callback) {
      const message = JSON.parse(chunk.toString());
      sent.push(message);
      queueMicrotask(() => {
        if (!message.method) { onReply(message); return; }
        if (!message.id) return;
        if (message.method === 'initialize' && holdInitialize) return;
        let result: unknown;
        if (message.method === 'initialize') result = {};
        if (message.method === 'model/list') result = { data: [{ model: 'configured-default', isDefault: true }] };
        if (message.method === 'hooks/list') {
          if (hooksList instanceof Error) { write({ id: message.id, error: { code: -32601, message: hooksList.message } }); return; }
          result = hooksList;
        }
        if (message.method === 'thread/start' || message.method === 'thread/resume') result = {
          thread: { id: 'thread-1', path: '/codex/sessions/thread-1.jsonl' }, approvalPolicy: message.params.approvalPolicy,
          approvalsReviewer: message.params.approvalsReviewer,
          sandbox: { type: message.params.sandbox === 'danger-full-access' ? 'dangerFullAccess' : 'workspaceWrite' },
          ...threadOverrides,
        };
        if (message.method === 'turn/start') {
          notify('turn/started', { turn: { id: 'turn-1' } });
          result = { turn: { id: 'turn-1' } };
        }
        if (message.method === 'turn/interrupt') result = {};
        write({ id: message.id, result });
        if (message.method === 'turn/start') onTurn();
      });
      callback();
    } });
    child.kill = vi.fn((signal = 'SIGTERM') => { child.signalCode = signal; child.emit('exit', null, signal); });
    mocks.spawn.mockReturnValue(child);
    controller = new AbortController();
    options = { threadId: null, workingDirectory: '/workspace', model: 'default', permissionMode: 'default', message: 'Task', signal: controller.signal, approve: vi.fn(async () => ({ decision: 'deny' })), ask: vi.fn(async () => ({ decision: 'cancel', reason: 'Cancelled by user', source: 'user' })) };
  });
  afterEach(() => { vi.useRealTimers(); vi.clearAllMocks(); });

  it("switches off the user's own permission hooks for the chat, keeping managed and other hooks", async () => {
    hooksList = { data: [{ cwd: '/workspace', errors: [], warnings: [], hooks: [
      { key: '/Users/me/.codex/hooks.json:permission_request:0:0', eventName: 'permissionRequest', handlerType: 'command', command: 'vibe-island-bridge --source codex', isManaged: false, enabled: true, trustStatus: 'trusted', timeoutSec: 7200 },
      { key: '/Library/managed.toml:permission_request:0:0', eventName: 'permissionRequest', handlerType: 'command', command: 'policy', isManaged: true, enabled: true, trustStatus: 'managed' },
      { key: '/Users/me/.codex/hooks.json:pre_tool_use:0:0', eventName: 'preToolUse', handlerType: 'command', command: 'guard', isManaged: false, enabled: true, trustStatus: 'trusted' },
    ] }] };
    await collect();
    expect(sent.find(message => message.method === 'hooks/list').params).toEqual({ cwds: ['/workspace'] });
    expect(sent.find(message => message.method === 'thread/start').params.config).toEqual({ hooks: { state: { '/Users/me/.codex/hooks.json:permission_request:0:0': { enabled: false } } } });
  });
  it("runs the user's permission hook next to Koda's card; a hook decision answers Codex and withdraws the card", async () => {
    hooksList = { data: [{ cwd: '/workspace', errors: [], warnings: [], hooks: [
      { key: 'mine', eventName: 'permissionRequest', handlerType: 'command', command: 'vibe-island-bridge --source codex', isManaged: false, enabled: true, trustStatus: 'trusted', timeoutSec: 7200 },
    ] }] };
    mocks.runHooks.mockImplementation(async () => 'allow');
    let withdrawn = false;
    options.approve = vi.fn((request: CodexApproval) => new Promise(resolve => request.signal.addEventListener('abort', () => { withdrawn = true; resolve({ decision: 'deny' as const }) })));
    let reply: any;
    onTurn = () => ask();
    onReply = message => { reply = message; finish(); };
    await collect();
    expect(reply.result).toEqual({ decision: 'accept' });
    expect(withdrawn).toBe(true);
    const [hooks, hookInput] = mocks.runHooks.mock.calls[0]!;
    expect(hooks).toEqual([{ key: 'mine', command: 'vibe-island-bridge --source codex', timeoutSec: 7200, matcher: null }]);
    // The same input Codex gives a PermissionRequest hook.
    expect(hookInput).toEqual({
      session_id: 'thread-1', turn_id: 'turn-1', transcript_path: '/codex/sessions/thread-1.jsonl', cwd: '/workspace',
      hook_event_name: 'PermissionRequest', model: 'configured-default', permission_mode: 'default',
      tool_name: 'Bash', tool_input: { command: 'touch /elsewhere/proof', description: 'Write outside workspace' },
    });
  });
  it("stops the user's hook when Koda's card is answered first", async () => {
    let hookSignal: AbortSignal | undefined;
    mocks.runHooks.mockImplementation((_hooks: unknown, _input: unknown, signal: AbortSignal) => { hookSignal = signal; return new Promise(resolve => signal.addEventListener('abort', () => resolve(undefined))); });
    options.approve = vi.fn(async () => ({ decision: 'allow' as const }));
    let reply: any;
    onTurn = () => ask();
    onReply = message => { reply = message; finish(); };
    await collect();
    expect(reply.result).toEqual({ decision: 'accept' });
    expect(hookSignal?.aborted).toBe(true);
  });
  it('gives a hook the patch for a file change, as apply_patch', async () => {
    let reply: any;
    onTurn = () => { notify('item/started', { item: { type: 'fileChange', id: 'tool-1', status: 'inProgress', changes: [{ path: '/elsewhere/note.txt', kind: { type: 'add' }, diff: 'hello' }] } }); ask('item/fileChange/requestApproval', 0); };
    onReply = message => { reply = message; finish(); };
    await collect();
    expect(reply).toBeDefined();
    expect(mocks.runHooks.mock.calls[0]![1]).toMatchObject({ tool_name: 'apply_patch', tool_input: { command: '*** Begin Patch\n*** Add File: /elsewhere/note.txt\n+hello\n*** End Patch' } });
  });
  it('starts normally when the installed Codex cannot list hooks', async () => {
    hooksList = new Error('Method not found');
    const events = await collect();
    expect(events.at(-1)).toEqual(expect.objectContaining({ type: 'turn.completed' }));
    expect(sent.find(message => message.method === 'thread/start').params).not.toHaveProperty('config');
  });
  it('streams real delta notifications and selects the discovered default with workspace approvals', async () => {
    const events = await collect();
    expect(mocks.spawn).toHaveBeenCalledWith('/trusted/codex', ['app-server', '--disable', 'shell_snapshot', '--disable', 'shell_snapshot_v2', '--enable', 'default_mode_request_user_input'], expect.objectContaining({ cwd: '/workspace' }));
    expect(events).toEqual([
      { type: 'thread.started', thread_id: 'thread-1' },
      { type: 'item.started', item: { type: 'agent_message', id: 'answer', text: '' } },
      { type: 'item.updated', item: { type: 'agent_message', id: 'answer', text: 'Done' } },
      { type: 'item.completed', item: { type: 'agent_message', id: 'answer', text: 'Done' } },
      { type: 'turn.completed', usage: { input_tokens: 5, cached_input_tokens: 1, output_tokens: 2 } },
    ]);
    expect(sent.find(message => message.method === 'thread/start').params).toMatchObject({ model: 'configured-default', approvalPolicy: 'on-request', approvalsReviewer: 'user', sandbox: 'workspace-write' });
    expect(sent.find(message => message.method === 'turn/start').params.sandboxPolicy).toMatchObject({ type: 'workspaceWrite', writableRoots: ['/workspace'], networkAccess: false, excludeTmpdirEnvVar: true, excludeSlashTmp: true });
    expect(child.kill).toHaveBeenCalled();
  });

  it.each(['allow', 'deny'] as const)('waits for the host decision and returns %s exactly once', async decision => {
    let resolve!: (value: { decision: 'allow' | 'deny' }) => void;
    options.approve = vi.fn(() => new Promise(done => { resolve = done; }));
    onTurn = () => ask();
    onReply = () => finish();
    const pending = collect();
    await vi.waitFor(() => expect(options.approve).toHaveBeenCalledOnce());
    expect(sent.filter(message => message.id === 'server-approval')).toHaveLength(0);
    resolve({ decision });
    await pending;
    expect(sent.filter(message => message.id === 'server-approval')).toEqual([{ id: 'server-approval', result: { decision: decision === 'allow' ? 'accept' : 'decline' } }]);
  });

  it('includes actual file paths and proposed diffs in file approval details', async () => {
    const changes = [{ path: '/elsewhere/proof', kind: { type: 'add' }, diff: '+proof' }];
    onTurn = () => { notify('item/started', { item: { type: 'fileChange', id: 'tool-1', changes, status: 'inProgress' } }); ask('item/fileChange/requestApproval', 0); };
    onReply = () => finish();
    await collect();
    expect(options.approve).toHaveBeenCalledWith(expect.objectContaining({ toolName: 'file_change', toolUseId: 'tool-1', input: expect.objectContaining({ item: expect.objectContaining({ changes }) }) }));
    expect(sent.find(message => message.id === 0)).toEqual({ id: 0, result: { decision: 'decline' } });
  });

  it('resumes the durable thread with explicit bypass settings and selected model', async () => {
    options = { ...options, threadId: 'thread-1', model: 'selected', permissionMode: 'bypassPermissions' };
    await collect();
    expect(sent.find(message => message.method === 'thread/resume').params).toMatchObject({ threadId: 'thread-1', model: 'selected', approvalPolicy: 'never', sandbox: 'danger-full-access' });
    expect(sent.find(message => message.method === 'turn/start').params.sandboxPolicy).toEqual({ type: 'dangerFullAccess' });
    expect(sent.some(message => message.method === 'model/list')).toBe(false);
  });

  it.each([
    { approvalPolicy: 'never' }, { approvalsReviewer: 'auto_review' }, { sandbox: { type: 'dangerFullAccess' } },
  ])('rejects incompatible effective thread settings before generation: %j', async overrides => {
    threadOverrides = overrides;
    await expect(collect()).rejects.toThrow('did not apply');
    expect(sent.some(message => message.method === 'turn/start')).toBe(false);
  });

  it('revokes pending approval and interrupts the turn on cancellation', async () => {
    let request!: CodexApproval;
    options.approve = vi.fn(input => { request = input; return new Promise(resolve => input.signal.addEventListener('abort', () => resolve({ decision: 'deny' }), { once: true })); });
    onTurn = () => ask();
    const pending = collect();
    const rejected = expect(pending).rejects.toThrow('cancelled');
    await vi.waitFor(() => expect(options.approve).toHaveBeenCalledOnce());
    controller.abort();
    await rejected;
    expect(request.signal.aborted).toBe(true);
    expect(sent.some(message => message.method === 'turn/interrupt')).toBe(true);
    expect(sent.find(message => message.id === 'server-approval')?.result).toEqual({ decision: 'decline' });
  });

  it('waits for process exit when startup cancellation and finally both close the server', async () => {
    holdInitialize = true;
    child.kill = vi.fn(); // The process has received SIGTERM but has not exited yet.
    let settled = false;
    const pending = collect().finally(() => { settled = true; });
    const rejected = expect(pending).rejects.toThrow('closed');
    await vi.waitFor(() => expect(sent.some(message => message.method === 'initialize')).toBe(true));
    controller.abort();
    await new Promise(resolve => setImmediate(resolve));
    expect(child.kill).toHaveBeenCalledWith('SIGTERM');
    expect(settled).toBe(false);
    child.signalCode = 'SIGTERM';
    child.emit('exit', null, 'SIGTERM');
    await rejected;
    expect(settled).toBe(true);
  });

  it('shares close completion and still waits for exit after SIGKILL escalation', async () => {
    const server = new CodexAppServer('/workspace');
    await server.initialize();
    vi.useFakeTimers();
    child.kill = vi.fn();
    const closing = server.close();
    expect(server.close()).toBe(closing);
    let settled = false;
    void closing.then(() => { settled = true; });
    await vi.advanceTimersByTimeAsync(2_000);
    expect(child.kill).toHaveBeenCalledWith('SIGKILL');
    expect(settled).toBe(false);
    child.signalCode = 'SIGKILL';
    child.emit('exit', null, 'SIGKILL');
    await closing;
    expect(settled).toBe(true);
  });

  it('ignores a stale nested turn completion while waiting for the current approval', async () => {
    onTurn = () => {
      notify('turn/completed', { turn: { id: 'previous-turn', status: 'completed' } });
      ask();
    };
    onReply = finish;
    const events = await collect();
    expect(options.approve).toHaveBeenCalledOnce();
    expect(events.filter(event => event.type === 'turn.completed')).toHaveLength(1);
    expect(events.find(event => event.type === 'item.completed' && event.item.text === 'Done')).toBeDefined();
  });

  it('revokes stale prompts when the server resolves them without host input', async () => {
    let request!: CodexApproval;
    options.approve = vi.fn(input => { request = input; return new Promise(resolve => input.signal.addEventListener('abort', () => resolve({ decision: 'deny' }), { once: true })); });
    onTurn = () => ask();
    const pending = collect();
    await vi.waitFor(() => expect(options.approve).toHaveBeenCalledOnce());
    notify('serverRequest/resolved', { requestId: 'server-approval' });
    finish();
    await pending;
    expect(request.signal.aborted).toBe(true);
  });

  it('denies pending prompts on process exit and exposes a visible failure', async () => {
    let request!: CodexApproval;
    options.approve = vi.fn(input => { request = input; return new Promise(resolve => input.signal.addEventListener('abort', () => resolve({ decision: 'deny' }), { once: true })); });
    onTurn = () => ask();
    const pending = collect();
    const rejected = expect(pending).rejects.toThrow('exited');
    await vi.waitFor(() => expect(options.approve).toHaveBeenCalledOnce());
    child.exitCode = 1;
    child.emit('exit', 1, null);
    await rejected;
    expect(request.signal.aborted).toBe(true);
  });

  it('fails visibly and rejects unknown server requests without granting approval', async () => {
    onTurn = () => ask('mcpServer/elicitation/request');
    await expect(collect()).rejects.toThrow('does not support');
    expect(options.approve).not.toHaveBeenCalled();
    expect(sent.find(message => message.id === 'server-approval').error.code).toBe(-32601);
    expect(child.kill).toHaveBeenCalled();
  });

  it.each(['default', 'bypassPermissions'] as const)('holds structured questions for an explicit host answer in %s mode', async permissionMode => {
    options.permissionMode = permissionMode;
    let respond!: (result: any) => void;
    options.ask = vi.fn(() => new Promise(resolve => { respond = resolve; }));
    onTurn = () => question({ autoResolutionMs: 1 });
    onReply = finish;
    const pending = collect();
    await vi.waitFor(() => expect(options.ask).toHaveBeenCalledOnce());
    expect(sent.filter(message => message.id === 'server-question')).toEqual([]);
    expect(options.ask).toHaveBeenCalledWith(expect.objectContaining({ toolUseId: 'question-1', questions: [{ id: 'color', header: 'Color', question: 'Which color?', options: [{ label: 'Blue', description: 'Cool tone' }, { label: 'Red', description: 'Warm tone' }], multiSelect: false, allowOther: true, isSecret: false }] }));
    respond({ decision: 'submit', answers: { color: { selected: ['Blue'] } } });
    await pending;
    expect(sent.filter(message => message.id === 'server-question')).toEqual([{ id: 'server-question', result: { answers: { color: { answers: ['Blue'] } } } }]);
    expect(options.approve).not.toHaveBeenCalled();
  });

  it('maps free-text and secret question input without manufacturing an option', async () => {
    options.ask = vi.fn(async () => ({ decision: 'submit', answers: { note: { selected: [], text: 'Private response' } } }));
    onTurn = () => question({ questions: [{ id: 'note', header: 'Note', question: 'Enter a note', isOther: false, isSecret: true, options: null }] });
    onReply = finish;
    const events = await collect();
    expect(options.ask).toHaveBeenCalledWith(expect.objectContaining({ questions: [expect.objectContaining({ options: [], allowOther: true, isSecret: true, multiSelect: false })] }));
    expect(sent.find(message => message.id === 'server-question').result).toEqual({ answers: { note: { answers: ['Private response'] } } });
    expect(JSON.stringify(events)).not.toContain('Private response');
  });

  it('returns an empty answer set for a cancelled question', async () => {
    onTurn = () => question(); onReply = finish;
    await collect();
    expect(sent.find(message => message.id === 'server-question').result).toEqual({ answers: {} });
  });

  it('withdraws exact questions without replying to a resolved server request', async () => {
    let request!: CodexQuestionRequest;
    let respond!: (result: any) => void;
    options.ask = vi.fn(input => { request = input; return new Promise(resolve => { respond = resolve; }); });
    onTurn = () => question();
    const pending = collect();
    await vi.waitFor(() => expect(options.ask).toHaveBeenCalledOnce());
    notify('serverRequest/resolved', { requestId: 'unrelated' });
    expect(request.signal.aborted).toBe(false);
    notify('serverRequest/resolved', { requestId: 'server-question' });
    expect(request.signal.aborted).toBe(true);
    respond({ decision: 'submit', answers: { color: { selected: ['Blue'] } } });
    finish(); await pending;
    expect(sent.filter(message => message.id === 'server-question')).toEqual([]);
    expect(controller.signal.aborted).toBe(false);
  });

  it.each(['cancel', 'turn-end', 'process-exit'] as const)('clears pending questions on %s and never sends a late answer', async ending => {
    let request!: CodexQuestionRequest;
    options.ask = vi.fn(input => { request = input; return new Promise(resolve => input.signal.addEventListener('abort', () => resolve({ decision: 'cancel', reason: 'Withdrawn', source: 'withdrawn' }), { once: true })); });
    onTurn = () => question();
    const pending = collect();
    const outcome = ending === 'turn-end' ? pending : expect(pending).rejects.toThrow(ending === 'cancel' ? 'cancelled' : 'exited');
    await vi.waitFor(() => expect(options.ask).toHaveBeenCalledOnce());
    if (ending === 'cancel') controller.abort();
    else if (ending === 'turn-end') finish();
    else { child.exitCode = 1; child.emit('exit', 1, null); }
    await outcome;
    expect(request.signal.aborted).toBe(true);
    expect(sent.filter(message => message.id === 'server-question')).toEqual([{ id: 'server-question', result: { answers: {} } }]);
  });

  it.each([{ threadId: 'wrong-thread' }, { turnId: 'previous-turn' }])('rejects a question for the wrong active context: %j', async overrides => {
    onTurn = () => question(overrides);
    await expect(collect()).rejects.toThrow('did not match');
    expect(options.ask).not.toHaveBeenCalled();
  });

  it('fails visibly for malformed question forms', async () => {
    onTurn = () => question({ questions: [{ id: 'broken' }] });
    await expect(collect()).rejects.toThrow('invalid question form');
    expect(options.ask).not.toHaveBeenCalled();
  });

  it('keeps direct question forms and answers out of normalized transcript events', async () => {
    onTurn = () => {
      notify('item/started', { item: { type: 'dynamicToolCall', id: 'q', tool: 'request_user_input', arguments: { questions: ['Private form'] } } });
      notify('item/completed', { item: { type: 'functionCallOutput', id: 'q-output', name: 'request_user_input', output: 'Private answer' } });
      notify('item/completed', { item: { type: 'agentMessage', id: 'a', text: 'Ordinary response', questions: ['Private form'] } });
      finish();
    };
    const events = await collect();
    expect(JSON.stringify(events)).not.toContain('Private');
    expect(JSON.stringify(events)).toContain('Ordinary response');
  });
});
