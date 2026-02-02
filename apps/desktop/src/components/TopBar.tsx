import { useState, useCallback, useRef } from 'react'
import { useAtomValue, useSetAtom } from 'jotai'
import {
  ChevronDown,
  GitBranch,
  Terminal,
  Folder,
  Code2,
  Check,
  Copy,
  History,
  X,
} from 'lucide-react'
import { Link } from '@tanstack/react-router'
import { useClickOutside } from '@/hooks/useClickOutside'
import { ConversationHistoryDialog } from '@/components/ConversationHistory'
import { cn } from '@/lib/utils'
import type { Worktree } from '@/lib/rpc'
import {
  openFilesAtom,
  activeFilePathAtom,
  closeFileAtom,
} from '@/store/fileExplorer'

type Tab = 'chat' | 'spec' | 'scratchpad'

interface TopBarProps {
  workspace: Worktree | undefined
  activeTab: Tab
  onTabChange: (tab: Tab) => void
  sessions?: { id: string; name: string }[]
  activeSessionId?: string
  onSessionChange?: (sessionId: string) => void
  onNewSession?: () => void
}

/**
 * Terminal-style top bar with TWO header rows:
 *
 * Row 1: ┌─ [branch] ─────────── /workspace [OPEN ▼] ─┐
 * Row 2: │ [PAD] [FILE] [CHAT] [+]            [HIST] │
 */
