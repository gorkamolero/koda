import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { randomUUID } from 'node:crypto';
import { eq } from 'drizzle-orm';
import { CodexHandler, StartSessionSchema } from '../src/agents/codex.js';
import { initDbWithMigrations, resetDb, getDb } from '../src/db/index.js';
import { repos, worktrees, sessions } from '../src/db/schema.js';
import { getNotificationEmitter } from '../src/rpc/notifications.js';

const mocks = vi.hoisted(() => ({ runStreamed: vi.fn(), startThread: vi.fn(), resumeThread: vi.fn() }));
vi.mock('@openai/codex-sdk', () => ({
  Codex: vi.fn(() => ({ startThread: mocks.startThread, resumeThread: mocks.resumeThread })),
}));

const usage = { input_tokens: 100, cached_input_tokens: 50, output_tokens: 20 };
async function* success() {
  yield { type: 'thread.started', thread_id: 'sdk-thread-1' };
  yield { type: 'item.started', item: { id: 'command', type: 'command_execution', command: 'pwd', status: 'in_progress', aggregated_output: '' } };
  yield { type: 'item.completed', item: { id: 'command', type: 'command_execution', command: 'pwd', status: 'completed', aggregated_output: '/work', exit_code: 0 } };
  yield { type: 'item.updated', item: { id: 'answer', type: 'agent_message', text: 'Hello' } };
  yield { type: 'item.completed', item: { id: 'answer', type: 'agent_message', text: 'Hello world' } };
  yield { type: 'turn.completed', usage };
}

