import { useQuery } from '@tanstack/react-query'
import { rpcRequest } from '@/lib/tauri'

export type SharePermission = 'view' | 'control'
export type Share = {
  roomId: string
  worktreeId: string
  hostMachineId: string
  permission: SharePermission
  invitation: string
  workspaceName?: string
  hostName?: string
}

/** Workspaces other people shared with this machine. */
export function useSharedWorkspaces() {
  return useQuery({ queryKey: ['collaboration', 'joined'], queryFn: () => rpcRequest<Share[]>('collaboration.list'), retry: false })
}
