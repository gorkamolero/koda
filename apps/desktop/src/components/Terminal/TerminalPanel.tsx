import { useEffect, useRef, useState, useCallback } from 'react'
import { Terminal } from 'xterm'
import { FitAddon } from 'xterm-addon-fit'
import { Plus, X, Terminal as TerminalIcon, Loader2 } from 'lucide-react'
import { cn } from '@/lib/utils'
import { rpcRequest } from '@/lib/tauri'
import { onPtyData, onPtyExit } from '@/lib/sidecarRpc'
import 'xterm/css/xterm.css'

interface TerminalTab {
  id: string
  title: string
  terminal: Terminal
  fitAddon: FitAddon
  ptySessionId: string | null
  pid: number | null
  connecting: boolean
}

interface TerminalPanelProps {
  workspaceId: string
  workingDirectory?: string
}

interface OwnedTerminal extends TerminalTab {
  disposeListeners: (() => void)[]
}

interface TerminalScope {
  workingDirectory?: string
  nextNumber: number
  tabs: Map<string, OwnedTerminal>
}

function closePty(sessionId: string) {
  void rpcRequest('pty.close', { sessionId }).catch(err => {
    console.error('[Terminal] Failed to close PTY:', err)
  })
}

function disposeTab(tab: OwnedTerminal) {
  for (const dispose of tab.disposeListeners) dispose()
  tab.disposeListeners = []
  tab.terminal.dispose()
  if (tab.ptySessionId) closePty(tab.ptySessionId)
}

/**
 * Terminal panel with tabbed xterm.js instances connected to real PTY sessions.
 *
 * Features:
 * - Multiple terminal tabs
 * - Auto-resize with FitAddon
 * - Real shell via node-pty in sidecar
 */
