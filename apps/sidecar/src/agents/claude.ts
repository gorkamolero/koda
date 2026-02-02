/**
 * Claude Code Handler
 *
 * Manages Claude Code sessions using the Claude Agent SDK.
 * Integrates the Koda MCP server for interactive tools.
 *
 * Architecture:
 * - Uses @anthropic-ai/claude-agent-sdk for session management
 * - Multi-turn async generator pattern for continuous conversation
 * - canUseTool callback for ExitPlanMode approval and path validation
 * - Hooks for checkpointing and notifications
 * - Generator reuse with dynamic settings updates
 */

import { EventEmitter } from 'node:events'
import * as fs from 'node:fs/promises'
import * as path from 'node:path'
import * as os from 'node:os'
import { randomUUID } from 'node:crypto'
import { z } from 'zod'
import { query, type Query, type SDKMessage, type Options } from '@anthropic-ai/claude-agent-sdk'
import { createKodaMCPServer } from '../mcp/kodaMCPServer.js'
import { getFrontendRpcClient, type FrontendRpcClient } from '../rpc/frontendRpc.js'
import { getNotificationEmitter } from '../rpc/notifications.js'
import { getDb } from '../db/index.js'
import { saveCheckpoint } from '../checkpoint/service.js'

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
 * Permission mode for the SDK
 */
export type PermissionMode = 'default' | 'plan' | 'bypassPermissions'

/**
 * Session status
 */
export type SessionStatus = 'idle' | 'running' | 'paused' | 'completed' | 'error' | 'cancelled';

/**
 * Current settings for a session (can be dynamically updated)
 */
export interface SessionSettings {
  model: string
  permissionMode: PermissionMode
  maxThinkingTokens?: number
}

/**
 * Internal session state - enhanced for Conductor pattern
 */
export interface ClaudeSession {
  id: string
  workspaceId: string
  status: SessionStatus
  
  // SDK Query instance (reused across turns)
  query: Query | null
  
  // Generator pattern for multi-turn conversations
  sendMessage: ((prompt: string) => Promise<void>) | null
  sendTerminate: (() => void) | null
  
  // Dynamic settings (can be updated mid-session)
  currentSettings: SessionSettings
  
  // Turn tracking for checkpointing
  turnId: number
  
  // Working directory for path validation
  cwd: string
  
  // Abort controller for cancellation
  abortController: AbortController | null
  
  // Original options
  options?: ClaudeSessionOptions
  
  // Token tracking
  contextTokenCount: number
  inputTokens: number
  outputTokens: number
  
