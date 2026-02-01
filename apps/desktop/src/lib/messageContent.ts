import type { ChatMessage, ContentBlock } from '@/store/chat'

/**
 * Extract copyable text content from a message
 * Converts structured content blocks to markdown
 */
export function extractMessageContent(message: ChatMessage): string {
  // If no content blocks, return raw content
  if (!message.contentBlocks || message.contentBlocks.length === 0) {
    return message.content
  }

  // Convert content blocks to markdown
  return message.contentBlocks
    .map(block => formatContentBlock(block))
    .filter(Boolean)
    .join('\n\n')
}

/**
 * Format a single content block as markdown
 */
function formatContentBlock(block: ContentBlock): string {
  switch (block.type) {
    case 'text':
      return block.text

    case 'thinking':
      return `<details>
<summary>Thinking (${formatDuration(block.durationMs)})</summary>

${block.content}

</details>`

    case 'tool_use':
      return `### Tool: ${block.name}

\`\`\`json
${JSON.stringify(block.input, null, 2)}
\`\`\``

    case 'tool_result':
      if (block.error) {
        return `**Error:** ${block.error}`
      }
      return block.output ?? ''

    default:
      return ''
  }
}

/**
 * Format duration in milliseconds to human-readable string
 */
function formatDuration(ms?: number): string {
  if (!ms) return 'unknown'
  if (ms < 1000) return `${String(ms)}ms`
  return `${(ms / 1000).toFixed(1)}s`
}

/**
 * Get a short preview of message content for display
 */
export function getMessagePreview(message: ChatMessage, maxLength = 100): string {
  const content = message.content || extractMessageContent(message)
  if (content.length <= maxLength) return content
  return content.slice(0, maxLength).trim() + '...'
}
