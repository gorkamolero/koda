/**
 * Sidecar RPC Handlers Hook
 *
 * Registers handlers for MCP tool calls from Claude.
 * When Claude uses GetWorkspaceDiff or DiffComment tools,
 * these handlers respond with the appropriate data.
 */

import { useEffect, useRef } from 'react'
import { useSetAtom, useAtomValue } from 'jotai'
import { onGetDiff, onDiffComment } from '@/lib/sidecarRpc'
import { rpcRequest } from '@/lib/tauri'
import {
  addCommentAtom,
  diffFilesAtom,
  generateCommentId,
  type DiffComment,
} from '@/store/diff'

/**
 * Register RPC handlers for MCP tools
 *
 * This hook sets up handlers that respond to Claude's MCP tool calls:
 * - GetWorkspaceDiff: Returns the git diff for code review
 * - DiffComment: Adds review comments to the diff UI
 */
export function useSidecarRpcHandlers(worktreeId: string) {
  const addComment = useSetAtom(addCommentAtom)
  const files = useAtomValue(diffFilesAtom)

  // Track registration to avoid double-registering
  const registeredRef = useRef(false)

  useEffect(() => {
    if (!worktreeId || registeredRef.current) return

    registeredRef.current = true

    // GetDiff handler - Claude asks for workspace diff
    onGetDiff(async ({ stat, file }) => {
      try {
        const result = await rpcRequest<{
          diff: string
          mergeBase?: string
          error?: string
        }>('workspace.getDiff', {
          worktreeId,
          stat,
          file,
        })

        if (result.error) {
          return { diff: '', error: result.error }
        }

        return { diff: result.diff }
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err)
        return { diff: '', error: `Failed to get diff: ${message}` }
      }
    })

    // DiffComment handler - Claude posts review comments
    onDiffComment(({ comments }) => {
      const commentIds: string[] = []

      for (const comment of comments) {
        // Find fileId from path - match full path or suffix
        const file = files.find(
          (f) => f.path === comment.file || f.path.endsWith(comment.file)
        )

        if (!file) {
          console.warn(
            `[useSidecarRpcHandlers] File not found for comment: ${comment.file}`
          )
          continue
        }

        const id = generateCommentId()

        // Add comment to Jotai state
        const newComment: Omit<DiffComment, 'id' | 'createdAt' | 'updatedAt'> = {
          fileId: file.id,
          lineNumber: comment.lineNumber,
          side: 'modified', // Claude comments on the modified side
          content: comment.body,
          author: 'Claude',
          isReviewItem: true,
          reviewStatus: 'pending',
        }

        addComment(newComment)
        commentIds.push(id)
      }

      return {
        success: commentIds.length > 0,
        commentIds,
      }
    })

    // Cleanup on unmount (though handlers persist globally)
    return () => {
      registeredRef.current = false
    }
  }, [worktreeId, addComment, files])
}
