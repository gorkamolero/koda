import { useParams, useSearch } from '@tanstack/react-router'
import { useState, useEffect, useCallback } from 'react'
import { useAtomValue } from 'jotai'
import { AgentChat } from '@/components/AgentChat'
import { FileExplorer } from '@/components/FileExplorer'
import { Editor } from '@/components/Editor'
import { DiffView } from '@/components/DiffView'
import { CommandPalette } from '@/components/CommandPalette'
import { TopBar } from '@/components/TopBar'
import { TerminalPanel } from '@/components/Terminal'
import { GitStatusBar } from '@/components/GitStatusBar'
import {
  InterviewMode,
  SpecDrivenView,
  RalphView,
} from '@/components/Interview'
import { workspaceTypeAtom } from '@/store/interview'
import { sidebarVisibleAtom } from '@/store/ui'
import { useKeyboardShortcuts } from '@/hooks/useKeyboardShortcuts'
import { useWorkspace, useSessions } from '@/hooks/useRpc'

type Tab = 'terminal' | 'diff' | 'chat' | 'files' | 'spec'

export function WorkspaceView() {
  const { id } = useParams({ from: '/workspace/$id' })
  const search = useSearch({ from: '/workspace/$id' })
  const workspaceType = useAtomValue(workspaceTypeAtom)
  const sidebarVisible = useAtomValue(sidebarVisibleAtom)

  // Fetch workspace data to get the real path
  const { data: workspace } = useWorkspace(id)

  // Fetch sessions for this workspace
  const { data: sessions } = useSessions(id)

  // Active session tracking
  const [activeSessionId, setActiveSessionId] = useState<string | undefined>()

  // Set initial active session when sessions load
  useEffect(() => {
    if (sessions && sessions.length > 0 && !activeSessionId) {
      // Select the most recent session or the first running one
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

  // Update tab when mode changes
  useEffect(() => {
    if (startMode === 'interview') {
      setActiveTab('spec')
    }
  }, [startMode])

  // Get real workspace path from worktree
  const rootPath = workspace?.directoryName
    ? `/Users/gorkolas/.koda/worktrees/${workspace.directoryName}`
    : ''

  // Build tabs based on workspace type
  const getTabs = (): { id: Tab; label: string }[] => {
    const baseTabs: { id: Tab; label: string }[] = [
      { id: 'chat', label: 'Chat' },
      { id: 'files', label: 'Files' },
      { id: 'diff', label: 'Diff' },
      { id: 'terminal', label: 'Terminal' },
    ]

    // Add spec tab for spec-driven and ralph modes
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

  // Register keyboard shortcuts
  useKeyboardShortcuts({
    onSwitchTab: handleSwitchTab,
    tabCount: tabs.length,
  })

  return (
    <div className="h-full flex flex-col">
      {/* Command Palette (global) */}
      <CommandPalette />

      {/* Conductor-style top bar */}
      <TopBar
        workspace={workspace}
        activeTab={activeTab}
        onTabChange={setActiveTab}
      />

      <div className="flex-1 overflow-hidden">
        {activeTab === 'chat' && (
          <AgentChat workspaceId={id} sessionId={activeSessionId} />
        )}

        {activeTab === 'spec' && workspaceType === 'spec-driven' && (
          <SpecDrivenView workspaceId={id} />
        )}

        {activeTab === 'spec' && workspaceType === 'ralph' && (
          <RalphView workspaceId={id} />
        )}

        {/* Show interview mode directly when in interview mode param */}
        {activeTab === 'spec' &&
          startMode === 'interview' &&
          workspaceType === 'standard' && (
            <InterviewMode workspaceId={id} />
          )}

        {activeTab === 'files' && rootPath && (
          <div className="h-full flex">
            {/* File explorer sidebar */}
            {sidebarVisible && (
              <div
                data-testid="file-explorer-sidebar"
                className="w-64 border-r border-border h-full overflow-hidden"
              >
                <FileExplorer rootPath={rootPath} />
              </div>
            )}

            {/* Editor area */}
            <div className="flex-1 h-full overflow-hidden">
              <Editor />
            </div>
          </div>
        )}

        {activeTab === 'diff' && (
          <DiffView workspaceId={id} />
        )}

        {activeTab === 'terminal' && (
          <TerminalPanel workspaceId={id} workingDirectory={rootPath} />
        )}
      </div>

      {/* Git status bar at bottom */}
      <GitStatusBar workspace={workspace} />
    </div>
  )
}
