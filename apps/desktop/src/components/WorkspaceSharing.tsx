import { useEffect, useMemo, useState } from 'react'
import { atom, useAtom } from 'jotai'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { rpcRequest } from '@/lib/tauri'
import { readSharedTranscript, type SharedTranscriptRow } from '@/lib/collaborationTranscript'
import { useStorage, useStatus } from '@/lib/liveblocks'
import { usePresence, useSessionSync } from '@/hooks/useCollaboration'
import { useRemoteMessageRelay } from '@/hooks/useRemoteMessageRelay'
import { CollaborativeWorkspaceProvider, useIsCollaborationAvailable } from './CollaborativeWorkspaceProvider'
import { PresenceAvatars } from './PresenceAvatars'

type Share = { roomId: string; worktreeId: string; permission: 'view' | 'control'; invitation: string }
const button = 'px-3 py-1.5 text-xs border border-border-subtle rounded hover:bg-surface-hover disabled:opacity-40'
const field = 'w-full p-2 bg-surface-messages border border-border-subtle rounded text-sm'

type ShareDialogState = { open: boolean; permission: 'view' | 'control'; invitation: string; error: string; pending: boolean }
const defaultShareDialog: ShareDialogState = { open: false, permission: 'view', invitation: '', error: '', pending: false }
// Enabling collaboration inserts a RoomProvider and remounts its children. Keep
// the invitation dialog outside that component lifetime so the result remains visible.
const shareDialogsAtom = atom<Record<string, ShareDialogState>>({})

export function ShareWorkspaceButton({ worktreeId }: { worktreeId: string }) {
  const queryClient = useQueryClient()
  const [dialogs, setDialogs] = useAtom(shareDialogsAtom)
  const { open, permission, invitation, error, pending } = dialogs[worktreeId] || defaultShareDialog
  const update = (patch: Partial<ShareDialogState>) => setDialogs((previous) => ({ ...previous, [worktreeId]: { ...(previous[worktreeId] || defaultShareDialog), ...patch } }))
  const setOpen = (value: boolean) => update({ open: value })
  const setPermission = (value: 'view' | 'control') => update({ permission: value })
  const setInvitation = (value: string) => update({ invitation: value })
  const setError = (value: string) => update({ error: value })
  const setPending = (value: boolean) => update({ pending: value })
  async function create() {
    setPending(true); setError(''); setInvitation('')
    try {
      const result = await rpcRequest<Share>('collaboration.share', { worktreeId, permission })
      setInvitation(result.invitation)
      await queryClient.invalidateQueries()
    } catch (e) { setError(e instanceof Error ? e.message : String(e)) }
    finally { setPending(false) }
  }
  return <>
    <button className={button} data-testid="share-workspace" onClick={() => setOpen(true)}>Share workspace</button>
    {open && <div className="fixed inset-0 z-[100] bg-black/70 flex items-center justify-center" role="dialog" aria-label="Share workspace">
      <div className="w-[520px] bg-surface-card border border-border-subtle p-6 rounded-lg space-y-4">
        <h2 className="text-lg">Share workspace</h2>
        <p className="text-sm text-text-muted">Anyone with this invitation can access this workspace. Creating a new invitation replaces previous invitations and their control permission. Keep it private.</p>
        <label className="block text-sm">Permission
          <select data-testid="share-permission" className={field} value={permission} onChange={(e) => { setPermission(e.target.value as 'view' | 'control'); setInvitation('') }}>
            <option value="view">View — watch the conversation</option>
            <option value="control">Control — send messages to Codex</option>
          </select>
        </label>
        <button className={button} data-testid="create-invitation" disabled={pending} onClick={() => void create()}>{pending ? 'Connecting…' : 'Create invitation'}</button>
        {invitation && <label className="block text-sm">Copy this invitation to your collaborator
          <textarea className={field} data-testid="share-invitation" readOnly value={invitation} rows={4} onFocus={(e) => e.target.select()} />
        </label>}
        {error && <p role="alert" className="text-red-400 text-sm">{error}</p>}
        <button className={button} onClick={() => setOpen(false)}>Close</button>
      </div>
    </div>}
  </>
}

export function SharedWorkspaceLauncher() {
  const [open, setOpen] = useState(false)
  const [invitation, setInvitation] = useState('')
  const [error, setError] = useState('')
  const [selected, setSelected] = useState<Share | null>(null)
  const { data: shares = [], refetch } = useQuery({ queryKey: ['collaboration', 'joined'], queryFn: () => rpcRequest<Share[]>('collaboration.list'), retry: false })
  async function join() {
    setError('')
    try {
      const share = await rpcRequest<Share>('collaboration.join', { invitation })
      await refetch(); setSelected(share); setOpen(false)
    } catch (e) { setError(e instanceof Error ? e.message : String(e)) }
  }
  return <>
    <button data-testid="join-workspace" className={`${button} fixed bottom-3 left-3 z-40 bg-surface-card`} onClick={() => setOpen(true)}>Shared workspaces</button>
    {open && <div className="fixed inset-0 z-[100] bg-black/70 flex items-center justify-center" role="dialog" aria-label="Join workspace">
      <div className="w-[520px] bg-surface-card border border-border-subtle p-6 rounded-lg space-y-4">
        <h2 className="text-lg">Join a shared workspace</h2>
        <textarea data-testid="join-invitation" className={field} placeholder="Paste workspace invitation" rows={4} value={invitation} onChange={(e) => setInvitation(e.target.value)} />
        <button data-testid="join-confirm" className={button} disabled={!invitation.trim()} onClick={() => void join()}>Join workspace</button>
        {error && <p role="alert" className="text-red-400">{error}</p>}
        {shares.map((share) => <button key={share.roomId} className={`${button} block w-full`} onClick={() => { setSelected(share); setOpen(false) }}>Open shared workspace · {share.permission}</button>)}
        <button className={button} onClick={() => setOpen(false)}>Close</button>
      </div>
    </div>}
    {selected && <div className="fixed inset-0 z-50 bg-surface-messages">
      <CollaborativeWorkspaceProvider workspaceId={selected.worktreeId} collaborative>
        <SharedWorkspaceGate share={selected} close={() => setSelected(null)} />
      </CollaborativeWorkspaceProvider>
    </div>}
  </>
}