export function TopBar({
  workspace,
  activeTab,
  onTabChange,
  sessions = [],
  activeSessionId,
  onSessionChange,
  onNewSession,
}: TopBarProps): React.ReactElement {
  const [branchCopied, setBranchCopied] = useState(false)
  const [openDropdownVisible, setOpenDropdownVisible] = useState(false)
  const [historyDialogOpen, setHistoryDialogOpen] = useState(false)
  const openDropdownRef = useRef<HTMLDivElement>(null)

  // Editor file tabs
  const openFiles = useAtomValue(openFilesAtom)
  const activeFilePath = useAtomValue(activeFilePathAtom)
  const setActiveFilePath = useSetAtom(activeFilePathAtom)
  const closeFile = useSetAtom(closeFileAtom)

  useClickOutside(openDropdownRef, {
    onClickOutside: () => { setOpenDropdownVisible(false) },
    onEscape: () => { setOpenDropdownVisible(false) },
    enabled: openDropdownVisible,
  })

  const branch = workspace?.branch ?? 'main'
  const workspaceName = workspace?.worktreePath?.split('/').pop() ?? workspace?.branch ?? 'workspace'
  const workspacePath = workspace?.worktreePath ?? ''

  const handleCopyBranch = useCallback(async (): Promise<void> => {
    await navigator.clipboard.writeText(branch)
    setBranchCopied(true)
    setTimeout(() => { setBranchCopied(false) }, 2000)
  }, [branch])

  const handleOpenInTerminal = useCallback(() => {
    if (!workspacePath) return
    window.open(`terminal://${workspacePath}`, '_blank')
    setOpenDropdownVisible(false)
  }, [workspacePath])

  const handleOpenInFinder = useCallback(() => {
    if (!workspacePath) return
    window.open(`file://${workspacePath}`, '_blank')
    setOpenDropdownVisible(false)
  }, [workspacePath])

  const handleOpenInIDE = useCallback((ide: 'vscode' | 'cursor') => {
    if (!workspacePath) return
    const protocol = ide === 'cursor' ? 'cursor' : 'vscode'
    window.open(`${protocol}://file${workspacePath}`, '_blank')
    setOpenDropdownVisible(false)
  }, [workspacePath])

  return (
    <div className="flex flex-col font-mono bg-[#000000]">
      {/* Row 1: Branch info and workspace name */}
      <div
        className="flex items-center justify-between h-10 px-3 border-b border-dashed border-border-subtle"
        data-tauri-drag-region
      >
        {/* Left: ASCII header with branch */}
        <div className="flex items-center gap-2 min-w-0 flex-1 overflow-hidden text-xs">
          <span className="text-text-faint">┌─</span>
          
          {/* Branch indicator */}
          <button
            onClick={() => void handleCopyBranch()}
            className="flex items-center gap-1.5 px-1.5 py-0.5 hover:bg-surface-hover transition-colors group"
            title={branchCopied ? 'Copied!' : 'Copy branch name'}
          >
            <GitBranch className="size-3 text-text-accent" />
            <span className="text-text-primary">{branch}</span>
            {branchCopied ? (
              <Check className="size-3 text-[--git-green]" />
            ) : (
              <Copy className="size-3 text-text-faint opacity-0 group-hover:opacity-100 transition-opacity" />
            )}
          </button>

          <span className="text-text-faint">→</span>
          
          {/* Origin indicator */}
          <span className="text-text-muted">origin/main</span>
          
          <span className="text-text-faint flex-1 overflow-hidden whitespace-nowrap">
            {'─'.repeat(20)}
          </span>
        </div>

        {/* Right: Workspace name and Open dropdown */}
        <div ref={openDropdownRef} className="relative flex items-center gap-2">
          <Link
            to="/"
            className="flex items-center gap-1 text-xs text-text-muted hover:text-text-primary transition-colors"
          >
            <span className="text-text-accent">/</span>
            <span>{workspaceName}</span>
          </Link>
          
          <button
            onClick={() => { setOpenDropdownVisible(!openDropdownVisible) }}
            className="flex items-center gap-1 px-2 py-1 text-xs border border-dashed border-border-subtle hover:border-text-accent hover:text-text-accent transition-colors"
          >
            <span>[OPEN</span>
            <ChevronDown className="size-3" />
            <span>]</span>
          </button>

          {openDropdownVisible && (
            <div className="absolute top-full right-0 mt-1 z-50 min-w-48 bg-[#0a0a0a] border border-dashed border-border-subtle">
              <div className="py-1 text-xs">
                <div className="px-3 py-1 text-text-faint border-b border-dashed border-border-subtle">
                  ┌─ OPEN IN ─────────┐
                </div>
                <button
                  onClick={handleOpenInTerminal}
                  className="w-full flex items-center gap-2 px-3 py-2 text-left hover:bg-surface-hover hover:text-text-accent transition-colors"
                >
                  <Terminal className="size-3" />
                  <span>Terminal</span>
                </button>
                <button
                  onClick={handleOpenInFinder}
                  className="w-full flex items-center gap-2 px-3 py-2 text-left hover:bg-surface-hover hover:text-text-accent transition-colors"
                >
                  <Folder className="size-3" />
                  <span>Finder</span>
                </button>
                <div className="h-px bg-border-subtle mx-2 my-1" />
                <button
                  onClick={() => { handleOpenInIDE('vscode') }}
                  className="w-full flex items-center gap-2 px-3 py-2 text-left hover:bg-surface-hover hover:text-text-accent transition-colors"
                >
                  <Code2 className="size-3" />
                  <span>VS Code</span>
                </button>
                <button
                  onClick={() => { handleOpenInIDE('cursor') }}
                  className="w-full flex items-center gap-2 px-3 py-2 text-left hover:bg-surface-hover hover:text-text-accent transition-colors"
                >
                  <Code2 className="size-3" />
                  <span>Cursor</span>
                </button>
                <div className="px-3 py-1 text-text-faint border-t border-dashed border-border-subtle">
                  └───────────────────┘
                </div>
              </div>
            </div>
          )}
          
          <span className="text-text-faint">─┐</span>
        </div>
      </div>

      {/* Row 2: Tab bar */}
      <div className="flex items-center justify-between h-9 px-3 border-b border-dashed border-border-subtle">
        <div className="flex items-center gap-1 min-w-0 overflow-hidden flex-1 text-xs">
          <span className="text-text-faint mr-1">│</span>
          
          {/* Scratchpad tab */}
          <TerminalTab
            active={activeTab === 'scratchpad'}
            onClick={() => { onTabChange('scratchpad') }}
            label="PAD"
            testId="tab-scratchpad"
          />

          {/* File tabs */}
          {openFiles.map((file) => {
            const testId = `editor-tab-${file.name.replace(/\./g, '-').toLowerCase()}`
            const isActive = file.path === activeFilePath
            const shortName = file.name.length > 12 ? file.name.slice(0, 10) + '..' : file.name

            return (
              <TerminalTab
                key={file.path}
                active={isActive}
                onClick={() => { setActiveFilePath(file.path) }}
                label={shortName}
                testId={testId}
                closable
                onClose={() => { closeFile(file.path) }}
              />
            )
          })}

          {/* Chat tabs */}
          {sessions.length > 0 ? (
            sessions.map((session, index) => (
              <TerminalTab
                key={session.id}
                active={activeSessionId === session.id && activeTab === 'chat'}
                onClick={() => {
                  onSessionChange?.(session.id)
                  onTabChange('chat')
                }}
                label={`CHAT${sessions.length > 1 ? index + 1 : ''}`}
                testId={`tab-session-${session.id}`}
                closable
                onClose={() => {
                  // TODO: Implement session close
                }}
              />
            ))
          ) : (
            <TerminalTab
              active={activeTab === 'chat'}
              onClick={() => { onTabChange('chat') }}
              label="CHAT"
              testId="tab-chat"
            />
          )}

          {/* New chat button */}
          {onNewSession && (
            <button
              onClick={onNewSession}
              className="px-2 py-1 text-text-muted hover:text-text-accent transition-colors"
              title="New chat"
              data-testid="new-chat-button"
            >
              [+]
            </button>
          )}
        </div>

        {/* Right side - History */}
        <div className="flex items-center gap-2">
          <button
            onClick={() => { setHistoryDialogOpen(true) }}
            title="Conversation history"
            className="flex items-center gap-1 px-2 py-1 text-xs text-text-muted hover:text-text-accent transition-colors"
          >
            <History className="size-3" />
            <span>[HIST]</span>
          </button>
          <span className="text-text-faint">│</span>
        </div>
      </div>

      {/* Conversation history dialog */}
      <ConversationHistoryDialog
        isOpen={historyDialogOpen}
        onClose={() => { setHistoryDialogOpen(false) }}
      />
    </div>
  )
}

interface TerminalTabProps {
  active: boolean
  onClick: () => void
  label: string
  testId?: string
  closable?: boolean
  onClose?: () => void
}

function TerminalTab({
  active,
  onClick,
  label,
  testId,
  closable,
  onClose,
}: TerminalTabProps): React.ReactElement {
  return (
    <button
      onClick={onClick}
      data-testid={testId}
      data-active={active}
      className={cn(
        'group flex items-center gap-1 px-2 py-1 text-xs transition-colors',
        active
          ? 'text-text-accent bg-surface-active'
          : 'text-text-muted hover:text-text-primary hover:bg-surface-hover'
      )}
    >
      <span>[{label}]</span>
      
      {closable && (
        <button
          onClick={(e) => {
            e.stopPropagation()
            onClose?.()
          }}
          className="opacity-0 group-hover:opacity-100 hover:text-status-error transition-opacity"
        >
          <X className="size-3" />
        </button>
      )}
    </button>
  )
}
