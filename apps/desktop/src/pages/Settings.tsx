import React from 'react'
import { cn } from '@/lib/utils'
import { ThemeSelector } from '@/components/ThemeSelector'

/**
 * Terminal-style settings section
 * ┌─ SECTION NAME ───────────────────┐
 * │ description...                   │
 * │                                  │
 * │ content                          │
 * └──────────────────────────────────┘
 */
function TerminalSection({
  title,
  description,
  children,
}: {
  title: string
  description?: string
  children: React.ReactNode
}) {
  return (
    <section className="font-mono text-xs">
      {/* Header */}
      <div className="flex items-center text-text-faint mb-2">
        <span>┌─ </span>
        <span className="text-text-accent">{title}</span>
        <span> {'─'.repeat(Math.max(0, 30 - title.length))}</span>
        <span>┐</span>
      </div>
      
      {/* Content */}
      <div className="px-4 py-3 border-l border-r border-dashed border-border-subtle">
        {description && (
          <p className="text-text-muted mb-3">{description}</p>
        )}
        {children}
      </div>
      
      {/* Footer */}
      <div className="text-text-faint">
        └{'─'.repeat(34)}┘
      </div>
    </section>
  )
}

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
        <p className="text-text-faint pl-4 text-[10px]">{description}</p>
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
}: {
  value: string
  onChange: (value: string) => void
  options: { value: string; label: string }[]
}) {
  return (
    <select
      value={value}
      onChange={(e) => { onChange(e.target.value) }}
      className={cn(
        'w-full px-3 py-2 text-xs font-mono',
        'bg-[#0a0a0a] border border-dashed border-border-subtle',
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
    </select>
  )
}

/**
 * Terminal-style keyboard shortcut row
 */
function ShortcutRow({ action, keys }: { action: string; keys: string }) {
  return (
    <div className="flex items-center justify-between py-2 border-b border-dashed border-border-subtle last:border-0">
      <span className="text-text-muted">{action}</span>
      <kbd className="px-2 py-1 bg-[#0a0a0a] border border-dashed border-border-subtle text-text-accent">
        {keys}
      </kbd>
    </div>
  )
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
  return (
    <div className="h-full overflow-y-auto font-mono bg-surface-messages">
      <div className="max-w-2xl mx-auto p-8">
        {/* ASCII Header */}
        <div className="mb-8 text-xs">
          <div className="text-text-faint mb-4">
            ┌{'─'.repeat(40)}┐
          </div>
          <div className="text-center mb-4">
            <h1 className="text-xl text-text-accent tracking-wider">[SETTINGS]</h1>
            <p className="text-text-muted mt-2">Configure your workspace preferences</p>
          </div>
          <div className="text-text-faint">
            └{'─'.repeat(40)}┘
          </div>
        </div>

        <div className="space-y-6">
          {/* Theme Section */}
          <TerminalSection title="THEME">
            <ThemeSelector />
          </TerminalSection>

          {/* Agent Configuration */}
          <TerminalSection
            title="AGENT"
            description="Configure your AI agent preferences"
          >
            <div className="space-y-4">
              <TerminalField
                label="DEFAULT_AGENT"
                description="The agent that will be used for new conversations"
              >
                <TerminalSelect
                  value="claude-code"
                  onChange={() => {}}
                  options={[
                    { value: 'claude-code', label: 'Claude Code' },
                    { value: 'codex', label: 'Codex' },
                    { value: 'kimi-code', label: 'Kimi Code' },
                  ]}
                />
              </TerminalField>
            </div>
          </TerminalSection>

          {/* Git Configuration */}
          <TerminalSection
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
          <TerminalSection
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
          <TerminalSection title="ABOUT">
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
          <div className="text-center text-text-faint text-[10px] pt-4">
            <div>{'─'.repeat(40)}</div>
            <div className="py-2">KODA TERMINAL v0.1.0</div>
            <div>{'─'.repeat(40)}</div>
          </div>
        </div>
      </div>
    </div>
  )
}
