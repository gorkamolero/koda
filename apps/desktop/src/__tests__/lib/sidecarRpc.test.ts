import { describe, expect, it, vi } from 'vitest'

const { onNotification } = vi.hoisted(() => ({ onNotification: vi.fn(async (_method: string, _callback: (params: unknown) => void) => () => {}) }))
vi.mock('@/lib/tauri', () => ({ onNotification }))

describe('sidecar notification listener', () => {
  it('subscribes once however often the layout starts it', async () => {
    const { startSidecarRpcListener, onPtyData, stopSidecarRpcListener } = await import('@/lib/sidecarRpc')
    await Promise.all([startSidecarRpcListener(), startSidecarRpcListener(), startSidecarRpcListener()])
    expect(onNotification.mock.calls.filter(([method]) => method === 'pty.data')).toHaveLength(1)
    const received: string[] = []
    const stop = onPtyData(payload => received.push(payload.data))
    const deliver = onNotification.mock.calls.find(([method]) => method === 'pty.data')![1]
    deliver({ sessionId: 'p1', data: 'ls\r\n' })
    expect(received).toEqual(['ls\r\n'])
    stop()
    stopSidecarRpcListener()
  })
})
