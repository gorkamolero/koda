import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useEffect, useState, useRef } from 'react'
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
  type Worktree,
  type CreateWorkspaceParams,
  type ListWorkspacesParams,
  type SidecarStatus,
  type HealthResponse,
  type Repo,
  type CreateRepoParams,
  type CreateWorktreeParams,
  type CheckpointDiff,
  type Session,
  type WorkspaceRepo,
  type AttachRepoParams,
  type DetachRepoParams,
  type CreateStandaloneWorkspaceParams,
} from '@/lib/rpc'

/**
 * Hook to manage sidecar lifecycle
 */
export function useSidecar() {
  const [status, setStatus] = useState<SidecarStatus | null>(null)
  const [error, setError] = useState<string | null>(null)
  const errorTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Listen to sidecar status events
  useEffect(() => {
    let unlistenStatus: (() => void) | undefined
    let unlistenError: (() => void) | undefined
    let mounted = true

    const setupListeners = async () => {
      unlistenStatus = await onSidecarStatus((newStatus) => {
        if (mounted) {
          setStatus(newStatus)
          // Clear error when we get a successful status update
          if (newStatus.running) {
            setError(null)
          }
        }
      })

      unlistenError = await onRpcError((err) => {
        if (mounted) {
          // Only show persistent errors for critical connection issues
          // Clear transient errors after 3 seconds
          setError(`RPC Error (${err.method}): ${err.error.message}`)
          
          // Clear previous timeout
          if (errorTimeoutRef.current) {
            clearTimeout(errorTimeoutRef.current)
          }
          
          // Auto-clear error after 3 seconds for transient issues
          errorTimeoutRef.current = setTimeout(() => {
            if (mounted) {
              setError(null)
            }
          }, 3000)
        }
      })
    }

    void setupListeners()

    return () => {
      mounted = false
      unlistenStatus?.()
      unlistenError?.()
      if (errorTimeoutRef.current) {
        clearTimeout(errorTimeoutRef.current)
      }
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

// Note: Workspace diff stats has been removed in the rearchitecture.
// Diff stats should now be computed per-worktree, not per-workspace.

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

// ============================================================================
// Repo Hooks
// ============================================================================

/**
 * List all registered repos
 */
export function useRepos() {
  return useQuery({
    queryKey: ['repos'],
    queryFn: () => rpcRequest<Repo[]>(RPC_METHODS.REPO_LIST),
    retry: false,
  })
}

/**
 * Get a single repo
 */
export function useRepo(id: string) {
  return useQuery({
    queryKey: ['repo', id],
    queryFn: () => rpcRequest<Repo>(RPC_METHODS.REPO_GET, { id }),
    enabled: !!id,
    retry: false,
  })
}

/**
 * Register a new repo
 */
export function useCreateRepo() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (params: CreateRepoParams) =>
      rpcRequest<Repo>(RPC_METHODS.REPO_CREATE, params),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['repos'] })
    },
  })
}

/**
 * Delete a repo
 */
export function useDeleteRepo() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (id: string) =>
      rpcRequest<{ success: boolean }>(RPC_METHODS.REPO_DELETE, { id }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['repos'] })
    },
  })
}

// ============================================================================
// Worktree Hooks
// ============================================================================

/**
 * Create a worktree (creates worktree record + git worktree)
 */
export function useCreateWorktree() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (params: CreateWorktreeParams) =>
      rpcRequest<Worktree>(RPC_METHODS.WORKTREE_CREATE, params),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['workspaces'] })
      void queryClient.invalidateQueries({ queryKey: ['worktrees'] })
    },
  })
}

/**
 * List worktrees for a repo
 */
export function useWorktrees(repoId: string) {
  return useQuery({
    queryKey: ['worktrees', repoId],
    queryFn: () => rpcRequest<Worktree[]>(RPC_METHODS.WORKTREE_LIST, { repoId }),
    enabled: !!repoId,
    retry: false,
  })
}

/**
 * Delete a worktree
 */
