import { describe, it, expect } from 'vitest'
import {
  parseSlashCommand,
  filterCommands,
  groupCommandsByCategory,
  SLASH_COMMANDS,
  CATEGORY_LABELS,
} from '@/lib/slashCommands'

describe('parseSlashCommand', () => {
  it('should return null for non-command input', () => {
    const result = parseSlashCommand('hello world')
    expect(result.command).toBeNull()
    expect(result.isComplete).toBe(false)
  })

  it('should parse complete command with args', () => {
    const result = parseSlashCommand('/search *.tsx')
    expect(result.command?.trigger).toBe('/search')
    expect(result.args).toBe('*.tsx')
    expect(result.isComplete).toBe(true)
  })

  it('should parse command without required args', () => {
    const result = parseSlashCommand('/clear')
    expect(result.command?.trigger).toBe('/clear')
    expect(result.args).toBe('')
    expect(result.isComplete).toBe(true)
  })

  it('should detect partial command (no space)', () => {
    const result = parseSlashCommand('/sea')
    expect(result.command).toBeNull()
    expect(result.partial).toBe('/sea')
    expect(result.isComplete).toBe(false)
  })

  it('should detect exact command without args when args are optional', () => {
    const result = parseSlashCommand('/help')
    expect(result.command?.trigger).toBe('/help')
    expect(result.isComplete).toBe(true)
  })

  it('should detect exact command requiring args as incomplete', () => {
    const result = parseSlashCommand('/search')
    expect(result.command?.trigger).toBe('/search')
    expect(result.isComplete).toBe(false) // hasArgs=true, needs space + args
  })

  it('should handle unknown command with args', () => {
    const result = parseSlashCommand('/unknown arg')
    expect(result.command).toBeNull()
    expect(result.args).toBe('arg')
    expect(result.partial).toBe('/unknown')
  })

  it('should handle whitespace-only input', () => {
    const result = parseSlashCommand('   ')
    expect(result.command).toBeNull()
  })

  it('should handle multiple args', () => {
    const result = parseSlashCommand('/model claude-3-opus')
    expect(result.command?.trigger).toBe('/model')
    expect(result.args).toBe('claude-3-opus')
  })
})

describe('filterCommands', () => {
  it('should return all commands for just /', () => {
    const result = filterCommands('/')
    expect(result.length).toBe(SLASH_COMMANDS.length)
  })

  it('should filter by trigger prefix', () => {
    const result = filterCommands('/se')
    expect(result.some(c => c.trigger === '/search')).toBe(true)
    expect(result.every(c => c.trigger.startsWith('/se') || c.name.toLowerCase().includes('se'))).toBe(true)
  })

  it('should filter by name', () => {
    const result = filterCommands('/context')
    expect(result.some(c => c.trigger === '/context')).toBe(true)
  })

  it('should return empty for non-command input', () => {
    const result = filterCommands('hello')
    expect(result).toHaveLength(0)
  })

  it('should be case-insensitive', () => {
    const resultLower = filterCommands('/SEARCH')
    const resultUpper = filterCommands('/search')
    expect(resultLower.length).toBe(resultUpper.length)
  })

  it('should match by name substring', () => {
    const result = filterCommands('/add')
    expect(result.some(c => c.name === 'Add Context')).toBe(true)
  })
})

describe('groupCommandsByCategory', () => {
  it('should group commands correctly', () => {
    const grouped = groupCommandsByCategory(SLASH_COMMANDS)

    expect(grouped['file']).toBeDefined()
    expect(grouped['chat']).toBeDefined()
    expect(grouped['model']).toBeDefined()
    expect(grouped['navigation']).toBeDefined()
  })

  it('should include all commands in groups', () => {
    const grouped = groupCommandsByCategory(SLASH_COMMANDS)
    const totalGrouped = Object.values(grouped).reduce((sum, cmds) => sum + cmds.length, 0)
    expect(totalGrouped).toBe(SLASH_COMMANDS.length)
  })

  it('should place search in file category', () => {
    const grouped = groupCommandsByCategory(SLASH_COMMANDS)
    const fileCommands = grouped['file'] ?? []
    expect(fileCommands.some(c => c.trigger === '/search')).toBe(true)
  })

  it('should place clear in chat category', () => {
    const grouped = groupCommandsByCategory(SLASH_COMMANDS)
    const chatCommands = grouped['chat'] ?? []
    expect(chatCommands.some(c => c.trigger === '/clear')).toBe(true)
  })
})

describe('CATEGORY_LABELS', () => {
  it('should have labels for all categories', () => {
    const categories = new Set(SLASH_COMMANDS.map(c => c.category))
    categories.forEach(cat => {
      expect(CATEGORY_LABELS[cat]).toBeDefined()
    })
  })
})

describe('SLASH_COMMANDS registry', () => {
  it('should have unique triggers', () => {
    const triggers = SLASH_COMMANDS.map(c => c.trigger)
    const uniqueTriggers = new Set(triggers)
    expect(uniqueTriggers.size).toBe(triggers.length)
  })

  it('should have all triggers start with /', () => {
    SLASH_COMMANDS.forEach(cmd => {
      expect(cmd.trigger.startsWith('/')).toBe(true)
    })
  })

  it('should have argsPlaceholder when hasArgs is true', () => {
    SLASH_COMMANDS.filter(c => c.hasArgs).forEach(cmd => {
      expect(cmd.argsPlaceholder).toBeDefined()
    })
  })

  it('should include essential commands', () => {
    const triggers = SLASH_COMMANDS.map(c => c.trigger)
    expect(triggers).toContain('/search')
    expect(triggers).toContain('/clear')
    expect(triggers).toContain('/help')
  })
})
