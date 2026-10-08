import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { existsSync, mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { listUserPermissionHooks, permissionHookConfig, runPermissionHooks, type PermissionHook } from '../src/agents/codexPermissionHooks.js';

let directory: string;
beforeAll(() => { directory = mkdtempSync(join(tmpdir(), 'koda-permission-hooks-')); });
afterAll(() => { rmSync(directory, { recursive: true, force: true }); });

const hook = (command: string, overrides: Partial<PermissionHook> = {}): PermissionHook => ({ key: 'user:permission_request:0:0', command, timeoutSec: 30, matcher: null, ...overrides });
const input = () => ({ session_id: 'thread-1', turn_id: 'turn-1', cwd: directory, hook_event_name: 'PermissionRequest', tool_name: 'Bash', tool_input: { command: 'touch /elsewhere' } });
const allow = `printf '%s\\n' '{"hookSpecificOutput":{"hookEventName":"PermissionRequest","decision":{"behavior":"allow"}}}'`;
const neverAborted = () => new AbortController().signal;

describe("the user's Codex permission hooks", () => {
  it('lists only enabled, trusted, unmanaged command hooks for permission requests', async () => {
    const server = { request: async () => ({ data: [{ cwd: directory, hooks: [
      { key: 'mine', eventName: 'permissionRequest', handlerType: 'command', command: 'vibe-island-bridge --source codex', isManaged: false, enabled: true, trustStatus: 'trusted', timeoutSec: 7200, matcher: null },
      { key: 'managed', eventName: 'permissionRequest', handlerType: 'command', command: 'policy', isManaged: true, enabled: true, trustStatus: 'managed' },
      { key: 'untrusted', eventName: 'permissionRequest', handlerType: 'command', command: 'repo', isManaged: false, enabled: true, trustStatus: 'untrusted' },
      { key: 'prompt', eventName: 'permissionRequest', handlerType: 'prompt', isManaged: false, enabled: true, trustStatus: 'trusted' },
      { key: 'guard', eventName: 'preToolUse', handlerType: 'command', command: 'guard', isManaged: false, enabled: true, trustStatus: 'trusted' },
    ] }] }) } as never;
    const hooks = await listUserPermissionHooks(server, directory);
    expect(hooks).toEqual([{ key: 'mine', command: 'vibe-island-bridge --source codex', timeoutSec: 7200, matcher: null }]);
    expect(permissionHookConfig(hooks)).toEqual({ config: { hooks: { state: { mine: { enabled: false } } } } });
    expect(permissionHookConfig([])).toEqual({});
  });

  it('gives a hook the input Codex would and reads its decision', async () => {
    const received = join(directory, 'received.json');
    expect(await runPermissionHooks([hook(`cat > '${received}'; ${allow}`)], input(), neverAborted())).toBe('allow');
    expect(JSON.parse(readFileSync(received, 'utf8'))).toEqual(input());
    expect(await runPermissionHooks([hook('exit 2')], input(), neverAborted())).toBe('deny');
    expect(await runPermissionHooks([hook('true')], input(), neverAborted())).toBeUndefined();
  });

  it('skips hooks whose matcher names another tool', async () => {
    expect(await runPermissionHooks([hook(allow, { matcher: 'apply_patch' })], input(), neverAborted())).toBeUndefined();
    expect(await runPermissionHooks([hook(allow, { matcher: 'Bash|apply_patch' })], input(), neverAborted())).toBe('allow');
  });

  it('stops a waiting hook when Koda answers first', async () => {
    const late = join(directory, 'late');
    const controller = new AbortController();
    const decision = runPermissionHooks([hook(`sleep 2; touch '${late}'`)], input(), controller.signal);
    setTimeout(() => controller.abort(), 200);
    expect(await decision).toBeUndefined();
    await new Promise(resolve => setTimeout(resolve, 2500));
    expect(existsSync(late)).toBe(false);
  });

  it("stops a hook at its configured timeout", async () => {
    const started = Date.now();
    expect(await runPermissionHooks([hook('sleep 5', { timeoutSec: 0.3 })], input(), neverAborted())).toBeUndefined();
    expect(Date.now() - started).toBeLessThan(3000);
  });
});
