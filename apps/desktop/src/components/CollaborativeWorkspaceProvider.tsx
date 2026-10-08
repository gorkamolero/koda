import { createContext, useContext, type ReactNode } from 'react'
import { useQuery } from '@tanstack/react-query'
import { RoomProvider, createInitialStorage, getWorkspaceRoomId } from '@/lib/liveblocks'
import { getMachineName, getUserColor } from '@/lib/machineId'
import { rpcRequest } from '@/lib/tauri'

const CollaborationContext = createContext(false)

export function CollaborativeWorkspaceProvider({ workspaceId, collaborative = false, userName, children }: {
  workspaceId: string; collaborative?: boolean; userName?: string; children: ReactNode
}) {
  const { data: identity } = useQuery({
    queryKey: ['collaboration', 'identity'],
    queryFn: () => rpcRequest<{ enabled: boolean; machineId: string; name: string }>('collaboration.status'),
    enabled: collaborative,
    retry: false,
  })
  if (!collaborative || !identity?.enabled) return <>{children}</>
  return (
    <CollaborationContext.Provider value={true}>
      <RoomProvider id={getWorkspaceRoomId(workspaceId)} initialStorage={createInitialStorage}
        initialPresence={{ name: userName || identity.name || getMachineName(), color: getUserColor(), machineId: identity.machineId, activeSessionId: null, cursorFile: null, cursorLine: null }}>
        {children}
      </RoomProvider>
    </CollaborationContext.Provider>
  )
}

export function useIsCollaborationAvailable() { return useContext(CollaborationContext) }
