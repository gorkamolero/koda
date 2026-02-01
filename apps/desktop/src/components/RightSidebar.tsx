/**
 * Right Sidebar Component
 *
 * Conductor-style right panel with TWO header rows:
 *
 * Row 1 (pr-actions): [Create PR ▼] [Manually] [Create Draft PR]
 * Row 2 (panel-tabs): [Files] [Changes] [Checks] [Review*]
 *
 * *Review is disabled for now
 */

import { useState, type ReactNode } from 'react'
import {
  Files,
  GitBranch,
  CheckCircle2,
  MessageSquareText,
  ChevronDown,
  Terminal,
  PanelRightClose,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { FileExplorer } from './FileExplorer'
import { DiffView } from './DiffView'
import { ChecksView } from './ChecksView'
import { ReviewView } from './ReviewView'
import { useWorkspaceDiffStats } from '@/hooks/useRpc'

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
  icon: ReactNode
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
  const [activeTab, setActiveTab] = useState<SidebarTab>('changes')
  const { data: diffStats } = useWorkspaceDiffStats(workspaceId)

  const changedFilesCount = diffStats?.filesChanged ?? 0

  const tabs: TabConfig[] = [
    { id: 'files', label: 'Files', icon: <Files className="h-3.5 w-3.5" /> },
    {
      id: 'changes',
      label: 'Changes',
      icon: <GitBranch className="h-3.5 w-3.5" />,
      badge: changedFilesCount > 0 ? changedFilesCount : undefined,
    },
    { id: 'checks', label: 'Checks', icon: <CheckCircle2 className="h-3.5 w-3.5" /> },
    {
      id: 'review',
      label: 'Review',
      icon: <MessageSquareText className="h-3.5 w-3.5" />,
      disabled: true,
    },
  ]

  return (
    <div
      data-testid="right-sidebar"
      className="h-full flex flex-col bg-sidebar-background/60"
    >
      {/* Row 1: PR Actions bar */}
      <div className="flex items-center justify-between h-9 px-2 border-b border-border bg-background/50">
        {/* PR Actions */}
        <div className="flex items-center gap-1">
          {/* Create PR dropdown */}
          <button className="flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium rounded-md bg-primary text-primary-foreground hover:bg-primary/90 transition-colors">
            Create PR
            <ChevronDown className="h-3 w-3" />
          </button>

          {/* Manually button */}
          <button className="flex items-center px-2 py-1 text-xs text-muted-foreground hover:text-foreground hover:bg-accent rounded transition-colors">
            Manually
          </button>

          {/* Create Draft PR */}
          <button className="flex items-center px-2 py-1 text-xs text-muted-foreground hover:text-foreground hover:bg-accent rounded transition-colors">
            Create Draft PR
          </button>
        </div>

        {/* Panel toggles */}
        <div className="flex items-center gap-1">
          {onToggleTerminal && (
            <button
              onClick={onToggleTerminal}
              className={cn(
                'flex items-center justify-center size-6 rounded transition-colors',
                showTerminal
                  ? 'bg-accent text-accent-foreground'
                  : 'text-muted-foreground hover:bg-accent hover:text-foreground'
              )}
              title={showTerminal ? 'Hide terminal' : 'Show terminal'}
            >
              <Terminal className="h-3.5 w-3.5" />
            </button>
          )}
          {onToggleSidebar && (
            <button
              onClick={onToggleSidebar}
              className="flex items-center justify-center size-6 rounded text-muted-foreground hover:bg-accent hover:text-foreground transition-colors"
              title="Close sidebar"
            >
              <PanelRightClose className="h-3.5 w-3.5" />
            </button>
          )}
        </div>
      </div>

      {/* Row 2: Tab bar */}
      <div className="flex items-center gap-0.5 px-2 py-1.5 border-b border-border bg-muted/30">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => { if (!tab.disabled) setActiveTab(tab.id) }}
            data-testid={`right-tab-${tab.id}`}
            data-active={activeTab === tab.id}
            disabled={tab.disabled}
            className={cn(
              'flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium rounded transition-colors',
              tab.disabled
                ? 'text-muted-foreground/50 cursor-not-allowed'
                : activeTab === tab.id
                  ? 'bg-background text-foreground shadow-sm'
                  : 'text-muted-foreground hover:text-foreground hover:bg-background/50'
            )}
          >
            {tab.icon}
            <span className="hidden lg:inline">{tab.label}</span>
            {tab.badge !== undefined && (
              <span
                className={cn(
                  'px-1.5 py-0.5 text-[10px] font-semibold rounded-full',
                  activeTab === tab.id
                    ? 'bg-primary text-primary-foreground'
                    : 'bg-muted text-muted-foreground'
                )}
              >
                {tab.badge}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Tab content */}
      <div className="flex-1 overflow-hidden">
        {activeTab === 'files' && rootPath && (
          <FileExplorer rootPath={rootPath} />
        )}
        {activeTab === 'changes' && (
          <DiffView workspaceId={workspaceId} />
        )}
        {activeTab === 'checks' && <ChecksView workspaceId={workspaceId} />}
        {activeTab === 'review' && <ReviewView workspaceId={workspaceId} />}
      </div>
    </div>
  )
}
