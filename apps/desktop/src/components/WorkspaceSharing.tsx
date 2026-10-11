import { Button, Callout, Dialog, DialogContent, DialogHeader, DialogTitle, NavItem, SegmentedControl, Textarea } from '@koda/ui'
import { useState } from 'react'
import { atom, useAtom } from 'jotai'
import { useQueryClient } from '@tanstack/react-query'
import { Link, useNavigate, useParams } from '@tanstack/react-router'
import { Check, Copy, Share2 } from 'lucide-react'
import { rpcRequest } from '@/lib/tauri'
import { useCollaborationSetup } from '@/hooks/useCollaborationSetup'
import { useSharedWorkspaces, type Share, type SharePermission } from '@/hooks/useSharedWorkspaces'
import { cn } from '@/lib/utils'

const PERMISSIONS: { id: SharePermission; label: string; detail: string }[] = [
  { id: 'view', label: 'VIEW', detail: 'Sees the session, files and terminal live' },
  { id: 'control', label: 'CONTROL', detail: 'Also sends messages to the agent' },
]

function Modal({ title, onClose, children, label }: { title: string; label: string; onClose: () => void; children: React.ReactNode }) {
  return <Dialog open onOpenChange={open => { if (!open) onClose() }}>
    <DialogContent aria-label={label} aria-labelledby={undefined} aria-describedby={undefined} className="max-w-md bg-surface-card border-text-dim/30 shadow-none" footerClassName="border-text-dim/20 px-4 py-3" closeButtonClassName="h-auto rounded-none border-0 p-0 text-xs text-text-dim hover:bg-transparent hover:text-text-primary">
      <DialogHeader className="border-text-dim/20"><DialogTitle decorate={false} className="text-xs font-normal tracking-normal text-border-accent"><span aria-hidden="true">┌─ </span>{title}<span aria-hidden="true"> {'─'.repeat(Math.max(4, 28 - title.length))}</span></DialogTitle></DialogHeader>
      {children}
    </DialogContent>
  </Dialog>
}

function CollaborationSetupState({ onClose }: { onClose: () => void }) {
  const { data, isPending } = useCollaborationSetup()
  if (data?.enabled && data.reachable !== false) return null
  return <Callout className="text-xs text-text-muted border-text-dim/30 bg-transparent p-3 [&>svg]:hidden [&>div]:space-y-2" data-testid="collaboration-setup">
    <p>{isPending ? 'Checking collaboration...' : data?.enabled ? 'The collaboration service is unavailable. Check the service URL and your connection.' : 'Choose your display name and collaboration service in Settings to share or join a workspace.'}</p>
    {!isPending && <Link to="/settings" onClick={onClose} className="text-border-accent">[→] COLLABORATION SETTINGS</Link>}
  </Callout>
}

const actionButton = 'w-full p-3 text-xs border border-dashed border-border-accent/50 hover:border-border-accent text-border-accent hover:bg-border-accent/10 transition-colors disabled:opacity-50'
const errorBox = 'text-status-error text-xs border border-dashed border-status-error p-2'

type ShareDialogState = { open: boolean; permission: SharePermission; invitation: string; error: string; pending: boolean }
const defaultShareDialog: ShareDialogState = { open: false, permission: 'control', invitation: '', error: '', pending: false }
// Enabling collaboration inserts a RoomProvider and remounts its children. Keep
// the invitation dialog outside that component lifetime so the result remains visible.
const shareDialogsAtom = atom<Record<string, ShareDialogState>>({})