  // Timestamps
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
  | { type: 'assistant'; message: { type: string; text?: string; name?: string; input?: unknown; content?: Array<{ type: string; text?: string }> } }
  | { type: 'user'; message: { type: string; content: unknown } }
  | { type: 'tool_use'; tool: string; input: unknown; id?: string }
  | { type: 'tool_result'; tool: string; output: unknown; id?: string; error?: string }
  | { type: 'text_delta'; text: string }
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
// Multi-Turn Input Generator Pattern (from Conductor)
// ============================================================================

/**
 * Input generator state
 */
interface InputGeneratorState {
  messageQueue: Array<{ prompt: string; resolve: () => void }>
  waitingForMessage: ((value: string) => void) | null
  terminated: boolean
}

/**
 * SDK user message type for the input generator
 */
interface SDKUserMessageInput {
  type: 'user'
  message: { role: 'user'; content: string }
  parent_tool_use_id: string | null
  session_id: string
}

/**
 * Creates an async generator for multi-turn input
 *
 * This pattern allows the same Query to handle multiple turns without
 * spawning new CLI processes. Messages are queued and yielded as the
 * SDK requests them.
 */
function createInputGenerator(sessionId: string): {
  inputGenerator: () => AsyncGenerator<SDKUserMessageInput>
  sendMessage: (prompt: string) => Promise<void>
  sendTerminate: () => void
} {
  const state: InputGeneratorState = {
    messageQueue: [],
    waitingForMessage: null,
    terminated: false,
  }

  const sendMessage = (prompt: string): Promise<void> => {
    return new Promise<void>((resolve) => {
      if (state.waitingForMessage) {
        // SDK is waiting, deliver immediately
        state.waitingForMessage(prompt)
        state.waitingForMessage = null
        resolve()
      } else {
        // Queue for later delivery
        state.messageQueue.push({ prompt, resolve })
      }
    })
  }

  const sendTerminate = (): void => {
    state.terminated = true
    if (state.waitingForMessage) {
      // Unblock with empty to allow graceful shutdown
      state.waitingForMessage('')
    }
  }

  async function* inputGenerator(): AsyncGenerator<SDKUserMessageInput> {
    while (!state.terminated) {
      const msg = await new Promise<string>((resolve) => {
        if (state.messageQueue.length > 0) {
          const item = state.messageQueue.shift()!
          item.resolve()
          resolve(item.prompt)
        } else {
          state.waitingForMessage = resolve
        }
      })

      if (msg && !state.terminated) {
        yield {
          type: 'user',
          message: { role: 'user', content: msg },
          parent_tool_use_id: null,
          session_id: sessionId,
        }
      }
    }
  }

  return { inputGenerator, sendMessage, sendTerminate }
}

// ============================================================================
// canUseTool Callback (from Conductor)
// ============================================================================

/**
 * Permission result type matching SDK expectations
 */
type PermissionResult =
  | { behavior: 'allow' }
  | { behavior: 'deny'; message: string }

/**
 * Creates a canUseTool callback for permission validation
 *
 * Handles:
 * - ExitPlanMode: Requires frontend approval before allowing
 * - Edit tools: Validates paths are within workspace directory
 */
function createCanUseTool(
  session: ClaudeSession,
  frontendRpc: FrontendRpcClient
): (toolName: string, toolInput: unknown) => Promise<PermissionResult> {
  return async (toolName: string, toolInput: unknown): Promise<PermissionResult> => {
    // ExitPlanMode requires explicit frontend approval
    if (toolName === 'ExitPlanMode') {
      try {
        const response = await frontendRpc.exitPlanMode({ turnId: session.turnId })
        if (!response.approved) {
          console.log(`[Claude] ExitPlanMode denied by frontend for session ${session.id}`)
          return { behavior: 'deny', message: 'Plan approval denied by user' }
        }
      } catch (error) {
        console.error(`[Claude] Error requesting ExitPlanMode approval:`, error)
        return { behavior: 'deny', message: 'Failed to get plan approval' }
      }
    }

    // Edit tools must target files within the workspace
    const editTools = ['Edit', 'Write', 'NotebookEdit', 'mcp__filesystem-with-morph__edit_file']
    if (editTools.includes(toolName)) {
      const input = toolInput as { file_path?: string; path?: string }
      const filePath = input.file_path || input.path

      if (filePath && !filePath.startsWith(session.cwd)) {
        console.log(`[Claude] Edit denied - path outside workspace: ${filePath}`)
        return { behavior: 'deny', message: `Path outside workspace: ${filePath}` }
      }
    }

    return { behavior: 'allow' }
  }
}

// ============================================================================
// Hooks System (from Conductor)
// ============================================================================

/**
 * Hook JSON output type (minimal - all fields optional)
 */
type HookJSONOutput = Record<string, unknown>

/**
 * Creates hooks for session lifecycle events
 *
 * Hooks:
 * - UserPromptSubmit: Save checkpoint before processing
 * - Stop: Save checkpoint on session end
 * - PostToolUse.EnterPlanMode: Notify frontend
 */
function createHooks(session: ClaudeSession): Options['hooks'] {
  const notificationEmitter = getNotificationEmitter()

  return {
    // Save checkpoint when user submits a prompt
    UserPromptSubmit: [
      {
        hooks: [
          async (_input: unknown, _toolUseID: string | undefined, _options: { signal: AbortSignal }): Promise<HookJSONOutput> => {
            console.log(`[Claude] UserPromptSubmit hook - turn ${session.turnId} for session ${session.id}`)
            try {
              const db = getDb()
              saveCheckpoint(db, {
                worktreeId: session.workspaceId,
                turnId: `turn-${session.turnId}-start`,
                repoPath: session.cwd,
              })
              console.log(`[Claude] Checkpoint saved for turn ${session.turnId} start`)
            } catch (error) {
              // Checkpoint failures should not break the session
              console.error(`[Claude] Failed to save checkpoint:`, error)
            }
            return {}
          },
        ],
      },
    ],

    // Save checkpoint when session stops
    Stop: [
      {
        hooks: [
          async (_input: unknown, _toolUseID: string | undefined, _options: { signal: AbortSignal }): Promise<HookJSONOutput> => {
            console.log(`[Claude] Stop hook - turn ${session.turnId} for session ${session.id}`)
            try {
              const db = getDb()
              saveCheckpoint(db, {
                worktreeId: session.workspaceId,
                turnId: `turn-${session.turnId}-stop`,
                repoPath: session.cwd,
              })
              console.log(`[Claude] Checkpoint saved for turn ${session.turnId} stop`)
            } catch (error) {
              // Checkpoint failures should not break the session
              console.error(`[Claude] Failed to save checkpoint:`, error)
            }
            return {}
          },
        ],
      },
    ],

    // Notify frontend when entering plan mode
    PostToolUse: [
      {
        matcher: 'EnterPlanMode',
        hooks: [
          async (_input: unknown, _toolUseID: string | undefined, _options: { signal: AbortSignal }): Promise<HookJSONOutput> => {
            console.log(`[Claude] EnterPlanMode detected for session ${session.id}`)
            notificationEmitter.emitEnterPlanMode(session.id)
            return {}
          },
        ],
      },
    ],
  }
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
    // Strip API keys to force subscription auth (following Conductor's pattern)
    delete env.ANTHROPIC_API_KEY
    delete env.OPENAI_API_KEY
    delete env.CLAUDE_CODE_USE_BEDROCK
    delete env.CLAUDE_CODE_USE_VERTEX
    return env
  }

