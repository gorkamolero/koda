import { describe, expect, it } from 'vitest'
import { agentEventsToMessages, type AgentEvent } from '@/lib/agentMessages'

const rows = (...events: AgentEvent['event'][]): AgentEvent[] => events.map((event, index) => ({ id: `event-${index}`, index, timestamp: 1000 + index, event }))

describe('durable agent transcript', () => {
  it('preserves the collaborator author after rehydrating a shared user message', () => {
    const messages = agentEventsToMessages(rows({ type: 'user', authorName: 'User B', authorMachineId: 'machine-b', message: { content: 'Remote task' } }))
    expect(messages[0]).toMatchObject({ role: 'user', authorName: 'User B', authorMachineId: 'machine-b', content: 'Remote task' })
  })

  it('hydrates repeated turns without duplicating streamed assistant text or user messages', () => {
    const events = rows(
      { type: 'user', message: { content: 'first task' } },
      { type: 'text_delta', text: 'First' },
      { type: 'text_delta', text: ' answer' },
      { type: 'assistant', message: { content: [{ type: 'text', text: 'First answer' }] } },
      { type: 'result', result: 'First answer' },
      { type: 'user', message: { content: 'second task' } },
      { type: 'text_delta', text: 'Second answer' },
    )
    const messages = agentEventsToMessages(events)
    expect(messages.map(message => [message.role, message.content, message.status])).toEqual([
      ['user', 'first task', 'complete'], ['assistant', 'First answer', 'complete'],
      ['user', 'second task', 'complete'], ['assistant', 'Second answer', 'streaming'],
    ])
    expect(agentEventsToMessages(events)).toEqual(messages)
  })

  it('links real SDK tool IDs and handles object results', () => {
    const messages = agentEventsToMessages(rows(
      { type: 'tool_use', id: 'sdk-command', tool: 'command_execution', input: { command: 'git status' } },
      { type: 'tool_result', tool_use_id: 'sdk-command', tool: 'command_execution', output: { exit_code: 0 } },
      { type: 'result', result: 'Finished' },
    ))
    expect(messages[0]?.contentBlocks?.[0]).toMatchObject({ id: 'sdk-command', status: 'success' })
    expect(messages[0]?.contentBlocks?.[1]).toMatchObject({ output: '{"exit_code":0}' })
  })

  it('displays durable execution errors after restart', () => {
    expect(agentEventsToMessages(rows({ type: 'error', error: 'Authentication failed' }))[0]).toMatchObject({ role: 'assistant', status: 'error', content: 'Authentication failed' })
  })

  it('stops unfinished tools on cancellation while preserving completed results', () => {
    const messages = agentEventsToMessages(rows(
      { type: 'text_delta', text: 'Preparing the write.' },
      { type: 'tool_use', id: 'complete', tool: 'Bash', input: {} },
      { type: 'tool_result', tool_use_id: 'complete', output: 'Done' },
      { type: 'tool_use', id: 'waiting', tool: 'Bash', input: {} },
      { type: 'result', result: 'Cancelled', cancelled: true },
    ))
    expect(messages[0]).toMatchObject({ content: 'Preparing the write.\n\nStopped.', status: 'complete' })
    expect(messages[0]?.contentBlocks?.[0]).toMatchObject({ id: 'complete', status: 'success' })
    expect(messages[0]?.contentBlocks?.[2]).toMatchObject({ id: 'waiting', status: 'cancelled' })
  })
})
