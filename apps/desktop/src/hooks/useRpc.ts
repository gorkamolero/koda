import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useEffect, useState } from 'react'
import {
  rpcRequest,
  spawnSidecar,
  stopSidecar,
  getSidecarStatus,
  onSidecarStatus,
  onRpcError,
} from '@/lib/tauri'
import {
  RPC_METHODS,
  type Workspace,
  type CreateWorkspaceParams,
  type ListWorkspacesParams,
  type SidecarStatus,
  type HealthResponse,
} from '@/lib/rpc'

/**
 * Hook to manage sidecar lifecycle
 */
export function useSidecar() {
  const [status, setStatus] = useState<SidecarStatus | null>(null)
  const [error, setError] = useState<string | null>(null)

  // Listen to sidecar status events
  useEffect(() => {
    let unlistenStatus: (() => void) | undefined
    let unlistenError: (() => void) | undefined
    let mounted = true

    const setupListeners = async () => {
      unlistenStatus = await onSidecarStatus((newStatus) => {
        if (mounted) {
          setStatus(newStatus)
          setError(null)
        }
      })

      unlistenError = await onRpcError((err) => {
        if (mounted) {
          setError(`RPC Error (${err.method}): ${err.error.message}`)
        }
      })
    }

    void setupListeners()

    return () => {
      mounted = false
      unlistenStatus?.()
      unlistenError?.()
    }
  }, [])

  // Query for initial status
  const statusQuery = useQuery({
    queryKey: ['sidecar-status'],
    queryFn: getSidecarStatus,
    refetchInterval: 10000, // Poll every 10 seconds
  })

  // Update local status from query
  useEffect(() => {
    if (statusQuery.data) {
      setStatus(statusQuery.data)
    }
  }, [statusQuery.data])

  const queryClient = useQueryClient()

  const spawn = useMutation({
    mutationFn: spawnSidecar,
    onSuccess: (data) => {
      setStatus(data)
      void queryClient.invalidateQueries({ queryKey: ['sidecar-status'] })
    },
    onError: (err) => {
      setError(err instanceof Error ? err.message : String(err))
    },
  })

  const stop = useMutation({
    mutationFn: stopSidecar,
    onSuccess: (data) => {
      setStatus(data)
      void queryClient.invalidateQueries({ queryKey: ['sidecar-status'] })
    },
    onError: (err) => {
      setError(err instanceof Error ? err.message : String(err))
    },
  })

  return {
    status,
    error,
    isLoading: statusQuery.isLoading || spawn.isPending || stop.isPending,
    spawn: spawn.mutate,
    stop: stop.mutate,
    refetch: statusQuery.refetch,
  }
}

/**
 * Ping/pong health check from sidecar
 */
export function usePing() {
  return useQuery({
    queryKey: ['rpc', 'ping'],
    queryFn: () => rpcRequest<string>(RPC_METHODS.PING),
    retry: false,
  })
}

/**
 * Full health status from sidecar
 */
export function useHealth() {
  return useQuery({
    queryKey: ['rpc', 'health'],
    queryFn: () => rpcRequest<HealthResponse>(RPC_METHODS.GET_STATUS),
    refetchInterval: 5000, // Poll every 5 seconds
    retry: false,
  })
}

/**
 * Workspace list hook
 */
export function useWorkspaces(params?: ListWorkspacesParams) {
  return useQuery({
    queryKey: ['workspaces', params],
    queryFn: () => rpcRequest<Workspace[]>(RPC_METHODS.WORKSPACE_LIST, params),
    retry: false,
  })
}

/**
 * Single workspace hook
 */
export function useWorkspace(id: string) {
  return useQuery({
    queryKey: ['workspace', id],
    queryFn: () => rpcRequest<Workspace>(RPC_METHODS.WORKSPACE_GET, { id }),
    enabled: !!id,
    retry: false,
  })
}

/**
 * Create workspace mutation
 */
export function useCreateWorkspace() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (params: CreateWorkspaceParams) =>
      rpcRequest<Workspace>(RPC_METHODS.WORKSPACE_CREATE, params),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['workspaces'] })
    },
  })
}
