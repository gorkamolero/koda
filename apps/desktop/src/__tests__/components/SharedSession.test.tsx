import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { Provider, createStore } from 'jotai'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { AgentChat } from '@/components/AgentChat/AgentChat'
import { MessageItem } from '@/components/AgentChat/MessageItem'
import { SharedWorkspacesSection } from '@/components/WorkspaceSharing'
import type { ChatMessage } from '@/store/chat'
import type { RemoteWorktree } from '@/lib/rpc'

const { rpcRequest, onNotification, navigate } = vi.hoisted(() => ({ rpcRequest: vi.fn(), onNotification: vi.fn(), navigate: vi.fn() }))
vi.mock('@/lib/tauri', () => ({ rpcRequest, onNotification }))
vi.mock('@/hooks/useNotifications', () => ({ useNotifications: () => ({ showToast: vi.fn() }) }))
vi.mock('@/components/AgentChat/MessageList', () => ({ MessageList: () => null }))
vi.mock('@/components/AgentChat/PlanModeIndicator', () => ({ PlanModeIndicator: () => null }))
vi.mock('@/components/AgentChat/InputArea', () => ({
  InputArea: ({ onSendMessage, disabled, placeholder }: { onSendMessage: (text: string) => void; disabled?: boolean; placeholder?: string }) =>
    <button disabled={disabled} title={placeholder} onClick={() => onSendMessage('remote task')}>Send task</button>,
}))
vi.mock('@tanstack/react-router', () => ({
  Link: ({ params, children, ...props }: { params: { workspaceId: string; worktreeId: string }; children: React.ReactNode }) =>
    <a href={`/workspace/${params.workspaceId}/${params.worktreeId}`} {...props}>{children}</a>,
  useParams: () => ({}),
  useNavigate: () => navigate,
}))

function wrap(node: React.ReactNode) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return <Provider store={createStore()}><QueryClientProvider client={client}>{node}</QueryClientProvider></Provider>
}
const remote = (permission: 'view' | 'control'): RemoteWorktree => ({ roomId: 'workspace:w1', permission, hostName: 'Gorka', hostMachineId: 'machine-a' })

beforeEach(() => {
  vi.clearAllMocks()
  localStorage.clear()
  onNotification.mockResolvedValue(() => {})
  rpcRequest.mockImplementation(async (method: string) => {
    if (method === 'claude.models') return [{ id: 'default', model: 'default', displayName: 'Claude default' }]
    if (method === 'claude.get') return { agentType: 'claude', status: 'idle', model: 'default' }
    if (method === 'claude.getMessages') return []
    if (method === 'collaboration.status') return { enabled: true, machineId: 'machine-a', name: 'Gorka' }
    if (method === 'approval.list') return []
    return {}
  })
})

describe("a collaborator's view of the host's session", () => {
  it('watches with view permission: the composer explains why it is disabled and host-only actions are hidden', async () => {
    render(wrap(<AgentChat worktreeId="w1" sessionId="s1" agentType="claude" remote={remote('view')} collaborative />))
    await waitFor(() => expect(rpcRequest).toHaveBeenCalledWith('claude.getMessages', { sessionId: 's1' }))
    expect(screen.getByRole('button', { name: 'Send task' })).toBeDisabled()
    expect(screen.getByRole('button', { name: 'Send task' })).toHaveAttribute('title', expect.stringContaining('view only'))
    expect(screen.queryByTestId('save-checkpoint')).not.toBeInTheDocument()
    expect(screen.getByTestId('shared-session-host')).toHaveTextContent('running on Gorka')
    // Approvals and permission modes stay with the host.
    expect(screen.queryByTestId('permission-mode-select')).not.toBeInTheDocument()
    expect(rpcRequest).not.toHaveBeenCalledWith('approval.list', expect.anything())
    // The host runs the agent, so its catalog is the one shown.
    expect(rpcRequest).toHaveBeenCalledWith('claude.models', { worktreeId: 'w1' })
  })

  it("messages the host's agent with control permission", async () => {
    render(wrap(<AgentChat worktreeId="w1" sessionId="s1" agentType="claude" remote={remote('control')} collaborative />))
    const send = screen.getByRole('button', { name: 'Send task' })
    await waitFor(() => expect(send).toBeEnabled())
    expect(send).toHaveAttribute('title', "message Gorka's Claude session...")
    fireEvent.click(send)
    await waitFor(() => expect(rpcRequest).toHaveBeenCalledWith('claude.send', expect.objectContaining({ sessionId: 's1', message: 'remote task' })))
    // The relay signs the collaborator's own name; the UI never claims one.
    const [, params] = rpcRequest.mock.calls.find(([method]) => method === 'claude.send')!
    expect(params).not.toHaveProperty('authorName')
  })

  it('labels the host\'s own messages in a shared workspace', async () => {
    render(wrap(<AgentChat worktreeId="w1" sessionId="s1" agentType="claude" collaborative />))
    await waitFor(() => expect(rpcRequest).toHaveBeenCalledWith('collaboration.status'))
    const send = screen.getByRole('button', { name: 'Send task' })
    await waitFor(() => expect(send).toBeEnabled())
    fireEvent.click(send)
    await waitFor(() => expect(rpcRequest).toHaveBeenCalledWith('claude.send', expect.objectContaining({ authorName: 'Gorka', authorMachineId: 'machine-a' })))
  })
})

