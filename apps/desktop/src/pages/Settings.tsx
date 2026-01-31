import React from 'react'
import { cn } from '@/lib/utils'
import { ThemeSelector } from '@/components/ThemeSelector'
import { Bot, GitBranch, Keyboard, Info } from 'lucide-react'

/**
 * Settings section wrapper component
 */
function SettingsSection({
  title,
  description,
  icon: Icon,
  children,
}: {
  title: string
  description?: string
  icon: React.ElementType
  children: React.ReactNode
}) {
  return (
    <section className="card-strong p-6">
      <div className="flex items-center gap-3 mb-4">
        <div className="w-10 h-10 rounded-xl bg-surface-card flex items-center justify-center">
          <Icon className="w-5 h-5 text-text-accent" />
        </div>
        <div>
          <h2 className="text-text-strong font-semibold">{title}</h2>
          {description && <p className="text-text-faint text-sm">{description}</p>}
        </div>
      </div>
      {children}
    </section>
  )
}

/**
 * Form field component
 */
function FormField({
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
      <div className="flex items-center justify-between">
        <label className="text-sm font-medium text-text-primary">{label}</label>
      </div>
      {description && <p className="text-xs text-text-faint">{description}</p>}
      {children}
    </div>
  )
}

/**
 * Select input component
 */
function Select({
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
        'w-full rounded-lg px-3 py-2 text-sm',
        'bg-surface-control border border-border-subtle',
        'text-text-primary',
        'focus:outline-none focus:border-border-accent focus:ring-1 focus:ring-border-accent-soft',
        'transition-colors'
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
 * Settings page component
 */
export function Settings() {
  return (
    <div className="h-full overflow-y-auto bg-surface-messages">
      <div className="max-w-3xl mx-auto p-8">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-text-strong mb-2">Settings</h1>
          <p className="text-text-muted">Configure your workspace preferences</p>
        </div>

        <div className="space-y-6">
          {/* Theme Section */}
          <section className="card-strong p-6">
            <ThemeSelector />
          </section>

          {/* Agent Configuration */}
          <SettingsSection
            title="Agent Configuration"
            description="Configure your AI agent preferences"
            icon={Bot}
          >
            <div className="space-y-4">
              <FormField
                label="Default Agent"
                description="The agent that will be used for new conversations"
              >
                <Select
                  value="claude-code"
                  onChange={() => {}}
                  options={[
                    { value: 'claude-code', label: 'Claude Code' },
                    { value: 'codex', label: 'Codex' },
                    { value: 'kimi-code', label: 'Kimi Code' },
                  ]}
                />
              </FormField>
            </div>
          </SettingsSection>

          {/* Git Configuration */}
          <SettingsSection
            title="Git Configuration"
            description="Manage your Git identities"
            icon={GitBranch}
          >
            <div className="space-y-4">
              <FormField
                label="Default Git Identity"
                description="Used when creating commits and PRs"
              >
                <Select
                  value="personal"
                  onChange={() => {}}
                  options={[
                    { value: 'personal', label: 'Personal (GitHub)' },
                    { value: 'work', label: 'Work (GitHub)' },
                    { value: 'add', label: 'Add New Identity...' },
                  ]}
                />
              </FormField>
            </div>
          </SettingsSection>

          {/* Keyboard Shortcuts */}
          <SettingsSection
            title="Keyboard Shortcuts"
            description="Customize your keyboard shortcuts"
            icon={Keyboard}
          >
            <div className="space-y-3">
              <div className="flex items-center justify-between py-2">
                <span className="text-sm text-text-primary">Command Palette</span>
                <kbd className="px-2 py-1 bg-surface-control rounded text-xs text-text-faint font-mono">
                  ⌘ K
                </kbd>
              </div>
              <div className="flex items-center justify-between py-2 border-t border-border-subtle">
                <span className="text-sm text-text-primary">Quick Open</span>
                <kbd className="px-2 py-1 bg-surface-control rounded text-xs text-text-faint font-mono">
                  ⌘ P
                </kbd>
              </div>
              <div className="flex items-center justify-between py-2 border-t border-border-subtle">
                <span className="text-sm text-text-primary">New Message</span>
                <kbd className="px-2 py-1 bg-surface-control rounded text-xs text-text-faint font-mono">
                  ⌘ ↵
                </kbd>
              </div>
            </div>
          </SettingsSection>

          {/* About */}
          <SettingsSection
            title="About"
            description="Application information"
            icon={Info}
          >
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-text-muted">Version</span>
                <span className="text-text-primary font-mono">0.1.0</span>
              </div>
              <div className="flex justify-between">
                <span className="text-text-muted">Build</span>
                <span className="text-text-primary font-mono">dev</span>
              </div>
            </div>
          </SettingsSection>
        </div>
      </div>
    </div>
  )
}
