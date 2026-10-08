/** Use the user's installed Claude CLI through the official SDK. */
import { accessSync, constants } from 'node:fs';
import { delimiter, join } from 'node:path';
import { execFile } from 'node:child_process';
import { query } from '@anthropic-ai/claude-agent-sdk';

export function resolveClaudePath(): string {
  const override = process.env.KODA_CLAUDE_PATH;
  if (override) {
    try { accessSync(override, constants.X_OK); return override; }
    catch { throw new Error('KODA_CLAUDE_PATH is not an executable. Select an installed Claude CLI.'); }
  }
  const executable = process.platform === 'win32' ? 'claude.exe' : 'claude';
  for (const directory of (process.env.PATH ?? '').split(delimiter)) {
    if (!directory) continue;
    const candidate = join(directory, executable);
    try { accessSync(candidate, constants.X_OK); return candidate; } catch { /* try next */ }
  }
  throw new Error('Install Claude Code, sign in with claude auth login, and add it to PATH or set KODA_CLAUDE_PATH.');
}

export interface ClaudeStatus {
  available: boolean;
  authenticated: boolean;
  authMethod: string | null;
  subscriptionType: string | null;
  error?: string;
}

/** Ask the official CLI; never read, return, or copy credential files. */
export async function getClaudeStatus(): Promise<ClaudeStatus> {
  let executable: string;
  try { executable = resolveClaudePath(); }
  catch (error) { return { available: false, authenticated: false, authMethod: null, subscriptionType: null, error: (error as Error).message }; }
  return new Promise(resolve => {
    execFile(executable, ['auth', 'status', '--json'], { timeout: 10_000, maxBuffer: 128_000 }, (_error, stdout) => {
      try {
        const status = JSON.parse(stdout) as Record<string, unknown>;
        resolve({ available: true, authenticated: status.loggedIn === true,
          authMethod: typeof status.authMethod === 'string' ? status.authMethod : null,
          subscriptionType: typeof status.subscriptionType === 'string' ? status.subscriptionType : null,
          ...(status.loggedIn === true ? {} : { error: 'Claude is not signed in. Run claude auth login, then try again.' }) });
      } catch {
        resolve({ available: true, authenticated: false, authMethod: null, subscriptionType: null,
          error: 'Could not check Claude login. Run claude auth status with the installed CLI.' });
      }
    });
  });
}

export interface ClaudeModel {
  id: string; model: string; displayName: string; description: string; isDefault: boolean;
}
let cached: { executable: string; expiresAt: number; models: ClaudeModel[] } | undefined;
let pending: Promise<ClaudeModel[]> | undefined;
export async function listClaudeModels(): Promise<ClaudeModel[]> {
  const executable = resolveClaudePath();
  if (cached?.executable === executable && cached.expiresAt > Date.now()) return cached.models;
  if (pending) return pending;
  pending = discoverModels(executable);
  try {
    const models = await pending;
    cached = { executable, expiresAt: Date.now() + 60_000, models };
    return models;
  } finally { pending = undefined; }
}

async function discoverModels(executable: string): Promise<ClaudeModel[]> {
  const controller = new AbortController();
  // Keep input open for the SDK initialization/control exchange, but never send
  // a prompt or make a model inference merely to populate the picker.
  async function* input(): AsyncGenerator<never> {
    await new Promise<void>(resolve => {
      if (controller.signal.aborted) resolve();
      else controller.signal.addEventListener('abort', () => resolve(), { once: true });
    });
  }
  const sdk = query({ prompt: input(), options: {
    pathToClaudeCodeExecutable: executable, abortController: controller,
    persistSession: false, settingSources: ['user'], tools: [],
  } });
  let timeout: ReturnType<typeof setTimeout> | undefined;
  try {
    const models = await Promise.race([
      sdk.supportedModels(),
      new Promise<never>((_, reject) => { timeout = setTimeout(() => reject(new Error('Claude model discovery timed out. Check the installed CLI login and connection.')), 15_000); }),
    ]);
    return models.map(model => ({ id: model.value, model: model.value,
      displayName: model.displayName, description: model.description, isDefault: model.value === 'default' }));
  } finally {
    if (timeout) clearTimeout(timeout);
    controller.abort();
    sdk.close();
  }
}
