import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { QuestionRequests } from '@/components/AgentChat/QuestionRequests'
import type { AgentQuestion, QuestionRequest } from '@/lib/rpc'

const { rpcRequest, onNotification } = vi.hoisted(() => ({ rpcRequest: vi.fn<[method: string, params?: { sessionId?: string; workingDirectory?: string; data?: string; [key: string]: unknown }], Promise<unknown>>(), onNotification: vi.fn<[method: string, callback: (payload: { sessionId: string }) => void], Promise<() => void>>() }))
vi.mock('@/lib/tauri', () => ({ rpcRequest, onNotification }))
const question = (changes: Partial<AgentQuestion> = {}): AgentQuestion => ({ id: 'approach', header: 'Approach', question: 'Which approach should I use?', options: [{ label: 'Fast', description: 'Make a small change' }, { label: 'Thorough', description: 'Include the wider refactor' }], multiSelect: false, allowOther: false, ...changes })
const request = (sessionId = 'A', questions = [question()]): QuestionRequest => ({ id: `request-${sessionId}`, sessionId, agentType: 'codex', questions, createdAt: '2026-10-08T00:00:00Z', expiresAt: '2026-10-08T00:10:00Z' })
function deferred<T>() { let resolve!: (value: T) => void; let reject!: (error: Error) => void; const promise = new Promise<T>((yes, no) => { resolve = yes; reject = no }); return { promise, resolve, reject } }
function setup() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  const view = (sessionId = 'A') => <QueryClientProvider client={client}><QuestionRequests sessionId={sessionId} /></QueryClientProvider>
  return { view }
}
beforeEach(() => { vi.clearAllMocks(); localStorage.clear(); onNotification.mockResolvedValue(() => {}) })

