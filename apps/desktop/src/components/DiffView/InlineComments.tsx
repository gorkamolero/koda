import { Button, Textarea } from '@koda/ui'
import { useState, useCallback, useRef, useEffect } from 'react'
import { useAtomValue, useSetAtom } from 'jotai'
import {
  activeCommentInputAtom,
  addCommentAtom,
  updateCommentAtom,
  deleteCommentAtom,
  currentFileCommentsAtom,
  reviewItemsCountAtom,
  type DiffComment,
} from '@/store/diff'

/**
 * Inline comment input and display component
 */
export function InlineComments() {
  const activeInput = useAtomValue(activeCommentInputAtom)
  const comments = useAtomValue(currentFileCommentsAtom)
  const reviewCount = useAtomValue(reviewItemsCountAtom)
  const setActiveInput = useSetAtom(activeCommentInputAtom)
  const addComment = useSetAtom(addCommentAtom)
  const updateComment = useSetAtom(updateCommentAtom)
  const deleteComment = useSetAtom(deleteCommentAtom)

  const [commentText, setCommentText] = useState('')
  const [selectedComment, setSelectedComment] = useState<DiffComment | null>(null)
  const [isEditing, setIsEditing] = useState(false)
  const [editText, setEditText] = useState('')
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)

  const inputRef = useRef<HTMLTextAreaElement>(null)
  const editInputRef = useRef<HTMLTextAreaElement>(null)

  // Focus input when opened
  useEffect(() => {
    if (activeInput && inputRef.current) {
      inputRef.current.focus()
    }
  }, [activeInput])

  // Focus edit input when editing
  useEffect(() => {
    if (isEditing && editInputRef.current) {
      editInputRef.current.focus()
    }
  }, [isEditing])

  // Handle escape key to close inputs
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (activeInput) {
          setActiveInput(null)
          setCommentText('')
        }
        if (isEditing) {
          setIsEditing(false)
          setEditText('')
        }
        if (showDeleteConfirm) {
          setShowDeleteConfirm(false)
        }
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => { window.removeEventListener('keydown', handleKeyDown) }
  }, [activeInput, isEditing, showDeleteConfirm, setActiveInput])

  const handleSubmitComment = useCallback(() => {
    if (!activeInput || !commentText.trim()) return

    addComment({
      fileId: activeInput.fileId,
      lineNumber: activeInput.lineNumber,
      side: activeInput.side,
      content: commentText.trim(),
      author: 'User', // TODO: Get from auth context
      isReviewItem: true,
      reviewStatus: 'pending',
    })

    setCommentText('')
    setActiveInput(null)
  }, [activeInput, commentText, addComment, setActiveInput])

  const handleCancelComment = useCallback(() => {
    setActiveInput(null)
    setCommentText('')
  }, [setActiveInput])

  const handleEditComment = useCallback((comment: DiffComment) => {
    setSelectedComment(comment)
    setEditText(comment.content)
    setIsEditing(true)
  }, [])

  const handleSaveEdit = useCallback(() => {
    if (!selectedComment || !editText.trim()) return

    updateComment({
      id: selectedComment.id,
      update: { content: editText.trim() },
    })

    setIsEditing(false)
    setEditText('')
    setSelectedComment(null)
  }, [selectedComment, editText, updateComment])

  const handleDeleteComment = useCallback(() => {
    if (!selectedComment) return

    deleteComment(selectedComment.id)
    setShowDeleteConfirm(false)
    setSelectedComment(null)
  }, [selectedComment, deleteComment])

  const handleCommentMarkerClick = useCallback((comment: DiffComment) => {
    setSelectedComment(comment)
  }, [])

  return (
    <>
      {/* Review count indicator */}
      <div
        className="absolute top-2 right-2 flex items-center gap-1 px-2 py-1 bg-primary/10 rounded-md"
        data-testid="diff-review-count"
      >
        <svg
          className="w-4 h-4 text-primary"
          fill="currentColor"
          viewBox="0 0 20 20"
        >
          <path
            fillRule="evenodd"
            d="M18 10c0 3.866-3.582 7-8 7a8.841 8.841 0 01-4.083-.98L2 17l1.338-3.123C2.493 12.767 2 11.434 2 10c0-3.866 3.582-7 8-7s8 3.134 8 7zM7 9H5v2h2V9zm8 0h-2v2h2V9zM9 9h2v2H9V9z"
            clipRule="evenodd"
          />
        </svg>
        <span className="text-sm font-medium text-primary">{reviewCount}</span>
      </div>

      {/* New comment input */}
      {activeInput && (
        <div
          className="absolute z-20 bg-background border border-border rounded-lg shadow-lg p-3 w-80"
          style={{
            top: `${String((activeInput.lineNumber - 1) * 20 + 40)}px`,
            left: activeInput.side === 'original' ? 'calc(var(--space-12) + var(--space-0_5))' : '50%',
          }}
          data-testid="diff-comment-input-container"
        >
          <div className="mb-2 text-xs text-muted-foreground">
            Line {activeInput.lineNumber} ({activeInput.side})
          </div>
          <Textarea
            ref={inputRef}
            value={commentText}
            onChange={(e) => { setCommentText(e.target.value) }}
            className="w-full h-20 px-3 py-2 text-sm bg-secondary border border-border rounded-md resize-none focus:outline-none focus:ring-2 focus:ring-primary"
            placeholder="Add a review comment..."
            data-testid="diff-comment-input"
          />
          <div className="flex justify-end gap-2 mt-2">
            <Button variant="unstyled"
              type="button"
              onClick={handleCancelComment}
              className="px-3 py-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
              data-testid="diff-comment-cancel"
            >
              Cancel
            </Button>
            <Button variant="unstyled"
              type="button"
              onClick={handleSubmitComment}
              disabled={!commentText.trim()}
              className="px-3 py-1.5 text-sm bg-primary text-primary-foreground rounded-md hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              data-testid="diff-comment-submit"
            >
              Comment
            </Button>
          </div>
        </div>
      )}

      {/* Comment popup */}
      {selectedComment && !isEditing && !showDeleteConfirm && (
        <div
          className="absolute z-20 bg-background border border-border rounded-lg shadow-lg p-3 w-80"
          style={{
            top: `${String((selectedComment.lineNumber - 1) * 20 + 40)}px`,
            left: selectedComment.side === 'original' ? 'calc(var(--space-12) + var(--space-0_5))' : '50%',
          }}
          data-testid="diff-comment-popup"
        >
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <div className="w-6 h-6 bg-primary/20 rounded-full flex items-center justify-center">
                <span className="text-xs font-medium text-primary">
                  {selectedComment.author.charAt(0)}
                </span>
              </div>
              <span className="text-sm font-medium">{selectedComment.author}</span>
            </div>
            <div className="flex items-center gap-1">
              <Button variant="unstyled"
                type="button"
                onClick={() => { handleEditComment(selectedComment) }}
                className="p-1 text-muted-foreground hover:text-foreground transition-colors"
                data-testid="diff-comment-edit"
                aria-label="Edit comment"
              >
                <svg
                  className="w-4 h-4"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"
                  />
                </svg>
              </Button>
              <Button variant="unstyled"
                type="button"
                onClick={() => { setShowDeleteConfirm(true) }}
                className="p-1 text-muted-foreground hover:text-status-error transition-colors"
                data-testid="diff-comment-delete"
                aria-label="Delete comment"
              >
                <svg
                  className="w-4 h-4"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                  />
                </svg>
              </Button>
              <Button variant="unstyled"
                type="button"
                onClick={() => { setSelectedComment(null) }}
                className="p-1 text-muted-foreground hover:text-foreground transition-colors"
                aria-label="Close"
              >
                <svg
                  className="w-4 h-4"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M6 18L18 6M6 6l12 12"
                  />
                </svg>
              </Button>
            </div>
          </div>
          <p className="text-sm text-foreground">{selectedComment.content}</p>
          <div className="mt-2 text-xs text-muted-foreground">
            Line {selectedComment.lineNumber} ({selectedComment.side})
          </div>
        </div>
      )}

      {/* Edit comment popup */}
      {isEditing && selectedComment && (
        <div
          className="absolute z-20 bg-background border border-border rounded-lg shadow-lg p-3 w-80"
          style={{
            top: `${String((selectedComment.lineNumber - 1) * 20 + 40)}px`,
            left: selectedComment.side === 'original' ? 'calc(var(--space-12) + var(--space-0_5))' : '50%',
          }}
          data-testid="diff-comment-edit-container"
        >
          <div className="mb-2 text-sm font-medium">Edit Comment</div>
          <Textarea
            ref={editInputRef}
            value={editText}
            onChange={(e) => { setEditText(e.target.value) }}
            className="w-full h-20 px-3 py-2 text-sm bg-secondary border border-border rounded-md resize-none focus:outline-none focus:ring-2 focus:ring-primary"
            data-testid="diff-comment-edit-input"
          />
          <div className="flex justify-end gap-2 mt-2">
            <Button variant="unstyled"
              type="button"
              onClick={() => {
                setIsEditing(false)
                setEditText('')
              }}
              className="px-3 py-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
            >
              Cancel
            </Button>
            <Button variant="unstyled"
              type="button"
              onClick={handleSaveEdit}
              disabled={!editText.trim()}
              className="px-3 py-1.5 text-sm bg-primary text-primary-foreground rounded-md hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              data-testid="diff-comment-save"
            >
              Save
            </Button>
          </div>
        </div>
      )}

      {/* Delete confirmation popup */}
      {showDeleteConfirm && selectedComment && (
        <div
          className="absolute z-20 bg-background border border-border rounded-lg shadow-lg p-3 w-80"
          style={{
            top: `${String((selectedComment.lineNumber - 1) * 20 + 40)}px`,
            left: selectedComment.side === 'original' ? 'calc(var(--space-12) + var(--space-0_5))' : '50%',
          }}
          data-testid="diff-comment-delete-container"
        >
          <div className="mb-2 text-sm font-medium">Delete Comment?</div>
          <p className="text-sm text-muted-foreground mb-3">
            This action cannot be undone.
          </p>
          <div className="flex justify-end gap-2">
            <Button variant="unstyled"
              type="button"
              onClick={() => { setShowDeleteConfirm(false) }}
              className="px-3 py-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
            >
              Cancel
            </Button>
            <Button variant="unstyled"
              type="button"
              onClick={handleDeleteComment}
              className="px-3 py-1.5 text-sm bg-status-error text-inverse rounded-md hover:bg-status-error/90 transition-colors"
              data-testid="diff-comment-delete-confirm"
            >
              Delete
            </Button>
          </div>
        </div>
      )}

      {/* Click handlers for comment markers - expose as hook for DiffEditor */}
      {comments.map((comment) => (
        <Button variant="unstyled"
          key={comment.id}
          type="button"
          className="absolute w-4 h-4 bg-primary rounded-full cursor-pointer hover:scale-110 transition-transform z-10"
          style={{
            top: `${String((comment.lineNumber - 1) * 20 + 28)}px`,
            left: comment.side === 'original' ? 'var(--space-1)' : '50%',
          }}
          onClick={() => { handleCommentMarkerClick(comment) }}
          data-testid="diff-comment-marker"
          data-line={comment.lineNumber}
          data-side={comment.side}
          aria-label={`Comment on line ${String(comment.lineNumber)}`}
        >
          <svg
            className="w-3 h-3 text-primary-foreground m-auto"
            fill="currentColor"
            viewBox="0 0 20 20"
          >
            <path
              fillRule="evenodd"
              d="M18 10c0 3.866-3.582 7-8 7a8.841 8.841 0 01-4.083-.98L2 17l1.338-3.123C2.493 12.767 2 11.434 2 10c0-3.866 3.582-7 8-7s8 3.134 8 7zM7 9H5v2h2V9zm8 0h-2v2h2V9zM9 9h2v2H9V9z"
              clipRule="evenodd"
            />
          </svg>
        </Button>
      ))}
    </>
  )
}