export function useDeleteWorktree() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (params: { worktreeId: string; deleteBranch?: boolean }) =>
      rpcRequest<Worktree>(RPC_METHODS.WORKTREE_DELETE, params),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['workspaces'] })
      void queryClient.invalidateQueries({ queryKey: ['worktrees'] })
    },
  })
}

// ============================================================================
// Workspace Repo Hooks (Multi-repo support)
// ============================================================================

/**
 * Create a standalone workspace (no repo attached)
 * Useful for cloud-first workspaces or when repo will be attached later
 */
export function useCreateStandaloneWorkspace() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (params: CreateStandaloneWorkspaceParams) =>
      rpcRequest<Workspace>(RPC_METHODS.WORKSPACE_CREATE_STANDALONE, params),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['workspaces'] })
    },
  })
}

/**
 * List repos attached to a workspace
 */
export function useWorkspaceRepos(workspaceId: string) {
  return useQuery({
    queryKey: ['workspace-repos', workspaceId],
    queryFn: () => rpcRequest<WorkspaceRepo[]>(RPC_METHODS.WORKSPACE_REPO_LIST, { workspaceId }),
    enabled: !!workspaceId,
    retry: false,
  })
}

/**
 * Attach a repo to a workspace
 */
export function useAttachRepo() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (params: AttachRepoParams) =>
      rpcRequest<WorkspaceRepo>(RPC_METHODS.WORKSPACE_REPO_ATTACH, params),
    onSuccess: (_, variables) => {
      void queryClient.invalidateQueries({ queryKey: ['workspace-repos', variables.workspaceId] })
      void queryClient.invalidateQueries({ queryKey: ['workspaces'] })
    },
  })
}

/**
 * Detach a repo from a workspace
 */
export function useDetachRepo() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (params: DetachRepoParams) =>
      rpcRequest<{ success: boolean }>(RPC_METHODS.WORKSPACE_REPO_DETACH, params),
    onSuccess: (_, variables) => {
      void queryClient.invalidateQueries({ queryKey: ['workspace-repos', variables.workspaceId] })
      void queryClient.invalidateQueries({ queryKey: ['workspaces'] })
    },
  })
}

// ============================================================================
// Checkpoint Hooks
// ============================================================================

/**
 * Get diff between two checkpoints
 */
export function useCheckpointDiff(checkpointId1: string, checkpointId2: string, repoPath: string) {
  return useQuery({
    queryKey: ['checkpoint-diff', checkpointId1, checkpointId2],
    queryFn: () =>
      rpcRequest<CheckpointDiff>(RPC_METHODS.CHECKPOINT_DIFF, {
        checkpointId1,
        checkpointId2,
        repoPath,
      }),
    enabled: !!checkpointId1 && !!checkpointId2 && !!repoPath,
    retry: false,
  })
}

/**
 * List checkpoints for a worktree
 */
export function useCheckpoints(worktreeId: string) {
  return useQuery({
    queryKey: ['checkpoints', worktreeId],
    queryFn: () =>
      rpcRequest<{ id: string; turnId: string; createdAt: string }[]>(
        RPC_METHODS.CHECKPOINT_LIST,
        { worktreeId }
      ),
    enabled: !!worktreeId,
    retry: false,
  })
}

// ============================================================================
// Session Hooks
// ============================================================================

/**
 * List sessions for a worktree
 */
export function useSessions(worktreeId: string) {
  return useQuery({
    queryKey: ['sessions', worktreeId],
    queryFn: () => rpcRequest<Session[]>(RPC_METHODS.SESSION_LIST, { worktreeId }),
    enabled: !!worktreeId,
    retry: false,
    refetchInterval: 5000, // Poll every 5 seconds to catch status changes
  })
}

/**
 * Create a new session
 */
export function useCreateSession() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (params: { worktreeId: string; model?: string; agentType?: string }) =>
      rpcRequest<Session>(RPC_METHODS.SESSION_CREATE, params),
    onSuccess: (_, variables) => {
      void queryClient.invalidateQueries({ queryKey: ['sessions', variables.worktreeId] })
    },
  })
}
