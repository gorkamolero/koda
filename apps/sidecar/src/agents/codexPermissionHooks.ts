/** The user's own Codex PermissionRequest hooks, run by Koda next to its approval card. */
import { spawn, type ChildProcessWithoutNullStreams } from 'node:child_process';
import type { CodexAppServer } from './codexTransport.js';

type Wire = Record<string, any>;

export interface PermissionHook { key: string; command: string; timeoutSec: number; matcher: string | null }

/**
 * Codex runs a PermissionRequest hook before asking the client and waits for it,
 * so an approval app's hook (Vibe Island's waits two hours) would hold every
 * request where Koda never sees it. Koda takes over the user's own command hooks
 * for its chats: they are switched off inside Codex and Koda runs them itself,
 * next to its own card, with the input Codex would give them. The first decision
 * wins, as with Claude. Managed hooks and hooks of other kinds stay with Codex.
 */
export async function listUserPermissionHooks(server: Pick<CodexAppServer, 'request'>, cwd: string): Promise<PermissionHook[]> {
  let listed: Wire | undefined;
  try { listed = await server.request('hooks/list', { cwds: [cwd] }); } catch { return []; }
  return (Array.isArray(listed?.data) ? listed.data : []).flatMap((entry: Wire) => Array.isArray(entry.hooks) ? entry.hooks : [])
    .filter((hook: Wire) => hook.eventName === 'permissionRequest' && hook.handlerType === 'command' && !hook.isManaged
      && hook.enabled !== false && hook.trustStatus === 'trusted' && typeof hook.key === 'string' && typeof hook.command === 'string')
    .map((hook: Wire) => ({ key: hook.key, command: hook.command, timeoutSec: Number(hook.timeoutSec) || 600, matcher: typeof hook.matcher === 'string' && hook.matcher ? hook.matcher : null }));
}

export function permissionHookConfig(hooks: PermissionHook[]): { config?: Wire } {
  return hooks.length ? { config: { hooks: { state: Object.fromEntries(hooks.map(hook => [hook.key, { enabled: false }])) } } } : {};
}

function hookMatches(matcher: string | null, toolName: string): boolean {
  if (!matcher || matcher === '*') return true;
  try { return new RegExp(`^(?:${matcher})$`).test(toolName); } catch { return matcher === toolName; }
}

/** A hook's decision, read as Codex reads it: JSON on stdout, or exit status 2 to deny. */
function hookDecision(stdout: string, code: number | null): 'allow' | 'deny' | undefined {
  if (code === 2) return 'deny';
  if (code !== 0) return undefined;
  const last = stdout.trim().split('\n').filter(Boolean).at(-1);
  try {
    const behavior = last ? JSON.parse(last)?.hookSpecificOutput?.decision?.behavior : undefined;
    return behavior === 'allow' || behavior === 'deny' ? behavior : undefined;
  } catch { return undefined; }
}

/** Runs matching hooks concurrently; resolves with the first decision, or undefined if none decides. */
export function runPermissionHooks(hooks: PermissionHook[], input: Wire, signal: AbortSignal): Promise<'allow' | 'deny' | undefined> {
  const matching = hooks.filter(hook => hookMatches(hook.matcher, String(input.tool_name)));
  if (!matching.length || signal.aborted) return Promise.resolve(undefined);
  return new Promise(resolve => {
    const children: ChildProcessWithoutNullStreams[] = [];
    let open = matching.length;
    let settled = false;
    const stop = (child: ChildProcessWithoutNullStreams) => {
      if (child.exitCode !== null || child.signalCode !== null || !child.pid) return;
      try { process.kill(-child.pid, 'SIGTERM'); } catch { child.kill('SIGTERM'); }
    };
    const finish = (decision: 'allow' | 'deny' | undefined) => {
      if (settled) return;
      settled = true;
      signal.removeEventListener('abort', onAbort);
      children.forEach(stop);
      resolve(decision);
    };
    const onAbort = () => finish(undefined);
    signal.addEventListener('abort', onAbort, { once: true });
    for (const hook of matching) {
      const child = spawn('/bin/sh', ['-c', hook.command], { cwd: String(input.cwd), detached: true, stdio: ['pipe', 'pipe', 'pipe'] });
      children.push(child);
      let stdout = '';
      child.stdout.on('data', chunk => { stdout += chunk; });
      child.stderr.resume();
      child.stdin.on('error', () => {});
      const timer = setTimeout(() => stop(child), hook.timeoutSec * 1000);
      timer.unref?.();
      const done = (code: number | null) => {
        clearTimeout(timer);
        const decision = settled ? undefined : hookDecision(stdout, code);
        // The decision a hook printed, so an unrecognized answer can be diagnosed.
        console.log(`[Codex hooks] ${hook.key} exited ${code}${settled ? ' after the request was answered' : ''}; decision ${decision ?? 'none'}; output ${JSON.stringify(stdout.slice(0, 500))}`);
        if (decision) finish(decision);
        else if (--open === 0) finish(undefined);
      };
      child.once('error', () => done(null));
      child.once('close', done);
      child.stdin.end(JSON.stringify(input));
    }
  });
}
