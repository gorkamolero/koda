import { Button, TerminalFrame } from '@koda/ui'
import { useEffect, useRef, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Terminal } from 'xterm'
import { FitAddon } from 'xterm-addon-fit'
import { Lock, Terminal as TerminalIcon } from 'lucide-react'
import { cn } from '@/lib/utils'
import { rpcRequest } from '@/lib/tauri'
import { onPtyData, onPtyExit } from '@/lib/sidecarRpc'
import { TERMINAL_OPTIONS } from './terminalOptions'
import 'xterm/css/xterm.css'

type HostTerminal = { sessionId: string; pid: number; workingDirectory: string; createdAt: string }
type Mirror = { terminal: Terminal; fitAddon: FitAddon; dispose: () => void }

/** The host's terminals in a shared workspace, mirrored read-only. */
export function RemoteTerminalPanel({ worktreeId, hostName }: { worktreeId: string; hostName: string | null }) {
  const containerRef = useRef<HTMLDivElement>(null)
  const mirrors = useRef(new Map<string, Mirror>())
  const [activeId, setActiveId] = useState<string | null>(null)
  const { data: terminals = [] } = useQuery({
    queryKey: ['remote-terminals', worktreeId],
    queryFn: () => rpcRequest<HostTerminal[]>('pty.list', { worktreeId }),
    refetchInterval: 3000,
  })

  useEffect(() => {
    const open = new Set(terminals.map((item) => item.sessionId))
    for (const [id, mirror] of mirrors.current) {
      if (!open.has(id)) { mirror.dispose(); mirrors.current.delete(id) }
    }
    for (const { sessionId } of terminals) {
      if (mirrors.current.has(sessionId)) continue
      const terminal = new Terminal({ ...TERMINAL_OPTIONS, disableStdin: true, cursorBlink: false })
      const fitAddon = new FitAddon()
      terminal.loadAddon(fitAddon)
      // Output that arrives while the snapshot loads is written after it.
      let pending: string[] | null = []
      const stopData = onPtyData((payload) => {
        if (payload.sessionId !== sessionId) return
        if (pending) pending.push(payload.data)
        else terminal.write(payload.data)
      })
      const stopExit = onPtyExit((payload) => {
        if (payload.sessionId === sessionId) terminal.writeln('\r\n\x1b[1;33m[Process exited on the host]\x1b[0m')
      })
      void rpcRequest<{ data: string }>('pty.snapshot', { sessionId })
        .then(({ data }) => terminal.write(data))
        .catch(() => {})
        .finally(() => { for (const data of pending ?? []) terminal.write(data); pending = null })
      mirrors.current.set(sessionId, { terminal, fitAddon, dispose: () => { stopData(); stopExit(); terminal.dispose() } })
    }
    setActiveId((current) => current && open.has(current) ? current : terminals[0]?.sessionId ?? null)
  }, [terminals])

  useEffect(() => () => {
    for (const mirror of mirrors.current.values()) mirror.dispose()
    mirrors.current.clear()
  }, [])

  useEffect(() => {
    const container = containerRef.current
    const mirror = activeId ? mirrors.current.get(activeId) : undefined
    if (!container) return
    container.replaceChildren()
    if (!mirror) return
    if (mirror.terminal.element) container.appendChild(mirror.terminal.element)
    else mirror.terminal.open(container)
    mirror.fitAddon.fit()
    const resize = () => mirror.fitAddon.fit()
    window.addEventListener('resize', resize)
    return () => window.removeEventListener('resize', resize)
  }, [activeId, terminals])

  return (
    <TerminalFrame title="Terminal" readOnly status={terminals.length ? 'ready' : 'disconnected'} className="h-full border-0 font-ui text-base" bodyClassName="flex min-h-0 flex-1 flex-col p-0" data-testid="terminal-container" data-remote="true" header={
      <div className="flex items-center border-b border-border-subtle bg-surface-card" data-testid="terminal-tab-bar">
        <div className="flex-1 flex items-center overflow-x-auto scrollbar-none">
          {terminals.map((item, index) => (
            <Button variant="unstyled"
              key={item.sessionId}
              data-testid={`remote-terminal-tab-${item.sessionId}`}
              onClick={() => setActiveId(item.sessionId)}
              className={cn(
                'h-auto rounded-none border-0 flex items-center gap-2 px-3 py-1.5 text-xs border-r border-border-subtle whitespace-nowrap flex-shrink-0',
                activeId === item.sessionId ? 'bg-surface-terminal text-text-primary' : 'text-text-muted hover:text-text-primary hover:bg-surface-hover'
              )}
            >
              <TerminalIcon className="h-3 w-3" />
              <span>Terminal {index + 1}</span>
              <span className="text-muted-foreground/60 text-2xs">({item.pid})</span>
            </Button>
          ))}
        </div>
        <span className="flex items-center gap-1 px-3 text-2xs text-text-faint" title="The host's terminal, read-only">
          <Lock className="h-3 w-3" />{hostName ? `${hostName.toUpperCase()}'S SHELL` : 'HOST SHELL'}
        </span>
      </div>
      }>
      <div ref={containerRef} className="flex-1" data-testid="terminal-viewport" />
      {terminals.length === 0 && (
        <div className="flex-1 flex items-center justify-center text-xs text-text-faint">No terminal open on the host</div>
      )}
    </TerminalFrame>
  )
}
