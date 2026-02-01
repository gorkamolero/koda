/**
 * Sidecar Notifications
 *
 * JSON-RPC 2.0 notifications are one-way messages (no response expected).
 * The sidecar uses these to stream real-time updates to the frontend.
 *
 * Notification types:
 * - message: Streaming assistant response chunks
 * - queryError: Error during query processing
 * - enterPlanMode: Claude entered plan mode
 * - toolUse: Tool invocation started
 * - toolResult: Tool invocation completed
 * - contextUsage: Token usage update
 * - sessionStatus: Session status change
 */

import type * as net from 'node:net'
import type { ClaudeStreamEvent, TokenUsage } from '../agents/claude.js'

// ============================================================================
// Notification Types
// ============================================================================

export const SIDECAR_NOTIFICATIONS = {
  MESSAGE: 'message',
  QUERY_ERROR: 'queryError',
  ENTER_PLAN_MODE: 'enterPlanModeNotification',
  TOOL_USE: 'toolUse',
  TOOL_RESULT: 'toolResult',
  CONTEXT_USAGE: 'contextUsage',
  SESSION_STATUS: 'sessionStatus',
  PTY_DATA: 'pty.data',
  PTY_EXIT: 'pty.exit',
} as const

// ============================================================================
// Notification Payloads
// ============================================================================

/**
 * Message notification payload
 */
export interface MessageNotification {
  sessionId: string
  event: ClaudeStreamEvent
  timestamp: number
}

/**
 * Query error notification payload
 */
export interface QueryErrorNotification {
  sessionId: string
  error: string
  code?: string
  recoverable?: boolean
}

/**
 * Enter plan mode notification payload
 */
export interface EnterPlanModeNotification {
  sessionId: string
  planFile?: string
}

/**
 * Tool use notification payload
 */
export interface ToolUseNotification {
  sessionId: string
  toolName: string
  toolId: string
  input: unknown
}

/**
 * Tool result notification payload
 */
export interface ToolResultNotification {
  sessionId: string
  toolName: string
  toolId: string
  output: unknown
  isError: boolean
  durationMs?: number
}

/**
 * Context usage notification payload
 */
export interface ContextUsageNotification {
  sessionId: string
  usage: TokenUsage
  contextUsedPercent: number
}

/**
 * Session status notification payload
 */
export interface SessionStatusNotification {
  sessionId: string
  status: 'idle' | 'running' | 'paused' | 'compacting' | 'completed' | 'error' | 'cancelled'
  message?: string
}

/**
 * PTY data notification payload
 */
export interface PtyDataNotification {
  sessionId: string
  data: string
}

/**
 * PTY exit notification payload
 */
export interface PtyExitNotification {
  sessionId: string
  exitCode: number
}

// ============================================================================
// JSON-RPC Notification Format
// ============================================================================

/**
 * JSON-RPC 2.0 notification (no id field)
 */
export interface JsonRpcNotification<T = unknown> {
  jsonrpc: '2.0'
  method: string
  params: T
}

// ============================================================================
// Notification Emitter
// ============================================================================

/**
 * Emits notifications to connected frontend clients
 */
export class NotificationEmitter {
  private sockets: Set<net.Socket> = new Set()

  /**
   * Register a socket to receive notifications
   */
  addSocket(socket: net.Socket): void {
    this.sockets.add(socket)

    socket.on('close', () => {
      this.sockets.delete(socket)
    })

    socket.on('error', () => {
      this.sockets.delete(socket)
    })
  }

  /**
   * Remove a socket
   */
  removeSocket(socket: net.Socket): void {
    this.sockets.delete(socket)
  }

  /**
   * Get connected socket count
   */
  get socketCount(): number {
    return this.sockets.size
  }

  /**
   * Send a notification to all connected clients
   */
  emit<T>(method: string, params: T): void {
    const notification: JsonRpcNotification<T> = {
      jsonrpc: '2.0',
      method,
      params,
    }

    const message = JSON.stringify(notification) + '\n'

    for (const socket of this.sockets) {
      if (!socket.destroyed) {
        socket.write(message)
      }
    }
  }

  // ============================================================================
  // Typed notification methods
  // ============================================================================

  /**
   * Emit a message notification (streaming response)
   */
  emitMessage(sessionId: string, event: ClaudeStreamEvent): void {
    this.emit<MessageNotification>(SIDECAR_NOTIFICATIONS.MESSAGE, {
      sessionId,
      event,
      timestamp: Date.now(),
    })
  }

  /**
   * Emit a query error notification
   */
  emitQueryError(sessionId: string, error: string, code?: string, recoverable?: boolean): void {
    this.emit<QueryErrorNotification>(SIDECAR_NOTIFICATIONS.QUERY_ERROR, {
      sessionId,
      error,
      code,
      recoverable,
    })
  }

  /**
   * Emit enter plan mode notification
   */
  emitEnterPlanMode(sessionId: string, planFile?: string): void {
    this.emit<EnterPlanModeNotification>(SIDECAR_NOTIFICATIONS.ENTER_PLAN_MODE, {
      sessionId,
      planFile,
    })
  }

  /**
   * Emit tool use notification
   */
  emitToolUse(sessionId: string, toolName: string, toolId: string, input: unknown): void {
    this.emit<ToolUseNotification>(SIDECAR_NOTIFICATIONS.TOOL_USE, {
      sessionId,
      toolName,
      toolId,
      input,
    })
  }

  /**
   * Emit tool result notification
   */
  emitToolResult(
    sessionId: string,
    toolName: string,
    toolId: string,
    output: unknown,
    isError: boolean,
    durationMs?: number
  ): void {
    this.emit<ToolResultNotification>(SIDECAR_NOTIFICATIONS.TOOL_RESULT, {
      sessionId,
      toolName,
      toolId,
      output,
      isError,
      durationMs,
    })
  }

  /**
   * Emit context usage notification
   */
  emitContextUsage(sessionId: string, usage: TokenUsage, contextUsedPercent: number): void {
    this.emit<ContextUsageNotification>(SIDECAR_NOTIFICATIONS.CONTEXT_USAGE, {
      sessionId,
      usage,
      contextUsedPercent,
    })
  }

  /**
   * Emit session status notification
   */
  emitSessionStatus(
    sessionId: string,
    status: SessionStatusNotification['status'],
    message?: string
  ): void {
    this.emit<SessionStatusNotification>(SIDECAR_NOTIFICATIONS.SESSION_STATUS, {
      sessionId,
      status,
      message,
    })
  }

  /**
   * Emit PTY data notification (terminal output)
   */
  emitPtyData(sessionId: string, data: string): void {
    this.emit<PtyDataNotification>(SIDECAR_NOTIFICATIONS.PTY_DATA, {
      sessionId,
      data,
    })
  }

  /**
   * Emit PTY exit notification
   */
  emitPtyExit(sessionId: string, exitCode: number): void {
    this.emit<PtyExitNotification>(SIDECAR_NOTIFICATIONS.PTY_EXIT, {
      sessionId,
      exitCode,
    })
  }
}

// ============================================================================
// Singleton
// ============================================================================

let emitterInstance: NotificationEmitter | null = null

/**
 * Get the singleton notification emitter
 */
export function getNotificationEmitter(): NotificationEmitter {
  if (!emitterInstance) {
    emitterInstance = new NotificationEmitter()
  }
  return emitterInstance
}
