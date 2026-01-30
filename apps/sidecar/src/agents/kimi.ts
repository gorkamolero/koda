/**
 * Kimi Code CLI Agent Handler
 *
 * Manages Kimi Code CLI sessions for the orchestrator sidecar.
 * Uses the kimi CLI in print mode with stream-json output format
 * for programmatic integration.
 *
 * @see https://github.com/MoonshotAI/kimi-cli
 */

import { z } from 'zod';
import { spawn, type ChildProcess } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { EventEmitter } from 'node:events';

/**
 * Session status enum
 */
export const KimiSessionStatus = {
  IDLE: 'idle',
  RUNNING: 'running',
  PAUSED: 'paused',
  STOPPED: 'stopped',
  ERROR: 'error',
} as const;

export type KimiSessionStatusType = (typeof KimiSessionStatus)[keyof typeof KimiSessionStatus];

/**
 * Zod schemas for input validation
 */
export const CreateKimiSessionSchema = z.object({
  workspaceId: z.string().uuid(),
  workDir: z.string().min(1),
  sessionId: z.string().optional(),
  model: z.string().optional(),
  autoApprove: z.boolean().optional(),
});

export const SendKimiMessageSchema = z.object({
  sessionId: z.string().min(1),
  message: z.string().min(1),
  streaming: z.boolean().optional(),
});

export const GetKimiSessionSchema = z.object({
  sessionId: z.string().min(1),
});

export const StopKimiSessionSchema = z.object({
  sessionId: z.string().min(1),
});

export type CreateKimiSessionInput = z.infer<typeof CreateKimiSessionSchema>;
export type SendKimiMessageInput = z.infer<typeof SendKimiMessageSchema>;
export type GetKimiSessionInput = z.infer<typeof GetKimiSessionSchema>;
export type StopKimiSessionInput = z.infer<typeof StopKimiSessionSchema>;

/**
 * Kimi session representation
 */
