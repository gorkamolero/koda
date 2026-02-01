/**
 * Frontend RPC Client
 *
 * Enables the sidecar to call INTO the frontend for interactive operations.
 * This is the reverse of the normal flow (frontend → sidecar).
 *
 * Architecture:
 * - The frontend connects to the sidecar via Unix socket (existing)
 * - The sidecar can send JSON-RPC requests to the frontend over the same socket
 * - The frontend responds with JSON-RPC responses
 *
 * Methods the sidecar can call on the frontend:
 * - askUserQuestion: Show modal with questions, return answers
 * - getDiff: Get the current workspace diff
 * - diffComment: Post comments on the diff
 * - getTerminalOutput: Get output from terminal
 * - exitPlanMode: Signal that plan mode should exit
 */

import type * as net from 'node:net'
import { randomUUID } from 'node:crypto'
import { z } from 'zod'
import type { JsonRpcRequest, JsonRpcResponse } from '../types/rpc.js'

// ============================================================================
// Frontend RPC Method Names
// ============================================================================

export const FRONTEND_RPC_METHODS = {
  ASK_USER_QUESTION: 'askUserQuestion',
  GET_DIFF: 'getDiff',
  DIFF_COMMENT: 'diffComment',
  GET_TERMINAL_OUTPUT: 'getTerminalOutput',
  EXIT_PLAN_MODE: 'exitPlanMode',
} as const

// ============================================================================
// Response Schemas
// ============================================================================

export const AskUserQuestionResponseSchema = z.object({
  answers: z.array(
    z.object({
      question: z.string(),
      selectedOptions: z.array(z.string()),
      otherText: z.string().optional(),
    })
  ),
  cancelled: z.boolean(),
})

export const GetDiffResponseSchema = z.object({
  diff: z.string(),
  error: z.string().optional(),
})

export const DiffCommentResponseSchema = z.object({
  success: z.boolean(),
  commentIds: z.array(z.string()),
  error: z.string().optional(),
})

export const GetTerminalOutputResponseSchema = z.object({
  output: z.string(),
  source: z.string(),
  error: z.string().optional(),
})

export const ExitPlanModeResponseSchema = z.object({
  approved: z.boolean(),
})

// ============================================================================
// Types
// ============================================================================

export type AskUserQuestionResponse = z.infer<typeof AskUserQuestionResponseSchema>
export type GetDiffResponse = z.infer<typeof GetDiffResponseSchema>
export type DiffCommentResponse = z.infer<typeof DiffCommentResponseSchema>
export type GetTerminalOutputResponse = z.infer<typeof GetTerminalOutputResponseSchema>
export type ExitPlanModeResponse = z.infer<typeof ExitPlanModeResponseSchema>

/**
 * Pending request waiting for response
 */
interface PendingRequest {
  resolve: (result: unknown) => void
  reject: (error: Error) => void
  timeout: NodeJS.Timeout
}

// ============================================================================
// Frontend RPC Client
// ============================================================================

/**
 * Client for making RPC calls to the frontend
 */
export class FrontendRpcClient {
  private socket: net.Socket | null = null
  private pendingRequests: Map<string, PendingRequest> = new Map()
  private buffer = ''
  private defaultTimeoutMs = 60000 // 60 seconds for user interactions

  /**
   * Attach to an existing socket connection
   */
  attach(socket: net.Socket): void {
    this.socket = socket

    // Listen for responses from frontend
    socket.on('data', (data) => {
      this.handleData(data.toString())
    })

    socket.on('close', () => {
      // Reject all pending requests
      for (const [id, pending] of this.pendingRequests) {
        clearTimeout(pending.timeout)
        pending.reject(new Error('Socket closed'))
        this.pendingRequests.delete(id)
      }
      this.socket = null
    })
  }

  /**
   * Detach from the socket
   */
  detach(): void {
    this.socket = null
    // Clear pending requests
    for (const [id, pending] of this.pendingRequests) {
      clearTimeout(pending.timeout)
      pending.reject(new Error('Client detached'))
      this.pendingRequests.delete(id)
    }
  }

