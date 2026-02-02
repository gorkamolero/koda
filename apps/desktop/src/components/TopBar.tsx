import { useState, useCallback, useRef } from 'react'
import { useAtomValue, useSetAtom } from 'jotai'
import {
  ChevronDown,
  GitBranch,
  MessageSquare,
  FileText,
  Plus,
  ChevronLeft,
  Terminal,
  Folder,
  Code2,
  Check,
  Copy,
  Pencil,
  History,
  Share2,
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
 * Conductor-style top bar with TWO header rows:
 *
 * Row 1 (workspace-header): [Workspace name] [branch] [origin] [Open dropdown]
 * Row 2 (session-tabs): [Scratchpad] [+ New] [Session tabs...] [History] [Share]
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
  const [copied, setCopied] = useState(false)
  const [branchCopied, setBranchCopied] = useState(false)
  const [isEditingBranch, setIsEditingBranch] = useState(false)
  const [editedBranch, setEditedBranch] = useState('')
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
  const workspaceName = workspace?.worktreePath?.split('/').pop() ?? workspace?.branch ?? 'Workspace'
  const workspacePath = workspace?.worktreePath ?? ''

  const handleCopyBranch = useCallback(async (): Promise<void> => {
    await navigator.clipboard.writeText(branch)
    setBranchCopied(true)
    setTimeout(() => { setBranchCopied(false) }, 2000)
  }, [branch])

  const handleEditBranch = useCallback(() => {
    setEditedBranch(branch)
    setIsEditingBranch(true)
  }, [branch])

  const handleSaveBranch = useCallback(() => {
    // TODO: Implement branch rename via RPC
    setIsEditingBranch(false)
  }, [])

  const handleShare = useCallback(async (): Promise<void> => {
    if (!workspace?.id) return
    await navigator.clipboard.writeText(workspace.id)
    setCopied(true)
    setTimeout(() => { setCopied(false) }, 2000)
  }, [workspace?.id])

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

          {/* Branch selector with edit/copy on hover */}
          <div className="flex items-center group">
            {isEditingBranch ? (
              <div className="flex items-center gap-1">
                <GitBranch className="h-3 w-3 text-muted-foreground" />
                <input
                  type="text"
                  value={editedBranch}
                  onChange={(e) => { setEditedBranch(e.target.value) }}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') handleSaveBranch()
                    if (e.key === 'Escape') setIsEditingBranch(false)
                  }}
                  onBlur={() => { setIsEditingBranch(false) }}
                  autoFocus
                  className="px-1 py-0.5 text-xs bg-background border border-border rounded w-[140px] focus:outline-none focus:ring-1 focus:ring-ring"
                />
              </div>
            ) : (
              <>
                <button className="flex items-center gap-1 px-1.5 py-0.5 text-xs rounded hover:bg-accent transition-colors">
                  <GitBranch className="h-3 w-3 text-muted-foreground" />
                  <span className="text-muted-foreground truncate max-w-[120px]">{branch}</span>
                  <ChevronDown className="h-3 w-3 text-muted-foreground" />
                </button>

                {/* Hover actions for branch */}
                <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                  <button
                    onClick={handleEditBranch}
                    className="p-1 rounded hover:bg-accent text-muted-foreground hover:text-foreground transition-colors"
                    title="Rename branch"
                  >
                    <Pencil className="h-3 w-3" />
                  </button>
                  <button
                    onClick={() => void handleCopyBranch()}
                    className="p-1 rounded hover:bg-accent text-muted-foreground hover:text-foreground transition-colors"
                    title={branchCopied ? 'Copied!' : 'Copy branch name'}
                  >
                    {branchCopied ? (
                      <Check className="h-3 w-3 text-green-500" />
                    ) : (
                      <Copy className="h-3 w-3" />
                    )}
                  </button>
                </div>
              </>
            )}
          </div>

          {/* Origin indicator */}
          <span className="text-xs text-muted-foreground/60">
            ← origin/main
          </span>
        </div>

        {/* Right: Open dropdown */}
        <div ref={openDropdownRef} className="relative">
          <button
            onClick={() => { setOpenDropdownVisible(!openDropdownVisible) }}
            className="flex items-center gap-1.5 px-2 py-1 text-xs text-muted-foreground hover:text-foreground hover:bg-accent rounded transition-colors"
            title="Open workspace in..."
          >
            <Folder className="h-3.5 w-3.5" />
            <span>Open</span>
            <ChevronDown className={cn("h-3 w-3 transition-transform", openDropdownVisible && "rotate-180")} />
          </button>

          {openDropdownVisible && (
            <div className="absolute top-full right-0 mt-1 z-50 w-48 py-1 bg-popover border border-border rounded-md shadow-lg">
              <button
                onClick={handleOpenInTerminal}
                className="w-full flex items-center gap-2 px-3 py-2 text-sm text-left hover:bg-accent transition-colors"
              >
                <Terminal className="h-4 w-4" />
                <span>Open in Terminal</span>
              </button>
              <button
                onClick={handleOpenInFinder}
                className="w-full flex items-center gap-2 px-3 py-2 text-sm text-left hover:bg-accent transition-colors"
              >
                <Folder className="h-4 w-4" />
                <span>Open in Finder</span>
              </button>
              <div className="h-px bg-border my-1" />
              <button
                onClick={() => { handleOpenInIDE('vscode') }}
                className="w-full flex items-center gap-2 px-3 py-2 text-sm text-left hover:bg-accent transition-colors"
              >
                <Code2 className="h-4 w-4" />
                <span>Open in VS Code</span>
              </button>
              <button
                onClick={() => { handleOpenInIDE('cursor') }}
                className="w-full flex items-center gap-2 px-3 py-2 text-sm text-left hover:bg-accent transition-colors"
              >
                <Code2 className="h-4 w-4" />
                <span>Open in Cursor</span>
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Row 2: Session tabs */}
      <div className="flex items-center gap-1 h-9 px-2 bg-muted/30">
        {/* Scratchpad tab */}
        <TabButton
          active={activeTab === 'scratchpad'}
          onClick={() => { onTabChange('scratchpad') }}
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
            onClick={() => { onTabChange('chat') }}
            icon={<MessageSquare className="h-3.5 w-3.5" />}
            testId="tab-chat"
          >
            Chat
          </TabButton>
        )}

        {/* Editor file tabs */}
        {openFiles.length > 0 && (
          <>
            {/* Separator before file tabs */}
            <div className="h-4 w-px bg-border mx-1" />

            {openFiles.map((file) => {
              const testId = `editor-tab-${file.name.replace(/\./g, '-').toLowerCase()}`
              const isActive = file.path === activeFilePath

              return (
                <button
                  key={file.path}
                  data-testid={testId}
                  data-unsaved={file.isDirty || undefined}
                  onClick={() => { setActiveFilePath(file.path) }}
                  className={cn(
                    'group flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium rounded transition-colors',
                    isActive
                      ? 'bg-background text-foreground shadow-sm'
                      : 'text-muted-foreground hover:text-foreground hover:bg-background/50'
                  )}
                >
                  {/* Dirty indicator */}
                  {file.isDirty && (
                    <span className="w-1.5 h-1.5 rounded-full bg-primary flex-shrink-0" />
                  )}

                  {/* File name */}
                  <span className="truncate max-w-[100px]">{file.name}</span>

                  {/* Close button */}
                  <button
                    onClick={(e) => {
                      e.stopPropagation()
                      closeFile(file.path)
                    }}
                    className="p-0.5 rounded hover:bg-accent opacity-0 group-hover:opacity-100 transition-opacity"
                    title="Close"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </button>
              )
            })}
          </>
        )}

        {/* Spacer */}
        <div className="flex-1" />

        {/* History button */}
        <button
          onClick={() => { setHistoryDialogOpen(true) }}
          title="Conversation history"
          className="p-1.5 rounded-md hover:bg-accent text-muted-foreground hover:text-foreground transition-colors"
        >
          <History className="h-4 w-4" />
        </button>

        {/* Share button */}
        <button
          onClick={() => void handleShare()}
          title={copied ? 'Copied!' : 'Copy workspace ID to share'}
          className="flex items-center gap-1.5 px-2 py-1.5 text-xs font-medium rounded-md hover:bg-accent transition-colors"
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
      </div>

      {/* Conversation history dialog */}
      <ConversationHistoryDialog
        isOpen={historyDialogOpen}
        onClose={() => { setHistoryDialogOpen(false) }}
      />
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

function TabButton({ active, onClick, badge, icon, children, testId }: TabButtonProps): React.ReactElement {
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
