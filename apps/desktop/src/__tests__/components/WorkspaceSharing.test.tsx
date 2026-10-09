import { useState } from 'react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { render, fireEvent, screen, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { Provider, createStore } from 'jotai'
import { ShareWorkspaceButton } from '@/components/WorkspaceSharing'

const { rpcRequest } = vi.hoisted(() => ({ rpcRequest: vi.fn<[method: string], Promise<unknown>>() }))
vi.mock('@/lib/tauri', () => ({ rpcRequest }))
vi.mock('@tanstack/react-router', () => ({ Link: ({ to, children, onClick }: { to: string; children: React.ReactNode; onClick: () => void }) => <a href={to} onClick={onClick}>{children}</a> }))
beforeEach(() => { rpcRequest.mockImplementation(method => Promise.resolve(method === 'collaboration.status' ? { enabled: true, reachable: true, mode: 'development-key' } : { invitation: 'test-invitation' })) })

describe('workspace invitation dialog', () => {
  it('keeps the returned invitation visible when enabling collaboration remounts the workspace subtree', async () => {
    const queryClient = new QueryClient()
    let enableCollaboration: () => void = () => {}
    vi.spyOn(queryClient, 'invalidateQueries').mockImplementation(async () => { enableCollaboration() })
    function Workspace() {
      const [collaborative, setCollaborative] = useState(false)
      enableCollaboration = () => setCollaborative(true)
      const button = <ShareWorkspaceButton worktreeId="workspace-for-remount-test" />
      // Mirrors CollaborativeWorkspaceProvider switching from Fragment to RoomProvider.
      return collaborative ? <section data-testid="collaborative-wrapper">{button}</section> : button
    }
    render(<QueryClientProvider client={queryClient}><Provider store={createStore()}><Workspace /></Provider></QueryClientProvider>)
    fireEvent.click(screen.getByTestId('share-workspace'))
    await waitFor(() => expect(screen.getByTestId('create-invitation')).toBeEnabled())
    fireEvent.click(screen.getByTestId('create-invitation'))
    expect(await screen.findByTestId('collaborative-wrapper')).toBeVisible()
    expect(screen.getByTestId('share-invitation')).toHaveValue('test-invitation')
    expect(screen.getByRole('dialog', { name: 'Share workspace' })).toBeVisible()
  })
  it.each([false, true])('shows Settings setup when collaboration enabled=%s is unavailable', async enabled => {
    rpcRequest.mockResolvedValue({ enabled, reachable: false, mode: enabled ? 'service' : 'not-configured' })
    render(<QueryClientProvider client={new QueryClient()}><Provider store={createStore()}><ShareWorkspaceButton worktreeId={`setup-${String(enabled)}`} /></Provider></QueryClientProvider>)
    fireEvent.click(screen.getByTestId('share-workspace'))
    const link = await screen.findByRole('link', { name: '[→] COLLABORATION SETTINGS' })
    expect(link).toHaveAttribute('href', '/settings')
    expect(screen.getByTestId('create-invitation')).toBeDisabled()
    expect(screen.getByTestId('collaboration-setup')).toHaveTextContent(enabled ? 'service is unavailable' : 'display name')
    expect(rpcRequest.mock.calls.filter(([method]) => method === 'collaboration.share')).toHaveLength(0)
  })

})
