import { Button } from '@koda/ui'
import { useState, useMemo } from 'react'
import { cn } from '@/lib/utils'
import type { Session, Worktree } from '@/lib/rpc'
import { SessionButton } from './SessionButton'
import { NewSessionPicker } from './NewSessionPicker'
import {
  Plus,
  ChevronRight,
  ChevronDown,
  MessageSquare,
  Loader2,
} from 'lucide-react'

// ============================================================================
// Types
// ============================================================================

export interface SessionSidebarProps {
  workspace: Worktree | null | undefined
  sessions: Session[]
  activeSessionId?: string
  isLoading?: boolean
  onSessionSelect: (sessionId: string) => void
  onNewSession: (model: string) => void
}

// ============================================================================
// Session Group Component
// ============================================================================

interface SessionGroupProps {
  title: string
  sessions: Session[]
  activeSessionId?: string
  onSessionSelect: (sessionId: string) => void
  defaultExpanded?: boolean
}

function SessionGroup({
  title,
  sessions,
  activeSessionId,
  onSessionSelect,
  defaultExpanded = true,
}: SessionGroupProps): React.ReactElement | null {
  const [isExpanded, setIsExpanded] = useState(defaultExpanded)

  if (sessions.length === 0) return null

  const ChevronIcon = isExpanded ? ChevronDown : ChevronRight

  return (
    <div className="mb-2">
      <Button variant="unstyled"
        onClick={() => { setIsExpanded(!isExpanded) }}
        className="flex items-center gap-1.5 w-full px-2 py-1 text-xs font-medium text-text-faint uppercase tracking-wider hover:text-text-muted transition-colors"
      >
        <ChevronIcon className="w-3 h-3" />
        <span>{title}</span>
        <span className="text-text-dim">({sessions.length})</span>
      </Button>

      {isExpanded && (
        <div className="mt-1">
          {sessions.map((session) => (
            <SessionButton
              key={session.id}
              session={session}
              isActive={session.id === activeSessionId}
              onClick={() => { onSessionSelect(session.id) }}
            />
          ))}
        </div>
      )}
    </div>
  )
}

// ============================================================================
// Session Status Categories
// ============================================================================

const ACTIVE_STATUSES = ['running', 'paused', 'compacting'] as const
const COMPLETED_STATUSES = ['completed', 'cancelled', 'error'] as const

function categorizeSession(status: Session['status']): 'active' | 'idle' | 'completed' {
  if (ACTIVE_STATUSES.includes(status as typeof ACTIVE_STATUSES[number])) return 'active'
  if (COMPLETED_STATUSES.includes(status as typeof COMPLETED_STATUSES[number])) return 'completed'
  return 'idle'
}

// ============================================================================
// SessionSidebar Component
// ============================================================================

export function SessionSidebar({
  workspace,
  sessions,
  activeSessionId,
  isLoading,
  onSessionSelect,
  onNewSession,
}: SessionSidebarProps): React.ReactElement {
  const [showNewSessionPicker, setShowNewSessionPicker] = useState(false)

  const { activeSessions, idleSessions, completedSessions } = useMemo(() => {
    const active: Session[] = []
    const idle: Session[] = []
    const completed: Session[] = []

    for (const session of sessions) {
      const category = categorizeSession(session.status)
      if (category === 'active') active.push(session)
      else if (category === 'idle') idle.push(session)
      else completed.push(session)
    }

    return { activeSessions: active, idleSessions: idle, completedSessions: completed }
  }, [sessions])

  const workspaceName = workspace?.branch ?? workspace?.worktreePath?.split('/').pop() ?? 'Workspace'

  return (
    <div className="flex flex-col h-full bg-surface-base">
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2.5 border-b border-border-subtle">
        <div className="flex items-center gap-2 min-w-0">
          <MessageSquare className="w-4 h-4 text-text-muted flex-shrink-0" />
          <span className="text-sm font-medium text-text-primary truncate">
            {workspaceName}
          </span>
        </div>
        <Button variant="unstyled"
          onClick={() => { setShowNewSessionPicker(true) }}
          className={cn(
            'p-1 rounded hover:bg-surface-hover text-text-muted hover:text-text-primary transition-colors',
            showNewSessionPicker && 'bg-surface-active text-text-primary'
          )}
          title="New session"
        >
          <Plus className="w-4 h-4" />
        </Button>
      </div>

      {/* New Session Picker */}
      {showNewSessionPicker && (
        <div className="border-b border-border-subtle">
          <NewSessionPicker
            onSelect={(model) => {
              onNewSession(model)
              setShowNewSessionPicker(false)
            }}
            onCancel={() => { setShowNewSessionPicker(false) }}
          />
        </div>
      )}

      {/* Sessions List */}
      <div className="flex-1 overflow-y-auto py-2 px-1">
        {isLoading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="w-5 h-5 text-text-muted animate-spin" />
          </div>
        ) : sessions.length === 0 ? (
          <div className="px-3 py-8 text-center">
            <MessageSquare className="w-8 h-8 text-text-dim mx-auto mb-2" />
            <p className="text-sm text-text-muted">No sessions yet</p>
            <p className="text-xs text-text-faint mt-1">
              Start a new session to begin
            </p>
            <Button variant="unstyled"
              onClick={() => { setShowNewSessionPicker(true) }}
              className="mt-3 inline-flex items-center gap-1.5 px-3 py-1.5 text-sm bg-status-unread/20 text-status-unread rounded-md hover:bg-status-unread/30 transition-colors"
            >
              <Plus className="w-3.5 h-3.5" />
              New Session
            </Button>
          </div>
        ) : (
          <>
            {/* Active sessions (running/paused/compacting) */}
            <SessionGroup
              title="Active"
              sessions={activeSessions}
              activeSessionId={activeSessionId}
              onSessionSelect={onSessionSelect}
              defaultExpanded
            />

            {/* Idle sessions */}
            <SessionGroup
              title="Idle"
              sessions={idleSessions}
              activeSessionId={activeSessionId}
              onSessionSelect={onSessionSelect}
              defaultExpanded
            />

            {/* Completed/cancelled/error sessions */}
            <SessionGroup
              title="Completed"
              sessions={completedSessions}
              activeSessionId={activeSessionId}
              onSessionSelect={onSessionSelect}
              defaultExpanded={false}
            />
          </>
        )}
      </div>

      {/* Footer with session count */}
      <div className="px-3 py-2 border-t border-border-subtle text-xs text-text-faint">
        {sessions.length} session{sessions.length !== 1 ? 's' : ''}
      </div>
    </div>
  )
}
