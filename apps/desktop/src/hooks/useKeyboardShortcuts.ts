import { useEffect, useCallback, useMemo } from 'react'
import { useSetAtom } from 'jotai'
import {
  toggleSidebarAtom,
  toggleCommandPaletteAtom,
  commandsAtom,
  type Command,
} from '@/store/ui'
import { quickOpenVisibleAtom } from '@/store/fileExplorer'

/**
 * Keyboard shortcut definition
 */
export interface KeyboardShortcut {
  /** Key combination (e.g., 'k', '1', 'Enter') */
  key: string
  /** Requires Cmd (Mac) or Ctrl (Windows/Linux) */
  metaKey?: boolean
  /** Requires Shift key */
  shiftKey?: boolean
  /** Requires Alt key */
  altKey?: boolean
  /** Description for UI */
  description: string
  /** Handler function */
  handler: () => void
  /** Whether to prevent default browser behavior */
  preventDefault?: boolean
  /** Only trigger when input is not focused */
  ignoreWhenInputFocused?: boolean
}

/**
 * Check if the active element is an input or textarea
 */
function isInputFocused(): boolean {
  const activeElement = document.activeElement
  if (!activeElement) return false

  const tagName = activeElement.tagName.toLowerCase()
  return (
    tagName === 'input' ||
    tagName === 'textarea' ||
    activeElement.getAttribute('contenteditable') === 'true'
  )
}

/**
 * Check if the user is on macOS using userAgentData (modern) or userAgent (fallback)
 */
function isMacOS(): boolean {
  if (typeof navigator === 'undefined') return false

  // Modern approach using userAgentData (not deprecated)
  if ('userAgentData' in navigator) {
    const uaData = navigator.userAgentData as { platform?: string } | undefined
    if (uaData?.platform) {
      return uaData.platform.toLowerCase().includes('mac')
    }
  }

  // Fallback to userAgent (not deprecated)
  return navigator.userAgent.toLowerCase().includes('mac')
}

/**
 * Format shortcut for display (e.g., "Cmd+K" or "Ctrl+K")
 */
export function formatShortcut(shortcut: KeyboardShortcut): string {
  const parts: string[] = []

  // Use Cmd on Mac, Ctrl on others
  const isMac = isMacOS()

  if (shortcut.metaKey) {
    parts.push(isMac ? 'Cmd' : 'Ctrl')
  }
  if (shortcut.altKey) {
    parts.push(isMac ? 'Option' : 'Alt')
  }
  if (shortcut.shiftKey) {
    parts.push('Shift')
  }

  // Capitalize single letter keys
  const keyDisplay =
    shortcut.key.length === 1 ? shortcut.key.toUpperCase() : shortcut.key

  parts.push(keyDisplay)

  return parts.join('+')
}

interface UseKeyboardShortcutsOptions {
  /** Callback when switching tabs (1-indexed) */
  onSwitchTab?: (tabIndex: number) => void
  /** Callback for sending a message */
  onSendMessage?: () => void
  /** Number of available tabs */
  tabCount?: number
  /** Callback for toggling terminal panel */
  onToggleTerminal?: () => void
  /** Callback for toggling right sidebar */
  onToggleSidebar?: () => void
  /** Callback for focusing the chat input */
  onFocusChat?: () => void
}

/**
 * Hook to register and manage global keyboard shortcuts
 *
 * Shortcuts:
 * - Cmd+K: Command palette
 * - Cmd+P: Quick open file
 * - Cmd+B: Toggle left sidebar
 * - Cmd+J: Toggle terminal
 * - Cmd+\: Toggle right sidebar
 * - Cmd+1/2/3: Switch tabs
 * - Cmd+Enter: Send message (when in chat input)
 */