describe('local agent question forms', () => {
  it.each(['constructor', 'toString', '__proto__'])('treats provider question ID %s as data instead of an inherited object property', async id => {
    let pending = [request('A', [question({ id })])]
    rpcRequest.mockImplementation(async method => { if (method === 'question.list') return pending; pending = []; return {} })
    const { view } = setup()
    render(view())
    await screen.findByTestId('question-card')
    expect(screen.getByTestId('question-submit')).toBeDisabled()
    fireEvent.click(screen.getByRole('radio', { name: /Fast/ }))
    fireEvent.click(screen.getByTestId('question-submit'))
    const payload = rpcRequest.mock.calls.find(([method]) => method === 'question.respond')![1] as { answers: Record<string, unknown> }
    expect(Object.prototype.hasOwnProperty.call(payload.answers, id)).toBe(true)
    expect(payload.answers[id]).toEqual({ selected: ['Fast'] })
    expect((JSON.parse(JSON.stringify(payload)) as typeof payload).answers[id]).toEqual({ selected: ['Fast'] })
    await waitFor(() => expect(screen.queryByTestId('question-card')).not.toBeInTheDocument())
  })

  it('requires every answer, supports keyboard choice and multi-select, and submits one complete payload', async () => {
    let pending = [request('A', [question(), question({ id: 'checks', header: 'Checks', question: 'Which checks?', multiSelect: true }), question({ id: 'note', header: 'Note', question: 'What should I call it?', options: [], allowOther: true })])]
    rpcRequest.mockImplementation(async method => { if (method === 'question.list') return pending; pending = []; return {} })
    const { view } = setup()
    render(view())
    await screen.findByTestId('question-card')
    expect(screen.getByTestId('question-submit')).toBeDisabled()
    expect(screen.getAllByRole('radio').every(input => !(input as HTMLInputElement).checked)).toBe(true)
    expect(screen.getAllByRole('checkbox').every(input => !(input as HTMLInputElement).checked)).toBe(true)
    expect(screen.getAllByText('Make a small change')).toHaveLength(2)
    const single = within(screen.getByRole('group', { name: 'Approach' }))
    const fast = single.getByRole('radio', { name: /Fast/ })
    fast.focus()
    await userEvent.keyboard(' ')
    expect(fast).toBeChecked()
    const multi = within(screen.getByRole('group', { name: 'Checks' }))
    fireEvent.click(multi.getByRole('checkbox', { name: /Fast/ }))
    fireEvent.click(multi.getByRole('checkbox', { name: /Thorough/ }))
    expect(screen.getByTestId('question-submit')).toBeDisabled()
    fireEvent.change(screen.getByRole('textbox', { name: 'What should I call it?' }), { target: { value: 'My change' } })
    fireEvent.click(screen.getByTestId('question-submit'))
    expect(rpcRequest).toHaveBeenCalledWith('question.respond', { sessionId: 'A', requestId: 'request-A', decision: 'submit', answers: { approach: { selected: ['Fast'] }, checks: { selected: ['Fast', 'Thorough'] }, note: { selected: [], text: 'My change' } } })
    await waitFor(() => expect(screen.queryByTestId('question-card')).not.toBeInTheDocument())
  })

  it('uses a written answer instead of a single choice, but allows written additions to multi-select', async () => {
    rpcRequest.mockImplementation(async method => method === 'question.list' ? [request('A', [question({ allowOther: true }), question({ id: 'checks', header: 'Checks', multiSelect: true, allowOther: true })])] : {})
    const { view } = setup()
    render(view())
    await screen.findByTestId('question-card')
    const single = within(screen.getByRole('group', { name: 'Approach' }))
    fireEvent.click(single.getByRole('radio', { name: /Fast/ }))
    fireEvent.click(single.getByRole('radio', { name: 'Other' }))
    expect(single.getByRole('radio', { name: /Fast/ })).not.toBeChecked()
    fireEvent.change(screen.getByRole('textbox', { name: 'Other answer for Approach' }), { target: { value: 'Alternative' } })
    const multi = within(screen.getByRole('group', { name: 'Checks' }))
    fireEvent.click(multi.getByRole('checkbox', { name: /Fast/ }))
    fireEvent.click(multi.getByRole('checkbox', { name: 'Other' }))
    expect(screen.getByTestId('question-submit')).toBeDisabled()
    fireEvent.change(screen.getByRole('textbox', { name: 'Other answer for Checks' }), { target: { value: 'Extra check' } })
    fireEvent.click(screen.getByTestId('question-submit'))
    expect(rpcRequest).toHaveBeenCalledWith('question.respond', { sessionId: 'A', requestId: 'request-A', decision: 'submit', answers: { approach: { selected: [], text: 'Alternative' }, checks: { selected: ['Fast'], text: 'Extra check' } } })
  })

  it('masks secret text and hydrates a pending request after remount without retaining draft answers', async () => {
    rpcRequest.mockResolvedValue([request('A', [question({ options: [], allowOther: true, isSecret: true })])])
    const first = setup()
    const rendered = render(first.view())
    await screen.findByTestId('question-card')
    const secret = screen.getByLabelText('Which approach should I use?')
    expect(secret).toHaveAttribute('type', 'password')
    expect(secret).toHaveAttribute('autocomplete', 'off')
    fireEvent.change(secret, { target: { value: '   ' } })
    expect(screen.getByTestId('question-submit')).toBeDisabled()
    fireEvent.change(secret, { target: { value: 'private draft' } })
    expect(screen.getByTestId('question-submit')).toBeEnabled()
    expect(localStorage.length).toBe(0)
    expect(rpcRequest.mock.calls.every(([method]) => method === 'question.list')).toBe(true)
    rendered.unmount()
    render(setup().view())
    await screen.findByTestId('question-card')
    expect(screen.getByLabelText('Which approach should I use?')).toHaveValue('')
    expect(screen.getByTestId('question-submit')).toBeDisabled()
  })

  it('prevents double submission, shows an error and preserves the answer for retry', async () => {
    const failed = deferred<object>()
    rpcRequest.mockImplementation(method => method === 'question.list' ? Promise.resolve([request()]) : failed.promise)
    const { view } = setup()
    render(view())
    await screen.findByTestId('question-card')
    fireEvent.click(screen.getByRole('radio', { name: /Fast/ }))
    fireEvent.submit(screen.getByTestId('question-card'))
    fireEvent.submit(screen.getByTestId('question-card'))
    expect(rpcRequest.mock.calls.filter(([method]) => method === 'question.respond')).toHaveLength(1)
    expect(screen.getByTestId('question-cancel')).toBeDisabled()
    expect(screen.getByRole('radio', { name: /Fast/ })).toBeDisabled()
    await act(async () => { failed.reject(new Error('Connection interrupted')); await failed.promise.catch(() => {}) })
    expect(await screen.findByRole('alert')).toHaveTextContent('Connection interrupted')
    expect(screen.getByRole('radio', { name: /Fast/ })).toBeChecked()
    expect(screen.getByTestId('question-submit')).toBeEnabled()
    rpcRequest.mockResolvedValue([])
    fireEvent.click(screen.getByTestId('question-submit'))
    expect(rpcRequest.mock.calls.filter(([method]) => method === 'question.respond')).toHaveLength(2)
    await waitFor(() => expect(screen.queryByTestId('question-card')).not.toBeInTheDocument())
  })

  it('cancels without submitting incomplete or secret draft answers', async () => {
    let pending = [request('A', [question({ options: [], allowOther: true, isSecret: true })])]
    rpcRequest.mockImplementation(async method => { if (method === 'question.list') return pending; pending = []; return {} })
    const { view } = setup()
    render(view())
    await screen.findByTestId('question-card')
    fireEvent.change(screen.getByLabelText('Which approach should I use?'), { target: { value: 'unsent' } })
    fireEvent.click(screen.getByRole('button', { name: 'Cancel and stop' }))
    expect(rpcRequest).toHaveBeenCalledWith('question.respond', { sessionId: 'A', requestId: 'request-A', decision: 'cancel' })
    await waitFor(() => expect(screen.queryByTestId('question-card')).not.toBeInTheDocument())
  })

  it('retries loading and removes resolved requests on a matching notification', async () => {
    const callbacks: Array<(value: { sessionId: string }) => void> = []
    onNotification.mockImplementation(async (method, callback) => { expect(method).toBe('questionChanged'); callbacks.push(callback); return () => {} })
    rpcRequest.mockRejectedValueOnce(new Error('Sidecar unavailable'))
    const { view } = setup()
    render(view())
    expect(await screen.findByRole('alert')).toHaveTextContent('Sidecar unavailable')
    let pending = [request()]
    rpcRequest.mockImplementation(async () => pending)
    fireEvent.click(screen.getByRole('button', { name: 'Retry' }))
    await screen.findByTestId('question-card')
    const callCount = rpcRequest.mock.calls.length
    act(() => callbacks.forEach(callback => callback({ sessionId: 'B' })))
    expect(rpcRequest.mock.calls).toHaveLength(callCount)
    pending = []
    act(() => callbacks.forEach(callback => callback({ sessionId: 'A' })))
    await waitFor(() => expect(screen.queryByTestId('question-card')).not.toBeInTheDocument())
  })

  it('ignores a delayed list from an old chat and discards draft choices on navigation', async () => {
    const old = deferred<QuestionRequest[]>()
    rpcRequest.mockImplementation((_method, params) => params?.sessionId === 'A' ? old.promise : Promise.resolve([request('B')]))
    const { view } = setup()
    const rendered = render(view())
    expect(screen.getByText('Checking for questions…')).toBeInTheDocument()
    rendered.rerender(view('B'))
    await screen.findByTestId('question-card')
    fireEvent.click(screen.getByRole('radio', { name: /Fast/ }))
    await act(async () => { old.resolve([request()]); await old.promise })
    expect(screen.getByTestId('question-card')).toHaveAttribute('data-request-id', 'request-B')
    rendered.rerender(view('A'))
    await waitFor(() => expect(screen.getByTestId('question-card')).toHaveAttribute('data-request-id', 'request-A'))
    expect(screen.getByTestId('question-submit')).toBeDisabled()
  })

  it.each(['resolve', 'reject'] as const)('does not apply an old response %s to the next chat', async outcome => {
    const old = deferred<object>()
    rpcRequest.mockImplementation((method, params) => method === 'question.list' ? Promise.resolve([request(params?.sessionId)]) : old.promise)
    const { view } = setup()
    const rendered = render(view())
    await screen.findByTestId('question-card')
    fireEvent.click(screen.getByTestId('question-cancel'))
    rendered.rerender(view('B'))
    await waitFor(() => expect(screen.getByTestId('question-card')).toHaveAttribute('data-request-id', 'request-B'))
    await act(async () => { if (outcome === 'resolve') old.resolve({}); else old.reject(new Error('Old question expired')); await old.promise.catch(() => {}) })
    expect(screen.queryByText('Old question expired')).not.toBeInTheDocument()
    expect(screen.getByTestId('question-cancel')).toBeEnabled()
    expect(screen.getByTestId('question-submit')).toBeDisabled()
    expect(screen.getByTestId('question-card')).toHaveAttribute('data-request-id', 'request-B')
  })
})