function SharedWorkspaceGate(props: { share: Share; close: () => void }) {
  const available = useIsCollaborationAvailable()
  return available ? <SharedWorkspace {...props} /> : <div className="p-6">Connecting to collaboration… <button onClick={props.close}>Close</button></div>
}

function SharedWorkspace({ share, close }: { share: Share; close: () => void }) {
  const { sessions } = useSessionSync()
  const { peers, setActiveSession } = usePresence()
  const metadata = useStorage((root) => root.workspace)
  const transcripts = useStorage((root) => root.transcripts)
  const status = useStatus()
  const [selectedId, selectId] = useState('')
  const [prompt, setPrompt] = useState('')
  const [sendError, setSendError] = useState('')
  const { send, pending, error } = useRemoteMessageRelay(share.roomId, share.permission)
  const sessionId = sessions.some((session) => session.id === selectedId) ? selectedId : sessions[0]?.id || ''
  useEffect(() => { setActiveSession(sessionId || null) }, [sessionId, setActiveSession])
  const session = sessions.find((item) => item.id === sessionId)
  const messages = useMemo(() => {
    try {
      const rows = JSON.parse(transcripts?.get(sessionId) || '[]') as SharedTranscriptRow[]
      return readSharedTranscript(rows)
    } catch { return [] }
  }, [transcripts, sessionId])
  const canSend = share.permission === 'control' && status === 'connected' && !!sessionId && session?.status !== 'running' && !pending
  async function submit() {
    if (!canSend || !prompt.trim()) return
    try { setSendError(''); await send(sessionId, prompt); setPrompt('') } catch (e) { setSendError(e instanceof Error ? e.message : String(e)) }
  }
  return <div className="h-full flex flex-col" data-testid="shared-workspace">
    <header className="border-b border-border-subtle p-4 flex items-center gap-4">
      <button className={button} onClick={close}>Back to local workspaces</button>
      <h1 className="font-semibold" data-testid="shared-workspace-name">{metadata?.name || 'Shared workspace'}</h1>
      <span data-testid="shared-permission" className="text-text-muted text-xs">{share.permission}</span>
      <span data-testid="shared-status" className="text-xs">{status}</span>
      <PresenceAvatars />
      <span data-testid="shared-presence" className="text-sm">{peers.map((peer) => peer.name).join(', ')}</span>
    </header>
    <div className="flex flex-1 min-h-0">
      <nav className="w-56 p-4 border-r border-border-subtle space-y-2" aria-label="Shared sessions">
        <h2 className="text-xs text-text-muted">Sessions</h2>
        {sessions.map((item) => <button data-testid="shared-session" key={item.id} className={`${button} block w-full text-left ${sessionId === item.id ? 'text-text-accent' : ''}`} onClick={() => selectId(item.id)}>{item.title || 'Codex session'} <span className="block text-text-muted">{item.agentType} · {item.status}</span></button>)}
      </nav>
      <section className="flex flex-col flex-1 min-w-0">
        <div data-testid="shared-messages" className="flex-1 overflow-auto p-6 space-y-5">
          {messages.map((message) => <article key={message.id} data-testid={`shared-message-${message.role}`} className="max-w-3xl mx-auto whitespace-pre-wrap text-sm"><div className="text-xs text-text-muted mb-1">{message.role === 'user' ? message.authorName || 'User' : message.role === 'error' ? 'Error' : 'Codex'}</div>{message.text}</article>)}
          {session?.status === 'running' && <p data-testid="shared-running" className="text-text-accent text-sm">Codex is working…</p>}
        </div>
        <form className="p-4 border-t border-border-subtle space-y-2" onSubmit={(event) => { event.preventDefault(); void submit() }}>
          {share.permission === 'view' && <p data-testid="view-only-notice" className="text-sm text-text-muted">View only — you can watch this workspace, but cannot send messages.</p>}
          <textarea data-testid="shared-composer" aria-label="Message shared Codex session" className={field} disabled={!canSend} rows={3} value={prompt} onChange={(e) => setPrompt(e.target.value)} placeholder="Send a task to the host’s Codex session" />
          <button data-testid="shared-send" className={button} disabled={!canSend || !prompt.trim()} type="submit">{pending ? 'Sending…' : 'Send'}</button>
          {(error || sendError) && <p role="alert" className="text-red-400 text-sm">{error || sendError}</p>}
        </form>
      </section>
    </div>
  </div>
}