export function useKeyboardShortcuts(options: UseKeyboardShortcutsOptions = {}) {
  const { onSwitchTab, onSendMessage, tabCount = 4, onToggleTerminal, onToggleSidebar, onFocusChat } = options

  const toggleCommandPalette = useSetAtom(toggleCommandPaletteAtom)
  const toggleSidebar = useSetAtom(toggleSidebarAtom)
  const setQuickOpenVisible = useSetAtom(quickOpenVisibleAtom)
  const setCommands = useSetAtom(commandsAtom)

  // Memoized shortcuts definition
  const shortcuts = useMemo<KeyboardShortcut[]>(
    () => [
      {
        key: 'k',
        metaKey: true,
        description: 'Open command palette',
        handler: () => {
          toggleCommandPalette()
        },
        preventDefault: true,
        ignoreWhenInputFocused: false, // Works even when typing
      },
      {
        key: 'p',
        metaKey: true,
        description: 'Quick open file',
        handler: () => {
          setQuickOpenVisible((prev) => !prev)
        },
        preventDefault: true,
        ignoreWhenInputFocused: false,
      },
      {
        key: 'b',
        metaKey: true,
        description: 'Toggle left sidebar',
        handler: () => {
          toggleSidebar()
        },
        preventDefault: true,
        ignoreWhenInputFocused: true,
      },
      {
        key: 'j',
        metaKey: true,
        description: 'Toggle terminal',
        handler: () => {
          onToggleTerminal?.()
        },
        preventDefault: true,
        ignoreWhenInputFocused: true,
      },
      {
        key: '\\',
        metaKey: true,
        description: 'Toggle right sidebar',
        handler: () => {
          onToggleSidebar?.()
        },
        preventDefault: true,
        ignoreWhenInputFocused: true,
      },
      {
        key: 'l',
        metaKey: true,
        description: 'Focus chat input',
        handler: () => {
          onFocusChat?.()
        },
        preventDefault: true,
        ignoreWhenInputFocused: false, // Works even when typing elsewhere
      },
      // Tab switching shortcuts
      ...Array.from({ length: 9 }, (_, i) => ({
        key: String(i + 1),
        metaKey: true,
        description: `Switch to tab ${String(i + 1)}`,
        handler: () => {
          if (onSwitchTab && i < tabCount) {
            onSwitchTab(i)
          }
        },
        preventDefault: true,
        ignoreWhenInputFocused: true,
      })),
    ],
    [toggleCommandPalette, setQuickOpenVisible, toggleSidebar, onSwitchTab, tabCount, onToggleTerminal, onToggleSidebar, onFocusChat]
  )

  // Update commands for command palette
  useEffect(() => {
    const commands: Command[] = [
      {
        id: 'quick-open',
        name: 'Quick Open File',
        description: 'Fuzzy search for files in the workspace',
        shortcut: 'Cmd+P',
        category: 'file',
        action: () => {
          setQuickOpenVisible(true)
        },
      },
      {
        id: 'toggle-left-sidebar',
        name: 'Toggle Left Sidebar',
        description: 'Show or hide the repos sidebar',
        shortcut: 'Cmd+B',
        category: 'view',
        action: () => {
          toggleSidebar()
        },
      },
      {
        id: 'toggle-terminal',
        name: 'Toggle Terminal',
        description: 'Show or hide the terminal panel',
        shortcut: 'Cmd+J',
        category: 'view',
        action: () => {
          onToggleTerminal?.()
        },
      },
      {
        id: 'toggle-right-sidebar',
        name: 'Toggle Right Sidebar',
        description: 'Show or hide the files/changes sidebar',
        shortcut: 'Cmd+\\',
        category: 'view',
        action: () => {
          onToggleSidebar?.()
        },
      },
      {
        id: 'switch-chat',
        name: 'Go to Chat Tab',
        description: 'Switch to the Chat tab',
        shortcut: 'Cmd+1',
        category: 'navigation',
        action: () => {
          onSwitchTab?.(0)
        },
      },
      {
        id: 'switch-scratchpad',
        name: 'Go to Scratchpad Tab',
        description: 'Switch to the Scratchpad tab',
        shortcut: 'Cmd+2',
        category: 'navigation',
        action: () => {
          onSwitchTab?.(1)
        },
      },
      {
        id: 'focus-chat',
        name: 'Focus Chat Input',
        description: 'Jump to the chat input field',
        shortcut: 'Cmd+L',
        category: 'navigation',
        action: () => {
          onFocusChat?.()
        },
      },
      {
        id: 'keyboard-shortcuts',
        name: 'Keyboard Shortcuts',
        description: 'View all available keyboard shortcuts',
        category: 'help',
        action: () => {
          // TODO: Open keyboard shortcuts dialog
          console.log('Keyboard shortcuts help')
        },
      },
    ]

    setCommands(commands)
  }, [setCommands, setQuickOpenVisible, toggleSidebar, onSwitchTab, onToggleTerminal, onToggleSidebar, onFocusChat])

  // Global keyboard event handler
  const handleKeyDown = useCallback(
    (event: KeyboardEvent) => {
      // Check for Cmd+Enter (send message) - special case for chat input
      if (
        (event.metaKey || event.ctrlKey) &&
        event.key === 'Enter' &&
        onSendMessage
      ) {
        event.preventDefault()
        onSendMessage()
        return
      }

      // Find matching shortcut
      const shortcut = shortcuts.find((s) => {
        const keyMatch = s.key.toLowerCase() === event.key.toLowerCase()
        const metaMatch = s.metaKey ? event.metaKey || event.ctrlKey : true
        const shiftMatch = s.shiftKey ? event.shiftKey : !event.shiftKey
        const altMatch = s.altKey ? event.altKey : !event.altKey

        return keyMatch && metaMatch && shiftMatch && altMatch
      })

      if (!shortcut) return

      // Check if we should ignore when input is focused
      if (shortcut.ignoreWhenInputFocused && isInputFocused()) {
        return
      }

      // Execute the shortcut
      if (shortcut.preventDefault) {
        event.preventDefault()
      }

      shortcut.handler()
    },
    [shortcuts, onSendMessage]
  )

  // Register global event listener
  useEffect(() => {
    document.addEventListener('keydown', handleKeyDown)
    return () => {
      document.removeEventListener('keydown', handleKeyDown)
    }
  }, [handleKeyDown])

  return {
    shortcuts,
    formatShortcut,
  }
}

/**
 * Hook for Cmd+Enter shortcut specifically for chat input
 * Should be used in the InputArea component
 */
export function useSendMessageShortcut(onSend: () => void) {
  const handleKeyDown = useCallback(
    (event: React.KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key === 'Enter') {
        event.preventDefault()
        onSend()
      }
    },
    [onSend]
  )

  return { onKeyDown: handleKeyDown }
}
