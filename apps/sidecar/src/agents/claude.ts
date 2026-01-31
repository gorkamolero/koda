/**
 * Claude Code Handler
 *
 * Manages Claude Code CLI sessions using bidirectional stream-json mode.
 * This is the same approach used by Conductor - no PTY needed.
 *
 * Key: --input-format stream-json allows writing JSON to stdin
 *      --output-format stream-json provides JSON responses on stdout
 */

import { spawn, type ChildProcess } from 'node:child_process';
import { EventEmitter } from 'node:events';
import * as fs from 'node:fs/promises';
import * as fsSync from 'node:fs';
import * as path from 'node:path';
import * as os from 'node:os';
import { randomUUID } from 'node:crypto';
import { z } from 'zod';

// ============================================================================
// Zod Schemas
// ============================================================================

/**
 * Options for starting a Claude session
 */
export const ClaudeSessionOptionsSchema = z.object({
  model: z.string().optional(),
  maxTokens: z.number().int().positive().optional(),
  allowedTools: z.array(z.string()).optional(),
  systemPrompt: z.string().optional(),
  workingDirectory: z.string().optional(),
  dangerouslySkipPermissions: z.boolean().optional(),
});

/**
 * Parameters for starting a new Claude session
 */
export const ClaudeStartParamsSchema = z.object({
  workspaceId: z.string(),
  prompt: z.string().min(1),
  options: ClaudeSessionOptionsSchema.optional(),
});

/**
 * Parameters for resuming an existing Claude session
 */
export const ClaudeResumeParamsSchema = z.object({
  sessionId: z.string(),
  prompt: z.string().optional(),
});

/**
 * Parameters for canceling a Claude session
 */
export const ClaudeCancelParamsSchema = z.object({
  sessionId: z.string(),
});

/**
 * Parameters for getting session info
 */
export const ClaudeGetSessionParamsSchema = z.object({
  sessionId: z.string(),
});

/**
 * Parameters for getting messages (polling)
 */
export const ClaudeGetMessagesParamsSchema = z.object({
  sessionId: z.string(),
  fromIndex: z.number().int().min(0).optional(),
});

// ============================================================================
// Types
// ============================================================================

export type ClaudeSessionOptions = z.infer<typeof ClaudeSessionOptionsSchema>;
export type ClaudeStartParams = z.infer<typeof ClaudeStartParamsSchema>;
export type ClaudeResumeParams = z.infer<typeof ClaudeResumeParamsSchema>;
export type ClaudeCancelParams = z.infer<typeof ClaudeCancelParamsSchema>;
export type ClaudeGetSessionParams = z.infer<typeof ClaudeGetSessionParamsSchema>;
export type ClaudeGetMessagesParams = z.infer<typeof ClaudeGetMessagesParamsSchema>;

/**
 * Session status
 */
export type SessionStatus = 'idle' | 'running' | 'paused' | 'completed' | 'error' | 'cancelled';

/**
 * Internal session state
 */
