import { z } from 'zod'
import { router } from '../rpc/router.js'
import { routeRemoteCall } from './guest.js'
import { collaborationStatus, setCollaborationSettings, deleteCollaborationRoom, authorizeRoom, getInvitation, getSyncManager, initializeCollaboration, isCollaborationEnabled, joinWorkspace, listSharedWorkspaces, prepareRelay, shareWorkspace } from './LiveblocksClient.js'

export function registerCollaborationMethods() {
  router.register('collaboration.status', collaborationStatus)
  router.register('collaboration.settings', async (settings) => setCollaborationSettings(settings), z.object({ displayName: z.string().trim().max(100), serviceUrl: z.string().trim().max(2048) }))
  router.register('collaboration.deleteRoom', async ({ roomId }) => deleteCollaborationRoom(roomId), z.object({ roomId: z.string() }))
  router.register('collaboration.share', async ({ worktreeId, permission }) => shareWorkspace(worktreeId, permission), z.object({ worktreeId: z.string().uuid(), permission: z.enum(['view', 'control']) }))
  router.register('collaboration.join', async ({ invitation }) => joinWorkspace(invitation), z.object({ invitation: z.string().min(1).max(8192) }))
  router.register('collaboration.list', async () => isCollaborationEnabled() ? listSharedWorkspaces() : [])
  router.register('collaboration.prepareRelay', async ({ roomId, sessionId, content, requestId }) => prepareRelay(roomId, sessionId, content, requestId), z.object({ roomId: z.string(), sessionId: z.string(), content: z.string().min(1).max(32000), requestId: z.string().uuid() }))
  router.register('collaboration.invitation', async ({ roomId }) => getInvitation(roomId), z.object({ roomId: z.string() }))
  router.register('collaboration.auth', async ({ roomId, name }) => authorizeRoom(roomId, name), z.object({ roomId: z.string(), name: z.string().max(100).optional() }))
  // The same authoritative receiver used by the realtime relay. Exposed locally for
  // retries/diagnostics and for negative authorization tests; it never trusts UI permission.
  router.register('collaboration.relay', async (input) => getSyncManager(input.worktreeId).receive({ ...input, type: 'relay' }), z.object({ worktreeId: z.string().uuid(), roomId: z.string(), grantId: z.string(), signature: z.string(), authorName: z.string().max(100).optional(), authorMachineId: z.string().max(100).optional(), requestId: z.string(), sessionId: z.string(), content: z.string() }))
  // Calls about a joined workspace are answered by its host.
  router.setInterceptor(routeRemoteCall)
  initializeCollaboration()
}
