import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { Provider, createStore, useAtomValue } from 'jotai'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { AgentChat } from '@/components/AgentChat/AgentChat'
import { messagesAtom } from '@/store/chat'
import type { CodingAgent } from '@/lib/rpc'

const { rpcRequest, onNotification, showToast } = vi.hoisted(() => ({
  rpcRequest: vi.fn(), onNotification: vi.fn(), showToast: vi.fn(),
}))
vi.mock('@/lib/tauri', () => ({ rpcRequest, onNotification }))
vi.mock('@/hooks/useNotifications', () => ({ useNotifications: () => ({ showToast }) }))
vi.mock('@/components/AgentChat/MessageList', () => ({ MessageList: () => null }))
vi.mock('@/components/AgentChat/PlanModeIndicator', () => ({ PlanModeIndicator: () => null }))
vi.mock('@/components/AgentChat/InputArea', () => ({ InputArea: ({ onSendMessage, disabled }: { onSendMessage: (text: string) => void; disabled?: boolean }) => <button disabled={disabled} onClick={() => onSendMessage('submitted task')}>Send task</button> }))

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
  const view = (worktreeId: string, sessionId?: string, agentType?: CodingAgent) => (
    <Provider store={store}><QueryClientProvider client={client}>
      <AgentChat key={worktreeId} worktreeId={worktreeId} sessionId={sessionId} agentType={agentType} onSessionChange={onSessionChange} />
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

describe('agent and model routing', () => {
  function mockAgents() {
    rpcRequest.mockImplementation(async (method: string, params?: { sessionId: string }) => {
      const agent = method.split('.')[0]
      if (method.endsWith('.models')) return [{ id: 'default', model: 'default', displayName: 'SDK default' }, { id: `${agent}-model`, model: `${agent}-model`, displayName: `${agent} available model` }]
      if (method.endsWith('.start')) return { id: `${agent}-session`, sessionId: `${agent}-session` }
      if (method.endsWith('.get')) return { agentType: agent, status: 'idle', model: `${agent}-model` }
      if (method.endsWith('.getMessages')) return transcript(`${params?.sessionId} reply`)
      return {}
    })
  }

  it('defaults to Codex and keeps separate selected model preferences for each agent', async () => {
    mockAgents()
    const { view } = setup()
    render(view('A'))
    expect(screen.getByTestId('agent-select')).toHaveValue('codex')
    await screen.findByRole('option', { name: 'codex available model' })
    expect(rpcRequest).not.toHaveBeenCalledWith('claude.models')
    fireEvent.change(screen.getByTestId('codex-model-select'), { target: { value: 'codex-model' } })
    fireEvent.change(screen.getByTestId('agent-select'), { target: { value: 'claude' } })
    await screen.findByRole('option', { name: 'claude available model' })
    expect(screen.getByTestId('claude-model-select').querySelectorAll('option[value="default"]')).toHaveLength(1)
    expect(screen.getByTestId('claude-model-select')).toHaveValue('default')
    fireEvent.change(screen.getByTestId('claude-model-select'), { target: { value: 'claude-model' } })
    fireEvent.change(screen.getByTestId('agent-select'), { target: { value: 'codex' } })
    expect(screen.getByTestId('codex-model-select')).toHaveValue('codex-model')
    expect(localStorage.getItem('settings:claudeModel')).toBe('claude-model')
    expect(localStorage.getItem('settings:codexModel')).toBe('codex-model')
  })

  it('creates and sends through the chosen Claude engine with its selected model', async () => {
    mockAgents()
    const { view, onSessionChange } = setup()
    render(view('A'))
    fireEvent.change(screen.getByTestId('agent-select'), { target: { value: 'claude' } })
    await screen.findByRole('option', { name: 'claude available model' })
    fireEvent.change(screen.getByTestId('claude-model-select'), { target: { value: 'claude-model' } })
    fireEvent.click(screen.getByRole('button', { name: 'Send task' }))
    await waitFor(() => expect(rpcRequest).toHaveBeenCalledWith('claude.send', { sessionId: 'claude-session', message: 'submitted task', stream: true, model: 'claude-model' }))
    expect(rpcRequest).toHaveBeenCalledWith('claude.start', { worktreeId: 'A', model: 'claude-model' })
    expect(onSessionChange).toHaveBeenCalledWith('claude-session', 'claude')
    expect(rpcRequest.mock.calls.some(([method]) => method === 'codex.start' || method === 'codex.send')).toBe(false)
  })

  it('starts an idle selected-engine chat without submitting a prompt', async () => {
    mockAgents()
    const { view, onSessionChange } = setup()
    render(view('A'))
    fireEvent.change(screen.getByTestId('agent-select'), { target: { value: 'claude' } })
    fireEvent.click(screen.getByTestId('start-chat-button'))
    await waitFor(() => expect(onSessionChange).toHaveBeenCalledWith('claude-session', 'claude'))
    expect(rpcRequest.mock.calls.some(([method]) => method.endsWith('.send'))).toBe(false)
  })

  it('restores the saved Claude model before enabling send and locks the engine', async () => {
    mockAgents()
    const loaded = deferred<{ agentType: string; status: string; model: string }>()
    const normalRpc = rpcRequest.getMockImplementation()!
    rpcRequest.mockImplementation((method, params) => method === 'claude.get' ? loaded.promise : normalRpc(method, params))
    const { view } = setup()
    render(view('A', 'saved', 'claude'))
    expect(screen.getByTestId('agent-select')).toBeDisabled()
    expect(screen.getByTestId('agent-select')).toHaveValue('claude')
    expect(screen.getByRole('button', { name: 'Send task' })).toBeDisabled()
    await act(async () => { loaded.resolve({ agentType: 'claude', status: 'idle', model: 'claude-model' }); await loaded.promise })
    await waitFor(() => expect(screen.getByRole('button', { name: 'Send task' })).toBeEnabled())
    expect(screen.getByTestId('claude-model-select')).toHaveValue('claude-model')
    fireEvent.click(screen.getByRole('button', { name: 'Send task' }))
    await waitFor(() => expect(rpcRequest).toHaveBeenCalledWith('claude.send', { sessionId: 'saved', message: 'submitted task', stream: true, model: 'claude-model' }))
    expect(rpcRequest).not.toHaveBeenCalledWith('codex.get', { sessionId: 'saved' })
  })

  it('does not let a delayed Codex transcript replace the newly selected Claude conversation', async () => {
    mockAgents()
    const pending = deferred<{ agentType: string; status: string; model: string }>()
    const normalRpc = rpcRequest.getMockImplementation()!
    rpcRequest.mockImplementation((method, params) => method === 'codex.get' ? pending.promise : normalRpc(method, params))
    const { view } = setup()
    const rendered = render(view('A', 'codex-session', 'codex'))
    rendered.rerender(view('A', 'claude-session', 'claude'))
    await waitFor(() => expect(screen.getByTestId('selected-transcript')).toHaveTextContent('claude-session reply'))
    await act(async () => { pending.resolve({ agentType: 'codex', status: 'idle', model: 'codex-model' }); await pending.promise })
    expect(screen.getByTestId('selected-transcript')).not.toHaveTextContent('codex-session reply')
    expect(screen.getByTestId('claude-model-select')).toHaveValue('claude-model')
  })

  it('shows model discovery or authentication errors without inventing Claude choices', async () => {
    mockAgents()
    const normalRpc = rpcRequest.getMockImplementation()!
    rpcRequest.mockImplementation((method, params) => method === 'claude.models' ? Promise.reject(new Error('Claude login required')) : normalRpc(method, params))
    const { view } = setup()
    render(view('A'))
    fireEvent.change(screen.getByTestId('agent-select'), { target: { value: 'claude' } })
    await waitFor(() => expect(screen.getByTestId('agent-model-error')).toHaveTextContent('Claude login required'))
    expect(screen.queryByRole('option', { name: 'claude available model' })).not.toBeInTheDocument()
    expect(screen.queryByRole('option', { name: 'codex available model' })).not.toBeInTheDocument()
  })
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
