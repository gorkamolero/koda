import { StrictMode } from 'react'
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { TerminalPanel } from '@/components/Terminal/TerminalPanel'

const { rpcRequest, onPtyData, onPtyExit, terminals } = vi.hoisted(() => ({
  rpcRequest: vi.fn(), onPtyData: vi.fn(), onPtyExit: vi.fn(),
  terminals: [] as { dispose: () => void; open: (parent: HTMLElement) => void; inputDispose: () => void }[],
}))
vi.mock('@/lib/tauri', () => ({ rpcRequest }))
vi.mock('@/lib/sidecarRpc', () => ({ onPtyData, onPtyExit }))
vi.mock('xterm-addon-fit', () => ({ FitAddon: class { fit = vi.fn() } }))
vi.mock('xterm', () => ({ Terminal: class {
  cols = 80
  rows = 24
  element?: HTMLDivElement
  dispose = vi.fn()
  inputDispose = vi.fn()
  loadAddon = vi.fn()
  clear = vi.fn()
  focus = vi.fn()
  write = vi.fn()
  writeln = vi.fn()
  onData = vi.fn(() => ({ dispose: this.inputDispose }))
  open = vi.fn((parent: HTMLElement) => {
    this.element = document.createElement('div')
    parent.appendChild(this.element)
  })
  constructor() { terminals.push(this) }
} }))

function deferred<T>() {
  let resolve!: (value: T) => void
  const promise = new Promise<T>(done => { resolve = done })
  return { promise, resolve }
}
const session = (id: string) => ({ sessionId: id, pid: 123, cols: 80, rows: 24 })
const terminalTabs = () => screen.queryAllByTestId(/^terminal-tab-term-/)
const createCalls = () => rpcRequest.mock.calls.filter(([method]) => method === 'pty.create')

beforeEach(() => {
  vi.clearAllMocks()
  terminals.length = 0
  onPtyData.mockImplementation(() => vi.fn())
  onPtyExit.mockImplementation(() => vi.fn())
  let nextSession = 0
  rpcRequest.mockImplementation(async (method: string) => method === 'pty.create' ? session(`shell-${++nextSession}`) : { success: true })
})

describe('terminal lifecycle ownership', () => {
  it('starts one shell in StrictMode and closes every resource on unmount', async () => {
    const rendered = render(<StrictMode><TerminalPanel workspaceId="A" workingDirectory="/repo/A" /></StrictMode>)
    await waitFor(() => expect(screen.getByTestId('terminal-pid')).toHaveTextContent('123'))
    expect(terminalTabs()).toHaveLength(1)
    expect(createCalls()).toHaveLength(1)
    expect(terminals).toHaveLength(1)
    expect(terminals[0]?.open).toHaveBeenCalledTimes(1)
    rendered.unmount()
    expect(rpcRequest).toHaveBeenCalledWith('pty.close', { sessionId: 'shell-1' })
    expect(terminals[0]?.dispose).toHaveBeenCalledTimes(1)
    expect(terminals[0]?.inputDispose).toHaveBeenCalledTimes(1)
    expect(onPtyData.mock.results[0]?.value).toHaveBeenCalledTimes(1)
    expect(onPtyExit.mock.results[0]?.value).toHaveBeenCalledTimes(1)
  })

  it.each(['close', 'unmount'])('closes a delayed shell after its pending tab is removed by %s', async removal => {
    const pending = deferred<ReturnType<typeof session>>()
    rpcRequest.mockImplementation(async (method: string) => method === 'pty.create' ? pending.promise : { success: true })
    const rendered = render(<TerminalPanel workspaceId="A" />)
    await waitFor(() => expect(createCalls()).toHaveLength(1))
    if (removal === 'close') fireEvent.click(screen.getByTestId(/^terminal-close-/))
    else rendered.unmount()
    await act(async () => { pending.resolve(session('late-shell')); await pending.promise })
    expect(rpcRequest).toHaveBeenCalledWith('pty.close', { sessionId: 'late-shell' })
    expect(terminalTabs()).toHaveLength(0)
    expect(terminals[0]?.dispose).toHaveBeenCalledTimes(1)
    expect(onPtyData).not.toHaveBeenCalled()
    expect(onPtyExit).not.toHaveBeenCalled()
  })

  it('replaces the shell when the worktree changes and rejects the previous pending result', async () => {
    const pending = deferred<ReturnType<typeof session>>()
    rpcRequest.mockImplementation(async (method: string, params?: { workingDirectory: string }) => {
      if (method === 'pty.create') return params?.workingDirectory === '/repo/A' ? pending.promise : session('B-shell')
      return { success: true }
    })
    const rendered = render(<TerminalPanel workspaceId="A" workingDirectory="/repo/A" />)
    await waitFor(() => expect(createCalls()).toHaveLength(1))
    rendered.rerender(<TerminalPanel workspaceId="B" workingDirectory="/repo/B" />)
    await waitFor(() => expect(screen.getByTestId('terminal-pid')).toHaveTextContent('123'))
    await act(async () => { pending.resolve(session('A-shell')); await pending.promise })
    expect(terminalTabs()).toHaveLength(1)
    expect(rpcRequest).toHaveBeenCalledWith('pty.close', { sessionId: 'A-shell' })
    expect(rpcRequest).not.toHaveBeenCalledWith('pty.close', { sessionId: 'B-shell' })
    rendered.unmount()
    expect(rpcRequest).toHaveBeenCalledWith('pty.close', { sessionId: 'B-shell' })
    for (const terminal of terminals) expect(terminal.dispose).toHaveBeenCalledTimes(1)
  })

  it('keeps distinct tabs when several shells start before earlier requests complete', async () => {
    const pending = deferred<ReturnType<typeof session>>()
    rpcRequest.mockImplementation(async (method: string) => method === 'pty.create' ? pending.promise : { success: true })
    render(<TerminalPanel workspaceId="A" />)
    await waitFor(() => expect(terminalTabs()).toHaveLength(1))
    fireEvent.click(screen.getByTestId('terminal-new-tab'))
    fireEvent.click(screen.getByTestId('terminal-new-tab'))
    expect(terminalTabs()).toHaveLength(3)
    for (const number of [1, 2, 3]) expect(screen.getByText(`Terminal ${number}`)).toBeInTheDocument()
    expect(new Set(terminalTabs().map(tab => tab.dataset.testid)).size).toBe(3)
  })
})
