import { useState } from 'react'
import { cn } from '@/lib/utils'
import type { Session, Workspace } from '@/lib/rpc'
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
  workspace: Workspace | null | undefined
  sessions: Session[]
  activeSessionId?: string
  isLoading?: boolean
  onSessionSelect: (sessionId: string) => void
  onNewSession: (model: string) => void
}

// ============================================================================
// Session Group Component
// ============================================================================

function SessionGroup({
  title,
  sessions,
  activeSessionId,
  onSessionSelect,
  defaultExpanded = true,
}: {
  title: string
  sessions: Session[]
  activeSessionId?: string
  onSessionSelect: (sessionId: string) => void
  defaultExpanded?: boolean
}) {
  const [isExpanded, setIsExpanded] = useState(defaultExpanded)

  if (sessions.length === 0) return null

  return (
    <div className="mb-2">
      <button
        onClick={() => { setIsExpanded(!isExpanded) }}
        className="flex items-center gap-1.5 w-full px-2 py-1 text-xs font-medium text-text-faint uppercase tracking-wider hover:text-text-muted transition-colors"
      >
        {isExpanded ? (
          <ChevronDown className="w-3 h-3" />
        ) : (
          <ChevronRight className="w-3 h-3" />
        )}
        <span>{title}</span>
        <span className="text-text-dim">({String(sessions.length)})</span>
      </button>

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
// SessionSidebar Component
// ============================================================================

export function SessionSidebar({
  workspace,
  sessions,
  activeSessionId,
  isLoading,
  onSessionSelect,
  onNewSession,
}: SessionSidebarProps) {
  const [showNewSessionPicker, setShowNewSessionPicker] = useState(false)

  // Categorize sessions
  const activeSessions = sessions.filter(
    (s) => s.status === 'running' || s.status === 'paused' || s.status === 'compacting'
  )
  const idleSessions = sessions.filter((s) => s.status === 'idle')
  const completedSessions = sessions.filter(
    (s) => s.status === 'completed' || s.status === 'cancelled' || s.status === 'error'
  )

  // Get workspace display name
  const workspaceName = workspace?.branch ?? workspace?.directoryName ?? 'Workspace'

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
        <button
          onClick={() => { setShowNewSessionPicker(true) }}
          className={cn(
            'p-1 rounded hover:bg-surface-hover text-text-muted hover:text-text-primary transition-colors',
            showNewSessionPicker && 'bg-surface-active text-text-primary'
          )}
          title="New session"
        >
          <Plus className="w-4 h-4" />
        </button>
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
            <button
              onClick={() => { setShowNewSessionPicker(true) }}
              className="mt-3 inline-flex items-center gap-1.5 px-3 py-1.5 text-sm bg-blue-500/20 text-blue-400 rounded-md hover:bg-blue-500/30 transition-colors"
            >
              <Plus className="w-3.5 h-3.5" />
              New Session
            </button>
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
