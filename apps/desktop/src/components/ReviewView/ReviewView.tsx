import { Button, Card, ButtonGroup } from '@koda/ui'
import { useState } from 'react'
import { cn } from '@/lib/utils'
import {
  Eye,
  MessageSquare,
  CheckCircle2,
  User,
  FileText,
  ChevronDown,
  ChevronRight,
  Plus,
} from 'lucide-react'

interface ReviewViewProps {
  workspaceId: string
}

/**
 * Review comment interface
 */
interface ReviewComment {
  id: string
  fileId: string
  filePath: string
  lineNumber: number
  author: string
  content: string
  timestamp: number
  resolved: boolean
}

/**
 * Mock review data - would be replaced with real code review integration
 */
const MOCK_COMMENTS: ReviewComment[] = [
  {
    id: 'comment-1',
    fileId: 'file-1',
    filePath: 'src/components/TopBar.tsx',
    lineNumber: 42,
    author: 'Claude',
    content: 'Consider adding a loading state for the branch selector dropdown.',
    timestamp: Date.now() - 3600000,
    resolved: false,
  },
  {
    id: 'comment-2',
    fileId: 'file-2',
    filePath: 'src/store/chat.ts',
    lineNumber: 128,
    author: 'Claude',
    content: 'This atom could benefit from memoization to prevent unnecessary re-renders.',
    timestamp: Date.now() - 7200000,
    resolved: true,
  },
]

/**
 * Format relative time
 */
function formatRelativeTime(timestamp: number): string {
  const now = Date.now()
  const diff = now - timestamp

  if (diff < 60000) return 'just now'
  if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`
  if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`
  return new Date(timestamp).toLocaleDateString()
}

/**
 * Conductor-style Code Review view.
 * Shows review comments and allows adding new ones.
 */
