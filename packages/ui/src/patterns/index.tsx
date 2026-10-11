import { useId, useState, type HTMLAttributes, type ReactNode } from 'react'
import { Check, ChevronDown, ChevronRight, Circle, LockKeyhole, Square, Wifi, WifiOff, X } from 'lucide-react'
import { Button, Command, CommandDialog, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList, CommandShortcut, Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../primitives'
import { Spinner } from '../brand'

const cx = (...values: (string | false | undefined)[]) => values.filter(Boolean).join(' ')
const focus = 'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus focus-visible:ring-offset-2 focus-visible:ring-offset-surface-card'

export interface MessageBubbleProps extends HTMLAttributes<HTMLElement> {
  variant?: 'user' | 'assistant' | 'system'
  /** Name displayed for a shared conversation. */
  author?: string
  actions?: ReactNode
  timestamp?: string
}
export function MessageBubble({ variant = 'assistant', author, actions, timestamp, children, className, ...props }: MessageBubbleProps) {
  return <article aria-label={`${author ?? variant} message`} className={cx('group relative rounded-md border border-border-subtle p-4 font-code text-sm', variant === 'user' ? 'ml-8 bg-surface-card-strong text-text-primary' : variant === 'system' ? 'bg-surface-card-muted text-text-secondary' : 'mr-8 bg-surface-card text-text-primary', className)} {...props}>
    <div className="mb-2 flex items-center gap-2 text-xs text-text-secondary"><span className="uppercase">[{author ?? variant}]</span>{timestamp && <time>{timestamp}</time>}<div className="ml-auto opacity-0 focus-within:opacity-100 group-hover:opacity-100 group-focus-within:opacity-100">{actions}</div></div><div className="space-y-3">{children}</div>
  </article>
}

export type ToolBlockStatus = 'running' | 'done' | 'failed'
export interface ToolCallSummaryProps extends HTMLAttributes<HTMLSpanElement> { tool: string; status: ToolBlockStatus; summary?: string; duration?: string }
export function ToolCallSummary({ tool, status, summary, duration, className, ...props }: ToolCallSummaryProps) {
  return <span className={cx('flex min-w-0 flex-1 items-center gap-2 font-code text-xs', className)} {...props}>{status === 'running' ? <Spinner label="Running" showLabel={false} /> : status === 'done' ? <Check aria-hidden="true" className="size-3 text-status-success" /> : <X aria-hidden="true" className="size-3 text-status-error" />}<span>{tool}</span><span className="text-text-secondary">{summary ?? status}</span><span className="sr-only">{status}</span>{duration && <span className="ml-auto text-text-secondary">{duration}</span>}</span>
}
export interface ToolBlockProps extends HTMLAttributes<HTMLDivElement> { tool: string; status?: ToolBlockStatus; summary?: string; duration?: string; defaultOpen?: boolean }
/** Running calls open automatically; completed calls collapse until expanded. */
export function ToolBlock({ tool, status = 'running', summary, duration, defaultOpen, children, className, ...props }: ToolBlockProps) {
  const id = useId()
  const [expansion, setExpansion] = useState({ status, open: defaultOpen ?? status === 'running' })
  const open = expansion.status === status ? expansion.open : status === 'running'
  return <div className={cx('border border-dashed border-border-subtle bg-surface-card font-code text-text-primary', className)} {...props}><button type="button" className={cx('flex w-full items-center gap-2 px-3 py-2 text-left hover:bg-surface-hover', focus)} aria-expanded={open} aria-controls={id} onClick={() => setExpansion({ status, open: !open })}>{open ? <ChevronDown aria-hidden="true" className="size-3" /> : <ChevronRight aria-hidden="true" className="size-3" />}<ToolCallSummary tool={tool} status={status} summary={summary} duration={duration} /></button><div id={id} hidden={!open} className="border-t border-dashed border-border-subtle p-3 text-xs">{children}</div></div>
}

export type ApprovalState = 'actionable' | 'read-only' | 'resolved' | 'withdrawn'
export interface ApprovalCardProps extends HTMLAttributes<HTMLElement> {
  kind?: 'command' | 'file' | 'network'
  title?: string
  reason: string
  state?: ApprovalState
  command?: string
  path?: string
  network?: string
  files?: { path: string; kind: string }[]
  details?: string
  /** Defined for collaborators; identifies who owns the workspace. */
  hostName?: string
  resolution?: string
  busy?: boolean
  error?: string
  onApprove?: () => void
  onDeny?: () => void
}
export function ApprovalCard({ kind = 'command', title, reason, state = 'actionable', command, path, network, files, details, hostName, resolution = 'Approved once', busy = false, error, onApprove, onDeny, className, ...props }: ApprovalCardProps) {
  const id = useId(), disabled = state !== 'actionable' || busy
  return <section aria-labelledby={id} data-testid="approval-card" className={cx('space-y-3 border border-border-accent bg-surface-card p-4 font-code text-xs text-text-primary', className)} {...props}>
    <h3 id={id} className="text-sm font-medium">{title ?? `Permission needed · ${kind}`}</h3><p className="text-text-secondary">{reason}</p>
    {hostName && <p className="text-text-secondary">Workspace shared by {hostName}</p>}
    {command && <div><span className="text-text-secondary">Command</span><pre data-testid="approval-command" className="mt-1 max-h-32 overflow-auto whitespace-pre-wrap break-all rounded-sm bg-surface-card-muted p-2">{command}</pre></div>}
    {path && <p className="break-all">Path: <code data-testid="approval-path">{path}</code></p>}
    {network && <p data-testid="approval-network" className="break-all">Network: {network}</p>}
    {files && <ul data-testid="approval-files" className="space-y-1 break-all">{files.map(file => <li key={`${file.kind}:${file.path}`}>{file.kind}: <code>{file.path}</code></li>)}</ul>}
    {details && <details><summary className={cx('cursor-pointer text-text-secondary', focus)}>Request details</summary><pre data-testid="approval-input" className="mt-2 max-h-32 overflow-auto whitespace-pre-wrap break-all">{details}</pre></details>}
    {state === 'read-only' && <p data-testid="approval-view-only" className="text-text-secondary">View only: {hostName ?? 'the host'} or a collaborator with control can answer.</p>}
    {state === 'resolved' && <p role="status">[RESOLVED] {resolution}</p>}
    {state === 'withdrawn' && <p role="status">[WITHDRAWN] This request is no longer available.</p>}
    {error && <p role="alert" className="flex items-start gap-2 text-text-primary"><X aria-hidden="true" className="size-4 shrink-0 text-status-error" />{error}</p>}
    {(state === 'actionable' || state === 'read-only') && <div className="flex flex-wrap gap-2"><Button variant="outline" size="sm" data-testid="approval-allow" disabled={disabled} loading={busy} onClick={() => { if (!disabled) onApprove?.() }}>Approve once</Button><Button variant="outline" size="sm" data-testid="approval-deny" disabled={disabled} onClick={() => { if (!disabled) onDeny?.() }}>Deny</Button></div>}
  </section>
}

export interface QuestionOption { value: string; label: string; description?: string }
export type QuestionValue = string | string[]
export interface QuestionCardProps extends Omit<HTMLAttributes<HTMLFormElement>, 'onChange' | 'onSubmit'> {
  title?: string
  question: string
  variant?: 'single' | 'multiple' | 'text' | 'secret'
  options?: QuestionOption[]
  value?: QuestionValue
  onValueChange?: (value: QuestionValue) => void
  onSubmit?: (value: QuestionValue) => void
  onCancel?: () => void
  state?: 'actionable' | 'read-only' | 'resolved' | 'withdrawn'
  /** Any collaborator must answer secret questions on the host, even with control. */
  hostName?: string
  busy?: boolean
  error?: string
}
export function QuestionCard({ title = 'Your answer is needed', question, variant = 'single', options = [], value = variant === 'multiple' ? [] : '', onValueChange, onSubmit, onCancel, state = 'actionable', hostName, busy = false, error, className, ...props }: QuestionCardProps) {
  const id = useId(), secretElsewhere = variant === 'secret' && hostName !== undefined
  const disabled = state !== 'actionable' || busy || secretElsewhere
  const ready = Array.isArray(value) ? value.length > 0 : value.trim().length > 0
  const selected = Array.isArray(value) ? value : [value]
  return <form aria-label="Agent question" autoComplete="off" data-testid="question-card" className={cx('space-y-4 border border-border-accent bg-surface-card p-4 font-code text-xs text-text-primary', className)} onSubmit={event => { event.preventDefault(); if (!disabled && ready) onSubmit?.(value) }} {...props}>
    <h3 className="text-sm font-medium">{title}</h3>
    {hostName && <p className="text-text-secondary">Workspace shared by {hostName}</p>}
    <fieldset disabled={disabled} className="min-w-0 space-y-3"><legend className="mb-2 text-sm">{question}</legend>
      {(variant === 'single' || variant === 'multiple') && <><p className="text-text-secondary">{variant === 'multiple' ? 'Choose one or more.' : 'Choose one.'}</p>{options.map((option, index) => <label key={option.value} className="flex cursor-pointer items-start gap-2"><input className={cx('mt-0.5 size-4 shrink-0 accent-text-accent', focus)} type={variant === 'multiple' ? 'checkbox' : 'radio'} name={id} value={option.value} aria-labelledby={`${id}-label-${index}`} checked={selected.includes(option.value)} aria-describedby={option.description ? `${id}-${index}` : undefined} onChange={event => { if (!disabled) onValueChange?.(variant === 'single' ? option.value : event.target.checked ? [...selected, option.value] : selected.filter(item => item !== option.value)) }} /><span><span id={`${id}-label-${index}`}>{option.label}</span>{option.description && <span id={`${id}-${index}`} className="block text-text-secondary">{option.description}</span>}</span></label>)}</>}
      {variant === 'text' && <label className="block space-y-2"><span>Your answer</span><textarea rows={3} className={cx('block w-full rounded-sm border border-border-strong bg-surface-card-muted p-2 text-text-primary disabled:opacity-50', focus)} value={typeof value === 'string' ? value : ''} onChange={event => { if (!disabled) onValueChange?.(event.target.value) }} /></label>}
      {variant === 'secret' && !secretElsewhere && <label className="block space-y-2"><span>Secret answer</span><input type="password" autoComplete="off" className={cx('block w-full rounded-sm border border-border-strong bg-surface-card-muted p-2 text-text-primary disabled:opacity-50', focus)} value={typeof value === 'string' ? value : ''} onChange={event => { if (!disabled) onValueChange?.(event.target.value) }} /></label>}
    </fieldset>
    {secretElsewhere && <p data-testid="question-secret-on-host" className="flex gap-2 text-text-secondary"><LockKeyhole aria-hidden="true" className="size-4 shrink-0" />This asks for a secret, so {hostName || 'the host'} answers it on their machine.</p>}
    {state === 'read-only' && <p data-testid="question-view-only" className="text-text-secondary">View only: {hostName ?? 'the host'} or a collaborator with control can answer.</p>}
    {state === 'resolved' && <p role="status">[ANSWERED] Your answer has been sent.</p>}
    {state === 'withdrawn' && <p role="status">[WITHDRAWN] This question is no longer available.</p>}
    {error && <p role="alert" className="flex items-start gap-2 text-text-primary"><X aria-hidden="true" className="size-4 shrink-0 text-status-error" />{error}</p>}
    {(state === 'actionable' || state === 'read-only') && <div className="flex flex-wrap gap-2"><Button type="submit" variant="outline" size="sm" data-testid="question-submit" disabled={disabled || !ready} loading={busy}>Submit answer</Button><Button variant="outline" size="sm" data-testid="question-cancel" disabled={disabled} onClick={() => { if (!disabled) onCancel?.() }}>Cancel and stop</Button></div>}
  </form>
}

export interface ComposerProps extends Omit<HTMLAttributes<HTMLFormElement>, 'onChange' | 'onSubmit'> {
  value: string
  onValueChange?: (value: string) => void
  onSend?: () => void
  onStop?: () => void
  mode?: 'own' | 'shared' | 'view-only'
  ownerName?: string
  modelSelector?: ReactNode
  permission?: string
  permissionOptions?: { value: string; label: string }[]
  onPermissionChange?: (value: string) => void
  /** Host-only settings cannot be changed from a collaborator's composer. */
  settingsReadOnly?: boolean
  attachments?: ReactNode
  running?: boolean
  disabled?: boolean
  placeholder?: string
}
export function Composer({ value, onValueChange, onSend, onStop, mode = 'own', ownerName = 'Gorka', modelSelector, permission = 'on-request', permissionOptions = [{ value: 'on-request', label: 'Ask for approval' }, { value: 'read-only', label: 'Read only' }], onPermissionChange, settingsReadOnly = mode !== 'own', attachments, running = false, disabled = false, placeholder, className, ...props }: ComposerProps) {
  const locked = disabled || mode === 'view-only'
  const hint = placeholder ?? (mode === 'view-only' ? `View only · ${ownerName} controls this session` : mode === 'shared' ? `Message ${ownerName}'s shared session…` : 'Ask Koda to build, explain, or fix…')
  return <form aria-label="Message composer" className={cx('space-y-3 rounded-md border border-border-strong bg-surface-card p-3 font-code text-xs text-text-primary', className)} onSubmit={event => { event.preventDefault(); if (!locked && !running && value.trim()) onSend?.() }} {...props}>
    {attachments && <div aria-label="Attachments" className="flex flex-wrap gap-2">{attachments}</div>}
    <textarea aria-label="Message" value={value} disabled={locked} onChange={event => { if (!locked) onValueChange?.(event.target.value) }} onKeyDown={event => { if (event.key === 'Enter' && (event.metaKey || event.ctrlKey) && !event.nativeEvent.isComposing && !locked && !running && value.trim()) { event.preventDefault(); onSend?.() } }} rows={3} placeholder={hint} className={cx('block w-full resize-y rounded-sm bg-transparent p-2 text-sm text-text-primary placeholder:text-text-secondary disabled:cursor-not-allowed', focus)} />
    <div className="flex flex-wrap items-center gap-2"><fieldset disabled={locked || settingsReadOnly} aria-label="Model" className={cx('min-w-0', (locked || settingsReadOnly) && 'pointer-events-none opacity-50')}>{modelSelector}</fieldset><Select value={permission} onValueChange={value => { if (!locked && !settingsReadOnly) onPermissionChange?.(value) }} disabled={locked || settingsReadOnly}><SelectTrigger aria-label="Permission mode" className="w-auto"><SelectValue /></SelectTrigger><SelectContent>{permissionOptions.map(option => <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>)}</SelectContent></Select><div className="ml-auto">{running ? <Button variant="bracket" size="sm" disabled={locked} onClick={() => { if (!locked) onStop?.() }}><Square aria-hidden="true" className="size-3" />Stop</Button> : <Button variant="bracket" size="sm" type="submit" disabled={locked || !value.trim()}>Send</Button>}</div></div>
    {mode === 'view-only' && <p className="text-text-secondary">View only: messages and host settings cannot be changed.</p>}
  </form>
}

export interface SharedBadgeProps extends HTMLAttributes<HTMLSpanElement> { hostName: string; permission: 'control' | 'view'; status?: 'connected' | 'connecting' | 'reconnecting' | 'disconnected' | 'initializing'; showStatus?: boolean }
export function SharedBadge({ hostName, permission, status = 'connected', showStatus = false, className, ...props }: SharedBadgeProps) {
  const Icon = status === 'connected' ? Wifi : status === 'disconnected' ? WifiOff : Circle
  return <span data-testid="shared-workspace-badge" className={cx('inline-flex flex-wrap items-center gap-2 font-code text-xs text-text-primary', className)} {...props} data-permission={permission}><span>[SHARED BY {hostName.toUpperCase()} · {permission.toUpperCase()}]</span>{showStatus && <span className="inline-flex items-center gap-1 text-text-secondary"><Icon aria-hidden="true" className={cx('size-3', status === 'connected' ? 'text-status-success' : status === 'disconnected' ? 'text-status-error' : 'text-status-warning')} />{status}</span>}</span>
}

export interface TerminalFrameProps extends Omit<HTMLAttributes<HTMLElement>, 'title'> { title?: string; status?: 'running' | 'ready' | 'disconnected'; readOnly?: boolean; actions?: ReactNode }
export function TerminalFrame({ title = 'Terminal', status = 'ready', readOnly = false, actions, children, className, ...props }: TerminalFrameProps) {
  return <section aria-label={title} className={cx('overflow-hidden rounded-md border border-border-subtle bg-surface-terminal font-code text-xs text-text-on-terminal', className)} {...props}><div className="flex flex-wrap items-center gap-2 border-b border-border-subtle bg-background px-3 py-2 text-text-primary"><span className={cx('size-1.5 rounded-full', status === 'ready' ? 'bg-status-ready' : status === 'running' ? 'bg-status-processing' : 'bg-status-error')} /><h2 className="text-xs">[{title.toUpperCase()}]</h2><span className="text-text-secondary">{status}</span>{readOnly && <span className="text-text-secondary">· read-only mirror</span>}<div className="ml-auto">{actions}</div></div><div className="min-h-32 p-3">{children}</div></section>
}

export interface PaletteCommand { id: string; label: string; group?: string; shortcut?: string; icon?: ReactNode; disabled?: boolean; onSelect?: () => void }
export interface CommandPaletteProps extends Omit<HTMLAttributes<HTMLDivElement>, 'children' | 'defaultValue'> { commands: PaletteCommand[]; placeholder?: string; emptyMessage?: string; /** When supplied, render as a modal; omit for an embedded shell. */ open?: boolean; onOpenChange?: (open: boolean) => void; className?: string }
export function CommandPalette({ commands, placeholder = 'Search commands and files…', emptyMessage = 'No matching commands.', open, onOpenChange, className, ...props }: CommandPaletteProps) {
  const groups = [...new Set(commands.map(command => command.group ?? 'Commands'))]
  const content = <><CommandInput aria-label="Search commands" placeholder={placeholder} /><CommandList><CommandEmpty>{emptyMessage}</CommandEmpty>{groups.map(group => <CommandGroup heading={group} key={group}>{commands.filter(command => (command.group ?? 'Commands') === group).map(command => <CommandItem key={command.id} value={`${command.label} ${command.id}`} disabled={command.disabled} onSelect={() => { if (!command.disabled) { command.onSelect?.(); onOpenChange?.(false) } }}>{command.icon}<span>{command.label}</span>{command.shortcut && <CommandShortcut>{command.shortcut}</CommandShortcut>}</CommandItem>)}</CommandGroup>)}</CommandList></>
  const commandProps = { className: cx('border border-border-subtle font-code', className), ...props }
  return open !== undefined ? <CommandDialog open={open} onOpenChange={onOpenChange} commandProps={commandProps}>{content}</CommandDialog> : <Command label="Command palette" {...commandProps}>{content}</Command>
}

export interface AppShellProps extends HTMLAttributes<HTMLDivElement> { sidebar?: ReactNode; topbar?: ReactNode; main: ReactNode; rightPanel?: ReactNode; bottomPanel?: ReactNode; sidebarLabel?: string; rightPanelLabel?: string }
/** Workspace layout slots; data, navigation and editor instances belong to the app. */
export function AppShell({ sidebar, topbar, main, rightPanel, bottomPanel, sidebarLabel = 'Workspace navigation', rightPanelLabel = 'Workspace details', className, ...props }: AppShellProps) {
  return <div className={cx('flex min-h-screen overflow-hidden bg-surface-messages font-code text-text-primary', className)} {...props}>{sidebar && <aside aria-label={sidebarLabel} className="hidden w-sidebar shrink-0 border-r border-border-subtle bg-surface-sidebar sm:block">{sidebar}</aside>}<div className="flex min-w-0 flex-1 flex-col">{topbar && <header className="border-b border-border-subtle bg-surface-card px-4 py-3">{topbar}</header>}<div className="flex min-h-0 flex-1"><main className="min-w-0 flex-1 overflow-auto bg-surface-card">{main}</main>{rightPanel && <aside aria-label={rightPanelLabel} className="hidden w-right-panel shrink-0 border-l border-border-subtle bg-surface-card lg:block">{rightPanel}</aside>}</div>{bottomPanel && <div className="border-t border-border-subtle">{bottomPanel}</div>}</div></div>
}
