import { useQuery } from '@tanstack/react-query'
import { rpcRequest } from '@/lib/tauri'

export type CollaborationSetup = {
  enabled: boolean; reachable: boolean; mode: 'development-key' | 'service' | 'not-configured'
  name: string; machineId: string; serviceUrl: string
  settings: { displayName: string; serviceUrl: string }
}
export function useCollaborationSetup(enabled = true) {
  return useQuery({ queryKey: ['collaboration', 'setup'], queryFn: () => rpcRequest<CollaborationSetup>('collaboration.status'), enabled, retry: false, staleTime: 5000 })
}
