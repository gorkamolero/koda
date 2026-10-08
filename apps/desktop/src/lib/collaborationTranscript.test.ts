import { describe, expect, it } from 'vitest'
import { readSharedTranscript } from './collaborationTranscript'
describe('shared streamed transcript', () => {
  it('preserves the remote author name', () => {
    expect(readSharedTranscript([{ id: 'u', event: { type: 'user', authorName: 'User B', authorMachineId: 'b', message: { content: 'Task' } } }])[0]).toMatchObject({ authorName: 'User B', authorMachineId: 'b' })
  })

  it('shows partial text while running and replaces it with the completed turn without duplicating', () => {
    const start = [
      { id: 'u', event: { type: 'user', message: { content: 'Hello' } } },
      { id: 'a1', event: { type: 'text_delta', text: 'Working' } },
      { id: 'a2', event: { type: 'text_delta', text: ' now' } },
    ]
    expect(readSharedTranscript(start)).toEqual([{ id: 'u', role: 'user', text: 'Hello' }, { id: 'a1', role: 'assistant', text: 'Working now' }])
    const completed = [...start, { id: 'r', event: { type: 'result', result: 'Working now. Done.' } }, { id: 'u2', event: { type: 'user', message: { content: 'Next' } } }, { id: 'a3', event: { type: 'text_delta', text: 'Second reply' } }]
    expect(readSharedTranscript(completed).map((item) => item.text)).toEqual(['Hello', 'Working now. Done.', 'Next', 'Second reply'])
  })
})