export interface KimiSession {
  id: string;
  workspaceId: string;
  agentType: 'kimi';
  model?: string;
  status: KimiSessionStatusType;
  kimiSessionId?: string;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Message response type
 */
export interface KimiMessageResponse {
  sessionId: string;
  content: string;
  turnId: string;
  createdAt: Date;
}

/**
 * Internal session state with process reference
 */
interface InternalKimiSession {
  session: KimiSession;
  process: ChildProcess;
  workDir: string;
  buffer: string;
  messageResolvers: Map<string, {
    resolve: (value: KimiMessageResponse) => void;
    reject: (reason: Error) => void;
    content: string;
    callback?: (chunk: string) => void;
  }>;
  emitter: EventEmitter;
}

/**
 * Active sessions registry
 */
const activeSessions = new Map<string, InternalKimiSession>();

/**
 * Stream JSON message types from kimi CLI
 */
interface KimiStreamMessage {
  type: 'ready' | 'content' | 'done' | 'error' | 'tool_use' | 'tool_result';
  text?: string;
  error?: string;
  tool?: string;
  result?: unknown;
}

/**
 * Check if Kimi CLI is installed
 */
export async function isKimiInstalled(): Promise<boolean> {
  return new Promise((resolve) => {
    const proc = spawn('kimi', ['--version'], { stdio: ['ignore', 'pipe', 'pipe'] });

    proc.on('error', () => {
      resolve(false);
    });

    proc.on('close', (code) => {
      resolve(code === 0);
    });

    // Handle stdout to prevent hanging
    proc.stdout?.on('data', () => {
      // Just consume the data
    });
  });
}

/**
 * Build CLI arguments for kimi command
 */
function buildKimiArgs(input: CreateKimiSessionInput): string[] {
  const args: string[] = [
    '--print',
    '--output-format', 'stream-json',
    '--input-format', 'stream-json',
    '--work-dir', input.workDir,
  ];

  if (input.sessionId) {
    args.push('--session', input.sessionId);
  }

  if (input.model) {
    args.push('--model', input.model);
  }

  if (input.autoApprove) {
    args.push('--yolo');
  }

  return args;
}

/**
 * Parse a JSONL line from kimi output
 */
function parseStreamLine(line: string): KimiStreamMessage | null {
  if (!line.trim()) return null;

  try {
    return JSON.parse(line) as KimiStreamMessage;
  } catch {
    // Invalid JSON line, ignore
    return null;
  }
}

/**
 * Create a new Kimi session
 */
export async function createKimiSession(
  input: CreateKimiSessionInput
): Promise<KimiSession> {
  const validated = CreateKimiSessionSchema.parse(input);

  return new Promise((resolve, reject) => {
    const args = buildKimiArgs(validated);

    const proc = spawn('kimi', args, {
      cwd: validated.workDir,
      stdio: ['pipe', 'pipe', 'pipe'],
      env: { ...process.env },
    });

    const sessionId = randomUUID();
    let stderrBuffer = '';
    let resolved = false;

    const session: KimiSession = {
      id: sessionId,
      workspaceId: validated.workspaceId,
      agentType: 'kimi',
      model: validated.model,
      status: KimiSessionStatus.RUNNING,
      kimiSessionId: validated.sessionId,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    const internal: InternalKimiSession = {
      session,
      process: proc,
      workDir: validated.workDir,
      buffer: '',
      messageResolvers: new Map(),
      emitter: new EventEmitter(),
    };

    // Handle process errors
    proc.on('error', (err) => {
      if (!resolved) {
        resolved = true;
        const errorMsg = err.message.includes('ENOENT')
          ? 'Kimi CLI is not installed. Install with: curl -LsSf https://code.kimi.com/install.sh | bash'
          : err.message;
        reject(new Error(errorMsg));
      }
      internal.session.status = KimiSessionStatus.ERROR;
    });

    // Handle stderr
    proc.stderr?.on('data', (data: Buffer) => {
      stderrBuffer += data.toString();
    });

    // Handle stdout (JSONL stream)
    proc.stdout?.on('data', (data: Buffer) => {
      internal.buffer += data.toString();

      // Process complete lines
      const lines = internal.buffer.split('\n');
      internal.buffer = lines.pop() || '';

      for (const line of lines) {
        const msg = parseStreamLine(line);
        if (!msg) continue;

        if (msg.type === 'ready' && !resolved) {
          resolved = true;
          activeSessions.set(sessionId, internal);
          resolve(session);
        } else if (msg.type === 'content') {
          // Dispatch to any waiting message resolvers
          for (const [, resolver] of internal.messageResolvers) {
            if (msg.text) {
              resolver.content += msg.text;
              resolver.callback?.(msg.text);
            }
          }
        } else if (msg.type === 'done') {
          // Complete all pending messages
          for (const [turnId, resolver] of internal.messageResolvers) {
            resolver.resolve({
              sessionId,
              content: resolver.content,
              turnId,
              createdAt: new Date(),
            });
            internal.messageResolvers.delete(turnId);
          }
        } else if (msg.type === 'error') {
          for (const [turnId, resolver] of internal.messageResolvers) {
            resolver.reject(new Error(msg.error || 'Unknown error from Kimi'));
            internal.messageResolvers.delete(turnId);
          }
        }

        internal.emitter.emit('message', msg);
      }
    });

    // Handle process close
    proc.on('close', (code, signal) => {
      if (!resolved) {
        resolved = true;
        const errorMsg = stderrBuffer || `Kimi process exited with code ${code}`;
        reject(new Error(errorMsg));
      }

      // Reject any pending message resolvers
      for (const [turnId, resolver] of internal.messageResolvers) {
        resolver.reject(new Error(`Kimi process exited unexpectedly (code: ${code}, signal: ${signal})`));
        internal.messageResolvers.delete(turnId);
      }

      internal.session.status = KimiSessionStatus.STOPPED;
      activeSessions.delete(sessionId);
    });

    // If no ready message within timeout, check if process started successfully
    setTimeout(() => {
      if (!resolved) {
        // Process started but no ready message - consider it ready anyway
        resolved = true;
        activeSessions.set(sessionId, internal);
        resolve(session);
      }
    }, 5000);
  });
}

/**
 * Send a message to an existing Kimi session
 */
export async function sendKimiMessage(
  input: SendKimiMessageInput,
  onChunk?: (chunk: string) => void
): Promise<KimiMessageResponse> {
  const validated = SendKimiMessageSchema.parse(input);

  const internal = activeSessions.get(validated.sessionId);
  if (!internal) {
    throw new Error(`Session not found: ${validated.sessionId}`);
  }

  if (internal.session.status !== KimiSessionStatus.RUNNING) {
    throw new Error(`Session is not running: ${internal.session.status}`);
  }

  const turnId = randomUUID();

  return new Promise((resolve, reject) => {
    // Register resolver for this message
    internal.messageResolvers.set(turnId, {
      resolve,
      reject,
      content: '',
      callback: validated.streaming ? onChunk : undefined,
    });

    // Send message as JSON to stdin
    const messagePayload = JSON.stringify({
      type: 'message',
      text: validated.message,
      turn_id: turnId,
    });

    internal.process.stdin?.write(messagePayload + '\n');

    // Timeout for response
    const timeout = setTimeout(() => {
      if (internal.messageResolvers.has(turnId)) {
        internal.messageResolvers.delete(turnId);
        reject(new Error('Message timeout: no response from Kimi within 5 minutes'));
      }
    }, 5 * 60 * 1000);

    // Clear timeout when resolved
    const originalResolve = internal.messageResolvers.get(turnId)!.resolve;
    internal.messageResolvers.get(turnId)!.resolve = (value) => {
      clearTimeout(timeout);
      originalResolve(value);
    };
  });
}

/**
 * Get session status
 */
export async function getKimiSession(
  input: GetKimiSessionInput
): Promise<KimiSession | null> {
  const validated = GetKimiSessionSchema.parse(input);
  const internal = activeSessions.get(validated.sessionId);
  return internal?.session ?? null;
}

/**
 * Stop a Kimi session
 */
export async function stopKimiSession(
  input: StopKimiSessionInput
): Promise<{ success: boolean; message?: string }> {
  const validated = StopKimiSessionSchema.parse(input);
  const internal = activeSessions.get(validated.sessionId);

  if (!internal) {
    return { success: false, message: `Session not found: ${validated.sessionId}` };
  }

  return new Promise((resolve) => {
    // Try graceful shutdown first
    internal.process.kill('SIGTERM');

    const forceKillTimeout = setTimeout(() => {
      // Force kill if still running
      if (!internal.process.killed) {
        internal.process.kill('SIGKILL');
      }
    }, 5000);

    internal.process.on('close', () => {
      clearTimeout(forceKillTimeout);
      internal.session.status = KimiSessionStatus.STOPPED;
      activeSessions.delete(validated.sessionId);
      resolve({ success: true });
    });
  });
}

/**
 * Get all active sessions
 */
export function getActiveSessions(): KimiSession[] {
  return Array.from(activeSessions.values()).map((internal) => internal.session);
}

/**
 * Clear all sessions (for testing)
 */
export function clearAllSessions(): void {
  for (const [sessionId] of activeSessions) {
    const internal = activeSessions.get(sessionId);
    if (internal) {
      internal.process.kill('SIGKILL');
    }
  }
  activeSessions.clear();
}
