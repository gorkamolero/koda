/** Commands travel through Liveblocks and are authorized by the host sidecar. */
import { useCallback, useEffect, useRef, useState } from 'react'
import { useBroadcastEvent, useEventListener, type RoomEvent } from '@/lib/liveblocks'
import { rpcRequest } from '@/lib/tauri'

type RelayCommand = Extract<RoomEvent, { type: 'relay' }>
export function useRemoteMessageRelay(roomId: string, permission: 'view' | 'control') {
  const broadcast = useBroadcastEvent()
  const [pending, setPending] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const retry = useRef<RelayCommand | null>(null)
  const active = useRef<{ id: string; timer: ReturnType<typeof setTimeout>; resolve: () => void; reject: (error: Error) => void } | null>(null)
  useEffect(() => () => {
    if (active.current) {
      clearTimeout(active.current.timer)
      active.current.reject(new Error('Left the shared workspace before acknowledgement'))
      active.current = null
    }
  }, [])
  useEventListener(({ event }) => {
    if (event.type !== 'relay-result' || active.current?.id !== event.requestId) return
    const request = active.current
    clearTimeout(request.timer)
    active.current = null
    retry.current = null
    setPending(false)
    setError(event.error)
    if (event.error) request.reject(new Error(event.error))
    else request.resolve()
  })
  const send = useCallback(async (sessionId: string, content: string): Promise<void> => {
    if (permission !== 'control') throw new Error('View permission cannot send messages')
    if (active.current) throw new Error('A message is awaiting the host acknowledgement')
    setError(null)
    // If an acknowledgement was lost, retry the identical signed request. The host
    // persists its receipt and will acknowledge it without running the task twice.
    const previous = retry.current
    const command = previous?.roomId === roomId && previous.sessionId === sessionId && previous.content === content
      ? previous
      : await rpcRequest<RelayCommand>('collaboration.prepareRelay', { roomId, requestId: crypto.randomUUID(), sessionId, content })
    retry.current = command
    return new Promise<void>((resolve, reject) => {
      active.current = { id: command.requestId, resolve, reject, timer: setTimeout(() => {
        active.current = null
        setPending(false)
        const message = 'The host has not acknowledged this message. Check that the host is online, then retry.'
        setError(message)
        reject(new Error(message))
      }, 20000) }
      setPending(true)
      broadcast(command, { shouldQueueEventIfNotReady: false })
    })
  }, [broadcast, roomId, permission])
  return { send, pending, error }
}
