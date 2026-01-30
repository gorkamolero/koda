/**
 * Codex Agent Handler
 *
 * Provides session management and message handling for OpenAI Codex CLI.
 * Uses the @openai/codex-sdk TypeScript library for programmatic control.
 *
 * Features:
 * - Session lifecycle (start, resume, cancel)
 * - Message sending with buffered and streaming modes
 * - Thread persistence for conversation continuity
 */

import { z } from 'zod';
import { randomUUID } from 'node:crypto';
import { Codex, type Thread, type Usage } from '@openai/codex-sdk';

// ============================================================================
// Schemas
// ============================================================================

const DEFAULT_MODEL = 'gpt-5.2-codex';

export const StartSessionSchema = z.object({
  workspaceId: z.string().uuid(),
  workingDirectory: z.string(),
  model: z.string().optional(),
  skipGitRepoCheck: z.boolean().optional(),
});

export const SendMessageSchema = z.object({
  sessionId: z.string().uuid(),
  message: z.string(),
  stream: z.boolean().optional(),
});

export const ResumeSessionSchema = z.object({
  sessionId: z.string().uuid(),
  threadId: z.string(),
  workspaceId: z.string().uuid(),
  workingDirectory: z.string(),
  model: z.string().optional(),
});

export const CancelSessionSchema = z.object({
  sessionId: z.string().uuid(),
});

export const GetSessionSchema = z.object({
  sessionId: z.string().uuid(),
});

// ============================================================================
// Types
// ============================================================================

export type CodexStartInput = z.infer<typeof StartSessionSchema>;
export type CodexSendInput = z.infer<typeof SendMessageSchema>;
export type CodexResumeInput = z.infer<typeof ResumeSessionSchema>;
export type CodexCancelInput = z.infer<typeof CancelSessionSchema>;
export type CodexGetSessionInput = z.infer<typeof GetSessionSchema>;

export type SessionStatus = 'idle' | 'running' | 'cancelled';

export interface CodexSession {
  id: string;
  workspaceId: string;
  workingDirectory: string;
  agentType: 'codex';
  model: string;
  status: SessionStatus;
  threadId: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface SendMessageResponse {
  sessionId: string;
  response: string;
  turnId: string;
  items: unknown[];
  usage?: {
    inputTokens: number;
    cachedInputTokens: number;
    outputTokens: number;
  };
}

export interface CancelSessionResponse {
  success: boolean;
  sessionId: string;
}

export interface StreamEvent {
  type: string;
  item?: unknown;
  usage?: unknown;
}

// ============================================================================
// Internal Types
// ============================================================================

interface InternalSession extends CodexSession {
  codex: Codex;
  thread: Thread;
}

// ============================================================================
// Handler
// ============================================================================

export class CodexHandler {
  private sessions: Map<string, InternalSession> = new Map();

  /**
   * Start a new Codex session
   */
  async startSession(input: CodexStartInput): Promise<CodexSession> {
    const codex = new Codex();
    const model = input.model ?? DEFAULT_MODEL;

    const thread = codex.startThread({
      model,
      workingDirectory: input.workingDirectory,
      skipGitRepoCheck: input.skipGitRepoCheck,
    });

    const sessionId = randomUUID();
    const now = new Date();

    const internalSession: InternalSession = {
      id: sessionId,
      workspaceId: input.workspaceId,
      workingDirectory: input.workingDirectory,
      agentType: 'codex',
      model,
      status: 'idle',
      threadId: thread.id, // Will be null until first message
      createdAt: now,
      updatedAt: now,
      codex,
      thread,
    };

    this.sessions.set(sessionId, internalSession);

    return this.toPublicSession(internalSession);
  }

  /**
   * Resume an existing Codex session by thread ID
   */
  async resumeSession(input: CodexResumeInput): Promise<CodexSession> {
    const codex = new Codex();
    const model = input.model ?? DEFAULT_MODEL;

    // This may throw if thread doesn't exist
    const thread = codex.resumeThread(input.threadId, {
      model,
      workingDirectory: input.workingDirectory,
    });

    const now = new Date();

    const internalSession: InternalSession = {
      id: input.sessionId,
      workspaceId: input.workspaceId,
      workingDirectory: input.workingDirectory,
      agentType: 'codex',
      model,
      status: 'idle',
      threadId: input.threadId,
      createdAt: now,
      updatedAt: now,
      codex,
      thread,
    };

    this.sessions.set(input.sessionId, internalSession);

    return this.toPublicSession(internalSession);
  }

  /**
   * Cancel an active session
   */
  async cancelSession(input: CodexCancelInput): Promise<CancelSessionResponse> {
    const session = this.sessions.get(input.sessionId);

    if (!session) {
      throw new Error('Session not found');
    }

    session.status = 'cancelled';
    session.updatedAt = new Date();

    return {
      success: true,
      sessionId: input.sessionId,
    };
  }

