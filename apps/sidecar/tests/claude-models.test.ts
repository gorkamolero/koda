import { afterEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({ query: vi.fn(), execFile: vi.fn() }));
vi.mock('@anthropic-ai/claude-agent-sdk', () => ({ query: mocks.query }));
vi.mock('node:child_process', () => ({ execFile: mocks.execFile }));
afterEach(() => { vi.unstubAllEnvs(); vi.clearAllMocks(); vi.resetModules(); });

describe('installed Claude discovery', () => {
  it('discovers live models without an inference prompt and closes its ephemeral SDK process', async () => {
    vi.stubEnv('KODA_CLAUDE_PATH', '/bin/sh');
    const close = vi.fn();
    const supportedModels = vi.fn().mockResolvedValue([{ value: 'sonnet', displayName: 'Live Sonnet', description: 'Current model' }]);
    mocks.query.mockReturnValue({ close, supportedModels });
    const { listClaudeModels } = await import('../src/agents/claudeModels.js');
    const models = await listClaudeModels();
    expect(models).toEqual([{ id: 'sonnet', model: 'sonnet', displayName: 'Live Sonnet', description: 'Current model', isDefault: false }]);
    expect(mocks.query.mock.calls[0][0].options).toMatchObject({ pathToClaudeCodeExecutable: '/bin/sh', persistSession: false, tools: [] });
    expect(typeof mocks.query.mock.calls[0][0].prompt).not.toBe('string');
    expect(close).toHaveBeenCalledOnce();
    expect(mocks.query.mock.calls[0][0].options.abortController.signal.aborted).toBe(true);
    expect(await listClaudeModels()).toEqual(models);
    expect(supportedModels).toHaveBeenCalledOnce();
  });

  it('returns only public auth status fields from the official CLI response', async () => {
    vi.stubEnv('KODA_CLAUDE_PATH', '/bin/sh');
    mocks.execFile.mockImplementation((_path, _args, _options, callback) => callback(null, JSON.stringify({ loggedIn: true, authMethod: 'claude.ai', subscriptionType: 'max', email: 'private@example.invalid', credential: 'not-for-clients' })));
    const { getClaudeStatus } = await import('../src/agents/claudeModels.js');
    expect(await getClaudeStatus()).toEqual({ available: true, authenticated: true, authMethod: 'claude.ai', subscriptionType: 'max' });
    expect(mocks.execFile.mock.calls[0][1]).toEqual(['auth', 'status', '--json']);
  });

  it('does not claim authentication when the CLI status is unreadable', async () => {
    vi.stubEnv('KODA_CLAUDE_PATH', '/bin/sh');
    mocks.execFile.mockImplementation((_path, _args, _options, callback) => callback(new Error('failure'), ''));
    const { getClaudeStatus } = await import('../src/agents/claudeModels.js');
    expect(await getClaudeStatus()).toMatchObject({ available: true, authenticated: false, error: expect.stringContaining('Could not check') });
  });

  it('requires an installed executable and never falls back to SDK vendor binaries', async () => {
    vi.stubEnv('KODA_CLAUDE_PATH', '/does-not-exist/claude');
    const { resolveClaudePath, getClaudeStatus } = await import('../src/agents/claudeModels.js');
    expect(resolveClaudePath).toThrow('not an executable');
    expect(await getClaudeStatus()).toMatchObject({ available: false, authenticated: false });
    expect(mocks.query).not.toHaveBeenCalled();
  });
});
