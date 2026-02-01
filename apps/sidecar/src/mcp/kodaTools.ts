/**
 * Koda MCP Tools
 *
 * Custom MCP tools that enable bidirectional communication between
 * Claude and the frontend. These tools allow Claude to:
 * - Ask the user questions mid-response
 * - Get the current workspace diff
 * - Post code review comments
 * - Read terminal output
 *
 * Architecture:
 * Claude invokes tool → Sidecar receives → Sidecar calls frontend RPC → Frontend responds → Sidecar returns to Claude
 */

import { z } from 'zod'
import type { FrontendRpcClient } from '../rpc/frontendRpc.js'

// ============================================================================
// Zod Schemas
// ============================================================================

/**
 * Question option for AskUserQuestion
 */
export const QuestionOptionSchema = z.object({
  question: z.string().describe('The question to ask the user'),
  options: z.array(z.string()).max(4).describe('Up to 4 options (an "Other" option is auto-provided)'),
  multiSelect: z.boolean().optional().describe('Allow selecting multiple options'),
})

/**
 * AskUserQuestion input schema
 */
export const AskUserQuestionInputSchema = z.object({
  questions: z.array(QuestionOptionSchema).max(4).describe('Up to 4 questions to ask'),
})

/**
 * GetWorkspaceDiff input schema
 */
export const GetWorkspaceDiffInputSchema = z.object({
  stat: z.boolean().optional().describe('Return --stat style output instead of full diff'),
  file: z.string().optional().describe('Return diff for a specific file only'),
})

/**
 * DiffComment schema
 */
export const DiffCommentSchema = z.object({
  file: z.string().describe('File path relative to repo root'),
  lineNumber: z.number().int().positive().describe('Line number in the file'),
  body: z.string().describe('Comment text (plain text preferred over markdown)'),
})

/**
 * DiffComment input schema
 */
export const DiffCommentInputSchema = z.object({
  comments: z.array(DiffCommentSchema).describe('Comments to post on the diff'),
})

/**
 * GetTerminalOutput input schema
 */
export const GetTerminalOutputInputSchema = z.object({
  source: z
    .enum(['spotlight', 'run_script', 'terminal', 'auto'])
    .optional()
    .describe('Terminal source to read from'),
  maxLines: z.number().int().positive().optional().describe('Maximum lines to return'),
})

// ============================================================================
// Types
// ============================================================================

export type QuestionOption = z.infer<typeof QuestionOptionSchema>
export type AskUserQuestionInput = z.infer<typeof AskUserQuestionInputSchema>
export type GetWorkspaceDiffInput = z.infer<typeof GetWorkspaceDiffInputSchema>
export type DiffCommentInput = z.infer<typeof DiffCommentInputSchema>
export type GetTerminalOutputInput = z.infer<typeof GetTerminalOutputInputSchema>

/**
 * Answer to a single question
 */
export interface QuestionAnswer {
  question: string
  selectedOptions: string[]
  otherText?: string
}

/**
 * Result of AskUserQuestion
 */
export interface AskUserQuestionResult {
  answers: QuestionAnswer[]
  cancelled: boolean
}

/**
 * Result of GetWorkspaceDiff
 */
export interface GetWorkspaceDiffResult {
  diff: string
  error?: string
}

/**
 * Result of DiffComment
 */
export interface DiffCommentResult {
  success: boolean
  commentIds: string[]
  error?: string
}

/**
 * Result of GetTerminalOutput
 */
export interface GetTerminalOutputResult {
  output: string
  source: string
  error?: string
}

// ============================================================================
// MCP Tool Definitions
// ============================================================================

/**
 * MCP tool definition format
 */
export interface McpToolDefinition {
  name: string
  description: string
  inputSchema: z.ZodType
}

/**
 * All Koda MCP tools
 */