  /**
   * Get session details
   */
  async getSession(input: CodexGetSessionInput): Promise<CodexSession> {
    const session = this.sessions.get(input.sessionId);

    if (!session) {
      throw new Error('Session not found');
    }

    return this.toPublicSession(session);
  }

  /**
   * Send a message and wait for complete response
   */
  async sendMessage(input: CodexSendInput): Promise<SendMessageResponse> {
    const session = this.sessions.get(input.sessionId);

    if (!session) {
      throw new Error('Session not found');
    }

    if (session.status === 'cancelled') {
      throw new Error('Session is cancelled');
    }

    // Update status to running
    session.status = 'running';
    session.updatedAt = new Date();

    try {
      const result = await session.thread.run(input.message);

      // Update thread ID after first message (it's populated after run)
      if (session.thread.id !== null) {
        session.threadId = session.thread.id;
      }

      // Update status back to idle
      session.status = 'idle';
      session.updatedAt = new Date();

      const turnId = randomUUID();

      return {
        sessionId: input.sessionId,
        response: result.finalResponse ?? '',
        turnId,
        items: result.items ?? [],
        usage: result.usage ? this.convertUsage(result.usage) : undefined,
      };
    } catch (error) {
      // Reset status on error
      session.status = 'idle';
      session.updatedAt = new Date();
      throw error;
    }
  }

  /**
   * Send a message and stream responses
   */
  async *sendMessageStreamed(
    input: CodexSendInput
  ): AsyncGenerator<StreamEvent> {
    const session = this.sessions.get(input.sessionId);

    if (!session) {
      throw new Error('Session not found');
    }

    if (session.status === 'cancelled') {
      throw new Error('Session is cancelled');
    }

    // Update status to running
    session.status = 'running';
    session.updatedAt = new Date();

    try {
      const streamedTurn = await session.thread.runStreamed(input.message);

      for await (const event of streamedTurn.events) {
        // Update thread ID from thread.started event
        if (event.type === 'thread.started') {
          session.threadId = event.thread_id;
        }
        yield event as StreamEvent;
      }

      // Update status back to idle after streaming completes
      session.status = 'idle';
      session.updatedAt = new Date();
    } catch (error) {
      // Reset status on error
      session.status = 'idle';
      session.updatedAt = new Date();
      throw error;
    }
  }

  /**
   * Clean up all sessions
   */
  cleanup(): void {
    this.sessions.clear();
  }

  /**
   * Convert SDK Usage type to our response format
   */
  private convertUsage(usage: Usage): SendMessageResponse['usage'] {
    return {
      inputTokens: usage.input_tokens,
      cachedInputTokens: usage.cached_input_tokens,
      outputTokens: usage.output_tokens,
    };
  }

  /**
   * Convert internal session to public session (without SDK internals)
   */
  private toPublicSession(internal: InternalSession): CodexSession {
    return {
      id: internal.id,
      workspaceId: internal.workspaceId,
      workingDirectory: internal.workingDirectory,
      agentType: internal.agentType,
      model: internal.model,
      status: internal.status,
      threadId: internal.threadId,
      createdAt: internal.createdAt,
      updatedAt: internal.updatedAt,
    };
  }
}

// ============================================================================
// Singleton Instance
// ============================================================================

let handlerInstance: CodexHandler | null = null;

export function getCodexHandler(): CodexHandler {
  if (!handlerInstance) {
    handlerInstance = new CodexHandler();
  }
  return handlerInstance;
}

// ============================================================================
// RPC Handler Functions
// ============================================================================

/**
 * Start a new Codex session
 * RPC method: codex.start
 */
export async function startCodexSession(
  input: CodexStartInput
): Promise<CodexSession> {
  const handler = getCodexHandler();
  return handler.startSession(input);
}

/**
 * Resume an existing Codex session
 * RPC method: codex.resume
 */
export async function resumeCodexSession(
  input: CodexResumeInput
): Promise<CodexSession> {
  const handler = getCodexHandler();
  return handler.resumeSession(input);
}

/**
 * Cancel a Codex session
 * RPC method: codex.cancel
 */
export async function cancelCodexSession(
  input: CodexCancelInput
): Promise<CancelSessionResponse> {
  const handler = getCodexHandler();
  return handler.cancelSession(input);
}

/**
 * Get Codex session details
 * RPC method: codex.get
 */
export async function getCodexSession(
  input: CodexGetSessionInput
): Promise<CodexSession> {
  const handler = getCodexHandler();
  return handler.getSession(input);
}

/**
 * Send a message to a Codex session
 * RPC method: codex.send
 */
export async function sendCodexMessage(
  input: CodexSendInput
): Promise<SendMessageResponse> {
  const handler = getCodexHandler();
  return handler.sendMessage(input);
}
