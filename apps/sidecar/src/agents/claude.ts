/**
 * Claude Code Handler
 *
 * Manages Claude Code sessions using the Claude Agent SDK.
 * Integrates the Conductor MCP server for interactive tools.
 *
 * Architecture:
 * - Uses @anthropic-ai/claude-agent-sdk for session management
 * - Registers Conductor MCP server with tools: AskUserQuestion, GetWorkspaceDiff, DiffComment, GetTerminalOutput
 * - Maintains backward-compatible API with the old CLI-based implementation
 */

import { EventEmitter } from 'node:events'
import * as fs from 'node:fs/promises'
import * as path from 'node:path'
import * as os from 'node:os'
import { randomUUID } from 'node:crypto'
import { z } from 'zod'
import { query, type Query, type SDKMessage, type Options } from '@anthropic-ai/claude-agent-sdk'
import { createConductorMCPServer } from '../mcp/conductorMCPServer.js'
import { getFrontendRpcClient } from '../rpc/frontendRpc.js'

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
 * Internal session state - updated for SDK
 */
export interface ClaudeSession {
  id: string
  workspaceId: string
  status: SessionStatus
  query: Query | null
  abortController: AbortController | null
  options?: ClaudeSessionOptions
  contextTokenCount: number
  inputTokens: number
  outputTokens: number
  createdAt: Date
  updatedAt: Date
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
 * Handler for Claude Code sessions using the Agent SDK
 */
export class ClaudeHandler extends EventEmitter {
  private sessions: Map<string, ClaudeSession> = new Map()
  private messageBuffers: Map<string, StoredMessage[]> = new Map()

  constructor() {
    super()
  }

  /**
   * Build environment for Claude - removes ANTHROPIC_API_KEY so Claude uses subscription auth
   */
  private buildEnv(): Record<string, string | undefined> {
    const env = { ...globalThis.process.env }
    delete env.ANTHROPIC_API_KEY
    return env
  }

  /**
   * Start a new Claude session using the Agent SDK with MCP integration
   */
  async start(params: ClaudeStartParams): Promise<ClaudeStartResult> {
    const sessionId = randomUUID()
    const abortController = new AbortController()

    console.log(`[Claude] Starting session ${sessionId} with Agent SDK`)

    // Create MCP server for Conductor tools
    const conductorMcp = createConductorMCPServer(sessionId, params.workspaceId, getFrontendRpcClient())

    // Build SDK options
    const sdkOptions: Options = {
      cwd: params.options?.workingDirectory || globalThis.process.cwd(),
      env: this.buildEnv(),
      abortController,
      mcpServers: {
        conductor: conductorMcp,
      },
    }

    // Add optional settings
    if (params.options?.model) {
      sdkOptions.model = params.options.model
    }
    if (params.options?.allowedTools?.length) {
      sdkOptions.allowedTools = params.options.allowedTools
    }
    if (params.options?.dangerouslySkipPermissions) {
      sdkOptions.permissionMode = 'bypassPermissions'
      sdkOptions.allowDangerouslySkipPermissions = true
    }

    console.log(`[Claude] SDK options:`, JSON.stringify({ ...sdkOptions, env: '[REDACTED]' }, null, 2))

    // Create the query using the SDK
    const sdkQuery = query({
      prompt: params.prompt,
      options: sdkOptions,
    })

    const session: ClaudeSession = {
      id: sessionId,
      workspaceId: params.workspaceId,
      status: 'running',
      query: sdkQuery,
      abortController,
      options: params.options,
      contextTokenCount: 0,
      inputTokens: 0,
      outputTokens: 0,
      createdAt: new Date(),
      updatedAt: new Date(),
    }

    this.sessions.set(sessionId, session)
    this.messageBuffers.set(sessionId, [])

    // Start processing the stream in the background
    this.processQueryStream(sessionId, sdkQuery)

    return {
      sessionId,
      status: 'running',
    }
  }

