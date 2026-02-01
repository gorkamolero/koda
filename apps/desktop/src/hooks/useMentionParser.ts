import { useMemo } from 'react'

/**
 * Parsed mention from message text
 */
export interface ParsedMention {
  path: string
  displayName: string
  startIndex: number
  endIndex: number
}

/**
 * Mention detection result while typing
 */
export interface MentionContext {
  isActive: boolean
  query: string
  startIndex: number
}

/**
 * Regex pattern for detecting @mentions in text
 * Matches: @path/to/file.ts or @filename
 */
const MENTION_PATTERN = /@([\w/.@-]+)/g

/**
 * Detects if cursor is within an @mention context for autocomplete
 * @param text - Input text
 * @param cursorPosition - Cursor position in text
 */
export function detectMentionContext(text: string, cursorPosition: number): MentionContext {
  // Find the most recent @ before cursor
  let atIndex = -1
  for (let i = cursorPosition - 1; i >= 0; i--) {
    const char = text[i]
    if (char === '@') {
      atIndex = i
      break
    }
    // Stop at whitespace or other breaking characters
    if (char === ' ' || char === '\n' || char === '\t') {
      break
    }
  }

  if (atIndex === -1) {
    return { isActive: false, query: '', startIndex: -1 }
  }

  // Extract the partial path/query
  const query = text.slice(atIndex + 1, cursorPosition)

  // Don't show popover for empty @ or if there's a space after @
  if (query.includes(' ') || query.includes('\n')) {
    return { isActive: false, query: '', startIndex: -1 }
  }

  return {
    isActive: true,
    query,
    startIndex: atIndex,
  }
}

/**
 * Parse all @mentions from message text
 * @param text - Message text to parse
 */
export function parseMentions(text: string): ParsedMention[] {
  const mentions: ParsedMention[] = []
  let match: RegExpExecArray | null

  while ((match = MENTION_PATTERN.exec(text)) !== null) {
    const fullMatch = match[0]
    const path = match[1] ?? ''

    if (!path) continue

    // Get display name (last segment of path)
    const displayName = path.split('/').pop() ?? path

    mentions.push({
      path,
      displayName,
      startIndex: match.index,
      endIndex: match.index + fullMatch.length,
    })
  }

  return mentions
}

/**
 * Hook for mention parsing functionality
 */
export function useMentionParser(text: string) {
  const mentions = useMemo(() => parseMentions(text), [text])

  return {
    mentions,
    hasMentions: mentions.length > 0,
  }
}

/**
 * Replace a mention in text with completed path
 * @param text - Original text
 * @param startIndex - Start index of @ symbol
 * @param cursorPosition - Current cursor position
 * @param completedPath - Full path to insert
 */
export function completeMention(
  text: string,
  startIndex: number,
  cursorPosition: number,
  completedPath: string
): { text: string; newCursorPosition: number } {
  const before = text.slice(0, startIndex)
  const after = text.slice(cursorPosition)
  const newText = `${before}@${completedPath} ${after}`
  const newCursorPosition = startIndex + completedPath.length + 2 // +2 for @ and space

  return { text: newText, newCursorPosition }
}
