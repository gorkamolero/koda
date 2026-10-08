import { useRef, useState } from 'react'
import { atom, useAtom } from 'jotai'
import { useQueryClient } from '@tanstack/react-query'
import { Link, useNavigate, useParams } from '@tanstack/react-router'
import { Check, Copy, Share2 } from 'lucide-react'
import { rpcRequest } from '@/lib/tauri'
import { useClickOutside } from '@/hooks/useClickOutside'
import { useSharedWorkspaces, type Share, type SharePermission } from '@/hooks/useSharedWorkspaces'
import { cn } from '@/lib/utils'

const PERMISSIONS: { id: SharePermission; label: string; detail: string }[] = [
  { id: 'view', label: 'VIEW', detail: 'Sees the session, files and terminal live' },
  { id: 'control', label: 'CONTROL', detail: 'Also sends messages to the agent' },
]

function Modal({ title, onClose, children, label }: { title: string; label: string; onClose: () => void; children: React.ReactNode }) {
  const ref = useRef<HTMLDivElement>(null)
  useClickOutside(ref, { onClickOutside: onClose, onEscape: onClose, enabled: true })
  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 animate-in fade-in duration-150" role="dialog" aria-label={label}>
      <div ref={ref} className="w-full max-w-md mx-4 animate-in zoom-in-95 slide-in-from-bottom-2 duration-200">
        <div className="bg-surface-card border border-dashed border-text-dim/30 font-mono">
          <div className="px-4 py-3 border-b border-dashed border-text-dim/20">
            <div className="text-xs text-border-accent">┌─ {title} {'─'.repeat(Math.max(4, 28 - title.length))}</div>
          </div>
          {children}
          <div className="px-4 py-3 border-t border-dashed border-text-dim/20 flex justify-end">
            <button onClick={onClose} className="text-xs text-text-dim hover:text-text-primary transition-colors">[ESC] CLOSE</button>
          </div>
        </div>
      </div>
    </div>
  )
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
    <button
      data-testid="share-workspace"
      onClick={() => update({ open: true })}
      className="flex items-center gap-1 px-2 py-1 text-xs border border-dashed border-border-subtle hover:border-text-accent hover:text-text-accent transition-colors"
    >
      <Share2 className="size-3" />
      <span>[SHARE]</span>
    </button>
    {open && <Modal title="SHARE WORKSPACE" label="Share workspace" onClose={() => update({ open: false })}>
      <div className="p-4 space-y-4">
        <p className="text-[11px] text-text-muted leading-relaxed">
          Your collaborator opens this workspace in their own Koda, with the same chat, changes, files and terminal you see. The agent keeps running on this machine. A new invitation replaces the previous one.
        </p>
        <div>
          <p className="text-[10px] text-text-dim mb-2 uppercase">PERMISSION:</p>
          <div className="grid grid-cols-2 gap-2" role="radiogroup" aria-label="Permission">
            {PERMISSIONS.map((option) => (
              <button
                key={option.id}
                role="radio"
                aria-checked={permission === option.id}
                data-testid={`share-permission-${option.id}`}
                onClick={() => update({ permission: option.id, invitation: '' })}
                className={cn(
                  'p-2 text-left border border-dashed transition-colors',
                  permission === option.id ? 'border-border-accent text-border-accent bg-border-accent/10' : 'border-text-dim/30 text-text-muted hover:border-text-dim'
                )}
              >
                <div className="text-xs">[{option.label}]</div>
                <div className="text-[10px] text-text-dim mt-1 leading-snug">{option.detail}</div>
              </button>
            ))}
          </div>
        </div>
        <button className={actionButton} data-testid="create-invitation" disabled={pending} onClick={() => void create()}>
          {pending ? 'CONNECTING...' : '[+] CREATE INVITATION'}
        </button>
        {invitation && <div>
          <div className="flex items-center justify-between mb-2">
            <p className="text-[10px] text-text-dim uppercase">INVITATION · KEEP IT PRIVATE</p>
            <button onClick={() => void copy()} className="flex items-center gap-1 text-[10px] text-text-dim hover:text-border-accent transition-colors">
              {copied ? <Check className="size-3" /> : <Copy className="size-3" />}{copied ? '[COPIED]' : '[COPY]'}
            </button>
          </div>
          <textarea
            data-testid="share-invitation"
            readOnly
            value={invitation}
            rows={4}
            onFocus={(e) => e.target.select()}
            className="w-full p-2 bg-transparent border border-dashed border-text-dim/30 text-[10px] text-text-muted break-all resize-none outline-none focus:border-border-accent"
          />
        </div>}
        {error && <p role="alert" className={errorBox}>ERROR: {error}</p>}
      </div>
    </Modal>}
  </>
}

export function JoinSharedWorkspaceModal({ onClose }: { onClose: () => void }) {
  const navigate = useNavigate()
  const { refetch } = useSharedWorkspaces()
  const [invitation, setInvitation] = useState('')
  const [error, setError] = useState('')
  const [pending, setPending] = useState(false)
  async function join() {
    setError(''); setPending(true)
    try {
      const share = await rpcRequest<Share>('collaboration.join', { invitation })
      await refetch()
      onClose()
      void navigate({ to: '/workspace/$workspaceId/$worktreeId', params: { workspaceId: 'shared', worktreeId: share.worktreeId } })
    } catch (e) { setError(e instanceof Error ? e.message : String(e)) }
    finally { setPending(false) }
  }
  return (
    <Modal title="JOIN SHARED WORKSPACE" label="Join workspace" onClose={onClose}>
      <div className="p-4 space-y-4">
        <div>
          <p className="text-[10px] text-text-dim mb-2 uppercase">INVITATION:</p>
          <div className="flex items-start gap-2 border border-dashed border-text-dim/30 focus-within:border-border-accent p-2">
            <span className="text-text-dim">{'>'}</span>
            <textarea
              data-testid="join-invitation"
              autoFocus
              rows={4}
              value={invitation}
              onChange={(e) => setInvitation(e.target.value)}
              placeholder="paste the invitation you received"
              className="flex-1 bg-transparent text-[11px] text-text-primary placeholder:text-text-dim/50 outline-none resize-none break-all"
            />
          </div>
        </div>
        <button data-testid="join-confirm" className={actionButton} disabled={!invitation.trim() || pending} onClick={() => void join()}>
          {pending ? 'JOINING...' : '[→] JOIN WORKSPACE'}
        </button>
        {error && <p role="alert" className={errorBox}>ERROR: {error}</p>}
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
      <div className="px-2 py-1.5 text-[10px] text-text-dim">├─ SHARED WITH YOU ───────────</div>
      {shares.map((share) => {
        const active = params.worktreeId === share.worktreeId
        return (
          <Link
            key={share.roomId}
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
            <span className="w-6 h-4 flex items-center justify-center text-[9px] text-text-dim border border-dashed border-text-dim/40" title={share.hostName ? `Hosted by ${share.hostName}` : undefined}>
              {initials(share.hostName)}
            </span>
          </Link>
        )
      })}
      <button
        data-testid="join-workspace"
        className="flex items-center gap-2 w-full px-2 py-1 text-xs text-text-dim hover:text-border-accent hover:bg-surface-hover transition-colors"
        onClick={() => setJoining(true)}
      >
        [+] JOIN SHARED WORKSPACE
      </button>
      {joining && <JoinSharedWorkspaceModal onClose={() => setJoining(false)} />}
    </div>
  )
}
