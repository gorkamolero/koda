import { ChevronDown, GitBranch, FolderOpen, MessageSquare, FileText, Plus, ChevronLeft } from 'lucide-react'
import { Link } from '@tanstack/react-router'
import { cn } from '@/lib/utils'
import type { Workspace } from '@/lib/rpc'
import { invoke } from '@tauri-apps/api/core'

interface TopBarProps {
  workspace: Workspace | undefined
  activeTab: 'chat' | 'spec' | 'scratchpad'
  onTabChange: (tab: 'chat' | 'spec' | 'scratchpad') => void
  sessions?: { id: string; name: string }[]
  activeSessionId?: string
  onSessionChange?: (sessionId: string) => void
  onNewSession?: () => void
}

/**
 * Conductor-style top bar with TWO header rows:
 *
 * Row 1 (workspace-header): [Workspace name] [branch] [origin] [Open in Finder]
 * Row 2 (session-tabs): [Scratchpad] [+ New] [Session tabs...]
 */
export function TopBar({
  workspace,
  activeTab,
  onTabChange,
  sessions = [],
  activeSessionId,
  onSessionChange,
  onNewSession,
}: TopBarProps) {
  const branch = workspace?.branch ?? 'main'
  const workspaceName = workspace?.directoryName ?? 'Workspace'
  const rootPath = workspace?.directoryName
    ? `/Users/gorkolas/.koda/worktrees/${workspace.directoryName}`
    : ''

  const handleOpenInFinder = () => {
    if (rootPath) {
      void invoke('plugin:opener|reveal_item_in_dir', { path: rootPath })
    }
  }

  return (
    <div className="flex flex-col border-b border-border">
      {/* Row 1: Workspace header with branch info */}
      <div className="flex items-center justify-between h-9 px-3 bg-background/50">
        {/* Left: Workspace name and branch */}
        <div className="flex items-center gap-2">
          {/* Back to workspaces + Workspace name */}
          <Link
            to="/"
            className="flex items-center gap-1 text-sm font-medium text-foreground hover:text-primary transition-colors"
          >
            <ChevronLeft className="h-4 w-4" />
            <span>{workspaceName}</span>
          </Link>

          {/* Branch selector */}
          <button className="flex items-center gap-1 px-1.5 py-0.5 text-xs rounded hover:bg-accent transition-colors">
            <GitBranch className="h-3 w-3 text-muted-foreground" />
            <span className="text-muted-foreground">{branch}</span>
            <ChevronDown className="h-3 w-3 text-muted-foreground" />
          </button>

          {/* Origin indicator */}
          <span className="text-xs text-muted-foreground/60">
            ← origin/main
          </span>
        </div>

        {/* Right: Open in Finder */}
        <button
          onClick={handleOpenInFinder}
          className="flex items-center gap-1.5 px-2 py-1 text-xs text-muted-foreground hover:text-foreground hover:bg-accent rounded transition-colors"
          title="Open in Finder"
        >
          <FolderOpen className="h-3.5 w-3.5" />
          <span>Open</span>
          <ChevronDown className="h-3 w-3" />
        </button>
      </div>

      {/* Row 2: Session tabs */}
      <div className="flex items-center gap-1 h-9 px-2 bg-muted/30">
        {/* Scratchpad tab */}
        <TabButton
          active={activeTab === 'scratchpad'}
          onClick={() => onTabChange('scratchpad')}
          icon={<FileText className="h-3.5 w-3.5" />}
          testId="tab-scratchpad"
        >
          Scratchpad
        </TabButton>

        {/* Separator */}
        <div className="h-4 w-px bg-border mx-1" />

        {/* New session button */}
        {onNewSession && (
          <button
            onClick={onNewSession}
            className="flex items-center justify-center size-6 rounded text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
            title="New chat"
          >
            <Plus className="h-3.5 w-3.5" />
          </button>
        )}

        {/* Chat sessions as tabs */}
        {sessions.length > 0 ? (
          sessions.map((session) => (
            <TabButton
              key={session.id}
              active={activeSessionId === session.id && activeTab === 'chat'}
              onClick={() => {
                onSessionChange?.(session.id)
                onTabChange('chat')
              }}
              icon={<MessageSquare className="h-3.5 w-3.5" />}
              testId={`tab-session-${session.id}`}
            >
              {session.name || 'Chat'}
            </TabButton>
          ))
        ) : (
          /* Default Chat tab when no sessions */
          <TabButton
            active={activeTab === 'chat'}
            onClick={() => onTabChange('chat')}
            icon={<MessageSquare className="h-3.5 w-3.5" />}
            testId="tab-chat"
          >
            Chat
          </TabButton>
        )}
      </div>
    </div>
  )
}

interface TabButtonProps {
  active: boolean
  onClick: () => void
  badge?: number
  icon?: React.ReactNode
  children: React.ReactNode
  testId?: string
  closable?: boolean
  onClose?: () => void
}

function TabButton({ active, onClick, badge, icon, children, testId }: TabButtonProps) {
  return (
    <button
      onClick={onClick}
      data-testid={testId}
      data-active={active}
      className={cn(
        'flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium rounded transition-colors',
        active
          ? 'bg-background text-foreground shadow-sm'
          : 'text-muted-foreground hover:text-foreground hover:bg-background/50'
      )}
    >
      {icon}
      {children}
      {badge !== undefined && (
        <span className={cn(
          'px-1.5 py-0.5 text-[10px] font-semibold rounded-full',
          active
            ? 'bg-primary text-primary-foreground'
            : 'bg-muted text-muted-foreground'
        )}>
          {badge}
        </span>
      )}
    </button>
  )
}
