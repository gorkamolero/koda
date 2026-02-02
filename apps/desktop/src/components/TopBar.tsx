import { useState, useCallback, useRef } from 'react'
import { useAtomValue, useSetAtom } from 'jotai'
import {
  ChevronDown,
  GitBranch,
  Plus,
  ChevronRight,
  Terminal,
  Folder,
  Code2,
  Check,
  Copy,
  Pencil,
  History,
  Files,
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

// Claude icon SVG path
const ClaudeIcon = () => (
  <svg
    stroke="currentColor"
    fill="currentColor"
    strokeWidth="0"
    role="img"
    viewBox="0 0 24 24"
    className="size-3 flex-shrink-0"
    height="1em"
    width="1em"
    xmlns="http://www.w3.org/2000/svg"
  >
    <path d="m4.7144 15.9555 4.7174-2.6471.079-.2307-.079-.1275h-.2307l-.7893-.0486-2.6956-.0729-2.3375-.0971-2.2646-.1214-.5707-.1215-.5343-.7042.0546-.3522.4797-.3218.686.0608 1.5179.1032 2.2767.1578 1.6514.0972 2.4468.255h.3886l.0546-.1579-.1336-.0971-.1032-.0972L6.973 9.8356l-2.55-1.6879-1.3356-.9714-.7225-.4918-.3643-.4614-.1578-1.0078.6557-.7225.8803.0607.2246.0607.8925.686 1.9064 1.4754 2.4893 1.8336.3643.3035.1457-.1032.0182-.0728-.164-.2733-1.3539-2.4467-1.445-2.4893-.6435-1.032-.17-.6194c-.0607-.255-.1032-.4674-.1032-.7285L6.287.1335 6.6997 0l.9957.1336.419.3642.6192 1.4147 1.0018 2.2282 1.5543 3.0296.4553.8985.2429.8318.091.255h.1579v-.1457l.1275-1.706.2368-2.0947.2307-2.6957.0789-.7589.3764-.9107.7468-.4918.5828.2793.4797.686-.0668.4433-.2853 1.8517-.5586 2.9021-.3643 1.9429h.2125l.2429-.2429.9835-1.3053 1.6514-2.0643.7286-.8196.85-.9046.5464-.4311h1.0321l.759 1.1293-.34 1.1657-1.0625 1.3478-.8804 1.1414-1.2628 1.7-.7893 1.36.0729.1093.1882-.0183 2.8535-.607 1.5421-.2794 1.8396-.3157.8318.3886.091.3946-.3278.8075-1.967.4857-2.3072.4614-3.4364.8136-.0425.0304.0486.0607 1.5482.1457.6618.0364h1.621l3.0175.2247.7892.522.4736.6376-.079.4857-1.2142.6193-1.6393-.3886-3.825-.9107-1.3113-.3279h-.1822v.1093l1.0929 1.0686 2.0035 1.8092 2.5075 2.3314.1275.5768-.3218.4554-.34-.0486-2.2039-1.6575-.85-.7468-1.9246-1.621h-.1275v.17l.4432.6496 2.3436 3.5214.1214 1.0807-.17.3521-.6071.2125-.6679-.1214-1.3721-1.9246L14.38 17.959l-1.1414-1.9428-.1397.079-.674 7.2552-.3156.3703-.7286.2793-.6071-.4614-.3218-.7468.3218-1.4753.3886-1.9246.3157-1.53.2853-1.9004.17-.6314-.0121-.0425-.1397.0182-1.4328 1.9672-2.1796 2.9446-1.7243 1.8456-.4128.164-.7164-.3704.0667-.6618.4008-.5889 2.386-3.0357 1.4389-1.882.929-1.0868-.0062-.1579h-.0546l-6.3385 4.1164-1.1293.1457-.4857-.4554.0608-.7467.2307-.2429 1.9064-1.3114Z" />
  </svg>
)

// Scratchpad icon (sticky note)
const ScratchpadIcon = () => (
  <svg
    stroke="currentColor"
    fill="currentColor"
    strokeWidth="0"
    viewBox="0 0 16 16"
    className="size-3 flex-shrink-0"
    height="1em"
    width="1em"
    xmlns="http://www.w3.org/2000/svg"
  >
    <path d="M2.5 1A1.5 1.5 0 0 0 1 2.5v11A1.5 1.5 0 0 0 2.5 15h6.086a1.5 1.5 0 0 0 1.06-.44l4.915-4.914A1.5 1.5 0 0 0 15 8.586V2.5A1.5 1.5 0 0 0 13.5 1zM2 2.5a.5.5 0 0 1 .5-.5h11a.5.5 0 0 1 .5.5V8H9.5A1.5 1.5 0 0 0 8 9.5V14H2.5a.5.5 0 0 1-.5-.5zm7 11.293V9.5a.5.5 0 0 1 .5-.5h4.293z" />
  </svg>
)

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
 * Row 1: [branch] > [origin/main] ... [/workspace Open▼]
 * Row 2: [Scratchpad] [File tabs...] [Chat tabs...] [+] ... [History]
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
    <div className="flex flex-col">
      {/* Row 1: Workspace header with branch info (also window drag region) */}
      <div
        className="flex items-center justify-between h-10 px-4 bg-sidebar-background border-b border-border"
        data-tauri-drag-region
      >
        {/* Left: Branch and origin */}
        <div className="flex items-center gap-2 min-w-0 flex-1 overflow-hidden">
          {/* Branch with edit/copy on hover */}
          <div className="flex items-center group">
            <GitBranch className="size-3 text-muted-foreground flex-shrink-0" />
            {isEditingBranch ? (
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
                className="ml-1 px-1 py-0.5 text-sm bg-background border border-border rounded w-[140px] focus:outline-none focus:ring-1 focus:ring-ring"
              />
            ) : (
              <div className="text-sm font-medium min-w-0 flex items-center relative cursor-pointer">
                <span className="truncate min-w-0 px-1">{branch}</span>
                {/* Hover actions */}
                <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                  <button
                    onClick={handleEditBranch}
                    className="p-1 rounded hover:bg-accent text-muted-foreground hover:text-foreground"
                    title="Rename branch"
                  >
                    <Pencil className="size-3" />
                  </button>
                  <button
                    onClick={() => void handleCopyBranch()}
                    className="p-1 rounded hover:bg-accent text-muted-foreground hover:text-foreground"
                    title={branchCopied ? 'Copied!' : 'Copy branch name'}
                  >
                    {branchCopied ? (
                      <Check className="size-3 text-green-500" />
                    ) : (
                      <Copy className="size-3" />
                    )}
                  </button>
                </div>
              </div>
            )}
          </div>

          <ChevronRight className="size-3 text-muted-foreground flex-shrink-0" />

          {/* Origin selector */}
          <button className="flex items-center gap-1 px-1 py-0.5 text-sm text-muted-foreground hover:text-foreground hover:bg-muted rounded transition-colors">
            <span>origin/main</span>
            <ChevronDown className="size-3" />
          </button>
        </div>

        {/* Right: Open dropdown */}
        <div ref={openDropdownRef} className="relative flex">
          <Link
            to="/"
            className="flex items-center gap-2 px-2 h-6 text-xs font-mono font-medium border border-input bg-background/50 rounded-l-sm hover:bg-sidebar-accent transition-colors"
          >
            <Code2 className="size-3" />
            <span>/{workspaceName}</span>
          </Link>
          <button
            onClick={() => { setOpenDropdownVisible(!openDropdownVisible) }}
            className="flex items-center gap-1 px-2 h-6 text-xs border border-l-0 border-input bg-sidebar-background/40 rounded-r-sm hover:bg-sidebar-accent transition-colors"
          >
            <span>Open</span>
            <ChevronDown className="size-3" />
          </button>

          {openDropdownVisible && (
            <div className="absolute top-full right-0 mt-1 z-50 w-48 py-1 bg-popover border border-border rounded-md shadow-lg">
              <button
                onClick={handleOpenInTerminal}
                className="w-full flex items-center gap-2 px-3 py-2 text-sm text-left hover:bg-accent transition-colors"
              >
                <Terminal className="size-4" />
                <span>Open in Terminal</span>
              </button>
              <button
                onClick={handleOpenInFinder}
                className="w-full flex items-center gap-2 px-3 py-2 text-sm text-left hover:bg-accent transition-colors"
              >
                <Folder className="size-4" />
                <span>Open in Finder</span>
              </button>
              <div className="h-px bg-border my-1" />
              <button
                onClick={() => { handleOpenInIDE('vscode') }}
                className="w-full flex items-center gap-2 px-3 py-2 text-sm text-left hover:bg-accent transition-colors"
              >
                <Code2 className="size-4" />
                <span>Open in VS Code</span>
              </button>
              <button
                onClick={() => { handleOpenInIDE('cursor') }}
                className="w-full flex items-center gap-2 px-3 py-2 text-sm text-left hover:bg-accent transition-colors"
              >
                <Code2 className="size-4" />
                <span>Open in Cursor</span>
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Row 2: Tab bar - Scratchpad | Files | Chat | + | ... | History */}
      <div className="flex items-center gap-3 min-w-0 overflow-hidden px-4 h-10 border-b border-border bg-sidebar-background/50">
        <div className="flex items-center gap-2 min-w-0 overflow-hidden flex-1">
          {/* Scratchpad tab */}
          <TabButton
            active={activeTab === 'scratchpad'}
            onClick={() => { onTabChange('scratchpad') }}
            icon={<ScratchpadIcon />}
            testId="tab-scratchpad"
          />

          {/* File tabs */}
          {openFiles.map((file) => {
            const testId = `editor-tab-${file.name.replace(/\./g, '-').toLowerCase()}`
            const isActive = file.path === activeFilePath

            return (
              <TabButton
                key={file.path}
                active={isActive}
                onClick={() => { setActiveFilePath(file.path) }}
                icon={<Files className="size-3 flex-shrink-0" />}
                testId={testId}
                closable
                onClose={() => { closeFile(file.path) }}
              >
                {file.name}
              </TabButton>
            )
          })}

          {/* Chat tabs - LAST before + button */}
          {sessions.length > 0 ? (
            sessions.map((session) => (
              <TabButton
                key={session.id}
                active={activeSessionId === session.id && activeTab === 'chat'}
                onClick={() => {
                  onSessionChange?.(session.id)
                  onTabChange('chat')
                }}
                icon={<ClaudeIcon />}
                testId={`tab-session-${session.id}`}
                closable
                onClose={() => {
                  // TODO: Implement session close
                }}
              >
                {session.name || 'Chat'}
              </TabButton>
            ))
          ) : (
            /* Default Chat tab when no sessions */
            <TabButton
              active={activeTab === 'chat'}
              onClick={() => { onTabChange('chat') }}
              icon={<ClaudeIcon />}
              testId="tab-chat"
            >
              Chat
            </TabButton>
          )}

          {/* New chat button - after all tabs */}
          {onNewSession && (
            <button
              onClick={onNewSession}
              className="inline-flex px-2 items-center justify-center size-6 rounded-sm text-muted-foreground hover:text-foreground hover:bg-sidebar-accent transition-colors"
              title="New chat"
              data-testid="new-chat-button"
            >
              <Plus className="size-3" />
            </button>
          )}
        </div>

        {/* History button - right side */}
        <button
          onClick={() => { setHistoryDialogOpen(true) }}
          title="Conversation history"
          className="inline-flex px-2 items-center justify-center size-6 rounded-sm text-muted-foreground hover:text-foreground hover:bg-sidebar-accent transition-colors"
        >
          <History className="size-4" />
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
  icon?: React.ReactNode
  children?: React.ReactNode
  testId?: string
  closable?: boolean
  onClose?: () => void
}

function TabButton({
  active,
  onClick,
  icon,
  children,
  testId,
  closable,
  onClose,
}: TabButtonProps): React.ReactElement {
  return (
    <button
      onClick={onClick}
      data-testid={testId}
      data-active={active}
      className={cn(
        'group flex items-center justify-center relative h-10 min-w-0 py-0 pt-0.5 whitespace-nowrap text-sm font-medium',
        '!bg-transparent border-b-2 transition-colors',
        active
          ? 'text-foreground !border-b-primary'
          : 'text-muted-foreground !border-b-transparent hover:text-foreground'
      )}
    >
      <span className="flex items-center gap-2 px-2 text-xs font-medium truncate min-w-0">
        {icon}
        {children && <span className="truncate min-w-0">{children}</span>}
      </span>

      {/* Close button - appears on hover */}
      {closable && (
        <div className="absolute right-0 pl-2 h-full flex items-center pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity">
          <button
            onClick={(e) => {
              e.stopPropagation()
              onClose?.()
            }}
            className="inline-flex items-center justify-center size-5 rounded hover:bg-accent pointer-events-auto"
          >
            <X className="size-3" />
          </button>
        </div>
      )}
    </button>
  )
}
