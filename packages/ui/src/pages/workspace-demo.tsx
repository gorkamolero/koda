import { useState } from 'react'
import { Check, GitBranch, MessageSquare, Plus, Search, Settings, Share2, Terminal } from 'lucide-react'
import { AppShell, ApprovalCard, Composer, MessageBubble, SharedBadge, TerminalFrame, ToolBlock } from '../patterns'
import { CodeBlock, DiffStat, FileIcon, KodaLogo, NavItem, Panel, PanelHeader, TerminalSection, Tree } from '../brand'
import { Badge, Button, Callout, IconButton, Input, Meter, Select, SelectContent, SelectItem, SelectTrigger, SelectValue, StatusBadge, Tabs, TabsContent, TabsList, TabsTrigger } from '../primitives'

const fileTree = [{ id: 'src', label: 'src', children: [{ id: 'sharing', label: 'collaboration', children: [{ id: 'permissions', label: 'permissions.ts' }, { id: 'permissions-test', label: 'permissions.test.ts' }] }, { id: 'workspace', label: 'WorkspaceSharing.tsx' }] }, { id: 'readme', label: 'README.md' }]

/** Local mock of the same worktree viewed by its host or a view-only collaborator. */
export function WorkspaceDemo({ collaborator = false }: { collaborator?: boolean }) {
  const [message, setMessage] = useState('')
  const [resolution, setResolution] = useState<'actionable' | 'resolved'>('actionable')
  const [selectedFile, setSelectedFile] = useState('permissions')
  const [sent, setSent] = useState<string[]>([])
  const [permission, setPermission] = useState('on-request')
  return <AppShell
    sidebar={<div className="flex h-full flex-col"><div className="space-y-4 p-4"><KodaLogo size="sm" /><Input aria-label="Filter workspaces" placeholder="Find a workspace…" /></div>
      <PanelHeader title="My projects" count={collaborator ? 1 : 2} actions={<IconButton aria-label="Add project"><Plus /></IconButton>} />
      <NavItem label={collaborator ? 'field-notes' : 'koda'} icon={<GitBranch className="size-4" />} meta={collaborator ? 'Your local project' : '~/Developer/koda'} />
      {!collaborator && <><NavItem active label="sharing-permissions" icon={<GitBranch className="size-3.5" />} meta="codex/sharing-permissions" trailing={<StatusBadge status="reviewing" />} /><NavItem label="agent-question-forms" icon={<GitBranch className="size-3.5" />} meta="main · clean" /></>}
      <PanelHeader title="Shared workspaces" count={1} actions={<Button variant="bracket" size="sm" data-testid="join-workspace">Join</Button>} />
      <NavItem active={collaborator} label="sharing-permissions" meta="Gorka · view access" icon={<Share2 className="size-3.5" />} data-testid="shared-workspace-link" />
      <div className="mt-auto border-t border-border-subtle p-3"><NavItem label="Settings" icon={<Settings className="size-4" />} /><p className="px-3 py-2 text-xs text-text-secondary">{collaborator ? 'Maya · collaborator' : 'Gorka · host'}</p></div>
    </div>}
    topbar={<div className="flex flex-wrap items-center gap-3"><GitBranch aria-hidden="true" className="size-4 text-text-secondary" /><div className="min-w-0 flex-1"><h1 className="truncate text-sm">sharing-permissions</h1><p className="text-xs text-text-secondary">koda / codex/sharing-permissions</p></div><SharedBadge hostName="Gorka" permission={collaborator ? 'view' : 'control'} showStatus /><Button variant="bracket" size="sm" disabled={collaborator}>Share</Button></div>}
    main={<div className="mx-auto flex max-w-3xl flex-col gap-4 p-6"><div className="flex flex-wrap items-center gap-3"><MessageSquare aria-hidden="true" className="size-4" /><h2 className="flex-1 text-sm">Respect workspace permissions</h2><Badge>Codex</Badge><span className="text-xs text-text-secondary">10:42</span></div>
      <MessageBubble variant="user" author="Gorka" timestamp="10:42">Make view invitations read-only throughout the shared session. Keep the transcript and terminal visible, and add regression tests for the permission boundary.</MessageBubble>
      <MessageBubble author="Codex" timestamp="10:42"><p>I’ll check where a collaborator can interact with the workspace, then cover the host and viewer paths.</p><ToolBlock tool="exec_command" status="done" summary="Inspect sharing permissions" duration="0.4s"><CodeBlock language="shell" code={'rg -n "permission|readOnly" src/collaboration\nsrc/collaboration/permissions.ts:24: canControlSession'} /></ToolBlock></MessageBubble>
      <MessageBubble author="Codex" timestamp="10:44"><p>The transcript and terminal remain visible. Viewers now have a disabled composer and read-only approval controls; host settings stay with the host.</p><div className="flex flex-wrap items-center gap-3 text-xs"><FileIcon filename="permissions.ts" /><span>permissions.ts</span><DiffStat additions={12} deletions={3} /></div><div className="flex flex-wrap items-center gap-3 text-xs"><FileIcon filename="permissions.test.ts" /><span>permissions.test.ts</span><DiffStat additions={28} deletions={0} /></div></MessageBubble>
      <ApprovalCard kind="command" reason="Run the focused permission regression tests before finishing the change." command="pnpm test -- permissions.test.ts" path="~/Developer/koda/.worktrees/sharing-permissions" state={collaborator ? 'read-only' : resolution} hostName={collaborator ? 'Gorka' : undefined} onApprove={() => setResolution('resolved')} onDeny={() => setResolution('resolved')} />
      {collaborator && <Callout tone="view-only">You are viewing Gorka’s session. Messages, approvals and host settings are read-only.</Callout>}
      {sent.map((text, index) => <MessageBubble key={index} variant="user" author="Gorka">{text}</MessageBubble>)}
      <Composer value={message} onValueChange={setMessage} onSend={() => { setSent(current => [...current, message]); setMessage('') }} mode={collaborator ? 'view-only' : 'own'} ownerName="Gorka" permission={permission} onPermissionChange={setPermission}
        modelSelector={<Select defaultValue="codex" disabled={collaborator}><SelectTrigger aria-label="Agent model" className="w-48"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="codex">Codex · GPT-5</SelectItem><SelectItem value="claude">Claude · Sonnet</SelectItem></SelectContent></Select>} />
      <p className="text-xs text-text-secondary">{collaborator ? 'Shared transcript · all messages signed by their author' : '⌘ Enter to send · changes stay in this worktree'}</p>
    </div>}
    rightPanel={<><PanelHeader title="Changes" count={3} /><Tabs defaultValue="files"><TabsList aria-label="Workspace details" className="w-full"><TabsTrigger value="files">Files</TabsTrigger><TabsTrigger value="checks">Checks</TabsTrigger></TabsList><TabsContent value="files"><div className="space-y-4 p-3"><DiffStat additions={44} deletions={5} /><Tree items={fileTree} label="Changed files" selectedId={selectedFile} defaultExpandedIds={['src', 'sharing']} onSelect={item => setSelectedFile(item.id)} /></div></TabsContent><TabsContent value="checks"><p className="flex items-center gap-2 p-4 text-xs"><Check aria-hidden="true" className="size-4" />Awaiting approval to run tests</p></TabsContent></Tabs><div className="mt-6 p-4"><TerminalSection title="Context"><Meter value={38} max={100} label="Context used" /><p className="mt-2 text-xs text-text-secondary">38% used · 76k / 200k</p></TerminalSection></div></>}
    bottomPanel={<TerminalFrame title="Terminal · sharing-permissions" status="ready" readOnly={collaborator}><pre className="whitespace-pre-wrap">{'$ git diff --stat\n src/collaboration/permissions.ts      | 15 ++++++++++++---\n src/collaboration/permissions.test.ts | 28 ++++++++++++++++++++++++++++\n src/WorkspaceSharing.tsx             |  6 ++++--\n 3 files changed, 44 insertions(+), 5 deletions(-)'}</pre></TerminalFrame>}
  />
}

