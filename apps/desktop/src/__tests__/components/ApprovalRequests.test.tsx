import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { ApprovalRequests } from '@/components/AgentChat/ApprovalRequests'
import type { ApprovalRequest } from '@/lib/rpc'

const { rpcRequest, onNotification } = vi.hoisted(() => ({ rpcRequest: vi.fn(), onNotification: vi.fn() }))
vi.mock('@/lib/tauri', () => ({ rpcRequest, onNotification }))
const request = (sessionId = 'A'): ApprovalRequest => ({ id: `request-${sessionId}`, sessionId, agentType: 'codex', toolName: 'command_execution', input: { command: 'echo marker > /owned/marker', cwd: '/owned' }, reason: 'Write outside the worktree', createdAt: '2026-10-08T00:00:00Z', expiresAt: '2026-10-08T00:10:00Z' })
function deferred<T>() { let resolve!: (value: T) => void; let reject!: (error: Error) => void; const promise = new Promise<T>((yes, no) => { resolve = yes; reject = no }); return { promise, resolve, reject } }
function setup() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  const view = (sessionId = 'A') => <QueryClientProvider client={client}><ApprovalRequests sessionId={sessionId} /></QueryClientProvider>
  return { view }
}
beforeEach(() => { vi.clearAllMocks(); onNotification.mockResolvedValue(() => {}) })

describe('local approval requests', () => {
  it.each(['allow', 'deny'] as const)('shows the precise action and answers %s once', async decision => {
    let pending = [request()]
    const answer = deferred<object>()
    rpcRequest.mockImplementation((method: string) => method === 'approval.list' ? Promise.resolve(pending) : answer.promise)
    const { view } = setup()
    render(view())
    expect(await screen.findByTestId('approval-command')).toHaveTextContent('echo marker > /owned/marker')
    expect(screen.getByTestId('approval-path')).toHaveTextContent('/owned')
    fireEvent.click(screen.getByTestId(`approval-${decision}`))
    expect(rpcRequest).toHaveBeenCalledWith('approval.respond', { sessionId: 'A', approvalId: 'request-A', decision })
    expect(screen.getByTestId('approval-allow')).toBeDisabled()
    expect(screen.getByTestId('approval-deny')).toBeDisabled()
    fireEvent.click(screen.getByTestId(`approval-${decision}`))
    expect(rpcRequest.mock.calls.filter(([method]) => method === 'approval.respond')).toHaveLength(1)
    pending = []
    await act(async () => { answer.resolve({}); await answer.promise })
    await waitFor(() => expect(screen.queryByTestId('approval-card')).not.toBeInTheDocument())
  })

  it('hydrates pending requests after remount and removes them on cancellation notifications', async () => {
    let pending = [request()]
    const callbacks: Array<(value: { sessionId: string }) => void> = []
    onNotification.mockImplementation(async (_method, callback) => { callbacks.push(callback); return () => {} })
    rpcRequest.mockImplementation(async () => pending)
    const first = setup()
    const rendered = render(first.view())
    await screen.findByTestId('approval-card')
    rendered.unmount()
    const second = setup()
    render(second.view())
    await screen.findByTestId('approval-card')
    pending = []
    act(() => callbacks.forEach(callback => callback({ sessionId: 'A' })))
    await waitFor(() => expect(screen.queryByTestId('approval-card')).not.toBeInTheDocument())
  })

  it('does not show a delayed list belonging to the previous chat', async () => {
    const old = deferred<ApprovalRequest[]>()
    rpcRequest.mockImplementation((_method, params) => params.sessionId === 'A' ? old.promise : Promise.resolve([request('B')]))
    const { view } = setup()
    const rendered = render(view())
    expect(screen.getByText('Checking for approval requests…')).toBeInTheDocument()
    rendered.rerender(view('B'))
    await waitFor(() => expect(screen.getByTestId('approval-card')).toHaveAttribute('data-approval-id', 'request-B'))
    await act(async () => { old.resolve([request()]); await old.promise })
    expect(screen.getAllByTestId('approval-card')).toHaveLength(1)
    expect(screen.getByTestId('approval-card')).toHaveAttribute('data-approval-id', 'request-B')
  })

  it('does not apply an old response failure or loading state to the next chat', async () => {
    const old = deferred<object>()
    rpcRequest.mockImplementation((method, params) => method === 'approval.list' ? Promise.resolve([request(params.sessionId)]) : old.promise)
    const { view } = setup()
    const rendered = render(view())
    await screen.findByTestId('approval-card')
    fireEvent.click(screen.getByTestId('approval-allow'))
    rendered.rerender(view('B'))
    await waitFor(() => expect(screen.getByTestId('approval-card')).toHaveAttribute('data-approval-id', 'request-B'))
    await act(async () => { old.reject(new Error('Old request expired')); await old.promise.catch(() => {}) })
    expect(screen.queryByText('Old request expired')).not.toBeInTheDocument()
    expect(screen.getByTestId('approval-allow')).toBeEnabled()
  })

  it('shows load and response failures so permission waits cannot be silent', async () => {
    rpcRequest.mockRejectedValueOnce(new Error('Sidecar unavailable'))
    const { view } = setup()
    render(view())
    expect(await screen.findByRole('alert')).toHaveTextContent('Sidecar unavailable')
    rpcRequest.mockImplementation(async method => { if (method === 'approval.list') return [request()]; throw new Error('Request expired') })
    fireEvent.click(screen.getByRole('button', { name: 'Retry' }))
    await screen.findByTestId('approval-card')
    fireEvent.click(screen.getByTestId('approval-deny'))
    expect(await screen.findByRole('alert')).toHaveTextContent('Request expired')
  })

  it('shows network targets and nested file changes without opening raw details', async () => {
    rpcRequest.mockResolvedValue([{ ...request(), input: { networkApprovalContext: { host: 'example.test', protocol: 'https' }, item: { changes: [{ path: '/owned/file.txt', kind: { type: 'update' } }] } } }])
    const { view } = setup()
    render(view())
    expect(await screen.findByTestId('approval-network')).toHaveTextContent('https://example.test')
    expect(screen.getByTestId('approval-files')).toHaveTextContent('update: /owned/file.txt')
  })
})
