import { useState } from 'react'
import { open } from '@tauri-apps/plugin-dialog'
import { Button, Callout, Dialog, DialogBody, DialogContent, DialogHeader, DialogTitle, Input, NavItem } from '@koda/ui'
import { useAttachRepo, useCreateRepo, useCreateStandaloneWorkspace, useRepos } from '@/hooks/useRpc'
import type { Workspace } from '@/lib/rpc'

export function CreateWorkspaceModal({ isOpen, onClose, onCreated, createLabel = '[+] CREATE', nameLabel = 'NAME' }: {
  isOpen: boolean
  onClose: () => void
  onCreated: (workspace: Workspace) => void
  createLabel?: string
  nameLabel?: string
}) {
  const createWorkspace = useCreateStandaloneWorkspace()
  const [name, setName] = useState('')
  const [error, setError] = useState<string | null>(null)
  const handleCreate = async () => {
    if (!name.trim() || createWorkspace.isPending) return
    try {
      setError(null)
      const workspace = await createWorkspace.mutateAsync({ name: name.trim() })
      setName('')
      onCreated(workspace)
      onClose()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create workspace')
    }
  }
  return <Dialog open={isOpen} onOpenChange={value => { if (!value) onClose() }}>
    <DialogContent className="max-w-md bg-surface-card border-text-dim/30" closeLabel="[ESC] CANCEL" aria-describedby={undefined}>
      <DialogHeader><DialogTitle className="text-xs text-border-accent">NEW WORKSPACE</DialogTitle></DialogHeader>
      <DialogBody className="space-y-4">
        {error && <Callout tone="error">ERROR: {error}</Callout>}
        <div>
          <label htmlFor="new-workspace-name" className="block text-2xs text-text-dim mb-1">{nameLabel}</label>
          <Input id="new-workspace-name" value={name} onChange={event => setName(event.target.value)} placeholder="my-workspace" className="rounded-none bg-transparent border-dashed border-text-dim/30" onKeyDown={event => { if (event.key === 'Enter') void handleCreate() }} autoFocus />
        </div>
        <Button variant="ghost" onClick={() => void handleCreate()} disabled={!name.trim() || createWorkspace.isPending} className="w-full h-auto rounded-none p-3 text-xs border border-dashed border-border-accent/50 hover:border-border-accent text-border-accent hover:bg-border-accent/10">
          {createWorkspace.isPending ? 'CREATING...' : createLabel}
        </Button>
      </DialogBody>
    </DialogContent>
  </Dialog>
}

export function AddRepoModal({ isOpen, onClose, workspaceId }: { isOpen: boolean; onClose: () => void; workspaceId: string }) {
  const { data: repos } = useRepos()
  const createRepo = useCreateRepo()
  const attachRepo = useAttachRepo()
  const [error, setError] = useState<string | null>(null)
  const [isAttaching, setIsAttaching] = useState(false)
  const handleSelectFolder = async () => {
    try {
      setError(null)
      const selected = await open({ directory: true, multiple: false, title: 'Select Git Repository' })
      if (selected && typeof selected === 'string') {
        setIsAttaching(true)
        const repo = await createRepo.mutateAsync({ rootPath: selected })
        await attachRepo.mutateAsync({ workspaceId, repoId: repo.id })
        onClose()
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to add repository')
    } finally { setIsAttaching(false) }
  }
  const handleAttachExisting = async (repoId: string) => {
    try {
      setError(null)
      setIsAttaching(true)
      await attachRepo.mutateAsync({ workspaceId, repoId })
      onClose()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to attach repository')
    } finally { setIsAttaching(false) }
  }
  const availableRepos = repos?.filter(repo => repo.id) ?? []
  return <Dialog open={isOpen} onOpenChange={value => { if (!value) onClose() }}>
    <DialogContent className="max-w-md bg-surface-card border-text-dim/30" closeLabel="[ESC] CANCEL" aria-describedby={undefined}>
      <DialogHeader><DialogTitle className="text-xs text-border-accent">ADD REPOSITORY</DialogTitle></DialogHeader>
      <DialogBody className="space-y-4">
        {error && <Callout tone="error">ERROR: {error}</Callout>}
        {availableRepos.length > 0 && <div>
          <p className="text-2xs text-text-dim mb-2 uppercase">ATTACH EXISTING REPO:</p>
          <div className="space-y-1 max-h-32 overflow-y-auto">{availableRepos.map((repo, index) => <NavItem key={repo.id} label={repo.name ?? 'unnamed'} icon={<span>[{index + 1}]</span>} meta={repo.rootPath} onClick={() => void handleAttachExisting(repo.id)} disabled={isAttaching} className="border border-dashed border-text-dim/30" buttonClassName="p-2" />)}</div>
        </div>}
        <Button variant="ghost" onClick={() => void handleSelectFolder()} disabled={isAttaching} className="w-full h-auto rounded-none p-3 text-xs border border-dashed border-border-accent/50 hover:border-border-accent text-border-accent hover:bg-border-accent/10">
          {isAttaching ? 'ADDING...' : '[+] ADD NEW GIT REPOSITORY'}
        </Button>
      </DialogBody>
    </DialogContent>
  </Dialog>
}
