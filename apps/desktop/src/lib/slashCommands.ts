/**
 * Slash command registry for chat input
 */

export interface SlashCommand {
  /** Command trigger (e.g., '/search') */
  trigger: string
  /** Display name */
  name: string
  /** Description shown in suggestions */
  description: string
  /** Category for grouping */
  category: 'file' | 'chat' | 'model' | 'navigation'
  /** Whether command takes arguments */
  hasArgs?: boolean
  /** Placeholder for args input */
  argsPlaceholder?: string
}

/**
 * Available slash commands
 */
export const SLASH_COMMANDS: SlashCommand[] = [
  {
    trigger: '/search',
    name: 'Search',
    description: 'Search files by pattern',
    category: 'file',
    hasArgs: true,
    argsPlaceholder: '<pattern>',
  },
  {
    trigger: '/context',
    name: 'Add Context',
    description: 'Add file to conversation context',
    category: 'file',
    hasArgs: true,
    argsPlaceholder: '<file path>',
  },
  {
    trigger: '/clear',
    name: 'Clear',
    description: 'Clear conversation history',
    category: 'chat',
  },
  {
    trigger: '/model',
    name: 'Switch Model',
    description: 'Change the AI model',
    category: 'model',
    hasArgs: true,
    argsPlaceholder: '<model name>',
  },
  {
    trigger: '/diff',
    name: 'Show Diff',
    description: 'Show current file changes',
    category: 'navigation',
  },
  {
    trigger: '/terminal',
    name: 'Open Terminal',
    description: 'Switch to terminal tab',
    category: 'navigation',
  },
  {
    trigger: '/help',
    name: 'Help',
    description: 'Show available commands',
    category: 'chat',
  },
]

/**
 * Parse input to detect slash command
 */
export function parseSlashCommand(input: string): {
  command: SlashCommand | null
  args: string
  partial: string
  isComplete: boolean
} {
  const trimmed = input.trim()

  // Not a command
  if (!trimmed.startsWith('/')) {
    return { command: null, args: '', partial: '', isComplete: false }
  }

  // Check for complete command with space
  const spaceIndex = trimmed.indexOf(' ')
  if (spaceIndex > 0) {
    const trigger = trimmed.slice(0, spaceIndex)
    const args = trimmed.slice(spaceIndex + 1)
    const command = SLASH_COMMANDS.find(c => c.trigger === trigger)
    return { command: command ?? null, args, partial: trigger, isComplete: !!command }
  }

  // Partial command (no space yet)
  const command = SLASH_COMMANDS.find(c => c.trigger === trimmed)
  return {
    command: command ?? null,
    args: '',
    partial: trimmed,
    isComplete: !!command && !command.hasArgs,
  }
}

/**
 * Filter commands by partial input
 */
export function filterCommands(partial: string): SlashCommand[] {
  if (!partial.startsWith('/')) return []

  const search = partial.toLowerCase()
  return SLASH_COMMANDS.filter(cmd =>
    cmd.trigger.toLowerCase().startsWith(search) ||
    cmd.name.toLowerCase().includes(search.slice(1))
  )
}

/**
 * Group commands by category
 */
export function groupCommandsByCategory(commands: SlashCommand[]): Record<string, SlashCommand[]> {
  return commands.reduce<Record<string, SlashCommand[]>>((acc, cmd) => {
    const category = cmd.category
    if (!acc[category]) {
      acc[category] = []
    }
    acc[category]!.push(cmd)
    return acc
  }, {})
}

/**
 * Category display names
 */
export const CATEGORY_LABELS: Record<string, string> = {
  file: 'Files',
  chat: 'Chat',
  model: 'Model',
  navigation: 'Navigation',
}
