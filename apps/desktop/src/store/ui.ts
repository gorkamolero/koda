import { atom } from 'jotai'

/**
 * Sidebar visibility state
 */
export const sidebarVisibleAtom = atom(true)

/**
 * Command palette visibility state
 */
export const commandPaletteVisibleAtom = atom(false)

/**
 * Command palette search query
 */
export const commandPaletteQueryAtom = atom('')

/**
 * Command definition type
 */
export interface Command {
  id: string
  name: string
  description?: string
  shortcut?: string
  category: 'navigation' | 'file' | 'edit' | 'view' | 'help'
  action: () => void
}

/**
 * Available commands for the command palette
 * These are populated dynamically based on the current context
 */
export const commandsAtom = atom<Command[]>([])

/**
 * Filtered commands based on search query
 */
export const filteredCommandsAtom = atom((get) => {
  const commands = get(commandsAtom)
  const query = get(commandPaletteQueryAtom).toLowerCase().trim()

  if (!query) return commands

  return commands.filter(
    (cmd) =>
      cmd.name.toLowerCase().includes(query) ||
      cmd.description?.toLowerCase().includes(query) ||
      cmd.category.toLowerCase().includes(query)
  )
})

/**
 * Action: toggle sidebar visibility
 */
export const toggleSidebarAtom = atom(null, (get, set) => {
  set(sidebarVisibleAtom, !get(sidebarVisibleAtom))
})

/**
 * Action: toggle command palette visibility
 */
export const toggleCommandPaletteAtom = atom(null, (get, set) => {
  const isVisible = get(commandPaletteVisibleAtom)
  if (isVisible) {
    set(commandPaletteVisibleAtom, false)
    set(commandPaletteQueryAtom, '')
  } else {
    set(commandPaletteVisibleAtom, true)
  }
})

/**
 * Action: close command palette
 */
export const closeCommandPaletteAtom = atom(null, (_get, set) => {
  set(commandPaletteVisibleAtom, false)
  set(commandPaletteQueryAtom, '')
})

/**
 * Action: execute command and close palette
 */
export const executeCommandAtom = atom(null, (_get, set, command: Command) => {
  command.action()
  set(commandPaletteVisibleAtom, false)
  set(commandPaletteQueryAtom, '')
})
