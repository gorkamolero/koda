import { describe, it, expect } from 'vitest'
import {
  parseMentions,
  detectMentionContext,
  completeMention,
} from '@/hooks/useMentionParser'

describe('parseMentions', () => {
  it('should parse single mention', () => {
    const result = parseMentions('Check @src/App.tsx for the bug')
    expect(result).toHaveLength(1)
    expect(result[0]).toEqual({
      path: 'src/App.tsx',
      displayName: 'App.tsx',
      startIndex: 6,
      endIndex: 18,
    })
  })

  it('should parse multiple mentions', () => {
    const result = parseMentions('Look at @file1.ts and @path/to/file2.js')
    expect(result).toHaveLength(2)
    expect(result[0]?.path).toBe('file1.ts')
    expect(result[1]?.path).toBe('path/to/file2.js')
  })

  it('should handle nested paths', () => {
    const result = parseMentions('@src/components/AgentChat/InputArea.tsx')
    expect(result).toHaveLength(1)
    expect(result[0]?.path).toBe('src/components/AgentChat/InputArea.tsx')
    expect(result[0]?.displayName).toBe('InputArea.tsx')
  })

  it('should handle @ in path (scoped packages)', () => {
    const result = parseMentions('Check @node_modules/@tanstack/react-query')
    expect(result).toHaveLength(1)
    expect(result[0]?.path).toBe('node_modules/@tanstack/react-query')
  })

  it('should return empty array for no mentions', () => {
    const result = parseMentions('No mentions here')
    expect(result).toHaveLength(0)
  })

  it('should handle mention at start of text', () => {
    const result = parseMentions('@file.ts is the one')
    expect(result).toHaveLength(1)
    expect(result[0]?.startIndex).toBe(0)
  })

  it('should handle mention at end of text', () => {
    const result = parseMentions('Check this @file.ts')
    expect(result).toHaveLength(1)
    // 'Check this ' = 11 chars, '@file.ts' = 8 chars, endIndex = 11 + 8 = 19
    expect(result[0]?.endIndex).toBe(19)
  })

  it('should handle files with dashes', () => {
    const result = parseMentions('@my-component.tsx')
    expect(result).toHaveLength(1)
    expect(result[0]?.path).toBe('my-component.tsx')
  })
})

describe('detectMentionContext', () => {
  it('should detect active mention context', () => {
    const result = detectMentionContext('Hello @src', 10)
    expect(result.isActive).toBe(true)
    expect(result.query).toBe('src')
    expect(result.startIndex).toBe(6)
  })

  it('should detect partial path input', () => {
    const result = detectMentionContext('@components/Bu', 14)
    expect(result.isActive).toBe(true)
    expect(result.query).toBe('components/Bu')
    expect(result.startIndex).toBe(0)
  })

  it('should not be active without @', () => {
    const result = detectMentionContext('Hello world', 11)
    expect(result.isActive).toBe(false)
    expect(result.query).toBe('')
  })

  it('should not be active if space after @', () => {
    const result = detectMentionContext('Hello @ world', 13)
    expect(result.isActive).toBe(false)
  })

  it('should stop at whitespace before cursor', () => {
    const result = detectMentionContext('@file.ts and @other', 8)
    expect(result.isActive).toBe(true)
    expect(result.query).toBe('file.ts')
  })

  it('should handle cursor at @', () => {
    const result = detectMentionContext('Hello @', 7)
    expect(result.isActive).toBe(true)
    expect(result.query).toBe('')
    expect(result.startIndex).toBe(6)
  })

  it('should handle newline as breaking character', () => {
    const result = detectMentionContext('@file\nsomething', 14)
    expect(result.isActive).toBe(false)
  })
})

describe('completeMention', () => {
  it('should replace partial mention with complete path', () => {
    const result = completeMention('Hello @src', 6, 10, 'src/App.tsx')
    expect(result.text).toBe('Hello @src/App.tsx ')
    expect(result.newCursorPosition).toBe(19)
  })

  it('should handle mention at start', () => {
    const result = completeMention('@co', 0, 3, 'components/Button.tsx')
    expect(result.text).toBe('@components/Button.tsx ')
    expect(result.newCursorPosition).toBe(23)
  })

  it('should preserve text after mention', () => {
    const result = completeMention('@pa is good', 0, 3, 'path/file.ts')
    expect(result.text).toBe('@path/file.ts  is good')
  })

  it('should handle empty remaining text', () => {
    const result = completeMention('@file', 0, 5, 'file.ts')
    expect(result.text).toBe('@file.ts ')
  })
})