export interface ClaudeSession {
  id: string;
  workspaceId: string;
  status: SessionStatus;
  process: ChildProcess | null;
  options?: ClaudeSessionOptions;
  contextTokenCount: number;
  inputTokens: number;
  outputTokens: number;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Session info returned to clients (without process reference)
 */
export interface ClaudeSessionInfo {
  id: string;
  workspaceId: string;
  status: SessionStatus;
  contextTokenCount: number;
  inputTokens: number;
  outputTokens: number;
  createdAt: string;
  updatedAt: string;
}

/**
 * Result of starting a session
 */
export interface ClaudeStartResult {
  sessionId: string;
  status: SessionStatus;
}

/**
 * Result of canceling a session
 */
export interface ClaudeCancelResult {
  success: boolean;
  sessionId: string;
}

/**
 * Claude stream event types
 * Based on Claude Code CLI stream-json output format
 */
export type ClaudeStreamEvent =
  | { type: 'system'; message: string; subtype?: string }
  | { type: 'assistant'; message: { type: string; text?: string; name?: string; input?: unknown } }
  | { type: 'user'; message: { type: string; content: unknown } }
  | { type: 'tool_use'; tool: string; input: unknown; id?: string }
  | { type: 'tool_result'; tool: string; output: unknown; id?: string; error?: string }
  | { type: 'result'; result: string; cost_usd?: number; duration_ms?: number; duration_api_ms?: number; num_turns?: number; session_id?: string; total_cost_usd?: number; usage?: TokenUsage }
  | { type: string; [key: string]: unknown };

/**
 * Token usage information
 */
export interface TokenUsage {
  input_tokens: number;
  output_tokens: number;
  cache_creation_input_tokens?: number;
  cache_read_input_tokens?: number;
}

/**
 * Context used event
 */
export interface ContextUsedEvent {
  sessionId: string;
  inputTokens: number;
  outputTokens: number;
  totalTokens: number;
  cacheCreationTokens?: number;
  cacheReadTokens?: number;
}

/**
 * Session ended event
 */
export interface SessionEndedEvent {
  sessionId: string;
  reason: 'completed' | 'error' | 'cancelled';
  exitCode?: number;
}

/**
 * Claude settings from ~/.claude/settings.json
 */
export interface ClaudeSettings {
  permissions?: {
    allow?: string[];
    defaultMode?: string;
  };
  hooks?: Record<string, unknown>;
  enabledPlugins?: Record<string, boolean>;
  alwaysThinkingEnabled?: boolean;
  [key: string]: unknown;
}

// ============================================================================
// Event types for TypeScript
// ============================================================================

export interface ClaudeHandlerEvents {
  message: (event: ClaudeStreamEvent) => void;
  tool_use: (event: ClaudeStreamEvent) => void;
  tool_result: (event: ClaudeStreamEvent) => void;
  context_used: (event: ContextUsedEvent) => void;
  session_ended: (event: SessionEndedEvent) => void;
  error: (error: string) => void;
}

// ============================================================================
// ClaudeHandler Implementation
// ============================================================================

/**
 * Stored message for polling
 */
export interface StoredMessage {
  index: number;
  timestamp: number;
  event: ClaudeStreamEvent;
}

/**
 * Handler for Claude Code CLI sessions
 */
export class ClaudeHandler extends EventEmitter {
  private sessions: Map<string, ClaudeSession> = new Map();
  private streamBuffers: Map<string, string> = new Map();
  private messageBuffers: Map<string, StoredMessage[]> = new Map();

  constructor() {
    super();
  }

  /**
   * Build environment for Claude CLI - removes ANTHROPIC_API_KEY so Claude uses subscription auth
   */
  private buildEnv(): NodeJS.ProcessEnv {
    const env = { ...globalThis.process.env };
    delete env.ANTHROPIC_API_KEY;
    return env;
  }

  /**
   * Find claude binary path
   */
  private findClaudeBinary(): string {
    const home = os.homedir();
    const candidates = [
      path.join(home, '.local', 'bin', 'claude'),
      '/usr/local/bin/claude',
      '/opt/homebrew/bin/claude',
    ];

    for (const candidate of candidates) {
      if (fsSync.existsSync(candidate)) {
        console.log(`[Claude] Found binary at: ${candidate}`);
        return candidate;
      }
    }

    console.log(`[Claude] Binary not found in common locations, falling back to PATH`);
    return 'claude';
  }