export function ShareWorkspaceButton({ worktreeId }: { worktreeId: string }) {
  const queryClient = useQueryClient()
  const { data: setup } = useCollaborationSetup()
  const [dialogs, setDialogs] = useAtom(shareDialogsAtom)
  const [copied, setCopied] = useState(false)
  const { open, permission, invitation, error, pending } = dialogs[worktreeId] || defaultShareDialog
  const update = (patch: Partial<ShareDialogState>) => setDialogs((previous) => ({ ...previous, [worktreeId]: { ...(previous[worktreeId] || defaultShareDialog), ...patch } }))
  async function create() {
    update({ pending: true, error: '', invitation: '' })
    try {
      const result = await rpcRequest<Share>('collaboration.share', { worktreeId, permission })
      update({ invitation: result.invitation })
      await queryClient.invalidateQueries()
    } catch (e) { update({ error: e instanceof Error ? e.message : String(e) }) }
    finally { update({ pending: false }) }
  }
  async function copy() {
    await navigator.clipboard.writeText(invitation)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }
  return <>
    <Button variant="unstyled"
      data-testid="share-workspace"
      onClick={() => update({ open: true })}
      className="flex items-center gap-1 px-2 py-1 text-xs border border-dashed border-border-subtle hover:border-text-accent hover:text-text-accent transition-colors"
    >
      <Share2 className="size-3" />
      <span>[SHARE]</span>
    </Button>
    {open && <Modal title="SHARE WORKSPACE" label="Share workspace" onClose={() => update({ open: false })}>
      <div className="p-4 space-y-4">
        <CollaborationSetupState onClose={() => update({ open: false })} />
        <p className="text-caption text-text-muted leading-relaxed">
          Your collaborator opens this workspace in their own Koda, with the same chat, changes, files and terminal you see. The agent keeps running on this machine. A new invitation replaces the previous one.
        </p>
        <div>
          <p className="text-2xs text-text-dim mb-2 uppercase">PERMISSION:</p>
          <SegmentedControl
            aria-label="Permission"
            value={permission}
            onValueChange={value => update({ permission: value as SharePermission, invitation: '' })}
            className="grid grid-cols-2 gap-2 rounded-none border-0 bg-transparent p-0"
            optionClassName="p-2 rounded-none text-left border border-dashed data-[state=checked]:ring-0"
            options={PERMISSIONS.map(option => ({ value: option.id, 'data-testid': `share-permission-${option.id}`, className: permission === option.id ? 'border-border-accent text-border-accent bg-border-accent/10 data-[state=checked]:bg-border-accent/10' : 'border-text-dim/30 text-text-muted hover:border-text-dim hover:bg-transparent', label: <><div className="text-xs">[{option.label}]</div><div className="text-2xs text-text-dim mt-1 leading-snug">{option.detail}</div></> }))}
          />
        </div>
        <Button variant="unstyled" className={actionButton} data-testid="create-invitation" disabled={pending || !setup?.enabled || setup.reachable === false} onClick={() => void create()}>
          {pending ? 'CONNECTING...' : '[+] CREATE INVITATION'}
        </Button>
        {invitation && <div>
          <div className="flex items-center justify-between mb-2">
            <p className="text-2xs text-text-dim uppercase">INVITATION · KEEP IT PRIVATE</p>
            <Button variant="unstyled" onClick={() => void copy()} className="flex items-center gap-1 text-2xs text-text-dim hover:text-border-accent transition-colors">
              {copied ? <Check className="size-3" /> : <Copy className="size-3" />}{copied ? '[COPIED]' : '[COPY]'}
            </Button>
          </div>
          <Textarea
            data-testid="share-invitation"
            readOnly
            value={invitation}
            rows={4}
            onFocus={(e) => e.target.select()}
            className="min-h-0 rounded-none w-full p-2 bg-transparent border border-dashed border-text-dim/30 text-2xs text-text-muted break-all resize-none outline-none focus:border-border-accent"
          />
        </div>}
        {error && <Callout tone="error" className={`${errorBox} bg-transparent [&>svg]:hidden`}>ERROR: {error}</Callout>}
      </div>
    </Modal>}
  </>
}

