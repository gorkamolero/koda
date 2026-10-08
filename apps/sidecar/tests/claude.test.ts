import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { randomUUID } from 'node:crypto';
import { eq } from 'drizzle-orm';
import { ClaudeHandler, ClaudeStartParamsSchema, ClaudeUpdateSettingsParamsSchema, claudeToolPermissions } from '../src/agents/claude.js';
import { ApprovalBroker } from '../src/agents/approvalBroker.js';
import { QuestionBroker } from '../src/agents/questionBroker.js';
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
const questionInput = () => ({ questions: [
  { header: 'Color', question: 'Which color?', options: [{ label: 'Blue', description: 'Cool' }, { label: 'Red', description: 'Warm' }], multiSelect: false },
  { header: 'Features', question: 'Which features?', options: [{ label: 'Search' }, { label: 'Export' }], multiSelect: true },
] });
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
  let approvals: ApprovalBroker;
  let questions: QuestionBroker;
  beforeEach(() => {
    vi.clearAllMocks();
    directory = mkdtempSync(join(tmpdir(), 'koda-claude-unit-'));
    databasePath = join(directory, 'state.db');
    initDbWithMigrations(databasePath);
    const repoId = randomUUID(); worktreeId = randomUUID();
    getDb().insert(repos).values({ id: repoId, rootPath: directory }).run();
    getDb().insert(worktrees).values({ id: worktreeId, repoId, worktreePath: directory }).run();
    mocks.query.mockImplementation(() => fakeQuery());
    approvals = new ApprovalBroker({ notify: () => {} });
    questions = new QuestionBroker({ notify: () => {} });
    handler = new ClaudeHandler(approvals, questions);
  });
  afterEach(async () => { approvals.dispose(); questions.dispose(); await handler.dispose(); resetDb(); rmSync(directory, { recursive: true, force: true }); vi.restoreAllMocks(); vi.useRealTimers(); });

  it('creates an idle persisted session and uses CLI defaults without changing auth', async () => {
    expect(ClaudeStartParamsSchema.safeParse({}).success).toBe(false);
    const session = await handler.start({ worktreeId });
    expect(session).toMatchObject({ model: 'default', status: 'idle', agentType: 'claude', threadId: null });
    expect(mocks.query).not.toHaveBeenCalled();
    await handler.send({ sessionId: session.id, message: 'Task' });
    const options = mocks.query.mock.calls[0][0].options;
    expect(options).toMatchObject({ pathToClaudeCodeExecutable: '/trusted/claude', includePartialMessages: true, persistSession: true,
      permissionMode: 'default', settingSources: ['user', 'project', 'local'], sandbox: { enabled: true, failIfUnavailable: true, allowUnsandboxedCommands: true } });
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

  it('queues every SDK permission ask, including workspace operations and unsandboxed retries', async () => {
    const session = await handler.start({ worktreeId });
    const permissions = claudeToolPermissions(session.id, new AbortController().signal, approvals);
    const options = { signal: new AbortController().signal, toolUseID: 'tool-1', requestId: 'request-1',
      matchedAskRule: { source: 'user', toolName: 'Write' }, title: 'Claude wants to change a file', blockedPath: '/outside/file.txt' };
    for (const [tool, input] of [
      ['Write', { file_path: join(directory, 'new/file.txt'), content: 'Inside' }],
      ['Edit', { file_path: '/outside/file.txt', old_string: '', new_string: 'Outside' }],
      ['Bash', { command: 'pwd' }],
      ['Bash', { command: 'pwd', dangerouslyDisableSandbox: true }],
      ['ExitPlanMode', {}],
    ] as const) {
      const result = permissions(tool, input, options);
      const [pending] = approvals.list(session.id);
      expect(pending).toMatchObject({ agentType: 'claude', toolName: tool, input, toolUseId: 'tool-1' });
      expect(pending.reason).toContain('Claude wants to change a file');
      approvals.respond({ sessionId: session.id, approvalId: pending.id, decision: 'allow' });
      expect(await result).toEqual({ behavior: 'allow', updatedInput: input, toolUseID: 'tool-1' });
    }
  });

  it('passes denial and SDK cancellation back to the exact tool call', async () => {
    const session = await handler.start({ worktreeId });
    const permissions = claudeToolPermissions(session.id, new AbortController().signal, approvals);
    const controller = new AbortController();
    const options = { signal: controller.signal, toolUseID: 'tool-1', requestId: 'request-1' };
    const denied = permissions('Write', { file_path: '/outside/file.txt' }, options);
    approvals.respond({ sessionId: session.id, approvalId: approvals.list()[0].id, decision: 'deny' });
    expect(await denied).toMatchObject({ behavior: 'deny', message: 'Denied by user', toolUseID: 'tool-1' });
    const aborted = permissions('Write', { file_path: '/outside/file.txt' }, options);
    controller.abort();
    expect(await aborted).toMatchObject({ behavior: 'deny', toolUseID: 'tool-1' });
    expect(approvals.list()).toEqual([]);
  });

  it('rejects malformed or ambiguous Claude questions without stranding an input request', async () => {
    const permissions = claudeToolPermissions(randomUUID(), new AbortController().signal, approvals, questions);
    for (const input of [{ questions: [{ question: 'Missing choices' }] },
      { questions: [questionInput().questions[0], questionInput().questions[0]] }]) {
      expect(await permissions('AskUserQuestion', input, { signal: new AbortController().signal, toolUseID: 'question-1' }))
        .toMatchObject({ behavior: 'deny', interrupt: true, message: expect.stringContaining('Invalid question form') });
    }
    expect(questions.list()).toEqual([]); expect(approvals.list()).toEqual([]);
  });

  it.each(['default', 'bypassPermissions'] as const)('awaits structured answers in %s mode and keeps raw questions/answers out of shared events', async permissionMode => {
    const input = questionInput();
    let answer: unknown;
    mocks.query.mockImplementationOnce(({ options }) => Object.assign((async function* () {
      yield assistant('question', [{ type: 'tool_use', id: 'question-tool', name: 'AskUserQuestion', input }]);
      answer = await options.canUseTool('AskUserQuestion', input, { signal: new AbortController().signal, toolUseID: 'question-tool' });
      yield { type: 'user', message: { content: [{ type: 'tool_result', tool_use_id: 'question-tool', content: 'Private structured answers' }] } };
      yield assistant('reply', [{ type: 'text', text: 'Ordinary final reply' }]);
      yield result;
    })(), { close: vi.fn() }));
    const session = await handler.start({ worktreeId, permissionMode });
    const running = handler.send({ sessionId: session.id, message: 'Ask me' });
    await vi.waitFor(() => expect(questions.list()).toHaveLength(1));
    const [request] = questions.list();
    expect(request).toMatchObject({ sessionId: session.id, agentType: 'claude', toolUseId: 'question-tool', questions: [
      { id: 'q1', allowOther: true, multiSelect: false }, { id: 'q2', allowOther: true, multiSelect: true },
    ] });
    expect(handler.getSession(session.id).status).toBe('running');
    expect(approvals.list()).toEqual([]);
    // SDK input mutation must not alter the pending form or its answer keys.
    input.questions[0].question = 'Mutated question';
    questions.respond({ sessionId: session.id, requestId: request.id, decision: 'submit', answers: {
      q1: { selected: [], text: 'Green' }, q2: { selected: ['Search', 'Export'], text: 'Import' },
    } });
    await running;
    expect(answer).toMatchObject({ behavior: 'allow', toolUseID: 'question-tool', updatedInput: {
      questions: questionInput().questions, answers: { 'Which color?': 'Green', 'Which features?': 'Search, Export, Import' },
    } });
    expect(handler.getMessages(session.id).map(message => message.event.type)).toEqual(['user', 'text_delta', 'result']);
    expect(JSON.stringify(handler.getMessages(session.id))).not.toContain('Private structured answers');
    expect(questions.list()).toEqual([]);
  });

  it.each(['cancel', 'expiry'] as const)('stops the owning Claude turn once when a question ends by %s', async action => {
    questions.dispose();
    questions = new QuestionBroker({ timeoutMs: 20, notify: () => {} });
    handler = new ClaudeHandler(approvals, questions);
    let decision: unknown;
    mocks.query.mockImplementationOnce(({ options }) => Object.assign((async function* () {
      decision = await options.canUseTool('AskUserQuestion', questionInput(), { signal: new AbortController().signal, toolUseID: 'question-tool' });
      yield result;
    })(), { close: vi.fn() }));
    const session = await handler.start({ worktreeId });
    const running = handler.send({ sessionId: session.id, message: 'Ask me' });
    const [request] = questions.list();
    if (action === 'cancel') questions.respond({ sessionId: session.id, requestId: request.id, decision: 'cancel' });
    await running;
    expect(decision).toMatchObject({ behavior: 'deny' });
    expect(handler.getSession(session.id).status).toBe('cancelled');
    expect(handler.getMessages(session.id).filter(message => message.event.type === 'result')).toHaveLength(1);
    expect(handler.getMessages(session.id).at(-1)?.event).toMatchObject({ cancelled: true });
    expect(questions.list()).toEqual([]);
    await expect(handler.updateSettings(session.id, { permissionMode: 'bypassPermissions' })).resolves.toMatchObject({ permissionMode: 'bypassPermissions' });
  });

  it('withdraws the provider question without stopping its owning turn or accepting a stale answer', async () => {
    const turn = new AbortController(), providerRequest = new AbortController(), cancel = vi.fn();
    const sessionId = randomUUID();
    const permissions = claudeToolPermissions(sessionId, turn.signal, approvals, questions, cancel);
    const pending = permissions('AskUserQuestion', questionInput(), { signal: providerRequest.signal, toolUseID: 'question-tool' });
    const [request] = questions.list();
    providerRequest.abort();
    expect(await pending).toMatchObject({ behavior: 'deny', message: 'Question request withdrawn' });
    expect(cancel).not.toHaveBeenCalled(); expect(turn.signal.aborted).toBe(false); expect(questions.list()).toEqual([]);
    expect(() => questions.respond({ sessionId, requestId: request.id, decision: 'submit', answers: {} })).toThrow('no longer pending');
  });

  it('preserves punctuation in original option labels and custom text when encoding SDK answers', async () => {
    const input = questionInput();
    input.questions[1].options[0].label = 'Search, everywhere';
    const sessionId = randomUUID();
    const permissions = claudeToolPermissions(sessionId, new AbortController().signal, approvals, questions);
    const pending = permissions('AskUserQuestion', input, { signal: new AbortController().signal, toolUseID: 'question-tool' });
    questions.respond({ sessionId, requestId: questions.list()[0].id, decision: 'submit', answers: {
      q1: { selected: ['Blue'] }, q2: { selected: ['Search, everywhere', 'Export'], text: 'Import, carefully' },
    } });
    expect(await pending).toMatchObject({ behavior: 'allow', updatedInput: { answers: {
      'Which color?': 'Blue', 'Which features?': 'Search, everywhere, Export, Import, carefully',
    } } });
  });

  it('honors a host cancellation that wins just before an external signal withdrawal', async () => {
    const providerRequest = new AbortController(), cancel = vi.fn(), sessionId = randomUUID();
    const permissions = claudeToolPermissions(sessionId, new AbortController().signal, approvals, questions, cancel);
    const pending = permissions('AskUserQuestion', questionInput(), { signal: providerRequest.signal, toolUseID: 'question-tool' });
    questions.respond({ sessionId, requestId: questions.list()[0].id, decision: 'cancel' });
    providerRequest.abort();
    expect(await pending).toMatchObject({ behavior: 'deny', message: 'Question cancelled by user' });
    expect(cancel).toHaveBeenCalledOnce();
  });

  it.each(['stop', 'shutdown'] as const)('cleans up pending Claude forms on %s', async action => {
    mocks.query.mockImplementationOnce(({ options }) => Object.assign((async function* () {
      await options.canUseTool('AskUserQuestion', questionInput(), { signal: new AbortController().signal, toolUseID: 'question-tool' });
      yield result;
    })(), { close: vi.fn() }));
    const session = await handler.start({ worktreeId });
    handler.startTurn({ sessionId: session.id, message: 'Ask me' });
    expect(questions.list()).toHaveLength(1);
    if (action === 'stop') await handler.cancel({ sessionId: session.id }); else await handler.dispose();
    expect(questions.list()).toEqual([]);
    expect(handler.getSession(session.id).status).toBe('cancelled');
  });

  it('persists explicit bypass settings per session across restart and can return to default', async () => {
    const session = await handler.start({ worktreeId, permissionMode: 'bypassPermissions' });
    const other = await handler.start({ worktreeId });
    expect(other.permissionMode).toBe('default');
    await handler.send({ sessionId: session.id, message: 'Full access task' });
    expect(mocks.query.mock.calls[0][0].options).toMatchObject({ permissionMode: 'bypassPermissions', allowDangerouslySkipPermissions: true, sandbox: { enabled: false } });
    expect(mocks.query.mock.calls[0][0].options.canUseTool).toBeTypeOf('function');
    await handler.dispose(); resetDb(); initDbWithMigrations(databasePath); handler = new ClaudeHandler(approvals);
    expect(handler.getSession(session.id).permissionMode).toBe('bypassPermissions');
    expect((await handler.updateSettings(session.id, { permissionMode: 'default' })).permissionMode).toBe('default');
    await handler.send({ sessionId: session.id, message: 'Restricted task' });
    const options = mocks.query.mock.calls[1][0].options;
    expect(options).toMatchObject({ permissionMode: 'default', sandbox: { enabled: true, allowUnsandboxedCommands: true } });
    expect(options).not.toHaveProperty('allowDangerouslySkipPermissions');
    getDb().update(sessions).set({ permissionMode: 'auto-approve' }).where(eq(sessions.id, session.id)).run();
    expect(handler.getSession(session.id).permissionMode).toBe('default');
    expect(ClaudeStartParamsSchema.safeParse({ worktreeId, permissionMode: 'auto-approve' }).success).toBe(false);
    expect(ClaudeUpdateSettingsParamsSchema.safeParse({ sessionId: session.id }).success).toBe(false);
  });

  it('keeps explicit asks in bypass mode and clears pending approvals when the turn stops', async () => {
    let response: unknown;
    mocks.query.mockImplementationOnce(({ options }) => Object.assign((async function* () {
      response = await options.canUseTool('Bash', { command: 'outside-task', dangerouslyDisableSandbox: true }, {
        signal: new AbortController().signal, toolUseID: 'ask-1', requestId: 'request-1', decisionReason: 'Explicit user ask rule',
      });
      yield result;
    })(), { close: vi.fn() }));
    const session = await handler.start({ worktreeId, permissionMode: 'bypassPermissions' });
    handler.startTurn({ sessionId: session.id, message: 'Task' });
    expect(approvals.list(session.id)).toHaveLength(1);
    const pending = approvals.list()[0];
    await expect(handler.updateSettings(session.id, { permissionMode: 'default' })).rejects.toThrow('Wait');
    await handler.cancel({ sessionId: session.id });
    await handler.dispose();
    expect(response).toMatchObject({ behavior: 'deny' });
    expect(approvals.list()).toEqual([]);
    expect(() => approvals.respond({ sessionId: session.id, approvalId: pending.id, decision: 'allow' })).toThrow('no longer pending');
  });

  it('removes a provider-withdrawn approval without treating it as a host rejection', async () => {
    const turn = new AbortController();
    const providerRequest = new AbortController();
    const canUseTool = claudeToolPermissions('session', turn.signal, approvals, questions);
    const pending = canUseTool('Bash', { command: 'fixture command', dangerouslyDisableSandbox: true }, {
      signal: providerRequest.signal, toolUseID: 'provider-tool',
    });
    const request = approvals.list()[0];
    // Claude can withdraw its SDK prompt when an existing PermissionRequest
    // hook resolves it. This is not a click on Koda's Deny button or Stop.
    providerRequest.abort();
    expect(await pending).toMatchObject({ behavior: 'deny', message: 'Tool request cancelled', toolUseID: 'provider-tool' });
    expect(approvals.list()).toEqual([]);
    expect(turn.signal.aborted).toBe(false);
    expect(questions.list()).toEqual([]);
    expect(() => approvals.respond({ sessionId: 'session', approvalId: request.id, decision: 'allow' })).toThrow('no longer pending');
  });

  it('waits for SDK teardown before Stop resolves so settings can save immediately afterward', async () => {
    let release!: () => void;
    const teardown = new Promise<void>(resolve => { release = resolve; });
    mocks.query.mockImplementationOnce(({ options }) => Object.assign((async function* () {
      await options.canUseTool('Write', { file_path: '/outside/file.txt' }, {
        signal: options.abortController.signal, toolUseID: 'ask-1', requestId: 'request-1',
      });
      await teardown;
      yield result;
    })(), { close: vi.fn() }));
    const session = await handler.start({ worktreeId });
    handler.startTurn({ sessionId: session.id, message: 'Task' });
    expect(approvals.list()).toHaveLength(1);
    let stopped = false;
    const cancel = handler.cancel({ sessionId: session.id }).then(() => { stopped = true; });
    try {
      await Promise.resolve();
      expect(stopped).toBe(false);
      expect(approvals.list()).toEqual([]);
      await expect(handler.updateSettings(session.id, { permissionMode: 'bypassPermissions' })).rejects.toThrow('Wait');
    } finally { release(); }
    await cancel;
    expect((await handler.updateSettings(session.id, { permissionMode: 'bypassPermissions' })).permissionMode).toBe('bypassPermissions');
    expect(handler.getSession(session.id).status).toBe('cancelled');
  });
});
