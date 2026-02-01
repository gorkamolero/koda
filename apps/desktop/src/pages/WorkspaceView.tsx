import { useParams, useSearch } from '@tanstack/react-router'
import { useState, useEffect, useCallback } from 'react'
import { useAtomValue } from 'jotai'
import { AgentChat } from '@/components/AgentChat'
import { CommandPalette } from '@/components/CommandPalette'
import { TopBar } from '@/components/TopBar'
import { TerminalPanel } from '@/components/Terminal'
import { GitStatusBar } from '@/components/GitStatusBar'
import { Scratchpad } from '@/components/Scratchpad'
import { RightSidebar } from '@/components/RightSidebar'
import { CollaborativeWorkspaceProvider } from '@/components/CollaborativeWorkspaceProvider'
import {
  InterviewMode,
  SpecDrivenView,
  RalphView,
} from '@/components/Interview'
import { workspaceTypeAtom } from '@/store/interview'
import { useKeyboardShortcuts } from '@/hooks/useKeyboardShortcuts'
import { useWorktree, useSessions } from '@/hooks/useRpc'
import { useResizable } from '@/hooks/useResizable'
import { cn } from '@/lib/utils'
import { FolderPlus, Loader2 } from 'lucide-react'

type Tab = 'chat' | 'spec' | 'scratchpad'

/**
 * WorkspaceView - Conductor-style layout
 *
 * The key insight: TopBar is INSIDE main-content, not above it.
 *
 * ┌─────────────────────────────────────────┬────────────────────────────┐
 * │ main-content                            │ right-panel                │
 * │ ┌─────────────────────────────────────┐ │ ┌────────────────────────┐ │
 * │ │ TopBar Row 1: Workspace | branch    │ │ │ PR Actions row         │ │
 * │ │ TopBar Row 2: Scratchpad | Chat     │ │ │ Files|Changes|Checks   │ │
 * │ ├─────────────────────────────────────┤ │ ├────────────────────────┤ │
 * │ │                                     │ │ │ git-panel content      │ │
 * │ │ Messages (virtuoso)                 │ │ │                        │ │
 * │ │                                     │ │ ├────────────────────────┤ │
 * │ ├─────────────────────────────────────┤ │ │ terminal-panel         │ │
 * │ │ Composer (input) - bottom           │ │ │                        │ │
 * │ └─────────────────────────────────────┘ │ └────────────────────────┘ │
 * └─────────────────────────────────────────┴────────────────────────────┘
 */
