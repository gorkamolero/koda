import { useState, useCallback } from 'react'
import {
  ChevronDown,
  GitBranch,
  ExternalLink,
  MessageSquare,
  Terminal,
  FileText,
  CheckCircle2,
  Eye,
  Share2,
  Check,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { PresenceAvatars } from '@/components/PresenceAvatars'
import type { Worktree } from '@/lib/rpc'

type Tab = 'chat' | 'diff' | 'files' | 'terminal' | 'spec' | 'scratchpad' | 'checks' | 'review'

interface TopBarProps {
  workspace: Worktree | undefined
  activeTab: Tab
  onTabChange: (tab: Tab) => void
}

/**
 * Conductor-style top bar with branch selector, tabs, and actions.
 */
export function TopBar({ workspace, activeTab, onTabChange }: TopBarProps): React.ReactElement {
  const [copied, setCopied] = useState(false)

  const branch = workspace?.branch ?? 'main'
  const workspaceName = workspace?.worktreePath?.split('/').pop() ?? workspace?.branch ?? 'Workspace'

  const handleShare = useCallback(async (): Promise<void> => {
    if (!workspace?.id) return
    await navigator.clipboard.writeText(workspace.id)
    setCopied(true)
    setTimeout(() => { setCopied(false) }, 2000)
  }, [workspace?.id])

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
      <div className="flex items-center gap-1 bg-muted/50 rounded-md p-0.5" data-testid="topbar-tabs">
        {/* Chat tab with icon */}
        <TabButton
          active={activeTab === 'chat'}
          onClick={() => { onTabChange('chat') }}
          icon={<MessageSquare className="h-3.5 w-3.5" />}
          testId="tab-chat"
        >
          Chat
        </TabButton>

        {/* Code tabs */}
        <TabButton
          active={activeTab === 'files'}
          onClick={() => { onTabChange('files') }}
          testId="tab-files"
        >
          All files
        </TabButton>

        <TabButton
          active={activeTab === 'diff'}
          onClick={() => { onTabChange('diff') }}
          testId="tab-diff"
        >
          Changes
        </TabButton>

        {/* Checks tab */}
        <TabButton
          active={activeTab === 'checks'}
          onClick={() => { onTabChange('checks') }}
          icon={<CheckCircle2 className="h-3.5 w-3.5" />}
          testId="tab-checks"
        >
          Checks
        </TabButton>

        {/* Review tab */}
        <TabButton
          active={activeTab === 'review'}
          onClick={() => { onTabChange('review') }}
          icon={<Eye className="h-3.5 w-3.5" />}
          testId="tab-review"
        >
          Review
        </TabButton>

        {/* Terminal tab with icon */}
        <TabButton
          active={activeTab === 'terminal'}
          onClick={() => { onTabChange('terminal') }}
          icon={<Terminal className="h-3.5 w-3.5" />}
          testId="tab-terminal"
        >
          Terminal
        </TabButton>

        {/* Scratchpad tab */}
        <TabButton
          active={activeTab === 'scratchpad'}
          onClick={() => { onTabChange('scratchpad') }}
          icon={<FileText className="h-3.5 w-3.5" />}
          testId="tab-scratchpad"
        >
          Scratchpad
        </TabButton>
      </div>

      {/* Right section: Presence + Actions */}
      <div className="flex items-center gap-3">
        {/* Presence avatars (shows other users in workspace) */}
        <PresenceAvatars maxVisible={4} size="sm" />

        {/* Share button - copies workspace ID for collaboration */}
        <button
          onClick={() => void handleShare()}
          title={copied ? 'Copied!' : 'Copy workspace ID to share'}
          className="flex items-center gap-1.5 px-2 py-1.5 text-xs font-medium rounded-md border border-border hover:bg-accent transition-colors"
        >
          {copied ? (
            <>
              <Check className="h-3 w-3 text-green-500" />
              <span className="text-green-500">Copied</span>
            </>
          ) : (
            <>
              <Share2 className="h-3 w-3" />
              <span>Share</span>
            </>
          )}
        </button>

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
  icon?: React.ReactNode
  children: React.ReactNode
  testId?: string
}

function TabButton({ active, onClick, icon, children, testId }: TabButtonProps): React.ReactElement {
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
    </button>
  )
}
