import { useState } from 'react'
import { describe, expect, it, vi } from 'vitest'
import { render, fireEvent, screen } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { Provider, createStore } from 'jotai'
import { ShareWorkspaceButton } from '@/components/WorkspaceSharing'

vi.mock('@/lib/tauri', () => ({ rpcRequest: vi.fn(async () => ({ invitation: 'test-invitation' })) }))

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
    fireEvent.click(screen.getByTestId('create-invitation'))
    expect(await screen.findByTestId('collaborative-wrapper')).toBeVisible()
    expect(screen.getByTestId('share-invitation')).toHaveValue('test-invitation')
    expect(screen.getByRole('dialog', { name: 'Share workspace' })).toBeVisible()
  })
})