describe('durable Codex runtime', () => {
  let handler: CodexHandler;
  let directory: string;
  let databasePath: string;
  let worktreeId: string;
  beforeEach(() => {
    vi.clearAllMocks();
    directory = mkdtempSync(join(tmpdir(), 'koda-codex-unit-'));
    databasePath = join(directory, 'state.db');
    initDbWithMigrations(databasePath);
    const repoId = randomUUID();
    worktreeId = randomUUID();
    getDb().insert(repos).values({ id: repoId, rootPath: directory }).run();
    getDb().insert(worktrees).values({ id: worktreeId, repoId, worktreePath: directory }).run();
    const thread = { id: null, runStreamed: mocks.runStreamed };
    mocks.startThread.mockReturnValue(thread);
    mocks.resumeThread.mockReturnValue(thread);
    mocks.runStreamed.mockImplementation(async () => ({ events: success() }));
    handler = new CodexHandler();
  });
  afterEach(() => {
    handler.cleanup();
    resetDb();
    rmSync(directory, { recursive: true, force: true });
    vi.restoreAllMocks();
  });

  it('requires a worktree and defaults to installed Codex configuration with workspace-write', async () => {
    expect(StartSessionSchema.safeParse({}).success).toBe(false);
    const session = await handler.startSession({ worktreeId });
    expect(session.model).toBe('default');
    expect(mocks.startThread).toHaveBeenCalledWith(expect.objectContaining({ sandboxMode: 'workspace-write', approvalPolicy: 'never' }));
    expect(mocks.startThread.mock.calls[0][0]).not.toHaveProperty('model');
    expect(getDb().select().from(sessions).get()?.id).toBe(session.id);
  });

  it('rejects a cwd outside the selected worktree', async () => {
    await expect(handler.startSession({ worktreeId, workingDirectory: '/' })).rejects.toThrow('must match');
  });

  it('persists streaming user, tool and text events and emits them live', async () => {
    const emit = vi.spyOn(getNotificationEmitter(), 'emitMessage');
    const session = await handler.startSession({ worktreeId });
    const response = await handler.sendMessage({ sessionId: session.id, message: 'Say hello' });
    expect(response.response).toBe('Hello world');
    expect(response.usage).toEqual({ inputTokens: 100, cachedInputTokens: 50, outputTokens: 20 });
    const messages = handler.getMessages({ sessionId: session.id });
    expect(messages.map(message => message.event.type)).toEqual(['user', 'tool_use', 'tool_result', 'text_delta', 'text_delta', 'result']);
    expect(messages.filter(message => message.event.type === 'text_delta').map(message => message.event.text).join('')).toBe('Hello world');
    expect(emit.mock.calls.map(call => call[1])).toEqual(messages.map(message => message.event));
    expect(handler.getMessages({ sessionId: session.id, fromIndex: 4 })).toHaveLength(2);
    expect((await handler.getSession({ sessionId: session.id })).status).toBe('idle');
  });

  it('reopens the database and resumes the original SDK thread with its history intact', async () => {
    const session = await handler.startSession({ worktreeId, model: 'test-model' });
    await handler.sendMessage({ sessionId: session.id, message: 'First turn' });
    const before = handler.getMessages({ sessionId: session.id });
    handler.cleanup();
    resetDb();
    initDbWithMigrations(databasePath);
    handler = new CodexHandler();
    const restored = (await handler.listSessions({ worktreeId }))[0];
    expect(restored.id).toBe(session.id);
    expect(restored.threadId).toBe('sdk-thread-1');
    expect(mocks.resumeThread).toHaveBeenCalledWith('sdk-thread-1', expect.objectContaining({ model: 'test-model' }));
    expect(handler.getMessages({ sessionId: session.id })).toEqual(before);
    await handler.sendMessage({ sessionId: session.id, message: 'Continue' });
    expect(handler.getMessages({ sessionId: session.id })).toHaveLength(before.length * 2);
  });

  it('persists a session that has not sent a first turn yet', async () => {
    const session = await handler.startSession({ worktreeId });
    handler.cleanup();
    handler = new CodexHandler();
    expect((await handler.getSession({ sessionId: session.id })).id).toBe(session.id);
    expect(mocks.resumeThread).not.toHaveBeenCalled();
  });

  it('changes the selected model on the existing thread and persists the choice', async () => {
    const session = await handler.startSession({ worktreeId, model: 'model-a' });
    await handler.sendMessage({ sessionId: session.id, message: 'First' });
    await handler.sendMessage({ sessionId: session.id, message: 'Next', model: 'model-b' });
    expect(mocks.resumeThread).toHaveBeenCalledWith('sdk-thread-1', expect.objectContaining({ model: 'model-b' }));
    handler.cleanup();
    handler = new CodexHandler();
    expect((await handler.getSession({ sessionId: session.id })).model).toBe('model-b');
  });

  it('preserves a relay sender in the durable user event', async () => {
    const session = await handler.startSession({ worktreeId });
    await handler.sendMessage({ sessionId: session.id, message: 'Remote task', authorName: 'User B', authorMachineId: 'machine-b' });
    expect(handler.getMessages({ sessionId: session.id })[0].event).toMatchObject({
      type: 'user', authorName: 'User B', authorMachineId: 'machine-b', message: { content: 'Remote task' },
    });
  });

  it('starts a background stream promptly and rejects concurrent local or relay turns', async () => {
    let release!: () => void;
    const gate = new Promise<void>(resolve => { release = resolve; });
    mocks.runStreamed.mockImplementation(async () => ({ events: (async function* () { await gate; yield* success(); })() }));
    const session = await handler.startSession({ worktreeId });
    const accepted = handler.startTurn({ sessionId: session.id, message: 'First' });
    expect(accepted.status).toBe('running');
    expect((await handler.getSession({ sessionId: session.id })).status).toBe('running');
    expect(() => handler.startTurn({ sessionId: session.id, message: 'Racing' })).toThrow('already running');
    release();
    await vi.waitFor(async () => expect((await handler.getSession({ sessionId: session.id })).status).toBe('idle'));
  });

  it('cancels the actual SDK request and allows a later turn', async () => {
    let signal!: AbortSignal;
    mocks.runStreamed.mockImplementationOnce(async (_message, options) => {
      signal = options.signal;
      return { events: (async function* () {
        await new Promise((_resolve, reject) => signal.addEventListener('abort', () => reject(new Error('aborted')), { once: true }));
      })() };
    });
    const session = await handler.startSession({ worktreeId });
    const pending = handler.sendMessage({ sessionId: session.id, message: 'Long task' });
    const rejected = expect(pending).rejects.toThrow('aborted');
    await new Promise(resolve => setImmediate(resolve));
    await handler.cancelSession({ sessionId: session.id });
    await rejected;
    expect(signal.aborted).toBe(true);
    expect((await handler.getSession({ sessionId: session.id })).status).toBe('cancelled');
    await handler.sendMessage({ sessionId: session.id, message: 'Try again' });
    expect((await handler.getSession({ sessionId: session.id })).status).toBe('idle');
  });

  it('records failed turns and recovers idle state without inventing completion', async () => {
    mocks.runStreamed.mockImplementationOnce(async () => ({ events: (async function* () { yield { type: 'turn.failed', error: { message: 'provider unavailable' } }; })() }));
    const session = await handler.startSession({ worktreeId });
    await expect(handler.sendMessage({ sessionId: session.id, message: 'Task' })).rejects.toThrow('provider unavailable');
    const events = handler.getMessages({ sessionId: session.id }).map(message => message.event);
    expect(events.at(-1)).toMatchObject({ type: 'error', error: 'provider unavailable' });
    expect(events.some(event => event.type === 'result')).toBe(false);
    expect((await handler.getSession({ sessionId: session.id })).status).toBe('idle');
  });

  it('recovers stale running state after process restart', async () => {
    const session = await handler.startSession({ worktreeId });
    getDb().update(sessions).set({ status: 'running' }).where(eq(sessions.id, session.id)).run();
    handler.cleanup();
    handler = new CodexHandler();
    expect((await handler.getSession({ sessionId: session.id })).status).toBe('idle');
  });
});