  /**
   * Start a new Claude session using bidirectional stream-json mode
   * This is the same approach used by Conductor - no PTY needed
   */
  async start(params: ClaudeStartParams): Promise<ClaudeStartResult> {
    const sessionId = randomUUID();
    const claudeBin = this.findClaudeBinary();

    // Build args with bidirectional stream-json (like Conductor does)
    const args = [
      '--output-format', 'stream-json',
      '--verbose',
      '--input-format', 'stream-json',
    ];

    // Add optional args
    if (params.options?.workingDirectory) {
      args.push('--cwd', params.options.workingDirectory);
    }
    if (params.options?.model) {
      args.push('--model', params.options.model);
    }
    if (params.options?.maxTokens) {
      args.push('--max-turns', String(params.options.maxTokens));
    }
    if (params.options?.allowedTools?.length) {
      args.push('--allowedTools', params.options.allowedTools.join(','));
    }
    if (params.options?.systemPrompt) {
      args.push('--system-prompt', params.options.systemPrompt);
    }
    if (params.options?.dangerouslySkipPermissions) {
      args.push('--dangerously-skip-permissions');
    }

    console.log(`[Claude] Starting session ${sessionId} with bidirectional stream-json`);
    console.log(`[Claude] Binary: ${claudeBin}`);
    console.log(`[Claude] Args: ${args.join(' ')}`);

    // Spawn with regular pipes - no PTY needed with stream-json input mode
    const childProcess = spawn(claudeBin, args, {
      stdio: ['pipe', 'pipe', 'pipe'],
      env: this.buildEnv(),
      cwd: params.options?.workingDirectory || globalThis.process.cwd(),
    });

    const session: ClaudeSession = {
      id: sessionId,
      workspaceId: params.workspaceId,
      status: 'running',
      process: childProcess,
      options: params.options,
      contextTokenCount: 0,
      inputTokens: 0,
      outputTokens: 0,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    this.sessions.set(sessionId, session);
    this.streamBuffers.set(sessionId, '');
    this.messageBuffers.set(sessionId, []);

    this.setupProcessHandlers(sessionId, childProcess);

    // Send the initial prompt via stdin as JSON (stream-json input format)
    const userMessage = {
      type: 'user',
      message: {
        role: 'user',
        content: params.prompt,
      },
    };
    
    console.log(`[Claude] Sending initial prompt via stdin`);
    childProcess.stdin?.write(JSON.stringify(userMessage) + '\n');

    return {
      sessionId,
      status: 'running',
    };
  }

  /**
   * Resume an existing session
   */
  async resume(params: ClaudeResumeParams): Promise<ClaudeStartResult> {
    const session = this.sessions.get(params.sessionId);
    if (!session) {
      throw new Error('Session not found');
    }

    const claudeBin = this.findClaudeBinary();
    const args = [
      '--output-format', 'stream-json',
      '--verbose', 
      '--input-format', 'stream-json',
      '--resume', params.sessionId,
    ];

    if (session.options?.workingDirectory) {
      args.push('--cwd', session.options.workingDirectory);
    }
    if (session.options?.model) {
      args.push('--model', session.options.model);
    }

    const childProcess = spawn(claudeBin, args, {
      stdio: ['pipe', 'pipe', 'pipe'],
      env: this.buildEnv(),
      cwd: session.options?.workingDirectory || globalThis.process.cwd(),
    });

    session.process = childProcess;
    session.status = 'running';
    session.updatedAt = new Date();

    this.streamBuffers.set(params.sessionId, '');
    this.setupProcessHandlers(params.sessionId, childProcess);

    // Send follow-up prompt if provided
    if (params.prompt) {
      const userMessage = {
        type: 'user',
        message: {
          role: 'user',
          content: params.prompt,
        },
      };
      childProcess.stdin?.write(JSON.stringify(userMessage) + '\n');
    }

    return {
      sessionId: params.sessionId,
      status: 'running',
    };
  }

  /**
   * Cancel a running session
   */
  async cancel(params: ClaudeCancelParams): Promise<ClaudeCancelResult> {
    const session = this.sessions.get(params.sessionId);
    if (!session) {
      throw new Error('Session not found');
    }

    session.status = 'cancelled';
    session.updatedAt = new Date();

    if (session.process && !session.process.killed) {
      session.process.kill('SIGTERM');
    }

    this.emit('session_ended', {
      sessionId: params.sessionId,
      reason: 'cancelled',
    } satisfies SessionEndedEvent);

    return {
      success: true,
      sessionId: params.sessionId,
    };
  }

  /**
   * Get session info
   */
  getSession(sessionId: string): ClaudeSessionInfo | null {
    const session = this.sessions.get(sessionId);
    if (!session) {
      return null;
    }

    return {
      id: session.id,
      workspaceId: session.workspaceId,
      status: session.status,
      contextTokenCount: session.contextTokenCount,
      inputTokens: session.inputTokens,
      outputTokens: session.outputTokens,
      createdAt: session.createdAt.toISOString(),
      updatedAt: session.updatedAt.toISOString(),
    };
  }

  /**
   * Read Claude settings from ~/.claude/settings.json
   */
  async getClaudeSettings(): Promise<ClaudeSettings | null> {
    try {
      const claudeHome = globalThis.process.env.CLAUDE_HOME || path.join(os.homedir(), '.claude');
      const settingsPath = path.join(claudeHome, 'settings.json');
      const content = await fs.readFile(settingsPath, 'utf-8');
      return JSON.parse(content) as ClaudeSettings;
    } catch {
      return null;
    }
  }

  /**
   * Dispose of all sessions
   */
  async dispose(): Promise<void> {
    const killPromises = Array.from(this.sessions.keys()).map((sessionId) => {
      const session = this.sessions.get(sessionId);
      if (session?.process && !session.process.killed) {
        session.process.kill('SIGTERM');
      }
      return Promise.resolve();
    });

    await Promise.all(killPromises);
    this.sessions.clear();
    this.streamBuffers.clear();
  }

  /**
   * Setup event handlers for the process
   */
  private setupProcessHandlers(sessionId: string, childProcess: ChildProcess): void {
    console.log(`[Claude] Setting up handlers for session ${sessionId}, PID: ${childProcess.pid}`);

    if (!childProcess.stdout) {
      console.error(`[Claude] ERROR: stdout is null for session ${sessionId}`);
      return;
    }

    childProcess.stdout.on('data', (data: Buffer) => {
      const text = data.toString();
      console.log(`[Claude] stdout (${sessionId}): ${text.substring(0, 300)}${text.length > 300 ? '...' : ''}`);
      this.handleStdout(sessionId, text);
    });

    childProcess.stderr?.on('data', (data: Buffer) => {
      const errorText = data.toString().trim();
      if (errorText) {
        console.log(`[Claude] stderr (${sessionId}): ${errorText}`);
        // Don't emit as error - stderr often contains debug info
      }
    });

    childProcess.on('close', (code: number | null) => {
      console.log(`[Claude] Process close (${sessionId}): code=${code}`);
      this.handleProcessClose(sessionId, code);
    });

    childProcess.on('error', (err: Error) => {
      console.error(`[Claude] Process error (${sessionId}):`, err.message);
      this.emit('error', err.message);
      const session = this.sessions.get(sessionId);
      if (session) {
        session.status = 'error';
        session.updatedAt = new Date();
      }
    });
  }

  /**
   * Handle stdout data from Claude process
   */
  private handleStdout(sessionId: string, data: string): void {
    let buffer = this.streamBuffers.get(sessionId) || '';
    buffer += data;

    // Process complete lines (newline-delimited JSON)
    const lines = buffer.split('\n');
    buffer = lines.pop() || ''; // Keep incomplete line in buffer
    this.streamBuffers.set(sessionId, buffer);

    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed) continue;

      try {
        const event = JSON.parse(trimmed) as ClaudeStreamEvent;
        this.processStreamEvent(sessionId, event);
      } catch {
        // Ignore JSON parse errors for non-JSON output
      }
    }
  }

