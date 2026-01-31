import { useEffect, useRef, useState } from 'react'
import { Terminal } from 'xterm'
import { FitAddon } from 'xterm-addon-fit'
import { Plus, X, Terminal as TerminalIcon } from 'lucide-react'
import { cn } from '@/lib/utils'
import 'xterm/css/xterm.css'

interface TerminalTab {
  id: string
  title: string
  terminal: Terminal
  fitAddon: FitAddon
}

interface TerminalPanelProps {
  workspaceId: string
  workingDirectory?: string
}

/**
 * Terminal panel with tabbed xterm.js instances.
 *
 * Features:
 * - Multiple terminal tabs
 * - Auto-resize with FitAddon
 * - Ready for PTY integration via sidecar
 */
export function TerminalPanel({ workspaceId: _workspaceId, workingDirectory }: TerminalPanelProps) {
  // workspaceId will be used for PTY session management
  void _workspaceId
  const containerRef = useRef<HTMLDivElement>(null)
  const [tabs, setTabs] = useState<TerminalTab[]>([])
  const [activeTabId, setActiveTabId] = useState<string | null>(null)

  // Create initial terminal on mount
  useEffect(() => {
    createNewTerminal()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Handle resize
  useEffect(() => {
    const handleResize = () => {
      const activeTab = tabs.find(t => t.id === activeTabId)
      if (activeTab) {
        activeTab.fitAddon.fit()
      }
    }

    window.addEventListener('resize', handleResize)
    return () => window.removeEventListener('resize', handleResize)
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

      // Write welcome message if empty
      if (activeTab.terminal.buffer.active.length <= 1) {
        activeTab.terminal.writeln('\x1b[1;36m╭─────────────────────────────────────╮\x1b[0m')
        activeTab.terminal.writeln('\x1b[1;36m│\x1b[0m  \x1b[1;33mKoda Terminal\x1b[0m                      \x1b[1;36m│\x1b[0m')
        activeTab.terminal.writeln('\x1b[1;36m│\x1b[0m  PTY integration coming soon...     \x1b[1;36m│\x1b[0m')
        activeTab.terminal.writeln('\x1b[1;36m╰─────────────────────────────────────╯\x1b[0m')
        activeTab.terminal.writeln('')
        activeTab.terminal.write(`\x1b[1;32m${workingDirectory || '~'}\x1b[0m $ `)
      }
    }
  }, [activeTabId, tabs, workingDirectory])

  const createNewTerminal = () => {
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

    // Handle input (placeholder - will connect to PTY later)
    terminal.onData((data: string) => {
      // Echo input for now
      if (data === '\r') {
        terminal.writeln('')
        terminal.write(`\x1b[1;32m${workingDirectory || '~'}\x1b[0m $ `)
      } else if (data === '\x7f') {
        // Backspace
        terminal.write('\b \b')
      } else {
        terminal.write(data)
      }
    })

    const newTab: TerminalTab = {
      id,
      title: `Terminal ${tabs.length + 1}`,
      terminal,
      fitAddon,
    }

    setTabs(prev => [...prev, newTab])
    setActiveTabId(id)
  }

  const closeTerminal = (id: string) => {
    const tab = tabs.find(t => t.id === id)
    if (tab) {
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

  return (
    <div className="h-full flex flex-col bg-[#1a1b1e]">
      {/* Tab bar */}
      <div className="flex items-center border-b border-border/50 bg-[#141517]">
        <div className="flex-1 flex items-center overflow-x-auto">
          {tabs.map((tab) => (
            <div
              key={tab.id}
              className={cn(
                'flex items-center gap-2 px-3 py-1.5 text-xs border-r border-border/30 cursor-pointer group',
                activeTabId === tab.id
                  ? 'bg-[#1a1b1e] text-foreground'
                  : 'text-muted-foreground hover:text-foreground hover:bg-[#1a1b1e]/50'
              )}
              onClick={() => setActiveTabId(tab.id)}
            >
              <TerminalIcon className="h-3 w-3" />
              <span>{tab.title}</span>
              <button
                onClick={(e) => {
                  e.stopPropagation()
                  closeTerminal(tab.id)
                }}
                className="opacity-0 group-hover:opacity-100 hover:text-destructive transition-opacity"
              >
                <X className="h-3 w-3" />
              </button>
            </div>
          ))}
        </div>

        {/* New terminal button */}
        <button
          onClick={createNewTerminal}
          className="p-2 text-muted-foreground hover:text-foreground transition-colors"
        >
          <Plus className="h-4 w-4" />
        </button>
      </div>

      {/* Terminal container */}
      <div ref={containerRef} className="flex-1 p-2" />

      {/* Empty state */}
      {tabs.length === 0 && (
        <div className="flex-1 flex items-center justify-center">
          <button
            onClick={createNewTerminal}
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