  /**
   * Check if connected
   */
  isConnected(): boolean {
    return this.socket !== null && !this.socket.destroyed
  }

  /**
   * Make an RPC call to the frontend
   */
  async call<T>(method: string, params?: unknown, timeoutMs?: number): Promise<T> {
    if (!this.socket || this.socket.destroyed) {
      throw new Error('Not connected to frontend')
    }

    const id = randomUUID()
    const request: JsonRpcRequest = {
      jsonrpc: '2.0',
      method,
      params,
      id,
    }

    return new Promise<T>((resolve, reject) => {
      const timeout = setTimeout(() => {
        this.pendingRequests.delete(id)
        reject(new Error(`Request timeout: ${method}`))
      }, timeoutMs ?? this.defaultTimeoutMs)

      this.pendingRequests.set(id, {
        resolve: resolve as (result: unknown) => void,
        reject,
        timeout,
      })

      // Send request
      const message = JSON.stringify(request) + '\n'
      this.socket?.write(message)
    })
  }

  /**
   * Handle incoming data from socket
   */
  private handleData(data: string): void {
    this.buffer += data

    // Process complete lines
    const lines = this.buffer.split('\n')
    this.buffer = lines.pop() ?? ''

    for (const line of lines) {
      const trimmed = line.trim()
      if (!trimmed) continue

      try {
        const message = JSON.parse(trimmed) as JsonRpcResponse

        // Check if this is a response to a pending request
        if (message.id && this.pendingRequests.has(String(message.id))) {
          const pending = this.pendingRequests.get(String(message.id))
          if (pending) {
            clearTimeout(pending.timeout)
            this.pendingRequests.delete(String(message.id))

            if ('error' in message && message.error) {
              pending.reject(new Error(message.error.message))
            } else if ('result' in message) {
              pending.resolve(message.result)
            }
          }
        }
      } catch {
        // Not valid JSON, ignore
      }
    }
  }

  // ============================================================================
  // Typed convenience methods
  // ============================================================================

  /**
   * Ask the user questions
   */
  async askUserQuestion(
    questions: Array<{
      question: string
      options: string[]
      multiSelect?: boolean
    }>
  ): Promise<AskUserQuestionResponse> {
    const result = await this.call(FRONTEND_RPC_METHODS.ASK_USER_QUESTION, { questions })
    return AskUserQuestionResponseSchema.parse(result)
  }

  /**
   * Get workspace diff
   */
  async getDiff(params: {
    workspaceId?: string | null
    stat?: boolean
    file?: string
  }): Promise<GetDiffResponse> {
    const result = await this.call(FRONTEND_RPC_METHODS.GET_DIFF, params)
    return GetDiffResponseSchema.parse(result)
  }

  /**
   * Post diff comments
   */
  async diffComment(params: {
    workspaceId?: string | null
    comments: Array<{
      file: string
      lineNumber: number
      body: string
    }>
  }): Promise<DiffCommentResponse> {
    const result = await this.call(FRONTEND_RPC_METHODS.DIFF_COMMENT, params)
    return DiffCommentResponseSchema.parse(result)
  }

  /**
   * Get terminal output
   */
  async getTerminalOutput(params: {
    workspaceId?: string | null
    source?: string
    maxLines?: number
  }): Promise<GetTerminalOutputResponse> {
    const result = await this.call(FRONTEND_RPC_METHODS.GET_TERMINAL_OUTPUT, params)
    return GetTerminalOutputResponseSchema.parse(result)
  }

  /**
   * Exit plan mode - requires frontend approval
   */
  async exitPlanMode(params: { turnId: number }): Promise<ExitPlanModeResponse> {
    const result = await this.call(FRONTEND_RPC_METHODS.EXIT_PLAN_MODE, params)
    return ExitPlanModeResponseSchema.parse(result)
  }
}

// ============================================================================
// Singleton
// ============================================================================

let clientInstance: FrontendRpcClient | null = null

/**
 * Get the singleton frontend RPC client
 */
export function getFrontendRpcClient(): FrontendRpcClient {
  if (!clientInstance) {
    clientInstance = new FrontendRpcClient()
  }
  return clientInstance
}
