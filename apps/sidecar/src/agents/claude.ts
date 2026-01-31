/**
 * Claude Code Handler
 *
 * Manages Claude Code CLI sessions, providing:
 * - Session start/resume/cancel
 * - Message streaming with JSON parsing
 * - Token usage tracking
 * - Claude settings integration
 */

import { spawn, type ChildProcess } from 'node:child_process';
import { EventEmitter } from 'node:events';
import * as fs from 'node:fs/promises';
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
    env.CLAUDE_CODE_OUTPUT_FORMAT = 'stream-json';
    return env;
  }

  /**
   * Start a new Claude session
   */
  async start(params: ClaudeStartParams): Promise<ClaudeStartResult> {
    const sessionId = randomUUID();
    const args = this.buildCliArgs(params.prompt, params.options);

    const childProcess = spawn('claude', args, {
      stdio: ['pipe', 'pipe', 'pipe'],
      env: this.buildEnv(),
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

    // Build args for resume
    const args = this.buildResumeArgs(params.sessionId, params.prompt, session.options);

    const newProcess = spawn('claude', args, {
      stdio: ['pipe', 'pipe', 'pipe'],
      env: this.buildEnv(),
    });

    // Update session
    session.process = newProcess;
    session.status = 'running';
    session.updatedAt = new Date();

    this.streamBuffers.set(params.sessionId, '');
    this.setupProcessHandlers(params.sessionId, newProcess);

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

    // Set status BEFORE killing to prevent close handler from emitting duplicate event
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
    const cancelPromises = Array.from(this.sessions.keys()).map((sessionId) => {
      const session = this.sessions.get(sessionId);
      if (session && session.process && !session.process.killed) {
        session.process.kill('SIGTERM');
      }
      return Promise.resolve();
    });

    await Promise.all(cancelPromises);
    this.sessions.clear();
    this.streamBuffers.clear();
  }

  /**
   * Build CLI arguments for starting a session
   */
  private buildCliArgs(prompt: string, options?: ClaudeSessionOptions): string[] {
    const args: string[] = ['--print', '--output-format', 'stream-json', '--verbose'];

    if (options?.workingDirectory) {
      args.push('--cwd', options.workingDirectory);
    }

    if (options?.model) {
      args.push('--model', options.model);
    }

    if (options?.maxTokens) {
      args.push('--max-turns', String(options.maxTokens));
    }

    if (options?.allowedTools && options.allowedTools.length > 0) {
      args.push('--allowedTools', options.allowedTools.join(','));
    }

    if (options?.systemPrompt) {
      args.push('--system-prompt', options.systemPrompt);
    }

    if (options?.dangerouslySkipPermissions) {
      args.push('--dangerously-skip-permissions');
    }

    // Add the prompt as positional argument at the end
    args.push(prompt);

    return args;
  }

  /**
   * Build CLI arguments for resuming a session
   */
  private buildResumeArgs(sessionId: string, prompt?: string, options?: ClaudeSessionOptions): string[] {
    const args: string[] = ['--print', '--output-format', 'stream-json', '--verbose', '--resume', sessionId];

    if (options?.workingDirectory) {
      args.push('--cwd', options.workingDirectory);
    }

    if (options?.model) {
      args.push('--model', options.model);
    }

    if (prompt) {
      // Add prompt as positional argument
      args.push(prompt);
    }

    return args;
  }

  /**
   * Setup event handlers for the Claude process
   */
  private setupProcessHandlers(sessionId: string, childProcess: ChildProcess): void {
    childProcess.stdout?.on('data', (data: Buffer) => {
      this.handleStdout(sessionId, data.toString());
    });

    childProcess.stderr?.on('data', (data: Buffer) => {
      const errorText = data.toString().trim();
      if (errorText) {
        this.emit('error', errorText);
      }
    });

    childProcess.on('close', (code: number | null) => {
      this.handleProcessClose(sessionId, code);
    });

    childProcess.on('error', (err: Error) => {
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