export function PatternExamples() {
  return <main className="mx-auto max-w-3xl space-y-8 p-6 font-code text-text-primary"><header><p className="text-xs uppercase tracking-widest text-text-secondary">Koda / Patterns</p><h1 className="mt-3 text-xl">A shared session, one source of truth.</h1><p className="mt-3 text-sm text-text-secondary">These compositions pass data and callbacks into the same components used in the workspace screens.</p></header>
    <TerminalSection title="A chat turn"><div className="space-y-3"><MessageBubble variant="user" author="Gorka">Check the invitation permissions before we share this workspace.</MessageBubble><MessageBubble author="Codex">I found the permission boundary. I’ll verify it with a focused test.<ToolBlock tool="exec_command" status="done" summary="Read permissions.ts"><code>cat src/collaboration/permissions.ts</code></ToolBlock></MessageBubble></div></TerminalSection>
    <TerminalSection title="Approval flow"><ApprovalCard reason="Run the permission regression test." command="pnpm test -- permissions.test.ts" /><p className="mt-3 text-xs text-text-secondary">An action returns through the caller's callback. The caller supplies the resolved or withdrawn state.</p></TerminalSection>
    <Panel title="Collaborator session" actions={<SharedBadge hostName="Gorka" permission="view" />}><div className="space-y-3 p-4"><MessageBubble author="Maya" variant="user">I can see the change in the shared transcript.</MessageBubble><Callout tone="view-only">View access keeps the conversation visible while disabling actions.</Callout><Composer mode="view-only" value="" ownerName="Gorka" /></div></Panel>
    <div className="flex gap-3 text-xs text-text-secondary"><Search aria-hidden="true" className="size-4" />Discover commands with the CommandPalette shell.<Terminal aria-hidden="true" className="size-4" />Mirror output with TerminalFrame.</div>
  </main>
}
