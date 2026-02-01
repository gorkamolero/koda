import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useEffect, useCallback } from 'react'
import { atom, useAtomValue, useSetAtom } from 'jotai'
import { rpcRequest, onNotification } from '@/lib/tauri'
import {
  RPC_METHODS,
  type PulseInfo,
  type StartPulseParams,
  type PulseStatusNotification,
  type PulseLogNotification,
} from '@/lib/rpc'

// ============================================================================
// Atoms for Real-time State
// ============================================================================

/**
 * Map of worktreeId -> PulseInfo for real-time status updates
 */
export const pulseStatusAtom = atom<Record<string, PulseInfo>>({})

/**
 * Map of worktreeId -> log lines for real-time log updates
 */
export const pulseLogsAtom = atom<Record<string, PulseLogNotification[]>>({})

const MAX_LOG_LINES = 500

// ============================================================================
// Notification Hooks
// ============================================================================

/**
 * Hook to subscribe to pulse notifications
 * Call this once at the app root level
 */
export function usePulseNotifications() {
  const setStatus = useSetAtom(pulseStatusAtom)
  const setLogs = useSetAtom(pulseLogsAtom)

  useEffect(() => {
    let unsubStatus: (() => void) | undefined
    let unsubLogs: (() => void) | undefined

    const setup = async () => {
      unsubStatus = await onNotification<PulseStatusNotification>(
        'pulse.status',
        (notification) => {
          setStatus((prev) => ({
            ...prev,
            [notification.worktreeId]: {
              worktreeId: notification.worktreeId,
              status: notification.status,
              repoRootPath: prev[notification.worktreeId]?.repoRootPath ?? '',
              syncCount: notification.syncCount,
              lastSyncAt: notification.lastSyncAt,
              errorMessage: notification.errorMessage,
            },
          }))
        }
      )

      unsubLogs = await onNotification<PulseLogNotification>(
        'pulse.log',
        (notification) => {
          setLogs((prev) => {
            const existing = prev[notification.worktreeId] ?? []
            const updated = [...existing, notification].slice(-MAX_LOG_LINES)
            return { ...prev, [notification.worktreeId]: updated }
          })
        }
      )
    }

    void setup()

    return () => {
      unsubStatus?.()
      unsubLogs?.()
    }
  }, [setStatus, setLogs])
}

// ============================================================================
// Main Hook
// ============================================================================

/**
 * Hook to manage pulse for a specific worktree
 */
export function usePulse(worktreeId: string, repoRootPath: string) {
  const queryClient = useQueryClient()
  const statusMap = useAtomValue(pulseStatusAtom)
  const logsMap = useAtomValue(pulseLogsAtom)

  // Real-time status from notifications
  const realtimeStatus = statusMap[worktreeId]
  const logs = logsMap[worktreeId] ?? []

  // Query for initial status
  const statusQuery = useQuery({
    queryKey: ['pulse', 'status', worktreeId],
    queryFn: () =>
      rpcRequest<PulseInfo | null>(RPC_METHODS.PULSE_STATUS, {
        worktreeId,
      }),
    enabled: !!worktreeId,
  })

  // Merge realtime and query status (realtime takes precedence)
  const status: PulseInfo | null = realtimeStatus ?? statusQuery.data ?? null

  // Start mutation
  const startMutation = useMutation({
    mutationFn: (params: StartPulseParams) =>
      rpcRequest<PulseInfo>(RPC_METHODS.PULSE_START, params),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['pulse'] })
    },
  })

  // Stop mutation
  const stopMutation = useMutation({
    mutationFn: () =>
      rpcRequest<PulseInfo | null>(RPC_METHODS.PULSE_STOP, {
        worktreeId,
      }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['pulse'] })
    },
  })

  const start = useCallback(() => {
    startMutation.mutate({ worktreeId, repoRootPath })
  }, [worktreeId, repoRootPath, startMutation])

  const stop = useCallback(() => {
    stopMutation.mutate()
  }, [stopMutation])

  const isActive =
    status?.status === 'running' || status?.status === 'syncing'
  const isLoading =
    startMutation.isPending ||
    stopMutation.isPending ||
    status?.status === 'starting' ||
    status?.status === 'stopping'

  return {
    status,
    logs,
    isActive,
    isLoading,
    start,
    stop,
    error:
      startMutation.error ||
      stopMutation.error ||
      (status?.errorMessage ? new Error(status.errorMessage) : null),
  }
}

// ============================================================================
// Helper Hook
// ============================================================================

/**
 * Hook to list all active pulses
 */
export function useActivePulses() {
  return useQuery({
    queryKey: ['pulse', 'active'],
    queryFn: () => rpcRequest<PulseInfo[]>(RPC_METHODS.PULSE_LIST_ACTIVE),
    refetchInterval: 10000, // Poll every 10 seconds
  })
}