export function WorkspaceView() {
  const { id } = useParams({ from: '/workspace/$id' })
  const search = useSearch({ from: '/workspace/$id' })
  const workspaceType = useAtomValue(workspaceTypeAtom)

  // Fetch worktree data to get the real path
  const { data: worktree, isLoading: isLoadingWorktree } = useWorktree(id)

  // Fetch sessions for this workspace
  const { data: sessions } = useSessions(id)

  // Active session tracking
  const [activeSessionId, setActiveSessionId] = useState<string | undefined>()

  // Set initial active session when sessions load
  useEffect(() => {
    if (sessions && sessions.length > 0 && !activeSessionId) {
      const runningSession = sessions.find((s) => s.status === 'running')
      const mostRecentSession = sessions[0]
      setActiveSessionId(runningSession?.id ?? mostRecentSession?.id)
    }
  }, [sessions, activeSessionId])

  // Check if we should start in interview mode
  const startMode = (search as { mode?: string }).mode

  // Determine initial tab based on mode param
  const getInitialTab = (): Tab => {
    if (startMode === 'interview') return 'spec'
    return 'chat'
  }

  const [activeTab, setActiveTab] = useState<Tab>(getInitialTab)

  // Right panel resizing (main-content vs right-panel, horizontal)
  const rightPanelResize = useResizable({
    cssVar: '--right-panel-width',
    initialSize: 400,
    minSize: 280,
    maxSize: 600,
    direction: 'horizontal',
    storageKey: 'koda-right-panel-width',
    edge: 'start',
  })

  // Terminal panel resizing (within right-panel, vertical split)
  const terminalResize = useResizable({
    cssVar: '--terminal-height',
    initialSize: 250,
    minSize: 100,
    maxSize: 500,
    direction: 'vertical',
    storageKey: 'koda-terminal-height',
    edge: 'start',
  })

  // State for showing/hiding panels
  const [showRightPanel, setShowRightPanel] = useState(true)
  const [showTerminal, setShowTerminal] = useState(true)

  // Update tab when mode changes
  useEffect(() => {
    if (startMode === 'interview') {
      setActiveTab('spec')
    }
  }, [startMode])

  // Get real workspace path from worktree
  const rootPath = worktree?.worktreePath ?? ''
  const hasRepo = Boolean(worktree?.repoId)

  // Build tabs based on workspace type
  const getTabs = (): { id: Tab; label: string }[] => {
    const baseTabs: { id: Tab; label: string }[] = [
      { id: 'chat', label: 'Chat' },
      { id: 'scratchpad', label: 'Scratchpad' },
    ]

    if (workspaceType === 'spec-driven' || workspaceType === 'ralph') {
      baseTabs.splice(1, 0, { id: 'spec', label: 'Spec' })
    }

    return baseTabs
  }

  const tabs = getTabs()

  // Handle tab switching via keyboard shortcuts
  const handleSwitchTab = useCallback(
    (tabIndex: number) => {
      const tab = tabs[tabIndex]
      if (tab) {
        setActiveTab(tab.id)
      }
    },
    [tabs]
  )

  // Focus chat input handler for ⌘L shortcut
  const handleFocusChat = useCallback(() => {
    const chatInput = document.querySelector<HTMLTextAreaElement>('[data-testid="chat-input"]')
    if (chatInput) {
      chatInput.focus()
      // Switch to chat tab if not already there
      if (activeTab !== 'chat') {
        setActiveTab('chat')
      }
    }
  }, [activeTab])

  // Register keyboard shortcuts
  useKeyboardShortcuts({
    onSwitchTab: handleSwitchTab,
    tabCount: tabs.length,
    onToggleTerminal: () => { setShowTerminal((prev) => !prev) },
    onToggleSidebar: () => { setShowRightPanel((prev) => !prev) },
    onFocusChat: handleFocusChat,
  })

  return (
    <CollaborativeWorkspaceProvider workspaceId={id}>
      <div className="h-full flex">
        {/* Command Palette (global) */}
        <CommandPalette />

      {/* Main content panel (chat/scratchpad) - includes its own TopBar */}
      <div
        data-testid="main-content"
        className="flex-1 min-w-0 flex flex-col overflow-hidden"
      >
        {/* TopBar is INSIDE main-content */}
        <TopBar
          workspace={worktree}
          activeTab={activeTab}
          onTabChange={(tab) => { setActiveTab(tab as Tab) }}
          sessions={sessions?.map(s => ({ id: s.id, name: s.title ?? 'Chat' })) ?? []}
          activeSessionId={activeSessionId}
          onSessionChange={setActiveSessionId}
        />

        {/* Content area - fills remaining space */}
        <div className="flex-1 min-h-0 overflow-hidden">
          {/* Loading state */}
          {isLoadingWorktree && (
            <div className="h-full flex items-center justify-center">
              <Loader2 className="w-6 h-6 text-muted-foreground animate-spin" />
            </div>
          )}

          {/* No repo connected - show indicator */}
          {!isLoadingWorktree && !hasRepo && activeTab === 'chat' && (
            <div className="h-full flex flex-col items-center justify-center px-8">
              <div className="max-w-md text-center">
                <FolderPlus className="w-12 h-12 text-muted-foreground/50 mx-auto mb-4" />
                <h3 className="text-lg font-medium text-foreground mb-2">
                  No repository connected
                </h3>
                <p className="text-sm text-muted-foreground mb-6">
                  Connect a git repository to enable agent features like file editing, code review, and version control.
                </p>
                <button
                  type="button"
                  className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-md bg-primary text-primary-foreground hover:bg-primary/90 transition-colors"
                  onClick={() => {
                    // TODO: Open repo connect dialog
                    console.log('Connect repo clicked')
                  }}
                >
                  <FolderPlus className="w-4 h-4" />
                  Connect Repository
                </button>
              </div>
            </div>
          )}

          {/* Normal content when repo is connected */}
          {!isLoadingWorktree && hasRepo && activeTab === 'chat' && (
            <AgentChat worktreeId={id} sessionId={activeSessionId} />
          )}

          {activeTab === 'spec' && workspaceType === 'spec-driven' && (
            <SpecDrivenView workspaceId={id} />
          )}

          {activeTab === 'spec' && workspaceType === 'ralph' && (
            <RalphView workspaceId={id} />
          )}

          {activeTab === 'spec' &&
            startMode === 'interview' &&
            workspaceType === 'standard' && (
              <InterviewMode workspaceId={id} />
            )}

          {activeTab === 'scratchpad' && <Scratchpad workspaceId={id} />}
        </div>

        {/* Git status bar at bottom of main content */}
        <GitStatusBar workspace={worktree} />
      </div>

      {/* Right panel (Files/Changes + Terminal) */}
      {showRightPanel && (
        <>
          {/* Resize handle */}
          <div
            {...rightPanelResize.handleProps}
            className={cn(
              'w-1 bg-border hover:bg-primary/50 transition-colors cursor-col-resize flex-shrink-0',
              rightPanelResize.isDragging && 'bg-primary/50'
            )}
          />

          {/* Right panel content */}
          <div
            data-testid="right-panel"
            style={{ width: `${String(rightPanelResize.size)}px` }}
            className="flex-shrink-0 flex flex-col overflow-hidden border-l border-border"
          >
            {/* Git panel (Files/Changes/Checks/Review) - includes its own header bars */}
            <div
              data-testid="git-panel"
              className={cn(
                'overflow-hidden',
                showTerminal ? 'flex-1' : 'h-full'
              )}
            >
              <RightSidebar
                workspaceId={id}
                rootPath={rootPath}
                onToggleTerminal={() => { setShowTerminal((prev) => !prev) }}
                onToggleSidebar={() => { setShowRightPanel(false) }}
                showTerminal={showTerminal}
              />
            </div>

            {/* Terminal panel (below git-panel in right sidebar) */}
            {showTerminal && (
              <>
                {/* Resize handle (horizontal) */}
                <div
                  {...terminalResize.handleProps}
                  className={cn(
                    'h-1 bg-border hover:bg-primary/50 transition-colors cursor-row-resize flex-shrink-0',
                    terminalResize.isDragging && 'bg-primary/50'
                  )}
                />
                {/* Terminal */}
                <div
                  data-testid="terminal-panel"
                  style={{ height: `${String(terminalResize.size)}px` }}
                  className="flex-shrink-0 border-t border-border"
                >
                  <TerminalPanel workspaceId={id} workingDirectory={rootPath} />
                </div>
              </>
            )}
          </div>
        </>
      )}
      </div>
    </CollaborativeWorkspaceProvider>
  )
}