describe('tool cards', () => {
  const message = (finished: boolean): ChatMessage => ({
    id: 'assistant-1', role: 'assistant', content: '', timestamp: 1, status: finished ? 'complete' : 'streaming',
    contentBlocks: [
      { type: 'tool_use', id: 'tool-1', name: 'Read', input: { file_path: 'index.html' }, status: finished ? 'success' : 'running' },
      ...(finished ? [{ type: 'tool_result' as const, toolUseId: 'tool-1', toolName: 'Read', output: '<h1>Koda</h1>' }] : []),
    ],
  })
  const state = (container: HTMLElement) => container.querySelector('.group[data-state]')?.getAttribute('data-state')

  it('stay open while the tool runs and collapse once it finishes, so every viewer sees the same transcript', () => {
    const { container, rerender } = render(<MessageItem message={message(false)} turnIndex={0} />)
    expect(state(container)).toBe('open')
    rerender(<MessageItem message={message(true)} turnIndex={0} />)
    expect(state(container)).toBe('closed')
  })

  it('stay open when the reader opened one by hand', () => {
    const { container, rerender } = render(<MessageItem message={message(true)} turnIndex={0} />)
    expect(state(container)).toBe('closed')
    fireEvent.click(container.querySelector('.group[data-state] button')!)
    expect(state(container)).toBe('open')
    rerender(<MessageItem message={{ ...message(true), content: 'more text' }} turnIndex={0} />)
    expect(state(container)).toBe('open')
  })
})

describe('shared workspaces in the sidebar', () => {
  it('lists workspaces shared with this machine and opens one as a normal workspace', async () => {
    rpcRequest.mockImplementation(async (method: string) => method === 'collaboration.list'
      ? [{ roomId: 'workspace:w1', worktreeId: 'w1', hostMachineId: 'machine-a', permission: 'control', invitation: 'secret', workspaceName: 'koda-landing / gorka/landing-faq', hostName: 'Gorka' }]
      : {})
    render(wrap(<SharedWorkspacesSection />))
    const link = await screen.findByTestId('shared-workspace-link')
    expect(link).toHaveTextContent('[CTRL]')
    expect(link).toHaveTextContent('koda-landing / gorka/landing-faq')
    expect(link).toHaveAttribute('href', '/workspace/shared/w1')
    expect(link).not.toHaveTextContent('secret')
  })

  it('joins from an invitation and opens the shared workspace', async () => {
    rpcRequest.mockImplementation(async (method: string) => {
      if (method === 'collaboration.list') return []
      if (method === 'collaboration.join') return { roomId: 'workspace:w2', worktreeId: 'w2', permission: 'view' }
      return {}
    })
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
    const invalidate = vi.spyOn(client, 'invalidateQueries')
    render(<Provider store={createStore()}><QueryClientProvider client={client}><SharedWorkspacesSection /></QueryClientProvider></Provider>)
    fireEvent.click(screen.getByTestId('join-workspace'))
    fireEvent.change(screen.getByTestId('join-invitation'), { target: { value: 'invitation-token' } })
    fireEvent.click(screen.getByTestId('join-confirm'))
    await waitFor(() => expect(navigate).toHaveBeenCalledWith({ to: '/workspace/$workspaceId/$worktreeId', params: { workspaceId: 'shared', worktreeId: 'w2' } }))
    expect(rpcRequest).toHaveBeenCalledWith('collaboration.join', { invitation: 'invitation-token' })
    // A replacement invitation can change the permission of the workspace on screen.
    expect(invalidate).toHaveBeenCalledWith()
  })
})

describe('themes', () => {
  it('apply the saved theme at startup', async () => {
    localStorage.setItem('minnetonka-active-theme', JSON.stringify('koda-graphite'))
    vi.resetModules()
    const { initializeThemeAtom } = await import('@/store/theme')
    createStore().set(initializeThemeAtom)
    expect(document.documentElement.style.getPropertyValue('--surface-messages')).toBe('#212328')
  })
})
