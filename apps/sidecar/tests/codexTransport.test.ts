import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { EventEmitter } from 'node:events';
import { PassThrough, Writable } from 'node:stream';
import { runCodexTurn, type CodexApproval, type CodexTurnOptions } from '../src/agents/codexTransport.js';

const mocks = vi.hoisted(() => ({ spawn: vi.fn() }));
vi.mock('node:child_process', () => ({ spawn: mocks.spawn }));
vi.mock('../src/agents/codexModels.js', () => ({ resolveCodexPath: () => '/trusted/codex' }));

describe('Codex app-server turn transport', () => {
  let child: EventEmitter & Record<string, any>;
  let sent: any[];
  let onTurn: () => void;
  let onReply: (message: any) => void;
  let threadOverrides: Record<string, unknown>;
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
  const collect = async () => { const events = []; for await (const event of runCodexTurn(options)) events.push(event); return events; };
  beforeEach(() => {
    sent = [];
    onTurn = finish;
    onReply = () => {};
    threadOverrides = {};
    child = Object.assign(new EventEmitter(), { stdout: new PassThrough(), stderr: new PassThrough(), exitCode: null, signalCode: null });
    child.stdin = new Writable({ write(chunk, _encoding, callback) {
      const message = JSON.parse(chunk.toString());
      sent.push(message);
      queueMicrotask(() => {
        if (!message.method) { onReply(message); return; }
        if (!message.id) return;
        let result: unknown;
        if (message.method === 'initialize') result = {};
        if (message.method === 'model/list') result = { data: [{ model: 'configured-default', isDefault: true }] };
        if (message.method === 'thread/start' || message.method === 'thread/resume') result = {
          thread: { id: 'thread-1' }, approvalPolicy: message.params.approvalPolicy,
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
    options = { threadId: null, workingDirectory: '/workspace', model: 'default', permissionMode: 'default', message: 'Task', signal: controller.signal, approve: vi.fn(async () => ({ decision: 'deny' })) };
  });
  afterEach(() => vi.clearAllMocks());

  it('streams real delta notifications and selects the discovered default with workspace approvals', async () => {
    const events = await collect();
    expect(mocks.spawn).toHaveBeenCalledWith('/trusted/codex', ['app-server', '--disable', 'shell_snapshot', '--disable', 'shell_snapshot_v2'], expect.objectContaining({ cwd: '/workspace' }));
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
    onTurn = () => ask('item/tool/requestUserInput');
    await expect(collect()).rejects.toThrow('does not support');
    expect(options.approve).not.toHaveBeenCalled();
    expect(sent.find(message => message.id === 'server-approval').error.code).toBe(-32601);
    expect(child.kill).toHaveBeenCalled();
  });
});
