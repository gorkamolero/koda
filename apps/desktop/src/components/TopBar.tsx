import { ChevronDown, GitBranch, ExternalLink, MessageSquare, Terminal, FileText } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useWorkspaceDiffStats } from '@/hooks/useRpc'
import type { Workspace } from '@/lib/rpc'

interface TopBarProps {
  workspace: Workspace | undefined
  activeTab: 'chat' | 'diff' | 'files' | 'terminal' | 'spec' | 'scratchpad'
  onTabChange: (tab: 'chat' | 'diff' | 'files' | 'terminal' | 'spec' | 'scratchpad') => void
}

/**
 * Conductor-style top bar with branch selector, tabs, and actions.
 *
 * Layout:
 * [Branch dropdown] [origin/main] [workspace badge] [Open ▼]  |  [All files] [Changed N] [Checks] [Review]  |  [Create PR]
 */
export function TopBar({ workspace, activeTab, onTabChange }: TopBarProps) {
  const { data: diffStats } = useWorkspaceDiffStats(workspace?.id ?? '')

  const changedFilesCount = diffStats?.filesChanged ?? 0
  const branch = workspace?.branch ?? 'main'
  const workspaceName = workspace?.directoryName ?? 'Workspace'

  return (
    <div className="flex items-center justify-between h-10 px-3 border-b border-border bg-background">
      {/* Left section: Branch info */}
      <div className="flex items-center gap-2">
        {/* Branch selector dropdown */}
        <button className="flex items-center gap-1.5 px-2 py-1 text-sm font-medium rounded hover:bg-accent transition-colors">
          <GitBranch className="h-3.5 w-3.5 text-muted-foreground" />
          <span className="truncate max-w-[200px]">{branch}</span>
          <ChevronDown className="h-3 w-3 text-muted-foreground" />
        </button>

        {/* Origin indicator */}
        <span className="text-xs text-muted-foreground">
          origin/main
        </span>

        {/* Workspace badge */}
        <span className="px-1.5 py-0.5 text-xs font-medium rounded bg-accent text-accent-foreground">
          {workspaceName}
        </span>

        {/* Open dropdown */}
        <button className="flex items-center gap-1 px-2 py-1 text-xs text-muted-foreground hover:text-foreground hover:bg-accent rounded transition-colors">
          <span>Open</span>
          <ChevronDown className="h-3 w-3" />
        </button>
      </div>

      {/* Center section: Navigation Tabs */}
      <div className="flex items-center gap-1 bg-muted/50 rounded-md p-0.5">
        {/* Chat tab with icon */}
        <TabButton
          active={activeTab === 'chat'}
          onClick={() => onTabChange('chat')}
          icon={<MessageSquare className="h-3.5 w-3.5" />}
        >
          Chat
        </TabButton>

        {/* Code tabs */}
        <TabButton
          active={activeTab === 'files'}
          onClick={() => onTabChange('files')}
        >
          All files
        </TabButton>

        <TabButton
          active={activeTab === 'diff'}
          onClick={() => onTabChange('diff')}
          badge={changedFilesCount > 0 ? changedFilesCount : undefined}
        >
          Changes
        </TabButton>

        {/* Terminal tab with icon */}
        <TabButton
          active={activeTab === 'terminal'}
          onClick={() => onTabChange('terminal')}
          icon={<Terminal className="h-3.5 w-3.5" />}
        >
          Terminal
        </TabButton>

        {/* Scratchpad tab */}
        <TabButton
          active={activeTab === 'scratchpad'}
          onClick={() => onTabChange('scratchpad')}
          icon={<FileText className="h-3.5 w-3.5" />}
        >
          Scratchpad
        </TabButton>
      </div>

      {/* Right section: Actions */}
      <div className="flex items-center gap-2">
        <button className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md bg-primary text-primary-foreground hover:bg-primary/90 transition-colors">
          <ExternalLink className="h-3 w-3" />
          Create PR
        </button>
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
}

function TabButton({ active, onClick, badge, icon, children }: TabButtonProps) {
  return (
    <button
      onClick={onClick}
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
