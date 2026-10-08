import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { Provider, createStore } from 'jotai'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { Settings } from '@/pages/Settings'

const { isTauriContext, openUrl } = vi.hoisted(() => ({ isTauriContext: vi.fn(() => false), openUrl: vi.fn() }))
vi.mock('@/lib/tauri', () => ({ isTauriContext }))
vi.mock('@tauri-apps/plugin-opener', () => ({ openUrl }))
vi.mock('@/components/ThemeSelector', () => ({ ThemeSelector: () => null }))
const view = () => <Provider store={createStore()}><Settings /></Provider>
beforeEach(() => { localStorage.clear(); vi.clearAllMocks(); isTauriContext.mockReturnValue(false) })

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