  /**
   * Process a parsed stream event
   */
  private processStreamEvent(sessionId: string, event: ClaudeStreamEvent): void {
    // Store event in buffer for polling
    this.storeMessage(sessionId, event);

    // Emit the event based on type
    switch (event.type) {
      case 'tool_use':
        this.emit('tool_use', event);
        break;
      case 'tool_result':
        this.emit('tool_result', event);
        break;
      case 'result':
        this.handleResultEvent(sessionId, event);
        break;
      default:
        this.emit('message', event);
    }
  }

  /**
   * Store a message in the buffer for polling
   */
  private storeMessage(sessionId: string, event: ClaudeStreamEvent): void {
    const buffer = this.messageBuffers.get(sessionId);
    if (buffer) {
      buffer.push({
        index: buffer.length,
        timestamp: Date.now(),
        event,
      });
    }
  }

  /**
   * Get messages for a session since a given index (for polling)
   */
  getMessages(sessionId: string, fromIndex = 0): StoredMessage[] {
    const buffer = this.messageBuffers.get(sessionId);
    if (!buffer) return [];
    return buffer.slice(fromIndex);
  }

  /**
   * Handle a result event (contains token usage)
   */
  private handleResultEvent(sessionId: string, event: ClaudeStreamEvent): void {
    if (event.type !== 'result') return;

    const session = this.sessions.get(sessionId);
    if (!session) return;

    // Extract token usage
    const usage = event.usage as TokenUsage | undefined;
    if (usage) {
      session.inputTokens = usage.input_tokens;
      session.outputTokens = usage.output_tokens;
      session.contextTokenCount = usage.input_tokens + usage.output_tokens;
      session.updatedAt = new Date();

      this.emit('context_used', {
        sessionId,
        inputTokens: usage.input_tokens,
        outputTokens: usage.output_tokens,
        totalTokens: usage.input_tokens + usage.output_tokens,
        cacheCreationTokens: usage.cache_creation_input_tokens,
        cacheReadTokens: usage.cache_read_input_tokens,
      } satisfies ContextUsedEvent);
    }

    this.emit('message', event);
  }