  /**
   * Start a new Claude session using the Agent SDK with full Conductor integration
   */
  async start(params: ClaudeStartParams): Promise<ClaudeStartResult> {
    const sessionId = randomUUID()
    const abortController = new AbortController()
    const frontendRpc = getFrontendRpcClient()
    const cwd = params.options?.workingDirectory || globalThis.process.cwd()

    console.log(`[Claude] Starting session ${sessionId} with Conductor integration`)

    // Create input generator for multi-turn conversations
    const { inputGenerator, sendMessage, sendTerminate } = createInputGenerator(sessionId)

    // Create session first (needed for callbacks)
    const session: ClaudeSession = {
      id: sessionId,
      workspaceId: params.workspaceId,
      status: 'running',
      query: null,
      sendMessage,
      sendTerminate,
      currentSettings: {
        model: params.options?.model || 'claude-sonnet-4-20250514',
        permissionMode: params.options?.dangerouslySkipPermissions ? 'bypassPermissions' : 'default',
        maxThinkingTokens: undefined,
      },
      turnId: 0,
      cwd,
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

    // Create MCP server for Koda tools
    const kodaMcp = createKodaMCPServer(sessionId, params.workspaceId, frontendRpc)

    // Build SDK options
    const sdkOptions: Options = {
      cwd,
      env: this.buildEnv(),
      abortController,
      model: session.currentSettings.model,
      mcpServers: {
        koda: kodaMcp,
      },
      // Enable streaming partial messages for real-time text display
      includePartialMessages: true,
      // Conductor patterns
      canUseTool: createCanUseTool(session, frontendRpc),
      hooks: createHooks(session),
    }

    // Add optional settings
    if (params.options?.allowedTools?.length) {
      sdkOptions.allowedTools = params.options.allowedTools
    }
    if (params.options?.dangerouslySkipPermissions) {
      sdkOptions.permissionMode = 'bypassPermissions'
      sdkOptions.allowDangerouslySkipPermissions = true
    }

    console.log(`[Claude] SDK options:`, JSON.stringify({
      cwd: sdkOptions.cwd,
      model: sdkOptions.model,
      permissionMode: sdkOptions.permissionMode,
    }, null, 2))

    // Create the query with input generator (Conductor pattern)
    const sdkQuery = query({
      prompt: inputGenerator(),
      options: sdkOptions,
    })

    session.query = sdkQuery

    // Start processing the stream in the background
    this.processQueryStream(sessionId, sdkQuery)

    // Send the initial prompt
    session.turnId++
    sendMessage(params.prompt)

    return {
      sessionId,
      status: 'running',
    }
  }

  /**
   * Continue an existing session with a new prompt (multi-turn)
   */
  async continue(params: { sessionId: string; prompt: string }): Promise<ClaudeStartResult> {
    const session = this.sessions.get(params.sessionId)
    if (!session) {
      throw new Error(`Session not found: ${params.sessionId}`)
    }
    if (!session.sendMessage) {
      throw new Error(`Session ${params.sessionId} is not active`)
    }

    console.log(`[Claude] Continuing session ${params.sessionId}, turn ${session.turnId + 1}`)

    session.turnId++
    session.status = 'running'
    session.updatedAt = new Date()
    
    await session.sendMessage(params.prompt)

    return {
      sessionId: params.sessionId,
      status: 'running',
    }
  }

  /**
   * Update session settings dynamically (model, permissionMode, maxThinkingTokens)
   */
  async updateSettings(
    sessionId: string,
    settings: Partial<SessionSettings>
  ): Promise<void> {
    const session = this.sessions.get(sessionId)
    if (!session) {
      throw new Error(`Session not found: ${sessionId}`)
    }
    if (!session.query) {
      throw new Error(`Session ${sessionId} has no active query`)
    }

    console.log(`[Claude] Updating settings for session ${sessionId}:`, settings)

    if (settings.model !== undefined) {
      await session.query.setModel(settings.model)
      session.currentSettings.model = settings.model
    }

    if (settings.permissionMode !== undefined) {
      await session.query.setPermissionMode(settings.permissionMode)
      session.currentSettings.permissionMode = settings.permissionMode
    }

    if (settings.maxThinkingTokens !== undefined) {
      await session.query.setMaxThinkingTokens(settings.maxThinkingTokens)
      session.currentSettings.maxThinkingTokens = settings.maxThinkingTokens
    }

    session.updatedAt = new Date()
  }

  /**
   * Process the SDK query stream and emit events
   */
  private async processQueryStream(sessionId: string, sdkQuery: Query): Promise<void> {
    const session = this.sessions.get(sessionId)
    if (!session) return

    try {
      for await (const message of sdkQuery) {
        // Debug: log incoming SDK message types
        console.log('[Claude] SDK message type:', message.type)

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
      case 'stream_event': {
        // Handle streaming partial messages from the SDK
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const event = (message as any).event
        if (event?.type === 'content_block_delta' && event?.delta?.type === 'text_delta') {
          return { type: 'text_delta', text: event.delta.text || '' }
        }
        // Ignore other stream events (content_block_start, content_block_stop, etc.)
        return null
      }
      default:
        // Pass through other message types
        return message as ClaudeStreamEvent
    }
  }

  /**
   * Emit event based on type - both locally and to frontend via notifications
   */
  private emitEvent(sessionId: string, event: ClaudeStreamEvent): void {
    // Push to frontend via notification system (real-time streaming)
    const notificationEmitter = getNotificationEmitter()
    notificationEmitter.emitMessage(sessionId, event)

    // Also emit locally for any internal listeners
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

    // Create MCP server for Koda tools
    const kodaMcp = createKodaMCPServer(params.sessionId, session.workspaceId, getFrontendRpcClient())

    // Build SDK options with resume
    const sdkOptions: Options = {
      cwd: session.options?.workingDirectory || globalThis.process.cwd(),
      env: this.buildEnv(),
      abortController,
      resume: params.sessionId, // Use SDK's native resume
      mcpServers: {
        koda: kodaMcp,
      },
      // Enable streaming partial messages for real-time text display
      includePartialMessages: true,
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

/**
 * Continue an existing Claude session
 */
export async function claudeContinue(params: { sessionId: string; prompt: string }): Promise<ClaudeStartResult> {
  const handler = getClaudeHandler()
  return handler.continue(params)
}

/**
 * Update Claude session settings
 */
export async function claudeUpdateSettings(params: {
  sessionId: string
  model?: string
  permissionMode?: PermissionMode
  maxThinkingTokens?: number
}): Promise<void> {
  const handler = getClaudeHandler()
  const { sessionId, ...settings } = params
  return handler.updateSettings(sessionId, settings)
}