export function JoinSharedWorkspaceModal({ onClose }: { onClose: () => void }) {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const { data: setup } = useCollaborationSetup()
  const [invitation, setInvitation] = useState('')
  const [error, setError] = useState('')
  const [pending, setPending] = useState(false)
  async function join() {
    setError(''); setPending(true)
    try {
      const share = await rpcRequest<Share>('collaboration.join', { invitation })
      // A new invitation can change the permission of a workspace already on screen.
      await queryClient.invalidateQueries()
      onClose()
      void navigate({ to: '/workspace/$workspaceId/$worktreeId', params: { workspaceId: 'shared', worktreeId: share.worktreeId } })
    } catch (e) { setError(e instanceof Error ? e.message : String(e)) }
    finally { setPending(false) }
  }
  return (
    <Modal title="JOIN SHARED WORKSPACE" label="Join workspace" onClose={onClose}>
      <div className="p-4 space-y-4">
        <CollaborationSetupState onClose={onClose} />
        <div>
          <p className="text-2xs text-text-dim mb-2 uppercase">INVITATION:</p>
          <div className="flex items-start gap-2 border border-dashed border-text-dim/30 focus-within:border-border-accent p-2">
            <span className="text-text-dim">{'>'}</span>
            <Textarea
              data-testid="join-invitation"
              autoFocus
              rows={4}
              value={invitation}
              onChange={(e) => setInvitation(e.target.value)}
              placeholder="paste the invitation you received"
              className="min-h-0 p-0 border-0 rounded-none flex-1 bg-transparent text-caption text-text-primary placeholder:text-text-dim/50 outline-none resize-none break-all"
            />
          </div>
        </div>
        <Button variant="unstyled" data-testid="join-confirm" className={actionButton} disabled={!invitation.trim() || pending || !setup?.enabled || setup.reachable === false} onClick={() => void join()}>
          {pending ? 'JOINING...' : '[→] JOIN WORKSPACE'}
        </Button>
        {error && <Callout tone="error" className={`${errorBox} bg-transparent [&>svg]:hidden`}>ERROR: {error}</Callout>}
      </div>
    </Modal>
  )
}

function initials(name?: string) {
  return (name || '?').split(/\s+/).map((part) => part[0]).join('').toUpperCase().slice(0, 2)
}

/** Sidebar list of shared workspaces; each opens as a normal workspace view. */
export function SharedWorkspacesSection() {
  const { data: shares = [] } = useSharedWorkspaces()
  const params = useParams({ strict: false })
  const [joining, setJoining] = useState(false)
  return (
    <div className="px-1 mt-2 font-mono" data-testid="shared-workspaces">
      <div className="px-2 py-1.5 text-2xs text-text-dim">├─ SHARED WITH YOU ───────────</div>
      {shares.map((share) => {
        const active = params.worktreeId === share.worktreeId
        return (
          <NavItem key={share.roomId} asChild label={share.workspaceName || 'Shared workspace'} className="hover:bg-transparent" buttonClassName="rounded-none px-0 py-0"><Link
            data-testid="shared-workspace-link"
            to="/workspace/$workspaceId/$worktreeId"
            params={{ workspaceId: 'shared', worktreeId: share.worktreeId }}
            className={cn(
              'group flex items-center gap-2 px-2 py-1.5 text-xs border-l-2 border-transparent',
              'hover:bg-surface-hover hover:border-l-border-accent/50 transition-colors duration-75',
              active && 'bg-surface-hover border-l-border-accent'
            )}
          >
            <span className="w-3 text-border-accent">⇄</span>
            <span className={cn('w-12 font-bold', share.permission === 'control' ? 'text-status-success' : 'text-text-muted')}>
              [{share.permission === 'control' ? 'CTRL' : 'VIEW'}]
            </span>
            <span className={cn('flex-1 truncate text-text-primary group-hover:text-border-accent', active && 'text-border-accent')}>
              {share.workspaceName || 'Shared workspace'}
            </span>
            <span className="w-6 h-4 flex items-center justify-center text-micro text-text-dim border border-dashed border-text-dim/40" title={share.hostName ? `Hosted by ${share.hostName}` : undefined}>
              {initials(share.hostName)}
            </span>
          </Link></NavItem>
        )
      })}
      <Button variant="unstyled"
        data-testid="join-workspace"
        className="flex items-center gap-2 w-full px-2 py-1 text-xs text-text-dim hover:text-border-accent hover:bg-surface-hover transition-colors"
        onClick={() => setJoining(true)}
      >
        [+] JOIN SHARED WORKSPACE
      </Button>
      {joining && <JoinSharedWorkspaceModal onClose={() => setJoining(false)} />}
    </div>
  )
}
