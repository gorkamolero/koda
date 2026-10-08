import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest';
import { mkdtempSync, mkdirSync, symlinkSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { randomUUID } from 'node:crypto';
import { eq } from 'drizzle-orm';
import { ClaudeHandler, ClaudeStartParamsSchema, claudeWorkspacePermissions } from '../src/agents/claude.js';
import { initDbWithMigrations, resetDb, getDb } from '../src/db/index.js';
import { repos, worktrees, sessions } from '../src/db/schema.js';
import { getNotificationEmitter } from '../src/rpc/notifications.js';

const mocks = vi.hoisted(() => ({ query: vi.fn(), checkpoint: vi.fn() }));
vi.mock('@anthropic-ai/claude-agent-sdk', () => ({ query: mocks.query }));
vi.mock('../src/agents/claudeModels.js', () => ({ resolveClaudePath: () => '/trusted/claude' }));
vi.mock('../src/checkpoint/service.js', () => ({ saveCheckpoint: mocks.checkpoint }));

const usage = { input_tokens: 17, output_tokens: 8 };
const assistant = (id: string, content: unknown[], uuid = id) => ({ type: 'assistant', session_id: 'sdk-thread', parent_tool_use_id: null, uuid, message: { id, content } });
const result = { type: 'result', subtype: 'success', is_error: false, result: 'Done', session_id: 'sdk-thread', usage };
const events = () => [
  { type: 'system', subtype: 'init', model: 'actual-model', session_id: 'sdk-thread' },
  { type: 'stream_event', event: { type: 'message_start', message: { id: 'announce' } } },
  { type: 'stream_event', event: { type: 'content_block_delta', delta: { type: 'text_delta', text: "I'll edit." } } },
  assistant('announce', [{ type: 'text', text: "I'll edit." }]),
  assistant('tool-call', [{ type: 'tool_use', id: 'write-id', name: 'Write', input: { file_path: 'file.txt', content: 'Hello' } }]),
  { type: 'user', message: { content: [{ type: 'tool_result', tool_use_id: 'write-id', content: 'Created file', is_error: false }] } },
  assistant('answer', [{ type: 'text', text: 'Done' }]),
  result,
];
function fakeQuery(messages: unknown[] = events()) {
  return Object.assign((async function* () { yield* messages; })(), { close: vi.fn() });
}

describe('durable Claude runtime', () => {
  let handler: ClaudeHandler;
  let directory: string;
  let databasePath: string;
  let worktreeId: string;
  beforeEach(() => {
    vi.clearAllMocks();
    directory = mkdtempSync(join(tmpdir(), 'koda-claude-unit-'));
    databasePath = join(directory, 'state.db');
    initDbWithMigrations(databasePath);
    const repoId = randomUUID(); worktreeId = randomUUID();
    getDb().insert(repos).values({ id: repoId, rootPath: directory }).run();
    getDb().insert(worktrees).values({ id: worktreeId, repoId, worktreePath: directory }).run();
    mocks.query.mockImplementation(() => fakeQuery());
    handler = new ClaudeHandler();
  });
  afterEach(async () => { await handler.dispose(); resetDb(); rmSync(directory, { recursive: true, force: true }); vi.restoreAllMocks(); });

  it('creates an idle persisted session and uses CLI defaults without changing auth', async () => {
    expect(ClaudeStartParamsSchema.safeParse({}).success).toBe(false);
    const session = await handler.start({ worktreeId });
    expect(session).toMatchObject({ model: 'default', status: 'idle', agentType: 'claude', threadId: null });
    expect(mocks.query).not.toHaveBeenCalled();
    await handler.send({ sessionId: session.id, message: 'Task' });
    const options = mocks.query.mock.calls[0][0].options;
    expect(options).toMatchObject({ pathToClaudeCodeExecutable: '/trusted/claude', includePartialMessages: true, persistSession: true,
      permissionMode: 'default', settingSources: ['user', 'project', 'local'], sandbox: { enabled: true, failIfUnavailable: true, allowUnsandboxedCommands: false } });
    expect(options).not.toHaveProperty('model');
    expect(options).not.toHaveProperty('env');
    expect(options).not.toHaveProperty('allowDangerouslySkipPermissions');
    expect(options).not.toHaveProperty('mcpServers');
  });

  it('rejects a directory that does not belong to the chosen worktree', async () => {
    await expect(handler.start({ worktreeId, workingDirectory: '/' })).rejects.toThrow('must match');
  });

  it('persists matching notification and polling events without SDK tool-result user duplicates', async () => {
    const emit = vi.spyOn(getNotificationEmitter(), 'emitMessage');
    const session = await handler.start({ worktreeId, model: 'chosen-model' });
    const response = await handler.send({ sessionId: session.id, message: 'Edit file', authorName: 'User B', authorMachineId: 'machine-b' });
    expect(response.response).toBe("I'll edit.\n\nDone");
    const messages = handler.getMessages(session.id);
    expect(messages.map(row => row.event.type)).toEqual(['user', 'system', 'text_delta', 'tool_use', 'tool_result', 'text_delta', 'result']);
    expect(messages[0].event).toMatchObject({ message: { content: 'Edit file' }, authorName: 'User B', authorMachineId: 'machine-b' });
    expect(messages.at(-1)?.event.result).toBe(response.response);
    expect(messages[4].event).toMatchObject({ tool_use_id: 'write-id', output: 'Created file' });
    expect(emit.mock.calls.map(call => call[1])).toEqual(messages.map(row => row.event));
    expect(new Set(messages.map(row => row.event.turnId)).size).toBe(1);
    expect(new Set(messages.map(row => row.event.eventId)).size).toBe(messages.length);
    expect(handler.getMessages(session.id, 4)).toEqual(messages.slice(4));
    expect(handler.getSession(session.id)).toMatchObject({ status: 'idle', threadId: 'sdk-thread' });
    expect(mocks.checkpoint).toHaveBeenCalledTimes(2);
  });

  it('reopens SQLite and resumes the upstream thread with the selected model and history', async () => {
    const session = await handler.start({ worktreeId, model: 'first-model' });
    await handler.send({ sessionId: session.id, message: 'First' });
    const messages = handler.getMessages(session.id);
    await handler.dispose(); resetDb(); initDbWithMigrations(databasePath); handler = new ClaudeHandler();
    expect(handler.list(worktreeId)[0]).toMatchObject({ id: session.id, model: 'first-model', threadId: 'sdk-thread' });
    expect(handler.getMessages(session.id)).toEqual(messages);
    await handler.send({ sessionId: session.id, message: 'Follow up', model: 'second-model' });
    expect(mocks.query.mock.calls[1][0].options).toMatchObject({ resume: 'sdk-thread', model: 'second-model' });
    expect(handler.getSession(session.id).model).toBe('second-model');
    expect(handler.getMessages(session.id)).toHaveLength(messages.length * 2);
  });

  it('reserves background turns synchronously and rejects overlapping relay/local messages', async () => {
    let release!: () => void;
    const gate = new Promise<void>(resolve => { release = resolve; });
    mocks.query.mockImplementation(() => Object.assign((async function* () { await gate; yield* events(); })(), { close: vi.fn() }));
    const session = await handler.start({ worktreeId });
    expect(handler.startTurn({ sessionId: session.id, message: 'First' }).status).toBe('running');
    expect(handler.getSession(session.id).status).toBe('running');
    expect(() => handler.startTurn({ sessionId: session.id, message: 'Second' })).toThrow('already running');
    await expect(handler.updateSettings(session.id, { model: 'other' })).rejects.toThrow('Wait');
    release();
    await vi.waitFor(() => expect(handler.getSession(session.id).status).toBe('idle'));
  });

  it('cancels and closes the actual SDK turn, then allows a later turn', async () => {
    let signal!: AbortSignal;
    const close = vi.fn();
    mocks.query.mockImplementationOnce(({ options }) => {
      signal = options.abortController.signal;
      return Object.assign((async function* () {
        await new Promise((_resolve, reject) => signal.addEventListener('abort', () => reject(new Error('aborted')), { once: true }));
      })(), { close });
    });
    const session = await handler.start({ worktreeId });
    const pending = handler.send({ sessionId: session.id, message: 'Long task' });
    const rejected = expect(pending).rejects.toThrow('aborted');
    await handler.cancel({ sessionId: session.id }); await rejected;
    expect(signal.aborted).toBe(true); expect(close).toHaveBeenCalled();
    expect(handler.getSession(session.id).status).toBe('cancelled');
    expect(handler.getMessages(session.id).at(-1)?.event).toMatchObject({ type: 'result', cancelled: true });
    await handler.send({ sessionId: session.id, message: 'Try again' });
    expect(handler.getSession(session.id).status).toBe('idle');
  });

  it('persists SDK failures without throwing unhandled EventEmitter errors', async () => {
    mocks.query.mockImplementationOnce(() => Object.assign((async function* () { throw new Error('Provider unavailable'); })(), { close: vi.fn() }));
    const session = await handler.start({ worktreeId });
    handler.startTurn({ sessionId: session.id, message: 'Task' });
    await vi.waitFor(() => expect(handler.getSession(session.id).status).toBe('idle'));
    expect(handler.getMessages(session.id).at(-1)?.event).toMatchObject({ type: 'error', error: 'Provider unavailable' });
  });

  it('keeps failed result text and never reports it as successful completion', async () => {
    mocks.query.mockReturnValueOnce(fakeQuery([{ ...result, is_error: true, result: 'Login required' }]));
    const session = await handler.start({ worktreeId });
    await expect(handler.send({ sessionId: session.id, message: 'Task' })).rejects.toThrow('Login required');
    expect(handler.getMessages(session.id).at(-1)?.event).toMatchObject({ type: 'result', is_error: true, result: 'Login required' });
    expect(handler.getMessages(session.id).filter(row => row.event.type === 'error')).toHaveLength(0);
  });

  it('keeps full fallback text blocks and does not replace the root thread with a subagent ID', async () => {
    mocks.query.mockReturnValueOnce(fakeQuery([
      { type: 'system', subtype: 'init', model: 'actual-model', session_id: 'sdk-thread' },
      assistant('full', [{ type: 'text', text: 'One ' }, { type: 'text', text: 'two' }]),
      { ...assistant('child', [{ type: 'text', text: 'Hidden subagent answer' }]), session_id: 'child-thread', parent_tool_use_id: 'task-id' },
      { ...result, result: 'One two' },
    ]));
    const session = await handler.start({ worktreeId });
    expect((await handler.send({ sessionId: session.id, message: 'Task' })).response).toBe('One two');
    expect(handler.getSession(session.id).threadId).toBe('sdk-thread');
  });

  it('recovers stale running state after a stopped sidecar', async () => {
    const session = await handler.start({ worktreeId });
    getDb().update(sessions).set({ status: 'running' }).where(eq(sessions.id, session.id)).run();
    handler = new ClaudeHandler();
    expect(handler.getSession(session.id).status).toBe('idle');
    expect(getDb().select().from(sessions).get()?.status).toBe('idle');
  });

  it('rejects wrong-engine and missing sessions', async () => {
    const session = await handler.start({ worktreeId });
    getDb().update(sessions).set({ agentType: 'codex' }).where(eq(sessions.id, session.id)).run();
    expect(() => handler.getSession(session.id)).toThrow('not found');
    expect(() => handler.getMessages(randomUUID())).toThrow('not found');
  });

  it('allows scoped file changes and sandboxed commands while denying escaping paths and interactive requests', async () => {
    const permissions = claudeWorkspacePermissions(resolve(directory));
    const options = { signal: new AbortController().signal, toolUseID: 'test' };
    expect(await permissions('Write', { file_path: join(directory, 'new/file.txt') }, options)).toMatchObject({ behavior: 'allow' });
    expect(await permissions('Write', { file_path: `${directory}-other/file.txt` }, options)).toMatchObject({ behavior: 'deny' });
    expect(await permissions('Write', { file_path: '../escape.txt' }, options)).toMatchObject({ behavior: 'deny' });
    mkdirSync(join(directory, 'sub'));
    symlinkSync(tmpdir(), join(directory, 'sub/escape'));
    expect(await permissions('Edit', { file_path: join(directory, 'sub/escape/file.txt') }, options)).toMatchObject({ behavior: 'deny' });
    expect(await permissions('Bash', { command: 'wc -c file.txt' }, options)).toMatchObject({ behavior: 'allow' });
    expect(await permissions('Bash', { command: 'pwd', dangerouslyDisableSandbox: true }, options)).toMatchObject({ behavior: 'deny' });
    expect(await permissions('ExitPlanMode', {}, options)).toMatchObject({ behavior: 'deny' });
  });

  it('accepts files inside a symlinked worktree root without accepting neighboring files', async () => {
    const realRoot = join(directory, 'actual-worktree');
    const alias = join(directory, 'worktree-alias');
    mkdirSync(realRoot); symlinkSync(realRoot, alias);
    const permissions = claudeWorkspacePermissions(alias);
    const options = { signal: new AbortController().signal, toolUseID: 'test' };
    expect(await permissions('Write', { file_path: join(alias, 'nested/new.txt') }, options)).toMatchObject({ behavior: 'allow' });
    expect(await permissions('Write', { file_path: join(realRoot, 'new.txt') }, options)).toMatchObject({ behavior: 'allow' });
    expect(await permissions('Write', { file_path: join(directory, 'neighbor.txt') }, options)).toMatchObject({ behavior: 'deny' });
  });
});