export function TerminalPanel({ workspaceId, workingDirectory }: TerminalPanelProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const panelRef = useRef<HTMLDivElement>(null)
  const [tabs, setTabs] = useState<TerminalTab[]>([])
  const [activeTabId, setActiveTabId] = useState<string | null>(null)

  const scopeRef = useRef<TerminalScope | null>(null)

  // Create initial terminal on mount
  useEffect(() => {
    const scope: TerminalScope = { workingDirectory, nextNumber: 0, tabs: new Map() }
    scopeRef.current = scope
    setTabs([])
    setActiveTabId(null)

    // Defer startup until the effect owns the panel. StrictMode's discarded
    // setup must not start a second shell, even if pty.create replies slowly.
    queueMicrotask(() => {
      if (scopeRef.current === scope && scope.tabs.size === 0) void createNewTerminal()
    })

    // Cleanup all PTY sessions on unmount
    return () => {
      if (scopeRef.current === scope) scopeRef.current = null
      for (const tab of scope.tabs.values()) disposeTab(tab)
      scope.tabs.clear()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [workspaceId, workingDirectory])

  // Handle resize
  useEffect(() => {
    const activeTab = tabs.find(t => t.id === activeTabId)
    if (!activeTab) return

    const handleResize = () => {
      activeTab.fitAddon.fit()

      // Send resize to PTY
      if (activeTab.ptySessionId) {
        const { cols, rows } = activeTab.terminal
        rpcRequest('pty.resize', {
          sessionId: activeTab.ptySessionId,
          cols,
          rows,
        }).catch(err => {
          console.error('[Terminal] Failed to resize PTY:', err)
        })
      }
    }

    window.addEventListener('resize', handleResize)
    return () => { window.removeEventListener('resize', handleResize); }
  }, [tabs, activeTabId])

  const activeTerminal = tabs.find(t => t.id === activeTabId)

  // Reattach an existing xterm element when switching tabs; open each once.
  useEffect(() => {
    const container = containerRef.current
    if (!container) return
    container.replaceChildren()
    if (!activeTerminal) return
    if (activeTerminal.terminal.element) container.appendChild(activeTerminal.terminal.element)
    else activeTerminal.terminal.open(container)
    activeTerminal.fitAddon.fit()
    activeTerminal.terminal.focus()
  }, [activeTerminal?.terminal, activeTerminal?.fitAddon])

  // Navigation helpers
  const navigateToNextTab = useCallback(() => {
    if (tabs.length <= 1) return
    const currentIndex = tabs.findIndex(t => t.id === activeTabId)
    const nextIndex = (currentIndex + 1) % tabs.length
    const nextTab = tabs[nextIndex]
    if (nextTab) setActiveTabId(nextTab.id)
  }, [tabs, activeTabId])

  const navigateToPrevTab = useCallback(() => {
    if (tabs.length <= 1) return
    const currentIndex = tabs.findIndex(t => t.id === activeTabId)
    const prevIndex = currentIndex <= 0 ? tabs.length - 1 : currentIndex - 1
    const prevTab = tabs[prevIndex]
    if (prevTab) setActiveTabId(prevTab.id)
  }, [tabs, activeTabId])

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Only handle if terminal panel is focused or contains focus
      if (!panelRef.current?.contains(document.activeElement) && document.activeElement !== panelRef.current) {
        return
      }

      // Cmd+T: New terminal tab
      if (e.metaKey && e.key === 't') {
        e.preventDefault()
        e.stopPropagation()
        void createNewTerminal()
        return
      }

      // Cmd+W: Close current terminal tab
      if (e.metaKey && e.key === 'w') {
        e.preventDefault()
        e.stopPropagation()
        if (activeTabId) {
          void closeTerminal(activeTabId)
        }
        return
      }

      // Opt+Cmd+Right: Next terminal
      if (e.metaKey && e.altKey && e.key === 'ArrowRight') {
        e.preventDefault()
        e.stopPropagation()
        navigateToNextTab()
        return
      }

      // Opt+Cmd+Left: Previous terminal
      if (e.metaKey && e.altKey && e.key === 'ArrowLeft') {
        e.preventDefault()
        e.stopPropagation()
        navigateToPrevTab()
        return
      }
    }

    window.addEventListener('keydown', handleKeyDown, true)
    return () => window.removeEventListener('keydown', handleKeyDown, true)
  }, [activeTabId, navigateToNextTab, navigateToPrevTab])

  const createNewTerminal = async () => {
    const scope = scopeRef.current
    if (!scope) return
    const id = `term-${crypto.randomUUID()}`
    const terminal = new Terminal({
      theme: {
        background: '#000000',
        foreground: '#c5c5c5',
        cursor: '#e07a5f',
        cursorAccent: '#000000',
        selectionBackground: 'rgba(224, 122, 95, 0.25)',
        black: '#141414',
        red: '#f87171',
        green: '#4ade80',
        yellow: '#fbbf24',
        blue: '#60a5fa',
        magenta: '#c084fc',
        cyan: '#22d3ee',
        white: '#c5c5c5',
        brightBlack: '#3a3a3a',
        brightRed: '#f87171',
        brightGreen: '#4ade80',
        brightYellow: '#facc15',
        brightBlue: '#60a5fa',
        brightMagenta: '#c084fc',
        brightCyan: '#22d3ee',
        brightWhite: '#e8e8e8',
      },
      fontFamily: 'ui-monospace, SFMono-Regular, "SF Mono", Menlo, Monaco, Consolas, monospace',
      fontSize: 13,
      lineHeight: 1.2,
      cursorBlink: true,
      cursorStyle: 'bar',
      scrollback: 1000,
    })

    const fitAddon = new FitAddon()
    terminal.loadAddon(fitAddon)

    const newTab: OwnedTerminal = {
      id,
      title: `Terminal ${++scope.nextNumber}`,
      terminal,
      fitAddon,
      ptySessionId: null,
      pid: null,
      connecting: true,
      disposeListeners: [],
    }

    scope.tabs.set(id, newTab)
    const isOwned = () => scopeRef.current === scope && scope.tabs.get(id) === newTab
    setTabs([...scope.tabs.values()])
    setActiveTabId(id)

    // Create PTY session
    try {
      const result = await rpcRequest<{
        sessionId: string
        pid: number
        cols: number
        rows: number
      }>('pty.create', {
        workingDirectory: scope.workingDirectory || undefined,
        cols: terminal.cols,
        rows: terminal.rows,
      })

      // A closed tab or previous workspace must not acquire a late session.
      if (!isOwned()) {
        closePty(result.sessionId)
        return
      }
      newTab.ptySessionId = result.sessionId
      newTab.pid = result.pid
      newTab.connecting = false
      terminal.clear()
      newTab.disposeListeners.push(
        onPtyData(payload => {
          if (isOwned() && payload.sessionId === newTab.ptySessionId) terminal.write(payload.data)
        }),
        onPtyExit(payload => {
          if (!isOwned() || payload.sessionId !== newTab.ptySessionId) return
          terminal.writeln(`\r\n\x1b[1;33m[Process exited with code ${payload.exitCode}]\x1b[0m`)
          newTab.ptySessionId = null
          newTab.pid = null
          setTabs([...scope.tabs.values()])
        }),
      )
      setTabs([...scope.tabs.values()])

      // Handle user input - send to PTY
      const input = terminal.onData((data: string) => {
        if (!isOwned() || !newTab.ptySessionId) return
        rpcRequest('pty.write', {
          sessionId: newTab.ptySessionId,
          data,
        }).catch(err => {
          console.error('[Terminal] Failed to write to PTY:', err)
        })
      })
      newTab.disposeListeners.push(() => input.dispose())

      console.log(`[Terminal] Created PTY session ${result.sessionId} (PID: ${result.pid})`)
    } catch (err) {
      if (!isOwned()) return
      console.error('[Terminal] Failed to create PTY session:', err)

      // Show error in terminal
      terminal.writeln('\x1b[1;31mFailed to connect to shell\x1b[0m')
      terminal.writeln(`\x1b[90m${err instanceof Error ? err.message : String(err)}\x1b[0m`)

      newTab.connecting = false
      setTabs([...scope.tabs.values()])
    }
  }

  const closeTerminal = (id: string) => {
    const scope = scopeRef.current
    const tab = scope?.tabs.get(id)
    if (!scope || !tab) return
    scope.tabs.delete(id)
    disposeTab(tab)
    const remaining = [...scope.tabs.values()]
    setTabs(remaining)
    setActiveTabId(current => current === id ? remaining[remaining.length - 1]?.id ?? null : current)
  }

  return (
    <div
      ref={panelRef}
      className="h-full flex flex-col bg-surface-terminal"
      data-testid="terminal-container"
      tabIndex={-1}
    >
      {/* Tab bar */}
      <div className="flex items-center border-b border-border-subtle bg-surface-card" data-testid="terminal-tab-bar">
        <div className="flex-1 flex items-center overflow-x-auto scrollbar-none">
          {tabs.map((tab) => (
            <div
              key={tab.id}
              data-testid={`terminal-tab-${tab.id}`}
              data-pid={tab.pid}
              data-connecting={tab.connecting}
              className={cn(
                'flex items-center gap-2 px-3 py-1.5 text-xs border-r border-border-subtle cursor-pointer group whitespace-nowrap flex-shrink-0',
                activeTabId === tab.id
                  ? 'bg-surface-terminal text-text-primary'
                  : 'text-text-muted hover:text-text-primary hover:bg-surface-hover'
              )}
              onClick={() => { setActiveTabId(tab.id); }}
            >
              {tab.connecting ? (
                <Loader2 className="h-3 w-3 animate-spin" data-testid="terminal-connecting-spinner" />
              ) : (
                <TerminalIcon className="h-3 w-3" />
              )}
              <span>{tab.title}</span>
              {tab.pid && (
                <span className="text-muted-foreground/60 text-[10px]" data-testid="terminal-pid">
                  ({tab.pid})
                </span>
              )}
              <button
                onClick={(e) => {
                  e.stopPropagation()
                  void closeTerminal(tab.id)
                }}
                data-testid={`terminal-close-${tab.id}`}
                className="opacity-0 group-hover:opacity-100 hover:text-destructive transition-opacity"
              >
                <X className="h-3 w-3" />
              </button>
            </div>
          ))}
        </div>

        {/* New terminal button */}
        <button
          onClick={() => void createNewTerminal()}
          data-testid="terminal-new-tab"
          className="p-2 text-muted-foreground hover:text-foreground transition-colors"
        >
          <Plus className="h-4 w-4" />
        </button>
      </div>

      {/* Terminal container */}
      <div ref={containerRef} className="flex-1" data-testid="terminal-viewport" />

      {/* Empty state */}
      {tabs.length === 0 && (
        <div className="flex-1 flex items-center justify-center">
          <button
            onClick={() => void createNewTerminal()}
            data-testid="terminal-new-empty"
            className="flex items-center gap-2 px-4 py-2 text-sm text-muted-foreground hover:text-foreground hover:bg-accent rounded-md transition-colors"
          >
            <Plus className="h-4 w-4" />
            New Terminal
          </button>
        </div>
      )}
    </div>
  )
}
