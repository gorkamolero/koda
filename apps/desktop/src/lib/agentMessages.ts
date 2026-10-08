import type { ChatMessage, ContentBlock, AgentModel } from '@/store/chat'

export interface AgentEvent {
  id?: string
  index: number
  timestamp: number
  event: {
    type: string
    authorName?: string
    authorMachineId?: string
    id?: string
    message?: { content?: string | Array<{ type: string; text?: string }> }
    text?: string
    result?: string
    is_error?: boolean
    tool?: string
    tool_id?: string
    tool_use_id?: string
    input?: Record<string, unknown>
    output?: unknown
    error?: string
  }
}

/** Rebuild a conversation from durable events, including partially streamed turns. */
export function agentEventsToMessages(events: AgentEvent[], model: AgentModel = 'codex'): ChatMessage[] {
  const messages: ChatMessage[] = []
  let assistant: ChatMessage | undefined
  let streamed = false
  const getAssistant = (entry: AgentEvent) => {
    if (!assistant) {
      assistant = { id: `agent-${entry.id ?? entry.index}`, role: 'assistant', content: '', timestamp: entry.timestamp, status: 'streaming', model, contentBlocks: [] }
      messages.push(assistant)
      streamed = false
    }
    return assistant
  }
  const messageText = (entry: AgentEvent) => {
    const content = entry.event.message?.content
    return typeof content === 'string' ? content : content?.filter(block => block.type === 'text').map(block => block.text ?? '').join('') ?? ''
  }
  for (const entry of events) {
    const event = entry.event
    if (event.type === 'user') {
      assistant = undefined
      messages.push({ id: `user-${entry.id ?? entry.index}`, role: 'user', authorName: event.authorName, authorMachineId: event.authorMachineId, content: messageText(entry) || event.text || '', timestamp: entry.timestamp, status: 'complete', model })
    } else if (event.type === 'text_delta') {
      getAssistant(entry).content += event.text ?? ''
      streamed = true
    } else if (event.type === 'assistant') {
      if (!streamed) getAssistant(entry).content += messageText(entry)
    } else if (event.type === 'tool_use') {
      const message = getAssistant(entry)
      const block: ContentBlock = { type: 'tool_use', id: event.tool_id ?? event.id ?? `tool-${entry.index}`, name: event.tool ?? 'tool', input: event.input ?? {}, status: 'running' }
      message.contentBlocks?.push(block)
    } else if (event.type === 'tool_result') {
      const message = getAssistant(entry)
      message.contentBlocks = message.contentBlocks?.map(block => block.type === 'tool_use' && block.id === event.tool_use_id ? { ...block, status: event.error ? 'error' : 'success' } : block)
      const output = event.output ?? event.result
      message.contentBlocks?.push({ type: 'tool_result', toolUseId: event.tool_use_id ?? '', toolName: event.tool ?? 'tool', output: typeof output === 'string' ? output : JSON.stringify(output), error: event.error })
    } else if (event.type === 'result') {
      const message = getAssistant(entry)
      message.content ||= event.result || (event.is_error ? 'Agent failed' : 'Done')
      message.status = event.is_error ? 'error' : 'complete'
      assistant = undefined
    } else if (event.type === 'error') {
      const message = getAssistant(entry)
      message.content += event.error || 'Agent failed'
      message.status = 'error'
      assistant = undefined
    }
  }
  return messages
}
