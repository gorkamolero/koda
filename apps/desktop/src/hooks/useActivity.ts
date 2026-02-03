import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { rpcRequest } from '@/lib/tauri'
import {
  RPC_METHODS,
  type Activity,
  type CreateActivityParams,
  type ListActivityParams,
  type MarkReadParams,
  type UnreadCountParams,
  type WorkspaceWithStatus,
} from '@/lib/rpc'

/**
 * Get all workspaces with their agent status
 * Used by the Agent Overview panel
 */
export function useWorkspacesWithStatus() {
  return useQuery({
    queryKey: ['workspaces-with-status'],
    queryFn: () => rpcRequest<WorkspaceWithStatus[]>(RPC_METHODS.ACTIVITY_GET_WORKSPACES_WITH_STATUS),
    refetchInterval: 5000, // Poll every 5 seconds for status updates
  })
}

/**
 * List activity entries for a workspace
 */
export function useActivity(workspaceId: string, options?: { limit?: number; unreadOnly?: boolean }) {
  return useQuery({
    queryKey: ['activity', workspaceId, options],
    queryFn: () => rpcRequest<Activity[]>(RPC_METHODS.ACTIVITY_LIST, {
      workspaceId,
      limit: options?.limit ?? 50,
      unreadOnly: options?.unreadOnly ?? false,
    } satisfies ListActivityParams),
    enabled: !!workspaceId,
    refetchInterval: 5000, // Poll every 5 seconds for new activity
  })
}

/**
 * Get unread count for a workspace
 */
export function useUnreadCount(workspaceId: string) {
  return useQuery({
    queryKey: ['activity-unread', workspaceId],
    queryFn: () => rpcRequest<{ count: number }>(RPC_METHODS.ACTIVITY_UNREAD_COUNT, {
      workspaceId,
    } satisfies UnreadCountParams),
    enabled: !!workspaceId,
    refetchInterval: 5000, // Poll every 5 seconds
  })
}

/**
 * Create activity entry mutation
 */
export function useCreateActivity() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (params: CreateActivityParams) =>
      rpcRequest<{ id: string }>(RPC_METHODS.ACTIVITY_CREATE, params),
    onSuccess: (_, variables) => {
      void queryClient.invalidateQueries({ queryKey: ['activity', variables.workspaceId] })
      void queryClient.invalidateQueries({ queryKey: ['activity-unread', variables.workspaceId] })
    },
  })
}

/**
 * Mark activities as read mutation
 */
export function useMarkRead() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (params: MarkReadParams) =>
      rpcRequest<{ updated: number }>(RPC_METHODS.ACTIVITY_MARK_READ, params),
    onSuccess: (_, variables) => {
      void queryClient.invalidateQueries({ queryKey: ['activity', variables.workspaceId] })
      void queryClient.invalidateQueries({ queryKey: ['activity-unread', variables.workspaceId] })
    },
  })
}