  /**
   * Process the SDK query stream and emit events
   */
  private async processQueryStream(sessionId: string, sdkQuery: Query): Promise<void> {
    const session = this.sessions.get(sessionId)
    if (!session) return

    try {
      for await (const message of sdkQuery) {
        // Convert SDK message to our event format
        const event = this.convertSDKMessage(message)
        if (event) {
          this.storeMessage(sessionId, event)
          this.emitEvent(sessionId, event)
        }

        // Update token counts if available
        if (message.type === 'result' && 'usage' in message) {
          const usage = message.usage as TokenUsage | undefined
          if (usage) {
            session.inputTokens = usage.input_tokens
            session.outputTokens = usage.output_tokens
            session.contextTokenCount = usage.input_tokens + usage.output_tokens
            session.updatedAt = new Date()

            this.emit('context_used', {
              sessionId,
              inputTokens: usage.input_tokens,
              outputTokens: usage.output_tokens,
              totalTokens: usage.input_tokens + usage.output_tokens,
              cacheCreationTokens: usage.cache_creation_input_tokens,
              cacheReadTokens: usage.cache_read_input_tokens,
            } satisfies ContextUsedEvent)
          }
        }
      }

      // Stream completed successfully
      if (session.status !== 'cancelled') {
        session.status = 'completed'
        session.updatedAt = new Date()
        this.emit('session_ended', {
          sessionId,
          reason: 'completed',
        } satisfies SessionEndedEvent)
      }
    } catch (error) {
      console.error(`[Claude] Stream error for session ${sessionId}:`, error)
      if (session.status !== 'cancelled') {
        session.status = 'error'
        session.updatedAt = new Date()
        this.emit('error', error instanceof Error ? error.message : String(error))
        this.emit('session_ended', {
          sessionId,
          reason: 'error',
        } satisfies SessionEndedEvent)
      }
    }
  }

  /**
   * Convert SDK message to our internal event format
   */
  private convertSDKMessage(message: SDKMessage): ClaudeStreamEvent | null {
    // The SDK message types map fairly directly to our event types
    switch (message.type) {
      case 'user':
        return { type: 'user', message: message.message }
      case 'assistant':
        return { type: 'assistant', message: message.message }
      case 'result':
        return {
          type: 'result',
          result: 'result' in message ? String(message.result) : '',
          session_id: 'session_id' in message ? String(message.session_id) : undefined,
          usage: 'usage' in message ? message.usage as TokenUsage : undefined,
        }
      case 'system':
        return { type: 'system', message: 'message' in message ? String(message.message) : '' }
      default:
        // Pass through other message types
        return message as ClaudeStreamEvent
    }
  }

  /**
   * Emit event based on type
   */
  private emitEvent(_sessionId: string, event: ClaudeStreamEvent): void {
    switch (event.type) {
      case 'tool_use':
        this.emit('tool_use', event)
        break
      case 'tool_result':
        this.emit('tool_result', event)
        break
      default:
        this.emit('message', event)
    }
  }

  /**
   * Resume an existing session using the SDK's resume option
   */
  async resume(params: ClaudeResumeParams): Promise<ClaudeStartResult> {
    const session = this.sessions.get(params.sessionId)
    if (!session) {
      throw new Error('Session not found')
    }

    const abortController = new AbortController()

    // Create MCP server for Conductor tools
    const conductorMcp = createConductorMCPServer(params.sessionId, session.workspaceId, getFrontendRpcClient())

    // Build SDK options with resume
    const sdkOptions: Options = {
      cwd: session.options?.workingDirectory || globalThis.process.cwd(),
      env: this.buildEnv(),
      abortController,
      resume: params.sessionId, // Use SDK's native resume
      mcpServers: {
        conductor: conductorMcp,
      },
    }

    if (session.options?.model) {
      sdkOptions.model = session.options.model
    }

    console.log(`[Claude] Resuming session ${params.sessionId} with Agent SDK`)

    // Create the query - use the new prompt if provided, otherwise send empty to continue
    const sdkQuery = query({
      prompt: params.prompt || '',
      options: sdkOptions,
    })

    // Update session state
    session.query = sdkQuery
    session.abortController = abortController
    session.status = 'running'
    session.updatedAt = new Date()

    // Start processing the stream in the background
    this.processQueryStream(params.sessionId, sdkQuery)

    return {
      sessionId: params.sessionId,
      status: 'running',
    }
  }

