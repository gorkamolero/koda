import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { Provider, createStore, useAtomValue } from 'jotai'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { AgentChat } from '@/components/AgentChat/AgentChat'
import { messagesAtom } from '@/store/chat'

const { rpcRequest, onNotification, showToast } = vi.hoisted(() => ({
  rpcRequest: vi.fn(), onNotification: vi.fn(), showToast: vi.fn(),
}))
vi.mock('@/lib/tauri', () => ({ rpcRequest, onNotification }))
vi.mock('@/hooks/useNotifications', () => ({ useNotifications: () => ({ showToast }) }))
vi.mock('@/components/AgentChat/MessageList', () => ({ MessageList: () => null }))
vi.mock('@/components/AgentChat/PlanModeIndicator', () => ({ PlanModeIndicator: () => null }))
vi.mock('@/components/AgentChat/InputArea', () => ({ InputArea: ({ onSendMessage }: { onSendMessage: (text: string) => void }) => <button onClick={() => onSendMessage('submitted task')}>Send task</button> }))

function deferred<T>() {
  let resolve!: (value: T) => void
  const promise = new Promise<T>(done => { resolve = done })
  return { promise, resolve }
}
function Inspector() {
  const messages = useAtomValue(messagesAtom)
  return <div data-testid="selected-transcript">{messages.map(message => message.content).join('|')}</div>
}
const transcript = (text: string) => [
  { id: text, index: 0, timestamp: 1000, event: { type: 'result', result: text } },
]
function setup() {
  const store = createStore()
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  const onSessionChange = vi.fn()
  const view = (worktreeId: string, sessionId?: string) => (
    <Provider store={store}><QueryClientProvider client={client}>
      <AgentChat key={worktreeId} worktreeId={worktreeId} sessionId={sessionId} onSessionChange={onSessionChange} />
      <Inspector />
    </QueryClientProvider></Provider>
  )
  return { view, onSessionChange }
}

beforeEach(() => {
  vi.clearAllMocks()
  localStorage.clear()
  onNotification.mockResolvedValue(() => {})
})

describe('chat navigation during requests', () => {
  it.each(['worktree-B', 'worktree-A'])('keeps the newly selected transcript when navigating to %s during an old request', async (nextWorktree) => {
    const oldSession = deferred<{ status: string; model: string }>()
    rpcRequest.mockImplementation(async (method: string, params?: { sessionId: string }) => {
      if (method === 'codex.models') return []
      if (method === 'codex.get') return params?.sessionId === 'A' ? oldSession.promise : { status: 'idle', model: 'default' }
      if (method === 'codex.getMessages') return transcript(`${params?.sessionId} reply`)
      return {}
    })
    const { view } = setup()
    const rendered = render(view('worktree-A', 'A'))
    await waitFor(() => expect(rpcRequest).toHaveBeenCalledWith('codex.get', { sessionId: 'A' }))
    rendered.rerender(view(nextWorktree, 'B'))
    await waitFor(() => expect(screen.getByTestId('selected-transcript')).toHaveTextContent('B reply'))
    await act(async () => { oldSession.resolve({ status: 'idle', model: 'default' }); await oldSession.promise })
    expect(screen.getByTestId('selected-transcript')).toHaveTextContent('B reply')
    expect(screen.getByTestId('selected-transcript')).not.toHaveTextContent('A reply')
  })

  it('finishes a submitted task without selecting its old workspace after delayed session creation', async () => {
    const created = deferred<{ id: string; sessionId: string }>()
    rpcRequest.mockImplementation(async (method: string, params?: { sessionId: string }) => {
      if (method === 'codex.models') return []
      if (method === 'codex.start') return created.promise
      if (method === 'codex.get') return { status: 'idle', model: 'default' }
      if (method === 'codex.getMessages') return transcript(`${params?.sessionId} reply`)
      return {}
    })
    const { view, onSessionChange } = setup()
    const rendered = render(view('worktree-A'))
    fireEvent.click(screen.getByRole('button', { name: 'Send task' }))
    await waitFor(() => expect(rpcRequest).toHaveBeenCalledWith('codex.start', { worktreeId: 'worktree-A', model: 'default' }))
    rendered.rerender(view('worktree-B', 'B'))
    await waitFor(() => expect(screen.getByTestId('selected-transcript')).toHaveTextContent('B reply'))
    await act(async () => { created.resolve({ id: 'A', sessionId: 'A' }); await created.promise })
    await waitFor(() => expect(rpcRequest).toHaveBeenCalledWith('codex.send', { sessionId: 'A', message: 'submitted task', stream: true, model: 'default' }))
    expect(onSessionChange).not.toHaveBeenCalled()
    expect(screen.getByTestId('selected-transcript')).toHaveTextContent('B reply')
  })
})
