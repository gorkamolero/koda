import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { Provider, createStore } from 'jotai'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { Settings } from '@/pages/Settings'

const { isTauriContext, openUrl, rpcRequest } = vi.hoisted(() => ({ isTauriContext: vi.fn(() => false), openUrl: vi.fn(), rpcRequest: vi.fn<[method: string, params?: unknown], Promise<unknown>>() }))
vi.mock('@/lib/tauri', () => ({ isTauriContext, rpcRequest }))
vi.mock('@tauri-apps/plugin-opener', () => ({ openUrl }))
vi.mock('@/components/ThemeSelector', () => ({ ThemeSelector: () => null }))
const view = () => <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}><Provider store={createStore()}><Settings /></Provider></QueryClientProvider>
beforeEach(() => { localStorage.clear(); vi.clearAllMocks(); isTauriContext.mockReturnValue(false); rpcRequest.mockResolvedValue({ enabled: false, reachable: false, mode: 'not-configured', name: 'Gorka', settings: { displayName: '', serviceUrl: '' } }) })

describe('new conversation settings', () => {
  it('starts with the requested bypass preference and preserves an explicit ask preference after remount', async () => {
    const rendered = render(view())
    expect(screen.getByLabelText('New conversation permissions')).toHaveValue('bypassPermissions')
    fireEvent.change(screen.getByLabelText('New conversation permissions'), { target: { value: 'default' } })
    expect(localStorage.getItem('settings:defaultPermissionMode')).toBe(JSON.stringify('default'))
    rendered.unmount()
    render(view())
    await waitFor(() => expect(screen.getByLabelText('New conversation permissions')).toHaveValue('default'))
  })

  it('persists a supported default agent', () => {
    render(view())
    fireEvent.change(screen.getByLabelText('Default agent'), { target: { value: 'claude' } })
    expect(localStorage.getItem('settings:defaultModel')).toBe(JSON.stringify('claude'))
    expect(screen.getByLabelText('Default agent')).toHaveValue('claude')
    expect(screen.queryByRole('option', { name: 'Kimi Code' })).not.toBeInTheDocument()
  })

  it('links the separate guard setup and states its limitations', async () => {
    isTauriContext.mockReturnValue(true)
    openUrl.mockResolvedValue(undefined)
    render(view())
    expect(screen.getByTestId('command-guard-recommendation')).toHaveTextContent('Requires separate setup')
    expect(screen.getByTestId('command-guard-recommendation')).toHaveTextContent('Codex coverage is incomplete')
    const link = screen.getByRole('link', { name: 'Official setup guide ↗' })
    expect(link).toHaveAttribute('href', 'https://github.com/Dicklesworthstone/destructive_command_guard#quick-install')
    fireEvent.click(link)
    await waitFor(() => expect(openUrl).toHaveBeenCalledWith(link.getAttribute('href')))
  })
})


describe('collaboration settings', () => {
  it('shows setup status, saves the display name and advanced service origin, and refreshes status', async () => {
    render(view())
    await waitFor(() => expect(screen.getByTestId('collaboration-setup-status')).toHaveTextContent('Not configured'))
    fireEvent.change(screen.getByLabelText('Collaboration display name'), { target: { value: 'Alex' } })
    fireEvent.click(screen.getByText('[ADVANCED]'))
    fireEvent.change(screen.getByLabelText('Collaboration service URL'), { target: { value: 'https://collab.example.com' } })
    rpcRequest.mockResolvedValue({ enabled: true, reachable: true, mode: 'service', name: 'Alex', settings: { displayName: 'Alex', serviceUrl: 'https://collab.example.com' } })
    fireEvent.click(screen.getByTestId('collaboration-save'))
    await waitFor(() => expect(rpcRequest).toHaveBeenCalledWith('collaboration.settings', { displayName: 'Alex', serviceUrl: 'https://collab.example.com' }))
    await waitFor(() => expect(screen.getByTestId('collaboration-setup-status')).toHaveTextContent('Connected'))
  })
  it('shows development-key mode and a useful save error', async () => {
    rpcRequest.mockResolvedValue({ enabled: true, reachable: true, mode: 'development-key', name: 'Gorka', settings: { displayName: '', serviceUrl: '' } })
    render(view())
    await waitFor(() => expect(screen.getByTestId('collaboration-setup-status')).toHaveTextContent('Development key'))
    rpcRequest.mockRejectedValueOnce(new Error('Use an HTTPS collaboration service origin'))
    fireEvent.click(screen.getByTestId('collaboration-save'))
    expect(await screen.findByRole('alert')).toHaveTextContent('Use an HTTPS')
  })
})