  /**
   * Cancel a running session
   */
  async cancel(params: ClaudeCancelParams): Promise<ClaudeCancelResult> {
    const session = this.sessions.get(params.sessionId)
    if (!session) {
      throw new Error('Session not found')
    }

    session.status = 'cancelled'
    session.updatedAt = new Date()

    // Abort the SDK query
    if (session.abortController) {
      session.abortController.abort()
    }

    this.emit('session_ended', {
      sessionId: params.sessionId,
      reason: 'cancelled',
    } satisfies SessionEndedEvent)

    return {
      success: true,
      sessionId: params.sessionId,
    }
  }

  /**
   * Get session info
   */
  getSession(sessionId: string): ClaudeSessionInfo | null {
    const session = this.sessions.get(sessionId)
    if (!session) {
      return null
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
    }
  }

  /**
   * Read Claude settings from ~/.claude/settings.json
   */
  async getClaudeSettings(): Promise<ClaudeSettings | null> {
    try {
      const claudeHome = globalThis.process.env.CLAUDE_HOME || path.join(os.homedir(), '.claude')
      const settingsPath = path.join(claudeHome, 'settings.json')
      const content = await fs.readFile(settingsPath, 'utf-8')
      return JSON.parse(content) as ClaudeSettings
    } catch {
      return null
    }
  }

  /**
   * Dispose of all sessions
   */
  async dispose(): Promise<void> {
    const killPromises = Array.from(this.sessions.keys()).map((sessionId) => {
      const session = this.sessions.get(sessionId)
      if (session?.abortController && !session.abortController.signal.aborted) {
        session.abortController.abort()
      }
      return Promise.resolve()
    })

    await Promise.all(killPromises)
    this.sessions.clear()
    this.messageBuffers.clear()
  }

  /**
   * Store a message in the buffer for polling
   */
  private storeMessage(sessionId: string, event: ClaudeStreamEvent): void {
    const buffer = this.messageBuffers.get(sessionId)
    if (buffer) {
      buffer.push({
        index: buffer.length,
        timestamp: Date.now(),
        event,
      })
    }
  }

  /**
   * Get messages for a session since a given index (for polling)
   */
  getMessages(sessionId: string, fromIndex = 0): StoredMessage[] {
    const buffer = this.messageBuffers.get(sessionId)
    if (!buffer) return []
    return buffer.slice(fromIndex)
  }

  // Type-safe event emitter overrides
  override on<K extends keyof ClaudeHandlerEvents>(event: K, listener: ClaudeHandlerEvents[K]): this {
    return super.on(event, listener)
  }

  override emit<K extends keyof ClaudeHandlerEvents>(
    event: K,
    ...args: Parameters<ClaudeHandlerEvents[K]>
  ): boolean {
    return super.emit(event, ...args)
  }
}

// ============================================================================
// Singleton instance for RPC handlers
// ============================================================================

let handlerInstance: ClaudeHandler | null = null

/**
 * Get the singleton Claude handler instance
 */
export function getClaudeHandler(): ClaudeHandler {
  if (!handlerInstance) {
    handlerInstance = new ClaudeHandler()
  }
  return handlerInstance
}

// ============================================================================
// RPC Handler Functions
// ============================================================================

/**
 * Start a new Claude session
 */
export async function claudeStart(params: ClaudeStartParams): Promise<ClaudeStartResult> {
  const handler = getClaudeHandler()
  return handler.start(params)
}

/**
 * Resume an existing Claude session
 */
export async function claudeResume(params: ClaudeResumeParams): Promise<ClaudeStartResult> {
  const handler = getClaudeHandler()
  return handler.resume(params)
}

/**
 * Cancel a Claude session
 */
export async function claudeCancel(params: ClaudeCancelParams): Promise<ClaudeCancelResult> {
  const handler = getClaudeHandler()
  return handler.cancel(params)
}

/**
 * Get Claude session info
 */
export async function claudeGetSession(params: ClaudeGetSessionParams): Promise<ClaudeSessionInfo | null> {
  const handler = getClaudeHandler()
  return handler.getSession(params.sessionId)
}

/**
 * Get Claude settings
 */
export async function claudeGetSettings(): Promise<ClaudeSettings | null> {
  const handler = getClaudeHandler()
  return handler.getClaudeSettings()
}

/**
 * Get messages for a session (polling endpoint)
 */
export async function claudeGetMessages(params: ClaudeGetMessagesParams): Promise<StoredMessage[]> {
  const handler = getClaudeHandler()
  return handler.getMessages(params.sessionId, params.fromIndex ?? 0)
}
