/** Discover models from the same Codex installation used to execute turns. */
import { accessSync, constants } from 'node:fs';
import { delimiter, join } from 'node:path';
import { spawn } from 'node:child_process';
import { createInterface } from 'node:readline';

export interface CodexModel {
  id: string;
  model: string;
  displayName: string;
  description: string;
  isDefault: boolean;
  defaultReasoningEffort?: string;
  supportedReasoningEfforts?: Array<{ reasoningEffort: string; description: string }>;
}

export function resolveCodexPath(): string {
  if (process.env.KODA_CODEX_PATH) {
    try { accessSync(process.env.KODA_CODEX_PATH, constants.X_OK); return process.env.KODA_CODEX_PATH; }
    catch { throw new Error('KODA_CODEX_PATH is not an executable. Select a trusted Codex installation; do not bypass macOS security warnings.'); }
  }
  const executable = process.platform === 'win32' ? 'codex.exe' : 'codex';
  for (const directory of (process.env.PATH ?? '').split(delimiter)) {
    const candidate = join(directory, executable);
    try { accessSync(candidate, constants.X_OK); return candidate; } catch { /* try next */ }
  }
  // Never fall back to the legacy SDK's bundled executable. macOS may reject
  // it, and its model/auth protocol can differ from the installed Codex app.
  throw new Error('Install and sign in to a trusted Codex CLI, add it to PATH, or set KODA_CODEX_PATH to its executable. Do not bypass macOS security warnings.');
}

let cached: { expiresAt: number; models: CodexModel[] } | undefined;
let pending: Promise<CodexModel[]> | undefined;
export async function listCodexModels(): Promise<CodexModel[]> {
  if (cached && cached.expiresAt > Date.now()) return cached.models;
  if (pending) return pending;
  pending = discoverModels();
  try {
    const models = await pending;
    cached = { expiresAt: Date.now() + 60_000, models };
    return models;
  } finally { pending = undefined; }
}

function discoverModels(): Promise<CodexModel[]> {
  return new Promise((resolve, reject) => {
    const child = spawn(resolveCodexPath(), ['app-server'], { stdio: ['pipe', 'pipe', 'pipe'] });
    const reader = createInterface({ input: child.stdout });
    let settled = false;
    let requestId = 1;
    const models: CodexModel[] = [];
    const finish = (error?: Error) => {
      if (settled) return;
      settled = true;
      clearTimeout(timeout);
      reader.close();
      child.stdin.end();
      child.kill();
      if (error) reject(error); else resolve(models);
    };
    const timeout = setTimeout(() => finish(new Error('Codex model discovery timed out. Check Codex login and connection.')), 15_000);
    const send = (message: unknown) => child.stdin.write(JSON.stringify(message) + '\n');
    child.stderr.resume(); // Do not leak credentials or unrelated CLI diagnostics to clients.
    child.stdin.on('error', () => finish(new Error('Codex model discovery process closed its input')));
    child.once('error', error => finish(new Error(`Cannot start Codex: ${error.message}`)));
    child.once('exit', () => { if (!settled) finish(new Error('Codex model discovery exited before responding')); });
    reader.on('line', line => {
      let message: any;
      try { message = JSON.parse(line); } catch { return; }
      if (message.id !== 0 && message.id !== requestId) return;
      if (message.error) { finish(new Error(`Codex model discovery: ${message.error.message}`)); return; }
      if (message.id === 0) {
        send({ method: 'initialized', params: {} });
        send({ method: 'model/list', id: requestId, params: { limit: 100, includeHidden: false } });
      } else if (Array.isArray(message.result?.data)) {
        for (const model of message.result.data) {
          if (typeof model.model !== 'string' || model.hidden) continue;
          models.push({ id: model.id ?? model.model, model: model.model, displayName: model.displayName ?? model.model,
            description: model.description ?? '', isDefault: !!model.isDefault,
            defaultReasoningEffort: model.defaultReasoningEffort, supportedReasoningEfforts: model.supportedReasoningEfforts });
        }
        if (message.result.nextCursor) {
          requestId++;
          send({ method: 'model/list', id: requestId, params: { limit: 100, cursor: message.result.nextCursor, includeHidden: false } });
        } else finish(models.length ? undefined : new Error('Codex returned no available models'));
      }
    });
    send({ method: 'initialize', id: 0, params: { clientInfo: { name: 'koda', title: 'Koda', version: '0.1.0' } } });
  });
}
