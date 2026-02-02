import { useParams, useSearch, useNavigate } from '@tanstack/react-router'
import { useState, useEffect, useCallback } from 'react'
import { useAtomValue } from 'jotai'
import { open } from '@tauri-apps/plugin-dialog'
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
import { useWorktree, useWorkspace, useSessions, useRepos, useCreateRepo, useCreateWorktree } from '@/hooks/useRpc'
import { useSidecarRpcHandlers } from '@/hooks/useSidecarRpcHandlers'
import { useResizable } from '@/hooks/useResizable'
import { cn } from '@/lib/utils'
import { Loader2, AlertCircle, ArrowLeft, FolderPlus, GitBranch } from 'lucide-react'

type Tab = 'chat' | 'spec' | 'scratchpad'
type ConnectStep = 'idle' | 'repo' | 'branch'

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
  const navigate = useNavigate()
  const workspaceType = useAtomValue(workspaceTypeAtom)

  // Try fetching as worktree first (git-backed workspace)
  const { data: worktree, isLoading: isLoadingWorktree, error: worktreeError } = useWorktree(id)

  // If worktree not found, try fetching as standalone workspace
  const shouldTryWorkspace = !isLoadingWorktree && (worktreeError || !worktree)
  const { data: standaloneWorkspace, isLoading: isLoadingWorkspace } = useWorkspace(
    shouldTryWorkspace ? id : ''
  )

  // Determine what we're working with
  const isLoading = isLoadingWorktree || (shouldTryWorkspace && isLoadingWorkspace)
  const isStandaloneWorkspace = !worktree && standaloneWorkspace
  const notFound = !isLoading && !worktree && !standaloneWorkspace

  // Fetch sessions for this workspace (only if we have a worktree)
  const { data: sessions } = useSessions(worktree ? id : '')

  // Register MCP tool handlers (GetWorkspaceDiff, DiffComment) for Claude
  useSidecarRpcHandlers(worktree?.id ?? '')

  // Repos and worktree creation for connecting repos to standalone workspaces
  const { data: repos } = useRepos()
  const createRepo = useCreateRepo()
  const createWorktree = useCreateWorktree()

  // Connect repository flow state
  const [connectStep, setConnectStep] = useState<ConnectStep>('idle')
  const [selectedRepoId, setSelectedRepoId] = useState<string>('')
  const [branchName, setBranchName] = useState('')
  const [connectError, setConnectError] = useState<string | null>(null)

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

  // Connect repository handlers
  const handleStartConnect = () => {
    setConnectStep('repo')
    setConnectError(null)
  }

  const handleSelectRepo = (repoId: string) => {
    setSelectedRepoId(repoId)
    setConnectStep('branch')
    setConnectError(null)
  }

  const handleAddRepo = async () => {
    try {
      const selected = await open({
        directory: true,
        multiple: false,
        title: 'Select Git Repository',
      })

      if (selected && typeof selected === 'string') {
        const repo = await createRepo.mutateAsync({ rootPath: selected })
        setSelectedRepoId(repo.id)
        setConnectStep('branch')
        setConnectError(null)
      }
    } catch (err) {
      setConnectError(err instanceof Error ? err.message : 'Failed to register repo')
    }
  }

  const handleCreateWorktree = async () => {
    if (!selectedRepoId || !branchName.trim()) return

    try {
      // Create worktree with the workspace ID to associate it
      const newWorktree = await createWorktree.mutateAsync({
        repoId: selectedRepoId,
        branch: branchName.trim(),
        workspaceId: id, // Associate with this standalone workspace
      })

      // Navigate to the new worktree (replace the standalone workspace URL)
      void navigate({ to: '/workspace/$id', params: { id: newWorktree.id } })
    } catch (err) {
      setConnectError(err instanceof Error ? err.message : 'Failed to create workspace')
    }
  }

  const handleCancelConnect = () => {
    setConnectStep('idle')
    setSelectedRepoId('')
    setBranchName('')
    setConnectError(null)
  }

  const selectedRepo = repos?.find((r) => r.id === selectedRepoId)
  const hasRepos = repos && repos.length > 0

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
          {isLoading && (
            <div className="h-full flex items-center justify-center">
              <Loader2 className="w-6 h-6 text-text-muted animate-spin" />
            </div>
          )}

          {/* Standalone workspace - show connect flow */}
          {!isLoading && isStandaloneWorkspace && activeTab === 'chat' && (
            <div className="h-full flex flex-col items-center justify-center px-8">
              <div className="w-full max-w-md">
                {/* Initial state - show connect button */}
                {connectStep === 'idle' && (
                  <div className="text-center">
                    <FolderPlus className="w-12 h-12 text-text-dim mx-auto mb-4" />
                    <h3 className="text-sm font-medium text-text-muted mb-1">
                      {standaloneWorkspace.name}
                    </h3>
                    <p className="text-xs text-text-faint mb-4">
                      Connect a repository to start chatting with Claude about your code.
                    </p>
                    <button
                      type="button"
                      data-testid="connect-repo-button"
                      className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-md bg-surface-control hover:bg-surface-control-hover text-text-primary transition-colors"
                      onClick={handleStartConnect}
                    >
                      <FolderPlus className="w-4 h-4" />
                      Connect Repository
                    </button>
                  </div>
                )}

                {/* Step 1: Select repository */}
                {connectStep === 'repo' && (
                  <div className="bg-surface-card border border-border-subtle rounded-lg p-6">
                    <h3 className="text-lg font-semibold text-text-primary mb-4">Select Repository</h3>

                    {connectError && (
                      <div className="mb-4 p-3 rounded-md bg-destructive/10 text-destructive text-sm">
                        {connectError}
                      </div>
                    )}

                    <p className="text-sm text-text-muted mb-4">
                      Choose a git repository to connect to this workspace.
                    </p>

                    {/* Existing repos */}
                    {hasRepos && (
                      <div className="mb-4">
                        <label className="block text-sm font-medium text-text-primary mb-2">Recent Repositories</label>
                        <div className="space-y-2 max-h-48 overflow-y-auto">
                          {repos.map((repo) => (
                            <button
                              key={repo.id}
                              onClick={() => { handleSelectRepo(repo.id) }}
                              className="w-full text-left p-3 border border-border-subtle rounded-md hover:border-border-accent hover:bg-surface-hover transition-colors"
                            >
                              <div className="font-medium text-text-primary">{repo.name}</div>
                              <div className="text-xs text-text-faint truncate">{repo.rootPath}</div>
                            </button>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Add new repo */}
                    <button
                      onClick={() => void handleAddRepo()}
                      disabled={createRepo.isPending}
                      className="w-full p-4 border-2 border-dashed border-border-subtle rounded-md hover:border-border-accent hover:bg-surface-hover transition-colors flex items-center justify-center gap-2 text-text-muted hover:text-text-primary"
                    >
                      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                      </svg>
                      {createRepo.isPending ? 'Registering...' : 'Add Git Repository'}
                    </button>

                    <div className="flex justify-end mt-6">
                      <button
                        onClick={handleCancelConnect}
                        className="px-4 py-2 text-sm font-medium border border-border-subtle rounded-md hover:bg-surface-hover text-text-primary transition-colors"
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                )}

                {/* Step 2: Create branch */}
                {connectStep === 'branch' && (
                  <div className="bg-surface-card border border-border-subtle rounded-lg p-6">
                    <h3 className="text-lg font-semibold text-text-primary mb-4">Create Branch</h3>

                    {connectError && (
                      <div className="mb-4 p-3 rounded-md bg-destructive/10 text-destructive text-sm">
                        {connectError}
                      </div>
                    )}

                    <div className="mb-4 p-3 rounded-md bg-surface-item">
                      <div className="text-sm font-medium text-text-primary">{selectedRepo?.name}</div>
                      <div className="text-xs text-text-faint">{selectedRepo?.rootPath}</div>
                    </div>

                    <div className="space-y-4">
                      <div>
                        <label className="block text-sm font-medium text-text-primary mb-1">Branch Name</label>
                        <input
                          type="text"
                          value={branchName}
                          onChange={(e) => { setBranchName(e.target.value) }}
                          placeholder="feature/my-feature"
                          data-testid="branch-name-input"
                          className="w-full px-3 py-2 border border-border-subtle rounded-md bg-surface-control text-text-primary placeholder:text-text-faint focus:outline-none focus:ring-2 focus:ring-border-accent"
                          autoFocus
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') void handleCreateWorktree()
                            if (e.key === 'Escape') handleCancelConnect()
                          }}
                        />
                        <p className="text-xs text-text-faint mt-1">
                          A git worktree will be created for isolated work
                        </p>
                      </div>
                    </div>

                    <div className="flex justify-between mt-6">
                      <button
                        onClick={() => { setConnectStep('repo') }}
                        className="px-4 py-2 text-sm font-medium text-text-muted hover:text-text-primary transition-colors"
                      >
                        Back
                      </button>
                      <div className="flex gap-2">
                        <button
                          onClick={handleCancelConnect}
                          className="px-4 py-2 text-sm font-medium border border-border-subtle rounded-md hover:bg-surface-hover text-text-primary transition-colors"
                        >
                          Cancel
                        </button>
                        <button
                          onClick={() => void handleCreateWorktree()}
                          disabled={!branchName.trim() || createWorktree.isPending}
                          data-testid="create-branch-button"
                          className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium bg-surface-control hover:bg-surface-control-hover text-text-primary rounded-md disabled:opacity-50 transition-colors"
                        >
                          <GitBranch className="w-4 h-4" />
                          {createWorktree.isPending ? 'Creating...' : 'Create & Connect'}
                        </button>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Error state - truly not found */}
          {!isLoading && notFound && activeTab === 'chat' && (
            <div className="h-full flex flex-col items-center justify-center px-8">
              <div className="max-w-md text-center">
                <AlertCircle className="w-12 h-12 text-text-dim mx-auto mb-4" />
                <h3 className="text-sm font-medium text-text-muted mb-1">
                  Workspace not found
                </h3>
                <p className="text-xs text-text-faint mb-4">
                  This workspace doesn&apos;t exist or has been deleted.
                </p>
                <button
                  type="button"
                  className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-md bg-surface-control hover:bg-surface-control-hover text-text-primary transition-colors"
                  onClick={() => { void navigate({ to: '/' }) }}
                >
                  <ArrowLeft className="w-4 h-4" />
                  Back to Workspaces
                </button>
              </div>
            </div>
          )}

          {/* Normal content when worktree exists */}
          {!isLoading && worktree && activeTab === 'chat' && (
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