export function ReviewView({ workspaceId }: ReviewViewProps) {
  void workspaceId // Will be used for real review integration
  const [comments, setComments] = useState<ReviewComment[]>(MOCK_COMMENTS)
  const [expandedComments, setExpandedComments] = useState<Set<string>>(new Set())
  const [filter, setFilter] = useState<'all' | 'open' | 'resolved'>('all')

  const toggleComment = (commentId: string) => {
    setExpandedComments((prev) => {
      const next = new Set(prev)
      if (next.has(commentId)) {
        next.delete(commentId)
      } else {
        next.add(commentId)
      }
      return next
    })
  }

  const toggleResolved = (commentId: string) => {
    setComments((prev) =>
      prev.map((c) =>
        c.id === commentId ? { ...c, resolved: !c.resolved } : c
      )
    )
  }

  const filteredComments = comments.filter((c) => {
    if (filter === 'open') return !c.resolved
    if (filter === 'resolved') return c.resolved
    return true
  })

  const openCount = comments.filter((c) => !c.resolved).length
  const resolvedCount = comments.filter((c) => c.resolved).length

  return (
    <div className="h-full flex flex-col bg-surface-messages" data-testid="review-view-container">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-border-subtle bg-surface-topbar" data-testid="review-view-header">
        <div className="flex items-center gap-3">
          <h2 className="text-sm font-medium text-text-primary">Code Review</h2>

          {/* Filter tabs */}
          <ButtonGroup aria-label="Review filter" className="gap-1 rounded-md bg-surface-control p-0.5" data-testid="review-filter-tabs">
            <Button variant="unstyled" onClick={() => setFilter('all')} aria-pressed={filter === 'all'}
              data-testid="review-filter-all"
              data-active={filter === 'all'}
              className={cn(
                'px-2 py-1 text-xs font-normal rounded transition-colors',
                filter === 'all'
                  ? 'bg-surface-active text-text-strong'
                  : 'text-text-muted hover:text-text-primary'
              )}
            >
              All ({comments.length})
            </Button>
            <Button variant="unstyled" onClick={() => setFilter('open')} aria-pressed={filter === 'open'}
              data-testid="review-filter-open"
              data-active={filter === 'open'}
              className={cn(
                'px-2 py-1 text-xs font-normal rounded transition-colors',
                filter === 'open'
                  ? 'bg-surface-active text-text-strong'
                  : 'text-text-muted hover:text-text-primary'
              )}
            >
              Open ({openCount})
            </Button>
            <Button variant="unstyled" onClick={() => setFilter('resolved')} aria-pressed={filter === 'resolved'}
              data-testid="review-filter-resolved"
              data-active={filter === 'resolved'}
              className={cn(
                'px-2 py-1 text-xs font-normal rounded transition-colors',
                filter === 'resolved'
                  ? 'bg-surface-active text-text-strong'
                  : 'text-text-muted hover:text-text-primary'
              )}
            >
              Resolved ({resolvedCount})
            </Button>
          </ButtonGroup>
        </div>

        {/* Actions */}
        <Button variant="unstyled" className="flex items-center gap-1.5 px-2 py-1 text-xs bg-surface-control text-text-muted hover:text-text-primary rounded hover:bg-surface-hover transition-colors">
          <Plus className="w-3 h-3" />
          Add comment
        </Button>
      </div>

      {/* Comments list */}
      <div className="flex-1 overflow-y-auto p-4">
        <div className="max-w-2xl mx-auto space-y-3">
          {filteredComments.map((comment) => {
            const isExpanded = expandedComments.has(comment.id)

            return (
              <Card
                key={comment.id}
                data-testid={`review-comment-${comment.id}`}
                data-resolved={comment.resolved}
                className={cn(
                  'border rounded-lg overflow-hidden transition-colors',
                  comment.resolved
                    ? 'border-border-subtle/50 bg-surface-control/20'
                    : 'border-border-subtle bg-surface-control/30'
                )}
              >
                {/* Comment header */}
                <Button variant="unstyled"
                  onClick={() => { toggleComment(comment.id); }}
                  data-testid={`review-comment-toggle-${comment.id}`}
                  className="w-full flex items-center gap-3 px-4 py-3 hover:bg-surface-hover/50 transition-colors"
                >
                  {/* Expand icon */}
                  <span className="text-text-dim">
                    {isExpanded ? (
                      <ChevronDown className="w-4 h-4" />
                    ) : (
                      <ChevronRight className="w-4 h-4" />
                    )}
                  </span>

                  {/* Status icon */}
                  {comment.resolved ? (
                    <CheckCircle2 className="w-4 h-4 text-status-success" />
                  ) : (
                    <MessageSquare className="w-4 h-4 text-text-accent" />
                  )}

                  {/* File info */}
                  <div className="flex-1 flex items-center gap-2 text-left min-w-0">
                    <FileText className="w-3 h-3 text-text-faint flex-shrink-0" />
                    <span className="text-xs text-text-muted truncate font-mono">
                      {comment.filePath}
                    </span>
                    <span className="text-xs text-text-faint">
                      :{comment.lineNumber}
                    </span>
                  </div>

                  {/* Author and time */}
                  <div className="flex items-center gap-2 text-xs text-text-faint">
                    <User className="w-3 h-3" />
                    <span>{comment.author}</span>
                    <span>•</span>
                    <span>{formatRelativeTime(comment.timestamp)}</span>
                  </div>
                </Button>

                {/* Expanded content */}
                {isExpanded && (
                  <div className="px-4 pb-3 pt-1 border-t border-border-subtle/50">
                    {/* Comment content */}
                    <p className="text-sm text-text-primary mb-3">{comment.content}</p>

                    {/* Actions */}
                    <div className="flex items-center gap-2">
                      <Button variant="unstyled"
                        onClick={() => { toggleResolved(comment.id); }}
                        data-testid={`review-comment-${comment.resolved ? 'reopen' : 'resolve'}-${comment.id}`}
                        className={cn(
                          'flex items-center gap-1 px-2 py-1 text-xs rounded transition-colors',
                          comment.resolved
                            ? 'bg-surface-control text-text-muted hover:text-text-primary'
                            : 'bg-status-success/20 text-status-success hover:bg-status-success/30'
                        )}
                      >
                        <CheckCircle2 className="w-3 h-3" />
                        {comment.resolved ? 'Reopen' : 'Resolve'}
                      </Button>
                      <Button variant="unstyled" className="flex items-center gap-1 px-2 py-1 text-xs text-text-muted hover:text-text-primary rounded hover:bg-surface-hover transition-colors">
                        <Eye className="w-3 h-3" />
                        View in diff
                      </Button>
                    </div>
                  </div>
                )}
              </Card>
            )
          })}

          {/* Empty state */}
          {filteredComments.length === 0 && (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <MessageSquare className="w-12 h-12 text-text-dim mb-4" />
              <p className="text-sm text-text-muted">
                {filter === 'all'
                  ? 'No review comments yet'
                  : filter === 'open'
                    ? 'No open comments'
                    : 'No resolved comments'}
              </p>
              <p className="text-xs text-text-faint mt-1">
                {filter === 'all' && 'Add comments from the diff view'}
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
