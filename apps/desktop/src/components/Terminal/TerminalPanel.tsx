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

/**
 * Terminal panel with tabbed xterm.js instances connected to real PTY sessions.
 *
 * Features:
 * - Multiple terminal tabs
 * - Auto-resize with FitAddon
 * - Real shell via node-pty in sidecar
 */
export function TerminalPanel({ workspaceId: _workspaceId, workingDirectory }: TerminalPanelProps) {
  void _workspaceId
  const containerRef = useRef<HTMLDivElement>(null)
  const [tabs, setTabs] = useState<TerminalTab[]>([])
  const [activeTabId, setActiveTabId] = useState<string | null>(null)

  // Keep track of PTY data handlers per session
  const ptyDataUnsubscribers = useRef<Map<string, () => void>>(new Map())

  // Create initial terminal on mount
  useEffect(() => {
    void createNewTerminal()
    const unsubscribersMap = ptyDataUnsubscribers.current

    // Cleanup all PTY sessions on unmount
    return () => {
      for (const unsubscribe of unsubscribersMap.values()) {
        unsubscribe()
      }
      unsubscribersMap.clear()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

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

  // Mount active terminal to container
  useEffect(() => {
    const activeTab = tabs.find(t => t.id === activeTabId)
    if (activeTab && containerRef.current) {
      // Clear container
      containerRef.current.innerHTML = ''

      // Mount terminal
      activeTab.terminal.open(containerRef.current)
      activeTab.fitAddon.fit()

      // Focus terminal
      activeTab.terminal.focus()
    }
  }, [activeTabId, tabs])

  // Subscribe to PTY data for a session
  const subscribeToPtyData = useCallback((ptySessionId: string, terminal: Terminal) => {
    // Unsubscribe from any existing handler for this session
    const existing = ptyDataUnsubscribers.current.get(ptySessionId)
    if (existing) existing()

    // Subscribe to PTY data notifications
    const unsubscribeData = onPtyData((payload) => {
      if (payload.sessionId === ptySessionId) {
        terminal.write(payload.data)
      }
    })

    // Subscribe to PTY exit notifications
    const unsubscribeExit = onPtyExit((payload) => {
      if (payload.sessionId === ptySessionId) {
        terminal.writeln(`\r\n\x1b[1;33m[Process exited with code ${payload.exitCode}]\x1b[0m`)
        setTabs(prev => prev.map(t =>
          t.ptySessionId === ptySessionId
            ? { ...t, ptySessionId: null, pid: null }
            : t
        ))
      }
    })

    // Store combined unsubscriber
    ptyDataUnsubscribers.current.set(ptySessionId, () => {
      unsubscribeData()
      unsubscribeExit()
    })
  }, [])

  const createNewTerminal = async () => {
    const id = `term-${Date.now()}`
    const terminal = new Terminal({
      theme: {
        background: '#1a1b1e',
        foreground: '#e4e4e7',
        cursor: '#e4e4e7',
        cursorAccent: '#1a1b1e',
        selectionBackground: 'rgba(255, 255, 255, 0.2)',
        black: '#27272a',
        red: '#ef4444',
        green: '#22c55e',
        yellow: '#eab308',
        blue: '#3b82f6',
        magenta: '#a855f7',
        cyan: '#06b6d4',
        white: '#e4e4e7',
        brightBlack: '#52525b',
        brightRed: '#f87171',
        brightGreen: '#4ade80',
        brightYellow: '#facc15',
        brightBlue: '#60a5fa',
        brightMagenta: '#c084fc',
        brightCyan: '#22d3ee',
        brightWhite: '#fafafa',
      },
      fontFamily: 'ui-monospace, SFMono-Regular, "SF Mono", Menlo, Monaco, Consolas, monospace',
      fontSize: 13,
      lineHeight: 1.4,
      cursorBlink: true,
      cursorStyle: 'bar',
    })

    const fitAddon = new FitAddon()
    terminal.loadAddon(fitAddon)

    const newTab: TerminalTab = {
      id,
      title: `Terminal ${tabs.length + 1}`,
      terminal,
      fitAddon,
      ptySessionId: null,
      pid: null,
      connecting: true,
    }

    setTabs(prev => [...prev, newTab])
    setActiveTabId(id)

    // Create PTY session
    try {
      const result = await rpcRequest<{
        sessionId: string
        pid: number
        cols: number
        rows: number
      }>('pty.create', {
        workingDirectory: workingDirectory || undefined,
        cols: terminal.cols,
        rows: terminal.rows,
      })

      // Subscribe to PTY data
      subscribeToPtyData(result.sessionId, terminal)

      // Update tab with PTY session info
      setTabs(prev => prev.map(t =>
        t.id === id
          ? { ...t, ptySessionId: result.sessionId, pid: result.pid, connecting: false }
          : t
      ))

      // Handle user input - send to PTY
      terminal.onData((data: string) => {
        rpcRequest('pty.write', {
          sessionId: result.sessionId,
          data,
        }).catch(err => {
          console.error('[Terminal] Failed to write to PTY:', err)
        })
      })


      console.log(`[Terminal] Created PTY session ${result.sessionId} (PID: ${result.pid})`)
    } catch (err) {
      console.error('[Terminal] Failed to create PTY session:', err)

      // Show error in terminal
      terminal.writeln('\x1b[1;31mFailed to connect to shell\x1b[0m')
      terminal.writeln(`\x1b[90m${err instanceof Error ? err.message : String(err)}\x1b[0m`)

      setTabs(prev => prev.map(t =>
        t.id === id ? { ...t, connecting: false } : t
      ))
    }
  }

  const closeTerminal = async (id: string) => {
    const tab = tabs.find(t => t.id === id)
    if (tab) {
      // Close PTY session
      if (tab.ptySessionId) {
        try {
          await rpcRequest('pty.close', { sessionId: tab.ptySessionId })
        } catch (err) {
          console.error('[Terminal] Failed to close PTY:', err)
        }

        // Unsubscribe from PTY data
        const unsubscribe = ptyDataUnsubscribers.current.get(tab.ptySessionId)
        if (unsubscribe) {
          unsubscribe()
          ptyDataUnsubscribers.current.delete(tab.ptySessionId)
        }
      }

      tab.terminal.dispose()
    }

    setTabs(prev => {
      const newTabs = prev.filter(t => t.id !== id)
      if (activeTabId === id && newTabs.length > 0) {
        const lastTab = newTabs[newTabs.length - 1]
        if (lastTab) {
          setActiveTabId(lastTab.id)
        }
      } else if (newTabs.length === 0) {
        setActiveTabId(null)
      }
      return newTabs
    })
  }

  const activeTab = tabs.find(t => t.id === activeTabId)

  return (
    <div className="h-full flex flex-col bg-[#1a1b1e]" data-testid="terminal-container">
      {/* Tab bar */}
      <div className="flex items-center border-b border-border/50 bg-[#141517]" data-testid="terminal-tab-bar">
        <div className="flex-1 flex items-center overflow-x-auto">
          {tabs.map((tab) => (
            <div
              key={tab.id}
              data-testid={`terminal-tab-${tab.id}`}
              data-pid={tab.pid}
              data-connecting={tab.connecting}
              className={cn(
                'flex items-center gap-2 px-3 py-1.5 text-xs border-r border-border/30 cursor-pointer group',
                activeTabId === tab.id
                  ? 'bg-[#1a1b1e] text-foreground'
                  : 'text-muted-foreground hover:text-foreground hover:bg-[#1a1b1e]/50'
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
      <div ref={containerRef} className="flex-1 p-2" data-testid="terminal-viewport" />

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

      {/* Connection status */}
      {activeTab?.connecting && (
        <div className="absolute inset-0 flex items-center justify-center bg-[#1a1b1e]/80" data-testid="terminal-connecting-overlay">
          <div className="flex items-center gap-2 text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" />
            <span>Connecting to shell...</span>
          </div>
        </div>
      )}
    </div>
  )
}
