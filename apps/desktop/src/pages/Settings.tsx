import { Button, Input, Kbd, Select, TerminalSection } from '@koda/ui'
import React, { useEffect, useState } from 'react'
import { useAtom } from 'jotai'
import { cn } from '@/lib/utils'
import { ThemeSelector } from '@/components/ThemeSelector'
import { defaultModelAtom, defaultPermissionModeAtom } from '@/store/settings'
import { useQueryClient } from '@tanstack/react-query'
import { useCollaborationSetup } from '@/hooks/useCollaborationSetup'
import { isTauriContext, rpcRequest } from '@/lib/tauri'
import type { CodingAgent, PermissionMode } from '@/lib/rpc'

const guardSetupUrl = 'https://github.com/Dicklesworthstone/destructive_command_guard#quick-install'

/**
 * Terminal-style form field
 */
function TerminalField({
  label,
  description,
  children,
}: {
  label: string
  description?: string
  children: React.ReactNode
}) {
  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2">
        <span className="text-text-faint">│</span>
        <label className="text-text-primary">[{label}]</label>
      </div>
      {description && (
        <p className="text-text-faint pl-4 text-2xs">{description}</p>
      )}
      <div className="pl-4">
        {children}
      </div>
    </div>
  )
}

/**
 * Terminal-style select input
 */
function TerminalSelect({
  value,
  onChange,
  options,
  label,
  testId,
}: {
  value: string
  onChange: (value: string) => void
  options: { value: string; label: string }[]
  label?: string
  testId?: string
}) {
  return (
    <Select native
      aria-label={label}
      data-testid={testId}
      value={value}
      onChange={(e) => { onChange(e.target.value) }}
      className={cn(
        'w-full px-3 py-2 text-xs font-mono',
        'border-dashed',
        'text-text-primary',
        'focus:outline-none focus:border-text-accent',
        'transition-colors cursor-pointer'
      )}
    >
      {options.map((option) => (
        <option key={option.value} value={option.value}>
          {option.label}
        </option>
      ))}
    </Select>
  )
}

/**
 * Terminal-style keyboard shortcut row
 */
function ShortcutRow({ action, keys }: { action: string; keys: string }) {
  return (
    <div className="flex items-center justify-between py-2 border-b border-dashed border-border-subtle last:border-0">
      <span className="text-text-muted">{action}</span>
      <Kbd className="px-2 py-1 bg-surface-control border border-dashed border-border-subtle text-text-accent">
        {keys}
      </Kbd>
    </div>
  )
}

function CollaborationSettings() {
  const { data, isPending, error } = useCollaborationSetup()
  const queryClient = useQueryClient()
  const [displayName, setDisplayName] = useState('')
  const [serviceUrl, setServiceUrl] = useState('')
  const [saveError, setSaveError] = useState('')
  const [saving, setSaving] = useState(false)
  useEffect(() => {
    if (data) { setDisplayName(data.settings.displayName); setServiceUrl(data.settings.serviceUrl) }
  }, [data])
  async function save() {
    setSaving(true); setSaveError('')
    try {
      await rpcRequest('collaboration.settings', { displayName, serviceUrl })
      await queryClient.invalidateQueries({ queryKey: ['collaboration'] })
    } catch (e) { setSaveError(e instanceof Error ? e.message : String(e)) }
    finally { setSaving(false) }
  }
  const inputClass = 'rounded-none h-auto text-xs w-full px-3 py-2 bg-surface-control border border-dashed border-border-subtle text-text-primary focus:outline-none focus:border-text-accent'
  return <TerminalSection compact className="[&_h2]:text-text-accent" title="COLLABORATION" description="Share workspaces using your install identity. Your first share registers it automatically.">
    <div className="space-y-4">
      <TerminalField label="DISPLAY NAME">
        <Input aria-label="Collaboration display name" data-testid="collaboration-display-name" value={displayName} onChange={e => setDisplayName(e.target.value)} maxLength={100} className={inputClass} />
      </TerminalField>
      <details>
        <summary className="cursor-pointer text-text-muted">[ADVANCED]</summary>
        <div className="mt-3"><TerminalField label="SERVICE URL" description="Use the service address supplied by your host. Environment configuration takes precedence.">
          <Input aria-label="Collaboration service URL" data-testid="collaboration-service-url" value={serviceUrl} onChange={e => setServiceUrl(e.target.value)} placeholder="https://collaboration.example.com" className={inputClass} />
        </TerminalField></div>
      </details>
      <p data-testid="collaboration-setup-status" className="text-text-accent">{isPending ? 'Checking...' : data?.mode === 'development-key' ? 'Development key' : data?.reachable ? 'Connected' : data?.enabled ? 'Service unreachable' : 'Not configured'}</p>
      {data?.name && <p className="text-text-muted">Name in shared workspaces: {data.name}</p>}
      <Button variant="unstyled" data-testid="collaboration-save" disabled={saving || isPending} onClick={() => void save()} className="text-text-accent border border-dashed border-border-subtle px-3 py-2 disabled:opacity-50">{saving ? 'SAVING...' : '[SAVE]'}</Button>
      {(saveError || error) && <p role="alert" className="text-status-error">{saveError || error?.message}</p>}
    </div>
  </TerminalSection>
}

/**
 * Terminal-style Settings page
 * ┌─────────────────────────────────────────────┐
 * │ ███████╗███████╗████████╗████████╗██╗███╗   │
 * │ ██╔════╝██╔════╝╚══██╔══╝╚══██╔══╝██║████╗  │
 * │ ███████╗█████╗     ██║      ██║   ██║██╔██╗ │
 * │ ╚════██║██╔══╝     ██║      ██║   ██║██║╚██╗│
 * │ ███████║███████╗   ██║      ██║   ██║██║ ╚██│
 * │ ╚══════╝╚══════╝   ╚═╝      ╚═╝   ╚═╝╚═╝  ╚═│
 * └─────────────────────────────────────────────┘
 */