  /**
   * Handle process close event
   */
  private handleProcessClose(sessionId: string, code: number | null): void {
    const session = this.sessions.get(sessionId);
    if (!session) return;

    // Don't update if already cancelled
    if (session.status === 'cancelled') return;

    const newStatus: SessionStatus = code === 0 ? 'completed' : 'error';
    session.status = newStatus;
    session.updatedAt = new Date();

    this.emit('session_ended', {
      sessionId,
      reason: code === 0 ? 'completed' : 'error',
      exitCode: code ?? undefined,
    } satisfies SessionEndedEvent);
  }

  // Type-safe event emitter overrides
  override on<K extends keyof ClaudeHandlerEvents>(event: K, listener: ClaudeHandlerEvents[K]): this {
    return super.on(event, listener);
  }

  override emit<K extends keyof ClaudeHandlerEvents>(
    event: K,
    ...args: Parameters<ClaudeHandlerEvents[K]>
  ): boolean {
    return super.emit(event, ...args);
  }
}

// ============================================================================
// Singleton instance for RPC handlers
// ============================================================================

let handlerInstance: ClaudeHandler | null = null;

/**
 * Get the singleton Claude handler instance
 */
export function getClaudeHandler(): ClaudeHandler {
  if (!handlerInstance) {
    handlerInstance = new ClaudeHandler();
  }
  return handlerInstance;
}

// ============================================================================
// RPC Handler Functions
// ============================================================================

/**
 * Start a new Claude session
 */
export async function claudeStart(params: ClaudeStartParams): Promise<ClaudeStartResult> {
  const handler = getClaudeHandler();
  return handler.start(params);
}

/**
 * Resume an existing Claude session
 */
export async function claudeResume(params: ClaudeResumeParams): Promise<ClaudeStartResult> {
  const handler = getClaudeHandler();
  return handler.resume(params);
}

/**
 * Cancel a Claude session
 */
export async function claudeCancel(params: ClaudeCancelParams): Promise<ClaudeCancelResult> {
  const handler = getClaudeHandler();
  return handler.cancel(params);
}

/**
 * Get Claude session info
 */
export async function claudeGetSession(params: ClaudeGetSessionParams): Promise<ClaudeSessionInfo | null> {
  const handler = getClaudeHandler();
  return handler.getSession(params.sessionId);
}

/**
 * Get Claude settings
 */
export async function claudeGetSettings(): Promise<ClaudeSettings | null> {
  const handler = getClaudeHandler();
  return handler.getClaudeSettings();
}

/**
 * Get messages for a session (polling endpoint)
 */
export async function claudeGetMessages(params: ClaudeGetMessagesParams): Promise<StoredMessage[]> {
  const handler = getClaudeHandler();
  return handler.getMessages(params.sessionId, params.fromIndex ?? 0);
}
