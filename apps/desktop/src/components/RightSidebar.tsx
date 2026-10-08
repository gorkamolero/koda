/**
 * Right Sidebar Component - Terminal Aesthetic
 *
 * ┌─ PR ACTIONS ────────────────────────────────┐
 * │ [CREATE PR ▼]                               │
 * ├─ TABS ──────────────────────────────────────┤
 * │ [FILES] [CHANGES] [CHECKS]        [REVIEW] │
 * ├─────────────────────────────────────────────┤
 * │ content...                                  │
 * └─────────────────────────────────────────────┘
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
  /** A view-only collaborator cannot ask the agent for a PR. */
  readOnly?: boolean
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
  readOnly = false,
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
    { id: 'files', label: 'FILES' },
    {
      id: 'changes',
      label: 'CHANGES',
      badge: changedFilesCount > 0 ? changedFilesCount : undefined,
    },
    { id: 'checks', label: 'CHECKS' },
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
      className="h-full flex flex-col font-mono bg-surface-messages"
    >
      {/* Row 1: PR Actions header */}
      <div
        className="flex items-center justify-between px-3 h-10 min-h-10 border-b border-dashed border-border-subtle"
        data-tauri-drag-region="true"
      >
        {/* Left: ASCII header */}
        <div className="flex items-center text-xs text-text-faint" data-tauri-drag-region="true">
          <span>┌─ PR ─</span>
          <span className="text-text-muted">{'─'.repeat(10)}</span>
        </div>

        {/* Right: Create PR button */}
        <div className="flex items-center">
          <DropdownMenu>
            <DropdownMenuTrigger asChild disabled={readOnly}>
              <button className="flex items-center gap-1 px-2 py-1 text-xs border border-dashed border-border-subtle hover:border-text-accent hover:text-text-accent transition-colors disabled:opacity-40 disabled:pointer-events-none">
                <GitPullRequestCreate className="size-3" />
                <span>[CREATE PR</span>
                <ChevronDown className="size-3" />
                <span>]</span>
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="font-mono bg-[#0a0a0a] border-dashed">
              <DropdownMenuItem onClick={() => handleCreatePr(false)} className="text-xs">
                Create PR
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => handleCreatePr(true)} className="text-xs">
                Create Draft PR
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      {/* Row 2: Tabs bar */}
      <div className="flex items-center justify-between gap-1 px-3 h-9 min-w-0 overflow-hidden border-b border-dashed border-border-subtle">
        {/* Left side - main tabs */}
        <div className="flex items-center gap-1 flex-shrink-0 text-xs">
          <span className="text-text-faint mr-1">│</span>
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => { if (!tab.disabled) setActiveTab(tab.id) }}
              data-testid={`right-tab-${tab.id}`}
              data-active={activeTab === tab.id}
              disabled={tab.disabled}
              className={cn(
                'px-2 py-1 transition-colors',
                tab.disabled
                  ? 'text-text-faint cursor-not-allowed'
                  : activeTab === tab.id
                    ? 'text-text-accent bg-surface-active'
                    : 'text-text-muted hover:text-text-primary hover:bg-surface-hover'
              )}
            >
              [{tab.label}{tab.badge !== undefined ? `:${tab.badge}` : ''}]
            </button>
          ))}
        </div>

        {/* Right side - Review button and more */}
        <div className="flex items-center min-w-0 overflow-hidden text-xs">
          <button
            onClick={() => setActiveTab('review')}
            data-testid="right-tab-review"
            data-active={activeTab === 'review'}
            className={cn(
              'flex items-center gap-1 px-2 py-1 transition-colors',
              activeTab === 'review'
                ? 'text-text-accent bg-surface-active'
                : 'text-text-muted hover:text-text-primary hover:bg-surface-hover'
            )}
          >
            <Eye className="size-3" />
            [REVIEW]
          </button>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button className="px-1 py-1 text-text-muted hover:text-text-primary transition-colors">
                <MoreVertical className="size-3" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="font-mono bg-[#0a0a0a] border-dashed">
              <DropdownMenuItem className="text-xs">Refresh</DropdownMenuItem>
              <DropdownMenuItem className="text-xs">Settings</DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
          <span className="text-text-faint ml-1">│</span>
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
