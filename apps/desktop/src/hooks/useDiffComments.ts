/**
 * useDiffComments
 *
 * Syncs diff comments via Liveblocks CRDT.
 * Allows multiple users to add comments on the same diff.
 */

import { useCallback, useMemo } from 'react'
import { useStorage, useMutation, LiveObject, type CommentData } from '@/lib/liveblocks'
import { getMachineId, getMachineName } from '@/lib/machineId'
import { useIsCollaborationAvailable } from '@/components/CollaborativeWorkspaceProvider'

export interface DiffComment {
  id: string
  userId: string
  userName: string
  filePath: string
  lineNumber: number
  body: string
  resolved: boolean
  timestamp: number
  parentId?: string
}

export interface UseDiffCommentsResult {
  /** All comments */
  comments: DiffComment[]
  /** Comments for a specific file */
  getCommentsForFile: (filePath: string) => DiffComment[]
  /** Comments for a specific line */
  getCommentsForLine: (filePath: string, lineNumber: number) => DiffComment[]
  /** Add a new comment */
  addComment: (filePath: string, lineNumber: number, body: string) => void
  /** Reply to a comment */
  replyToComment: (parentId: string, body: string) => void
  /** Resolve a comment */
  resolveComment: (commentId: string) => void
  /** Unresolve a comment */
  unresolveComment: (commentId: string) => void
  /** Delete a comment (only own comments) */
  deleteComment: (commentId: string) => void
  /** Whether collaboration is available */
  isAvailable: boolean
}

export function useDiffComments(): UseDiffCommentsResult {
  const isAvailable = useIsCollaborationAvailable()
  const machineId = getMachineId()
  const machineName = getMachineName()

  // Read comments from storage
  const commentsStorage = useStorage((root) => root.comments)

  // Convert to array
  const comments = useMemo((): DiffComment[] => {
    if (!commentsStorage || !isAvailable) return []
    // Storage returns immutable data
    return commentsStorage as unknown as DiffComment[]
  }, [commentsStorage, isAvailable])

  // Get comments for a file
  const getCommentsForFile = useCallback(
    (filePath: string): DiffComment[] => {
      return comments.filter((c) => c.filePath === filePath)
    },
    [comments]
  )

  // Get comments for a specific line
  const getCommentsForLine = useCallback(
    (filePath: string, lineNumber: number): DiffComment[] => {
      return comments.filter(
        (c) => c.filePath === filePath && c.lineNumber === lineNumber
      )
    },
    [comments]
  )

  // Add comment mutation
  const addComment = useMutation(
    ({ storage }, filePath: string, lineNumber: number, body: string) => {
      const comments = storage.get('comments')
      const comment: CommentData = {
        id: crypto.randomUUID(),
        userId: machineId,
        userName: machineName,
        filePath,
        lineNumber,
        body,
        resolved: false,
        timestamp: Date.now(),
        parentId: null,
      }
      comments.push(new LiveObject(comment))
    },
    [machineId, machineName]
  )

  // Reply to comment mutation
  const replyToComment = useMutation(
    ({ storage }, parentId: string, body: string) => {
      const comments = storage.get('comments')
      // Find parent to get file/line info
      const commentsArray = comments.toArray()
      const parent = commentsArray.find((c) => c.get('id') === parentId)
      if (!parent) return

      const comment: CommentData = {
        id: crypto.randomUUID(),
        userId: machineId,
        userName: machineName,
        filePath: parent.get('filePath'),
        lineNumber: parent.get('lineNumber'),
        body,
        resolved: false,
        timestamp: Date.now(),
        parentId,
      }
      comments.push(new LiveObject(comment))
    },
    [machineId, machineName]
  )

  // Resolve comment mutation
  const resolveComment = useMutation(({ storage }, commentId: string) => {
    const comments = storage.get('comments')
    const commentsArray = comments.toArray()
    const index = commentsArray.findIndex((c) => c.get('id') === commentId)
    if (index !== -1 && commentsArray[index]) {
      commentsArray[index].set('resolved', true)
    }
  }, [])

  // Unresolve comment mutation
  const unresolveComment = useMutation(({ storage }, commentId: string) => {
    const comments = storage.get('comments')
    const commentsArray = comments.toArray()
    const index = commentsArray.findIndex((c) => c.get('id') === commentId)
    if (index !== -1 && commentsArray[index]) {
      commentsArray[index].set('resolved', false)
    }
  }, [])

  // Delete comment mutation (only own comments)
  const deleteComment = useMutation(
    ({ storage }, commentId: string) => {
      const comments = storage.get('comments')
      const commentsArray = comments.toArray()
      const index = commentsArray.findIndex(
        (c) => c.get('id') === commentId && c.get('userId') === machineId
      )
      if (index !== -1) {
        comments.delete(index)
      }
    },
    [machineId]
  )

  // Return no-op functions when not available
  if (!isAvailable) {
    return {
      comments: [],
      getCommentsForFile: () => [],
      getCommentsForLine: () => [],
      addComment: () => {},
      replyToComment: () => {},
      resolveComment: () => {},
      unresolveComment: () => {},
      deleteComment: () => {},
      isAvailable: false,
    }
  }

  return {
    comments,
    getCommentsForFile,
    getCommentsForLine,
    addComment,
    replyToComment,
    resolveComment,
    unresolveComment,
    deleteComment,
    isAvailable: true,
  }
}
