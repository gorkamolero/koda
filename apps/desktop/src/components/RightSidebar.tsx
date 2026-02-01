/**
 * Right Sidebar Component
 *
 * Conductor-style right panel with TWO header rows:
 * Row 1 (top bar): Create PR button on the right
 * Row 2 (tabs): [All files] [Changes] [Checks] [Review]
 */

import { useState, type ReactNode } from 'react'
import { useSetAtom } from 'jotai'
import {
  Eye,
  ChevronDown,
  GitPullRequestCreate,
  MoreVertical,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { FileExplorer } from './FileExplorer'
import { DiffView } from './DiffView'
import { ChecksView } from './ChecksView'
import { ReviewView } from './ReviewView'
import { useWorkspaceDiffStats } from '@/hooks/useRpc'
import { sendAgentPromptAtom } from '@/store/chat'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'

type SidebarTab = 'files' | 'changes' | 'checks' | 'review'

interface RightSidebarProps {
  workspaceId: string
  rootPath: string
  onToggleTerminal?: () => void
  onToggleSidebar?: () => void
  showTerminal?: boolean
}

interface TabConfig {
  id: SidebarTab
  label: string
  icon?: ReactNode
  badge?: number
  disabled?: boolean
}

export function RightSidebar({
  workspaceId,
  rootPath,
  onToggleTerminal,
  onToggleSidebar,
  showTerminal = true,
}: RightSidebarProps) {
  // Silence unused variable warnings - these props are for parent compatibility
  void onToggleTerminal
  void onToggleSidebar
  void showTerminal

  const [activeTab, setActiveTab] = useState<SidebarTab>('changes')
  const { data: diffStats } = useWorkspaceDiffStats(workspaceId)
  const sendAgentPrompt = useSetAtom(sendAgentPromptAtom)

  const changedFilesCount = diffStats?.filesChanged ?? 0

  const tabs: TabConfig[] = [
    { id: 'files', label: 'All files' },
    {
      id: 'changes',
      label: 'Changes',
      badge: changedFilesCount > 0 ? changedFilesCount : undefined,
    },
    { id: 'checks', label: 'Checks' },
  ]

  const handleCreatePr = (draft: boolean = false) => {
    const prompt = draft
      ? 'Create a draft pull request for this branch'
      : 'Create a pull request for this branch'
    sendAgentPrompt(prompt)
  }

  return (
    <div
      data-testid="right-sidebar"
      className="h-full flex flex-col"
    >
      {/* Row 1: Top bar with Create PR button */}
      <div
        className="flex items-center justify-between pl-2 pr-2 h-10 min-h-10 bg-sidebar-background border-b border-sidebar-border"
        data-tauri-drag-region="true"
      >
        {/* Left side - workspace name could go here */}
        <div className="flex items-center min-w-0 flex-1" data-tauri-drag-region="true">
          <p className="text-sm font-medium truncate min-w-0 mr-3 text-sidebar-foreground" />
        </div>

        {/* Right side - Create PR button */}
        <div className="flex items-center drop-shadow-sm">
          <button
            onClick={() => handleCreatePr(false)}
            className="flex items-center gap-1 pl-1.5 pr-2 py-1 h-6 bg-popover text-secondary-foreground rounded-l-sm text-xs cursor-pointer hover:bg-popover/90 border border-input"
          >
            <GitPullRequestCreate className="size-3" />
            <span>Create PR</span>
          </button>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                className="flex items-center px-1 h-6 bg-popover text-secondary-foreground rounded-r-sm text-xs cursor-pointer hover:bg-popover/90 border border-input border-l-0"
              >
                <ChevronDown className="size-3" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => handleCreatePr(false)}>
                Create PR
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => handleCreatePr(true)}>
                Create Draft PR
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      {/* Row 2: Tabs bar */}
      <div className="flex items-center justify-between gap-1 px-2 py-2 min-w-0 overflow-hidden">
        {/* Left side - main tabs */}
        <div className="flex items-center gap-1 flex-shrink-0">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => { if (!tab.disabled) setActiveTab(tab.id) }}
              data-testid={`right-tab-${tab.id}`}
              data-active={activeTab === tab.id}
              disabled={tab.disabled}
              className={cn(
                'inline-flex items-center justify-center h-7 px-2.5 text-xs font-medium rounded-md gap-1.5',
                tab.disabled
                  ? 'text-muted-foreground/50 cursor-not-allowed'
                  : activeTab === tab.id
                    ? 'bg-accent text-foreground'
                    : 'text-muted-foreground hover:bg-sidebar-accent hover:text-accent-foreground'
              )}
            >
              {tab.label}
              {tab.badge !== undefined && (
                <span className="font-mono text-muted-foreground">{tab.badge}</span>
              )}
            </button>
          ))}
        </div>

        {/* Right side - Review button and more */}
        <div className="flex items-center min-w-0 overflow-hidden">
          <button
            onClick={() => setActiveTab('review')}
            data-testid="right-tab-review"
            data-active={activeTab === 'review'}
            className={cn(
              'inline-flex items-center h-6 px-2 text-xs font-medium rounded-sm gap-1.5 mr-1.5',
              activeTab === 'review'
                ? 'bg-accent text-foreground'
                : 'text-muted-foreground hover:bg-sidebar-accent hover:text-accent-foreground'
            )}
          >
            <Eye className="h-3 w-3" />
            Review
          </button>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button className="inline-flex items-center justify-center h-6 w-6 text-xs rounded-sm text-muted-foreground hover:bg-sidebar-accent hover:text-accent-foreground mr-2">
                <MoreVertical className="h-3 w-3" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem>Refresh</DropdownMenuItem>
              <DropdownMenuItem>Settings</DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      {/* Tab content */}
      <div className="flex-1 overflow-hidden">
        {activeTab === 'files' && rootPath && (
          <FileExplorer rootPath={rootPath} />
        )}
        {activeTab === 'changes' && (
          <DiffView workspaceId={workspaceId} rootPath={rootPath} />
        )}
        {activeTab === 'checks' && <ChecksView workspaceId={workspaceId} />}
        {activeTab === 'review' && <ReviewView workspaceId={workspaceId} />}
      </div>
    </div>
  )
}