export const KODA_MCP_TOOLS: McpToolDefinition[] = [
  {
    name: 'AskUserQuestion',
    description: `Ask the user questions during execution. Allows gathering preferences, clarifying instructions,
getting decisions on implementation choices, or offering choices about direction.
An "Other" option with free-form input is automatically provided.`,
    inputSchema: AskUserQuestionInputSchema,
  },
  {
    name: 'GetWorkspaceDiff',
    description: `View the current workspace diff comparing all changes on the current branch
(including uncommitted changes) against the merge base. Use stat:true for per-file statistics,
or file:'path' for a specific file's diff.`,
    inputSchema: GetWorkspaceDiffInputSchema,
  },
  {
    name: 'DiffComment',
    description: `Post code review comments on the workspace diff. Each comment targets a specific
file and line number. Prefer plain text over markdown formatting.`,
    inputSchema: DiffCommentInputSchema,
  },
  {
    name: 'GetTerminalOutput',
    description: `View terminal output from the user's workspace. Useful for seeing output from
dev servers, build processes, or debugging running processes.`,
    inputSchema: GetTerminalOutputInputSchema,
  },
]

// ============================================================================
// Tool Handlers
// ============================================================================

/**
 * Koda MCP tool handler
 *
 * Bridges MCP tool invocations to frontend RPC calls.
 */
export class KodaToolHandler {
  private frontendRpc: FrontendRpcClient | null = null
  private workspaceId: string | null = null

  /**
   * Set the frontend RPC client for this handler
   */
  setFrontendRpc(client: FrontendRpcClient): void {
    this.frontendRpc = client
  }

  /**
   * Set the current workspace context
   */
  setWorkspaceId(workspaceId: string): void {
    this.workspaceId = workspaceId
  }

  /**
   * Handle a tool invocation
   */
  async handleTool(name: string, input: unknown): Promise<unknown> {
    if (!this.frontendRpc) {
      throw new Error('Frontend RPC client not initialized')
    }

    switch (name) {
      case 'AskUserQuestion':
        return this.handleAskUserQuestion(AskUserQuestionInputSchema.parse(input))

      case 'GetWorkspaceDiff':
        return this.handleGetWorkspaceDiff(GetWorkspaceDiffInputSchema.parse(input))

      case 'DiffComment':
        return this.handleDiffComment(DiffCommentInputSchema.parse(input))

      case 'GetTerminalOutput':
        return this.handleGetTerminalOutput(GetTerminalOutputInputSchema.parse(input))

      default:
        throw new Error(`Unknown tool: ${name}`)
    }
  }

  /**
   * Handle AskUserQuestion tool
   */
  private async handleAskUserQuestion(input: AskUserQuestionInput): Promise<AskUserQuestionResult> {
    if (!this.frontendRpc) {
      throw new Error('Frontend RPC not available')
    }

    return this.frontendRpc.call('askUserQuestion', {
      questions: input.questions,
    })
  }

  /**
   * Handle GetWorkspaceDiff tool
   */
  private async handleGetWorkspaceDiff(input: GetWorkspaceDiffInput): Promise<GetWorkspaceDiffResult> {
    if (!this.frontendRpc) {
      throw new Error('Frontend RPC not available')
    }

    return this.frontendRpc.call('getDiff', {
      workspaceId: this.workspaceId,
      stat: input.stat,
      file: input.file,
    })
  }

  /**
   * Handle DiffComment tool
   */
  private async handleDiffComment(input: DiffCommentInput): Promise<DiffCommentResult> {
    if (!this.frontendRpc) {
      throw new Error('Frontend RPC not available')
    }

    return this.frontendRpc.call('diffComment', {
      workspaceId: this.workspaceId,
      comments: input.comments,
    })
  }

  /**
   * Handle GetTerminalOutput tool
   */
  private async handleGetTerminalOutput(input: GetTerminalOutputInput): Promise<GetTerminalOutputResult> {
    if (!this.frontendRpc) {
      throw new Error('Frontend RPC not available')
    }

    return this.frontendRpc.call('getTerminalOutput', {
      workspaceId: this.workspaceId,
      source: input.source,
      maxLines: input.maxLines,
    })
  }
}

// ============================================================================
// Singleton
// ============================================================================

let handlerInstance: KodaToolHandler | null = null

/**
 * Get the singleton tool handler instance
 */
export function getKodaToolHandler(): KodaToolHandler {
  if (!handlerInstance) {
    handlerInstance = new KodaToolHandler()
  }
  return handlerInstance
}
