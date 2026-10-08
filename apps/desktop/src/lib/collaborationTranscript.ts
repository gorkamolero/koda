/** Reconstruct the same messages from either a partial stream or persisted history. */
export type SharedTranscriptEvent = {
  type: string; authorName?: string; authorMachineId?: string; turnId?: string; text?: string; result?: string; error?: string;
  message?: { content?: string | { type: string; text?: string }[] }
}
export type SharedTranscriptRow = { id: string; event: SharedTranscriptEvent }
export type SharedChatMessage = { id: string; role: 'user' | 'assistant' | 'error'; text: string; authorName?: string; authorMachineId?: string }

export function readSharedTranscript(rows: SharedTranscriptRow[]): SharedChatMessage[] {
  const result: SharedChatMessage[] = []
  let assistant: SharedChatMessage | undefined
  for (const row of rows) {
    const event = row.event
    if (event.type === 'user') {
      assistant = undefined
      const content = event.message?.content
      const text = typeof content === 'string' ? content : content?.filter((item) => item.type === 'text').map((item) => item.text).join('\n') || ''
      if (text) result.push({ id: row.id, role: 'user', text, ...(event.authorName ? { authorName: event.authorName } : {}), ...(event.authorMachineId ? { authorMachineId: event.authorMachineId } : {}) })
    } else if (event.type === 'text_delta' || event.type === 'result' || event.type === 'assistant') {
      const content = event.message?.content
      const complete = typeof content === 'string' ? content : content?.filter((item) => item.type === 'text').map((item) => item.text).join('\n')
      const text = event.type === 'text_delta' ? event.text : event.type === 'result' ? event.result : complete
      if (!text) continue
      if (!assistant) { assistant = { id: row.id, role: 'assistant', text: '' }; result.push(assistant) }
      assistant.text = event.type === 'text_delta' ? assistant.text + text : text
    } else if (event.type === 'error') {
      result.push({ id: row.id, role: 'error', text: event.error || 'Agent error' })
    }
  }
  return result
}
