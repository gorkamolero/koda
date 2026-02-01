/**
 * Koda MCP Server
 *
 * Creates an SDK-type MCP server that provides Koda-specific tools to Claude.
 * This server is hosted in-process by the Claude Agent SDK and enables:
 * - AskUserQuestion: Interactive Q&A with the user
 * - GetWorkspaceDiff: View workspace changes
 * - DiffComment: Post code review comments
 * - GetTerminalOutput: Read terminal/process output
 *
 * Architecture:
 * Claude invokes tool → SDK routes to MCP server → Server calls FrontendRpcClient → Frontend responds
 */

import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { z } from 'zod'
import { getFrontendRpcClient, type FrontendRpcClient } from '../rpc/frontendRpc.js'
import {
  type AskUserQuestionResult,
  type GetWorkspaceDiffResult,
  type DiffCommentResult,
  type GetTerminalOutputResult,
} from './kodaTools.js'

// ============================================================================
// MCP Server Factory
// ============================================================================

/**
 * Create a Koda MCP server for a specific session
 *
 * @param sessionId - The Claude session ID
 * @param workspaceId - The workspace ID for diff/comment operations
 * @param frontendRpc - Optional FrontendRpcClient override (for testing)
 * @returns SDK-type MCP server configuration
 */
export function createKodaMCPServer(
  sessionId: string,
  workspaceId: string,
  frontendRpc?: FrontendRpcClient
): { type: 'sdk'; name: string; instance: McpServer } {
  const mcpServer = new McpServer(
    { name: 'koda', version: '1.0.0' },
    { capabilities: { tools: {} } }
  )

  const getClient = () => frontendRpc ?? getFrontendRpcClient()

  // ============================================================================
  // AskUserQuestion Tool
  // ============================================================================
  mcpServer.tool(
    'AskUserQuestion',
    `Use this tool when you need to ask the user questions during execution. This allows you to:
1. Gather user preferences or requirements
2. Clarify ambiguous instructions
3. Get decisions on implementation choices
4. Offer choices to the user about what direction to take

IMPORTANT: An 'Other' option that allows free-form input is automatically provided to the user, so do NOT include 'Other' or similar options in your options array.`,
    {
      questions: z.array(
        z.object({
          question: z.string().describe('The question to ask the user'),
          options: z.array(z.string()).max(4).describe(
            'Available options for the user to choose from (max 4). Do not include "Other" - it is automatically provided.'
          ),
          multiSelect: z.boolean().optional().describe(
            'If true, user can select multiple options. Answers are comma-separated.'
          ),
        })
      ).max(4).describe('Up to 4 questions to ask the user'),
    },
    async (args: { questions: Array<{ question: string; options: string[]; multiSelect?: boolean }> }) => {
      console.log(`[kodaMCPServer] AskUserQuestion invoked for session ${sessionId}`)
      console.log(`[kodaMCPServer] Questions:`, JSON.stringify(args.questions, null, 2))

      const client = getClient()
      if (!client.isConnected()) {
        return {
          content: [{ type: 'text' as const, text: 'Error: Not connected to frontend' }],
        }
      }

      try {
        const result = await client.askUserQuestion(args.questions) as AskUserQuestionResult
        console.log(`[kodaMCPServer] Received answers for ${sessionId}:`, result)

        if (result.cancelled) {
          return {
            content: [{
              type: 'text' as const,
              text: 'User cancelled the question. Please continue without this information or ask in a different way.',
            }],
          }
        }

        const formatAnswer = (answer: { question: string; selectedOptions: string[]; otherText?: string }, index: number) => {
          const selections = answer.selectedOptions.map((s) => `   - ${s}`).join('\n')
          const other = answer.otherText ? `\n   - Other: ${answer.otherText}` : ''
          return `${index + 1}. ${answer.question}\n${selections}${other}`
        }

        return {
          content: [{
            type: 'text' as const,
            text: `User responses:\n${result.answers.map((answer, i) => formatAnswer(answer, i)).join('\n')}`,
          }],
        }
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error)
        return {
          content: [{ type: 'text' as const, text: `Error asking user: ${message}` }],
        }
      }
    }
  )

  // ============================================================================
  // GetWorkspaceDiff Tool
  // ============================================================================
  mcpServer.tool(
    'GetWorkspaceDiff',
    `You can use this tool to see what the user is currently working on, or when the user refers to the "workspace diff", "PR diff", or "all changes".
This compares all changes on the current branch (including uncommitted changes) against the merge base.
It's the same diff the user will see in the Koda UI, and the same diff that will be used in any PRs.
With stat: true, returns git diff --stat style output showing per-file statistics.
With file: 'path/to/file', returns the full unified diff for that specific file.
With no parameters, returns the full unified diff for all changes.`,
    {
      file: z.string().optional().describe('Absolute path to the file to show the unified diff for'),
      stat: z.boolean().optional().describe('If true, return git diff --stat style output with per-file statistics'),
    },
    async (args: { file?: string; stat?: boolean }) => {
      console.log(`[kodaMCPServer] GetWorkspaceDiff invoked for session ${sessionId}`)
      console.log(`[kodaMCPServer] getDiff args:`, JSON.stringify(args, null, 2))

      const client = getClient()
      if (!client.isConnected()) {
        return {
          content: [{ type: 'text' as const, text: 'Error: Not connected to frontend' }],
        }
      }

      try {
        const result = await client.getDiff({
          workspaceId,
          stat: args.stat,
          file: args.file,
        }) as GetWorkspaceDiffResult

        if (result.error) {
          return {
            content: [{ type: 'text' as const, text: `Error getting diff: ${result.error}` }],
          }
        }

        return {
          content: [{ type: 'text' as const, text: result.diff || 'No changes found.' }],
        }
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error)
        return {
          content: [{ type: 'text' as const, text: `Error getting diff: ${message}` }],
        }
      }
    }
  )

  // ============================================================================
  // DiffComment Tool
  // ============================================================================
  mcpServer.tool(
    'DiffComment',
    'Use this tool to leave comments on the user\'s diff during code review. Each comment targets a specific file and line number. Prefer plain text over markdown formatting.',
    {
      comments: z.array(
        z.object({
          file: z.string().describe('The file path to comment on'),
          lineNumber: z.number().describe('The line number to comment on'),
          body: z.string().describe('The comment body/content'),
        })
      ).describe('Comments to post on the diff'),
    },
    async (args: { comments: Array<{ file: string; lineNumber: number; body: string }> }) => {
      console.log(`[kodaMCPServer] DiffComment invoked for session ${sessionId}`)

      const client = getClient()
      if (!client.isConnected()) {
        return {
          content: [{ type: 'text' as const, text: 'Error: Not connected to frontend' }],
        }
      }

      try {
        const result = await client.diffComment({
          workspaceId,
          comments: args.comments,
        }) as DiffCommentResult

        return {
          content: [{
            type: 'text' as const,
            text: result.success
              ? `Posted ${args.comments.length} comment(s) on the diff.`
              : `Failed to post comments: ${result.error || 'Unknown error'}`,
          }],
        }
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error)
        return {
          content: [{ type: 'text' as const, text: `Error posting comments: ${message}` }],
        }
      }
    }
  )

  // ============================================================================
  // GetTerminalOutput Tool
  // ============================================================================
  mcpServer.tool(
    'GetTerminalOutput',
    `Use this tool to view terminal output in the user's workspace. This is helpful when:
- You need to see the output of a running command (like a dev server)
- You want to check for errors or logs from a build/test process
- The user mentions output they're seeing in their terminal
- You need to debug issues with a running process

Returns the terminal output along with information about what type of terminal it came from.`,
    {
      source: z.enum(['spotlight', 'run_script', 'terminal', 'auto']).optional().describe(
        'Which terminal to read from: "spotlight" (spotlight testing process), "run_script" (dev server/run script), "terminal" (user\'s interactive terminal), or "auto" (automatically select the most relevant). Defaults to "auto".'
      ),
      maxLines: z.number().optional().describe('Maximum number of lines to return. Defaults to 1000.'),
    },
    async (args: { source?: 'spotlight' | 'run_script' | 'terminal' | 'auto'; maxLines?: number }) => {
      console.log(`[kodaMCPServer] GetTerminalOutput invoked for session ${sessionId}`)
      console.log(`[kodaMCPServer] GetTerminalOutput args:`, JSON.stringify(args, null, 2))

      const client = getClient()
      if (!client.isConnected()) {
        return {
          content: [{ type: 'text' as const, text: 'Error: Not connected to frontend' }],
        }
      }

      try {
        const result = await client.getTerminalOutput({
          workspaceId,
          source: args.source,
          maxLines: args.maxLines,
        }) as GetTerminalOutputResult

        if (result.error) {
          return {
            content: [{ type: 'text' as const, text: `Error getting terminal output: ${result.error}` }],
          }
        }

        if (result.source === 'none') {
          return {
            content: [{
              type: 'text' as const,
              text: 'No terminal output available. No active terminal, run script, or spotlight process found.',
            }],
          }
        }

        const sourceLabel =
          result.source === 'spotlight' ? 'Spotlight'
          : result.source === 'run_script' ? 'Run script'
          : 'Terminal'

        const header = `[${sourceLabel}]\n`

        return {
          content: [{
            type: 'text' as const,
            text: result.output ? header + result.output : `${header}No output available yet.`,
          }],
        }
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error)
        return {
          content: [{ type: 'text' as const, text: `Error getting terminal output: ${message}` }],
        }
      }
    }
  )

  return { type: 'sdk', name: 'koda', instance: mcpServer }
}

// ============================================================================
// Helper Types (re-exported for convenience)
// ============================================================================

export type { AskUserQuestionResult, GetWorkspaceDiffResult, DiffCommentResult, GetTerminalOutputResult }
