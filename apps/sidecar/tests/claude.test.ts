/** Test the current SDK adapter at its SDK boundary, never a real CLI process. */
import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest';
import { ClaudeHandler, ClaudeStartParamsSchema, ClaudeResumeParamsSchema, ClaudeCancelParamsSchema } from '../src/agents/claude.js';
import { getNotificationEmitter } from '../src/rpc/notifications.js';

const sdk = vi.hoisted(() => ({ query: vi.fn() }));
vi.mock('@anthropic-ai/claude-agent-sdk', () => ({ query: sdk.query }));
vi.mock('../src/mcp/kodaMCPServer.js', () => ({ createKodaMCPServer: vi.fn(() => ({ type: 'sdk', name: 'koda', instance: {} })) }));

function fakeQuery(events: unknown[] = []) {
  return Object.assign((async function* () { for (const event of events) yield event; })(), {
    setModel: vi.fn(), setPermissionMode: vi.fn(), setMaxThinkingTokens: vi.fn(),
  });
}

describe('Claude SDK adapter', () => {
  let handler: ClaudeHandler;
  beforeEach(() => {
    sdk.query.mockReset();
    sdk.query.mockImplementation(() => fakeQuery());
    handler = new ClaudeHandler();
  });
  afterEach(async () => { await handler.dispose(); vi.restoreAllMocks(); vi.unstubAllEnvs(); });

  it('validates requests before invoking the SDK', () => {
    expect(ClaudeStartParamsSchema.safeParse({ workspaceId: 'worktree', prompt: 'Hello' }).success).toBe(true);
    expect(ClaudeStartParamsSchema.safeParse({ workspaceId: 'worktree', prompt: '' }).success).toBe(false);
    expect(ClaudeStartParamsSchema.safeParse({ prompt: 'Hello' }).success).toBe(false);
    expect(ClaudeResumeParamsSchema.safeParse({ sessionId: 'session' }).success).toBe(true);
    expect(ClaudeCancelParamsSchema.safeParse({}).success).toBe(false);
  });

  it('configures workspace, model and streaming without API key inheritance', async () => {
    vi.stubEnv('ANTHROPIC_API_KEY', 'test-secret-never-sent');
    vi.stubEnv('OPENAI_API_KEY', 'test-secret-never-sent');
    const result = await handler.start({ workspaceId: 'worktree', prompt: 'Hello', options: { model: 'test-model', workingDirectory: '/tmp', allowedTools: ['Read'] } });
    const request = sdk.query.mock.calls[0][0];
    expect(result.sessionId).toBeTruthy();
    expect(request.options).toMatchObject({ cwd: '/tmp', model: 'test-model', includePartialMessages: true, allowedTools: ['Read'] });
    expect(request.options.env.ANTHROPIC_API_KEY).toBeUndefined();
    expect(request.options.env.OPENAI_API_KEY).toBeUndefined();
    expect(request.options.permissionMode).toBeUndefined();
    const prompt = await request.prompt.next();
    expect(prompt.value.message.content).toBe('Hello');
  });

  it('enables permission bypass only when explicitly requested', async () => {
    await handler.start({ workspaceId: 'worktree', prompt: 'Hello', options: { dangerouslySkipPermissions: true } });
    expect(sdk.query.mock.calls[0][0].options).toMatchObject({ permissionMode: 'bypassPermissions', allowDangerouslySkipPermissions: true });
  });

  it('reuses the multi-turn input stream for follow-up messages', async () => {
    const started = await handler.start({ workspaceId: 'worktree', prompt: 'First' });
    const prompt = sdk.query.mock.calls[0][0].prompt;
    expect((await prompt.next()).value.message.content).toBe('First');
    const continued = handler.continue({ sessionId: started.sessionId, prompt: 'Second' });
    expect((await prompt.next()).value.message.content).toBe('Second');
    await continued;
    expect(sdk.query).toHaveBeenCalledTimes(1);
  });

  it('normalizes stream deltas, persists its polling buffer, and reports token usage', async () => {
    const emit = vi.spyOn(getNotificationEmitter(), 'emitMessage');
    sdk.query.mockReturnValueOnce(fakeQuery([
      { type: 'stream_event', event: { type: 'content_block_delta', delta: { type: 'text_delta', text: 'Hello' } } },
      { type: 'result', result: 'Hello', session_id: 'sdk-id', usage: { input_tokens: 12, output_tokens: 7 } },
    ]));
    const started = await handler.start({ workspaceId: 'worktree', prompt: 'Task' });
    await vi.waitFor(() => expect(handler.getSession(started.sessionId)?.status).toBe('completed'));
    expect(handler.getMessages(started.sessionId).map(message => message.event.type)).toEqual(['text_delta', 'result']);
    expect(emit).toHaveBeenCalledWith(started.sessionId, { type: 'text_delta', text: 'Hello' });
    expect(handler.getSession(started.sessionId)?.contextTokenCount).toBe(19);
    expect(handler.getMessages(started.sessionId, 1)).toHaveLength(1);
  });

  it('aborts the SDK query when cancelled', async () => {
    const started = await handler.start({ workspaceId: 'worktree', prompt: 'Task' });
    const controller = sdk.query.mock.calls[0][0].options.abortController;
    await handler.cancel({ sessionId: started.sessionId });
    expect(controller.signal.aborted).toBe(true);
    expect(handler.getSession(started.sessionId)?.status).toBe('cancelled');
  });

  it('forwards selected model and settings to a running query', async () => {
    const query = fakeQuery();
    sdk.query.mockReturnValueOnce(query);
    const started = await handler.start({ workspaceId: 'worktree', prompt: 'Task' });
    await handler.updateSettings(started.sessionId, { model: 'new-model', permissionMode: 'plan', maxThinkingTokens: 100 });
    expect(query.setModel).toHaveBeenCalledWith('new-model');
    expect(query.setPermissionMode).toHaveBeenCalledWith('plan');
    expect(query.setMaxThinkingTokens).toHaveBeenCalledWith(100);
  });

  it('reports SDK stream failures as errors rather than completion', async () => {
    sdk.query.mockReturnValueOnce((async function* () { throw new Error('test provider failure'); })());
    const errors: string[] = [];
    handler.on('error', message => errors.push(message));
    const started = await handler.start({ workspaceId: 'worktree', prompt: 'Task' });
    await vi.waitFor(() => expect(handler.getSession(started.sessionId)?.status).toBe('error'));
    expect(errors).toEqual(['test provider failure']);
  });

  it('rejects requests for missing sessions', async () => {
    expect(handler.getSession('missing')).toBeNull();
    await expect(handler.resume({ sessionId: 'missing' })).rejects.toThrow('Session not found');
    await expect(handler.cancel({ sessionId: 'missing' })).rejects.toThrow('Session not found');
    await expect(handler.continue({ sessionId: 'missing', prompt: 'Task' })).rejects.toThrow('Session not found');
  });
});