export function Settings() {
  const [defaultAgent, setDefaultAgent] = useAtom(defaultModelAtom)
  const [defaultPermissions, setDefaultPermissions] = useAtom(defaultPermissionModeAtom)
  const [linkError, setLinkError] = useState<string | null>(null)
  const openGuardSetup = (event: React.MouseEvent<HTMLAnchorElement>) => {
    if (!isTauriContext()) return
    event.preventDefault()
    setLinkError(null)
    void import('@tauri-apps/plugin-opener').then(({ openUrl }) => openUrl(guardSetupUrl)).catch(() => setLinkError('Unable to open the setup guide in your browser.'))
  }
  return (
    <div className="h-full overflow-y-auto font-mono bg-surface-messages">
      <div className="max-w-2xl mx-auto p-8">
        {/* ASCII Header */}
        <div className="mb-8 text-xs">
          <div className="text-center mb-4">
            <h1 className="text-xl text-text-accent tracking-wider">[SETTINGS]</h1>
            <p className="text-text-muted mt-2">Configure your workspace preferences</p>
          </div>
        </div>

        <div className="space-y-6">
          {/* Theme Section */}
          <TerminalSection compact className="[&_h2]:text-text-accent" title="THEME">
            <ThemeSelector />
          </TerminalSection>

          {/* Agent Configuration */}
          <TerminalSection compact className="[&_h2]:text-text-accent"
            title="AGENT"
            description="Configure your AI agent preferences"
          >
            <div className="space-y-4">
              <TerminalField
                label="DEFAULT_AGENT"
                description="The agent that will be used for new conversations"
              >
                <TerminalSelect
                  label="Default agent"
                  testId="default-agent-select"
                  value={defaultAgent === 'claude' ? 'claude' : 'codex'}
                  onChange={value => setDefaultAgent(value as CodingAgent)}
                  options={[
                    { value: 'claude', label: 'Claude' },
                    { value: 'codex', label: 'Codex' },
                  ]}
                />
              </TerminalField>
              <TerminalField label="New conversation permissions" description="Applies to new Codex and Claude chats. Existing chats keep their saved permissions.">
                <TerminalSelect label="New conversation permissions" testId="default-permission-mode-select" value={defaultPermissions} onChange={value => setDefaultPermissions(value as PermissionMode)} options={[
                  { value: 'default', label: 'Ask when needed' },
                  { value: 'bypassPermissions', label: 'Bypass permissions' },
                ]} />
                {defaultPermissions === 'bypassPermissions' && <p className="mt-2 text-text-accent">Tools can run outside the worktree without asking. This also applies to collaborators with control.</p>}
              </TerminalField>
              <div data-testid="command-guard-recommendation" className="border border-dashed border-border-subtle p-3 space-y-2 text-text-muted">
                <p className="text-text-primary">Destructive Command Guard (dcg) · Recommended with bypass</p>
                <p>Blocks known destructive commands, including <code>rm -rf /</code>. Supports Claude and Codex hooks; Codex coverage is incomplete. It adds protection but does not replace a sandbox.</p>
                <p>Requires separate setup. Koda does not install it.</p>
                <a href={guardSetupUrl} target="_blank" rel="noopener noreferrer" onClick={openGuardSetup} className="text-text-accent underline">Official setup guide ↗</a>
                {linkError && <p role="alert" className="text-status-error">{linkError}</p>}
              </div>
            </div>
          </TerminalSection>

          <CollaborationSettings />

          {/* Git Configuration */}
          <TerminalSection compact className="[&_h2]:text-text-accent"
            title="GIT"
            description="Manage your Git identities"
          >
            <div className="space-y-4">
              <TerminalField
                label="GIT_IDENTITY"
                description="Used when creating commits and PRs"
              >
                <TerminalSelect
                  value="personal"
                  onChange={() => {}}
                  options={[
                    { value: 'personal', label: 'Personal (GitHub)' },
                    { value: 'work', label: 'Work (GitHub)' },
                    { value: 'add', label: '+ Add New Identity...' },
                  ]}
                />
              </TerminalField>
            </div>
          </TerminalSection>

          {/* Keyboard Shortcuts */}
          <TerminalSection compact className="[&_h2]:text-text-accent"
            title="KEYBINDS"
            description="Keyboard shortcuts reference"
          >
            <div className="space-y-1">
              <ShortcutRow action="Command Palette" keys="⌘ K" />
              <ShortcutRow action="Quick Open" keys="⌘ P" />
              <ShortcutRow action="New Message" keys="⌘ ↵" />
              <ShortcutRow action="Toggle Terminal" keys="⌘ `" />
              <ShortcutRow action="Toggle Sidebar" keys="⌘ B" />
            </div>
          </TerminalSection>

          {/* About */}
          <TerminalSection compact className="[&_h2]:text-text-accent" title="ABOUT">
            <div className="space-y-2">
              <div className="flex justify-between py-1">
                <span className="text-text-muted">VERSION</span>
                <span className="text-text-accent">0.1.0</span>
              </div>
              <div className="flex justify-between py-1">
                <span className="text-text-muted">BUILD</span>
                <span className="text-text-accent">dev</span>
              </div>
              <div className="flex justify-between py-1">
                <span className="text-text-muted">RUNTIME</span>
                <span className="text-text-accent">Tauri v2</span>
              </div>
            </div>
          </TerminalSection>

          {/* Footer */}
          <div className="text-center text-text-faint text-2xs pt-4">
            <div className="py-2">KODA TERMINAL v0.1.0</div>
          </div>
        </div>
      </div>
    </div>
  )
}
