import { useId, useState, type HTMLAttributes, type ReactNode, type Ref, type TextareaHTMLAttributes } from 'react'
import { Check, ChevronDown, ChevronRight, Circle, Loader2, LockKeyhole, Square, Wifi, WifiOff, X } from 'lucide-react'
import { Button, Command, CommandDialog, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList, CommandShortcut, Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../primitives'
import { cn } from '../primitives/utils'
import { Spinner } from '../brand'

const cx = (...values: (string | false | undefined)[]) => values.filter(Boolean).join(' ')
const focus = 'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus focus-visible:ring-offset-2 focus-visible:ring-offset-surface-card'

export interface MessageBubbleProps extends HTMLAttributes<HTMLElement> {
  variant?: 'user' | 'assistant' | 'system'
  /** Name displayed for a shared conversation. */
  author?: string
  actions?: ReactNode
  timestamp?: string
  appearance?: 'card' | 'terminal'
  heading?: ReactNode
  summary?: ReactNode
  footer?: ReactNode
  error?: boolean
}
export function MessageBubble({ variant = 'assistant', author, actions, timestamp, appearance = 'card', heading, summary, footer, error, children, className, ...props }: MessageBubbleProps) {
  if (appearance === 'terminal') return <article aria-label={`${author ?? variant} message`} className={cn('group relative px-6 font-code', variant === 'system' ? 'py-2 text-xs' : 'py-3', variant === 'assistant' && 'text-xs', className)} {...props}>
    {variant === 'system' ? <div className="flex justify-center"><span className="text-text-faint">─── </span><span className="text-text-muted">{children}</span><span className="text-text-faint"> ───</span></div> : variant === 'user' ? <>
      {author && <div className="text-xs text-text-muted mb-1" data-testid="message-author">{author}</div>}<div className="flex gap-2 text-sm"><span className="text-text-accent shrink-0">&gt;</span><div className="text-text-primary whitespace-pre-wrap break-words">{children}</div></div>
    </> : <>{summary}<div className={cn('border border-dashed border-border-subtle', error && 'border-status-error/50')}>{heading && <div className="flex items-center justify-between px-3 py-1.5 border-b border-dashed border-border-subtle">{heading}</div>}<div className="px-4 py-3">{children}</div>{footer}</div></>}
    {actions && <div className="absolute right-6 top-1 opacity-0 group-hover:opacity-100 focus-within:opacity-100">{actions}</div>}
  </article>
  return <article aria-label={`${author ?? variant} message`} className={cx('group relative rounded-md border border-border-subtle p-4 font-code text-sm', variant === 'user' ? 'ml-8 bg-surface-card-strong text-text-primary' : variant === 'system' ? 'bg-surface-card-muted text-text-secondary' : 'mr-8 bg-surface-card text-text-primary', className)} {...props}>
    <div className="mb-2 flex items-center gap-2 text-xs text-text-secondary"><span className="uppercase">[{author ?? variant}]</span>{timestamp && <time>{timestamp}</time>}<div className="ml-auto opacity-0 focus-within:opacity-100 group-hover:opacity-100 group-focus-within:opacity-100">{actions}</div></div><div className="space-y-3">{children}</div>
  </article>
}

export type ToolBlockStatus = 'running' | 'done' | 'failed'
export interface ToolCallSummaryProps extends HTMLAttributes<HTMLSpanElement> { tool: string; status: ToolBlockStatus; summary?: string; duration?: string }
export function ToolCallSummary({ tool, status, summary, duration, className, ...props }: ToolCallSummaryProps) {
  return <span className={cx('flex min-w-0 flex-1 items-center gap-2 font-code text-xs', className)} {...props}>{status === 'running' ? <Spinner label="Running" showLabel={false} /> : status === 'done' ? <Check aria-hidden="true" className="size-3 text-status-success" /> : <X aria-hidden="true" className="size-3 text-status-error" />}<span>{tool}</span><span className="text-text-secondary">{summary ?? status}</span><span className="sr-only">{status}</span>{duration && <span className="ml-auto text-text-secondary">{duration}</span>}</span>
}
export interface ToolBlockProps extends HTMLAttributes<HTMLDivElement> { tool: string; status?: ToolBlockStatus; summary?: string; duration?: string; defaultOpen?: boolean; header?: ReactNode; bodyClassName?: string }
/** Running calls open automatically; completed calls collapse until expanded. */
export function ToolBlock({ tool, status = 'running', summary, duration, defaultOpen, header, bodyClassName, children, className, ...props }: ToolBlockProps) {
  const id = useId()
  const [expansion, setExpansion] = useState({ status, open: defaultOpen ?? status !== 'done', toggled: false })
  const open = expansion.toggled || expansion.status === status ? expansion.open : status !== 'done'
  return <div data-state={open ? 'open' : 'closed'} className={cn('border border-dashed border-border-subtle bg-surface-card font-code text-text-primary', className)} {...props}><button type="button" className={cx('flex w-full items-center gap-2 px-3 py-2 text-left hover:bg-surface-hover', focus)} aria-expanded={open} aria-controls={id} onClick={() => setExpansion({ status, open: !open, toggled: true })}>{header ?? <>{open ? <ChevronDown aria-hidden="true" className="size-3" /> : <ChevronRight aria-hidden="true" className="size-3" />}<ToolCallSummary tool={tool} status={status} summary={summary} duration={duration} /></>}</button><div id={id} hidden={!open} className={cn("border-t border-dashed border-border-subtle p-3 text-xs", bodyClassName)}>{children}</div></div>
}

export type ApprovalState = 'actionable' | 'read-only' | 'resolved' | 'withdrawn'
export interface ApprovalCardProps extends HTMLAttributes<HTMLElement> {
  appearance?: 'card' | 'terminal'
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
export function ApprovalCard({ appearance = 'card', kind = 'command', title, reason, state = 'actionable', command, path, network, files, details, hostName, resolution = 'Approved once', busy = false, error, onApprove, onDeny, className, ...props }: ApprovalCardProps) {
  const id = useId(), disabled = state !== 'actionable' || busy
  return <section aria-labelledby={props['aria-label'] ? undefined : id} data-testid="approval-card" className={cn('border bg-surface-card font-code text-xs text-text-primary', appearance === 'terminal' ? 'space-y-2 border-text-accent/40 p-3 [&_h3]:text-xs [&_pre]:bg-transparent [&_pre]:p-0 [&_p]:text-text-secondary' : 'space-y-3 border-border-accent p-4', className)} {...props}>
    <h3 id={id} className="text-sm font-medium">{title ?? `Permission needed · ${kind}`}</h3><p className="text-text-secondary">{reason}</p>
    {hostName && appearance !== 'terminal' && <p className="text-text-secondary">Workspace shared by {hostName}</p>}
    {command && <div><span className="text-text-secondary">Command</span><pre data-testid="approval-command" className="mt-1 max-h-32 overflow-auto whitespace-pre-wrap break-all rounded-sm bg-surface-card-muted p-2">{command}</pre></div>}
    {path && <p className="break-all">Path: <code data-testid="approval-path">{path}</code></p>}
    {network && <p data-testid="approval-network" className="break-all">Network: {network}</p>}
    {files && <ul data-testid="approval-files" className="space-y-1 break-all">{files.map(file => <li key={`${file.kind}:${file.path}`}>{file.kind}: <code>{file.path}</code></li>)}</ul>}
    {details && <details><summary className={cx('cursor-pointer text-text-secondary', focus)}>Request details</summary><pre data-testid="approval-input" className="mt-2 max-h-32 overflow-auto whitespace-pre-wrap break-all">{details}</pre></details>}
    {state === 'read-only' && <p data-testid="approval-view-only" className="text-text-secondary">View only: {hostName ?? 'the host'} or a collaborator with control can answer.</p>}
    {state === 'resolved' && <p role="status">[RESOLVED] {resolution}</p>}
    {state === 'withdrawn' && <p role="status">[WITHDRAWN] This request is no longer available.</p>}
    {error && <p role="alert" className="flex items-start gap-2 text-text-primary"><X aria-hidden="true" className="size-4 shrink-0 text-status-error" />{error}</p>}
    {(state === 'actionable' || state === 'read-only') && <div className="flex flex-wrap gap-2"><Button variant={appearance === 'terminal' ? 'unstyled' : 'outline'} size="sm" className={appearance === 'terminal' ? 'border rounded-none border-border-subtle px-3 py-1 disabled:opacity-50 hover:text-text-accent' : undefined} data-testid="approval-allow" disabled={disabled} loading={appearance !== 'terminal' && busy} onClick={() => { if (!disabled) onApprove?.() }}>{busy ? 'Sending…' : 'Approve once'}</Button><Button variant={appearance === 'terminal' ? 'unstyled' : 'outline'} size="sm" className={appearance === 'terminal' ? 'border rounded-none border-border-subtle px-3 py-1 disabled:opacity-50 hover:text-status-error' : undefined} data-testid="approval-deny" disabled={disabled} onClick={() => { if (!disabled) onDeny?.() }}>Deny</Button></div>}
  </section>
}

export interface QuestionOption { value: string; label: string; description?: string }
export type QuestionValue = string | string[]
export interface QuestionCardProps extends Omit<HTMLAttributes<HTMLFormElement>, 'onChange' | 'onSubmit'> {
  title?: string
  question?: string
  appearance?: 'card' | 'terminal' | 'interview'
  heading?: ReactNode
  hideActions?: boolean
  /** Composed fields allow a request to collect several answers in one form. */
  ready?: boolean
  requiresHost?: boolean
  submitLabel?: string
  footerNote?: ReactNode
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
export function QuestionCard({ title = 'Your answer is needed', question, appearance = 'card', heading, hideActions = false, children, ready: readyProp, requiresHost = false, submitLabel = 'Submit answer', footerNote, variant = 'single', options = [], value = variant === 'multiple' ? [] : '', onValueChange, onSubmit, onCancel, state = 'actionable', hostName, busy = false, error, className, ...props }: QuestionCardProps) {
  const id = useId(), secretElsewhere = (variant === 'secret' || requiresHost) && hostName !== undefined
  const disabled = state !== 'actionable' || busy || secretElsewhere
  const ready = readyProp ?? (Array.isArray(value) ? value.length > 0 : value.trim().length > 0)
  const selected = Array.isArray(value) ? value : [value]
  return <form aria-label="Agent question" autoComplete="off" data-testid="question-card" className={cn(appearance === 'interview' ? 'max-w-2xl mx-auto' : 'space-y-4 border bg-surface-card font-code text-xs text-text-primary', appearance === 'terminal' ? 'border-text-accent/40 p-3 [&>h3]:text-xs' : appearance === 'card' ? 'border-border-accent p-4' : undefined, className)} onSubmit={event => { event.preventDefault(); if (!disabled && ready) onSubmit?.(value) }} {...props}>
    {heading ?? <h3 className="text-sm font-medium">{title}</h3>}
    {hostName && appearance !== 'terminal' && <p className="text-text-secondary">Workspace shared by {hostName}</p>}
    {children ?? <fieldset disabled={disabled} className="min-w-0 space-y-3"><legend className="mb-2 text-sm">{question}</legend>
      {(variant === 'single' || variant === 'multiple') && <><p className="text-text-secondary">{variant === 'multiple' ? 'Choose one or more.' : 'Choose one.'}</p>{options.map((option, index) => <label key={option.value} className="flex cursor-pointer items-start gap-2"><input className={cx('mt-0.5 size-4 shrink-0 accent-text-accent', focus)} type={variant === 'multiple' ? 'checkbox' : 'radio'} name={id} value={option.value} aria-labelledby={`${id}-label-${index}`} checked={selected.includes(option.value)} aria-describedby={option.description ? `${id}-${index}` : undefined} onChange={event => { if (!disabled) onValueChange?.(variant === 'single' ? option.value : event.target.checked ? [...selected, option.value] : selected.filter(item => item !== option.value)) }} /><span><span id={`${id}-label-${index}`}>{option.label}</span>{option.description && <span id={`${id}-${index}`} className="block text-text-secondary">{option.description}</span>}</span></label>)}</>}
      {variant === 'text' && <label className="block space-y-2"><span>Your answer</span><textarea rows={3} className={cx('block w-full rounded-sm border border-border-strong bg-surface-card-muted p-2 text-text-primary disabled:opacity-50', focus)} value={typeof value === 'string' ? value : ''} onChange={event => { if (!disabled) onValueChange?.(event.target.value) }} /></label>}
      {variant === 'secret' && !secretElsewhere && <label className="block space-y-2"><span>Secret answer</span><input type="password" autoComplete="off" className={cx('block w-full rounded-sm border border-border-strong bg-surface-card-muted p-2 text-text-primary disabled:opacity-50', focus)} value={typeof value === 'string' ? value : ''} onChange={event => { if (!disabled) onValueChange?.(event.target.value) }} /></label>}
    </fieldset>}
    {secretElsewhere && (appearance !== 'terminal' || state !== 'read-only') && <p data-testid="question-secret-on-host" className="flex gap-2 text-text-secondary"><LockKeyhole aria-hidden="true" className="size-4 shrink-0" />This asks for a secret, so {hostName || 'the host'} answers it on their machine.</p>}
    {state === 'read-only' && <p data-testid="question-view-only" className="text-text-secondary">View only: {hostName ?? 'the host'} or a collaborator with control can answer.</p>}
    {state === 'resolved' && <p role="status">[ANSWERED] Your answer has been sent.</p>}
    {state === 'withdrawn' && <p role="status">[WITHDRAWN] This question is no longer available.</p>}
    {error && <p role="alert" className="flex items-start gap-2 text-text-primary"><X aria-hidden="true" className="size-4 shrink-0 text-status-error" />{error}</p>}
    {footerNote}
    {!hideActions && (state === 'actionable' || state === 'read-only') && <div className="flex flex-wrap gap-2"><Button type="submit" variant={appearance === 'terminal' ? 'unstyled' : 'outline'} size="sm" className={appearance === 'terminal' ? 'border rounded-none border-border-subtle px-3 py-1 disabled:opacity-50 hover:text-text-accent' : undefined} data-testid="question-submit" disabled={disabled || !ready} loading={appearance !== 'terminal' && busy}>{busy ? 'Sending…' : submitLabel}</Button><Button variant={appearance === 'terminal' ? 'unstyled' : 'outline'} size="sm" className={appearance === 'terminal' ? 'border rounded-none border-border-subtle px-3 py-1 disabled:opacity-50 hover:text-status-error' : undefined} data-testid="question-cancel" disabled={disabled} onClick={() => { if (!disabled) onCancel?.() }}>Cancel and stop</Button></div>}
  </form>
}

export interface ComposerProps extends Omit<HTMLAttributes<HTMLFormElement>, 'onChange' | 'onSubmit'> {
  appearance?: 'card' | 'terminal'
  textareaRef?: Ref<HTMLTextAreaElement>
  textareaProps?: Omit<TextareaHTMLAttributes<HTMLTextAreaElement>, 'value' | 'defaultValue' | 'disabled'> & { [attribute: `data-${string}`]: string | undefined }
  footer?: ReactNode
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
export function Composer({ appearance = 'card', textareaRef, textareaProps, footer, children, value, onValueChange, onSend, onStop, mode = 'own', ownerName = 'Gorka', modelSelector, permission = 'on-request', permissionOptions = [{ value: 'on-request', label: 'Ask for approval' }, { value: 'read-only', label: 'Read only' }], onPermissionChange, settingsReadOnly = mode !== 'own', attachments, running = false, disabled = false, placeholder, className, ...props }: ComposerProps) {
  const locked = disabled || mode === 'view-only'
  const hint = placeholder ?? (mode === 'view-only' ? `View only · ${ownerName} controls this session` : mode === 'shared' ? `Message ${ownerName}'s shared session…` : 'Ask Koda to build, explain, or fix…')
  if (appearance === 'terminal') return <form aria-label="Message composer" className={cn('group border border-dashed border-border-subtle focus-within:border-text-accent transition-colors font-code', className)} onSubmit={event => { event.preventDefault(); if (!locked && !running && value.trim()) onSend?.() }} {...props}>
    <div className="flex min-h-20 max-h-50 overflow-y-auto px-3 py-3"><span className="text-text-accent text-sm mr-2 mt-0.5 select-none">&gt;</span><textarea ref={textareaRef} aria-label="Message" value={value} onChange={event => onValueChange?.(event.target.value)} placeholder={hint} {...textareaProps} disabled={locked || running} className={cn('flex-1 min-h-15 resize-none bg-transparent text-sm text-text-primary placeholder:text-text-faint focus:outline-none disabled:opacity-50 disabled:cursor-not-allowed', textareaProps?.className)} /></div>
    {children}{attachments}{footer}
  </form>
  return <form aria-label="Message composer" className={cx('space-y-3 rounded-md border border-border-strong bg-surface-card p-3 font-code text-xs text-text-primary', className)} onSubmit={event => { event.preventDefault(); if (!locked && !running && value.trim()) onSend?.() }} {...props}>
    {attachments && <div aria-label="Attachments" className="flex flex-wrap gap-2">{attachments}</div>}
    <textarea aria-label="Message" value={value} disabled={locked} onChange={event => { if (!locked) onValueChange?.(event.target.value) }} onKeyDown={event => { if (event.key === 'Enter' && (event.metaKey || event.ctrlKey) && !event.nativeEvent.isComposing && !locked && !running && value.trim()) { event.preventDefault(); onSend?.() } }} rows={3} placeholder={hint} className={cx('block w-full resize-y rounded-sm bg-transparent p-2 text-sm text-text-primary placeholder:text-text-secondary disabled:cursor-not-allowed', focus)} />
    <div className="flex flex-wrap items-center gap-2"><fieldset disabled={locked || settingsReadOnly} aria-label="Model" className={cx('min-w-0', (locked || settingsReadOnly) && 'pointer-events-none opacity-50')}>{modelSelector}</fieldset><Select value={permission} onValueChange={value => { if (!locked && !settingsReadOnly) onPermissionChange?.(value) }} disabled={locked || settingsReadOnly}><SelectTrigger aria-label="Permission mode" className="w-auto"><SelectValue /></SelectTrigger><SelectContent>{permissionOptions.map(option => <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>)}</SelectContent></Select><div className="ml-auto">{running ? <Button variant="bracket" size="sm" disabled={locked} onClick={() => { if (!locked) onStop?.() }}><Square aria-hidden="true" className="size-3" />Stop</Button> : <Button variant="bracket" size="sm" type="submit" disabled={locked || !value.trim()}>Send</Button>}</div></div>
    {mode === 'view-only' && <p className="text-text-secondary">View only: messages and host settings cannot be changed.</p>}
  </form>
}

export interface SharedBadgeProps extends HTMLAttributes<HTMLSpanElement> { hostName?: string; icon?: ReactNode; connectionOnly?: boolean; showLabel?: boolean; permission?: 'control' | 'view'; status?: 'connected' | 'connecting' | 'reconnecting' | 'disconnected' | 'initializing'; showStatus?: boolean }
export function SharedBadge({ hostName = '', icon, permission = 'view', connectionOnly = false, showLabel = false, status = 'connected', showStatus = false, className, ...props }: SharedBadgeProps) {
  const Icon = status === 'connected' ? Wifi : status === 'disconnected' ? WifiOff : Circle
  if (connectionOnly) {
    const label = status === 'connected' ? 'Connected' : status === 'connecting' ? 'Connecting...' : status === 'reconnecting' ? 'Reconnecting...' : status === 'disconnected' ? 'Disconnected' : 'Initializing...'
    const tone = status === 'connected' ? 'text-status-success-foreground bg-status-success/10' : status === 'connecting' || status === 'reconnecting' ? 'text-status-warning-foreground bg-status-warning/10' : 'text-muted-foreground bg-muted'
    const ConnectionIcon = status === 'connecting' || status === 'reconnecting' ? Loader2 : status === 'disconnected' ? WifiOff : Wifi
    return <span title={`Collaboration: ${label}`} className={cn('flex items-center gap-1.5 px-2 py-1 rounded text-xs', tone, className)} {...props}><ConnectionIcon aria-hidden="true" className={cx('size-3', (status === 'connecting' || status === 'reconnecting') && 'animate-spin')} />{showLabel && <span className="font-medium">{label}</span>}</span>
  }
  return <span data-testid="shared-workspace-badge" className={cn('inline-flex flex-wrap items-center gap-2 font-code text-xs text-text-primary', className)} {...props} data-permission={permission}>{icon}<span>[SHARED BY {hostName.toUpperCase()} · {permission.toUpperCase()}]</span>{showStatus && <span className="inline-flex items-center gap-1 text-text-secondary"><Icon aria-hidden="true" className={cx('size-3', status === 'connected' ? 'text-status-success' : status === 'disconnected' ? 'text-status-error' : 'text-status-warning')} />{status}</span>}</span>
}

export interface TerminalFrameProps extends Omit<HTMLAttributes<HTMLElement>, 'title'> { title?: string; status?: 'running' | 'ready' | 'disconnected'; readOnly?: boolean; actions?: ReactNode; header?: ReactNode; bodyClassName?: string }
export function TerminalFrame({ title = 'Terminal', status = 'ready', readOnly = false, actions, header, bodyClassName, children, className, ...props }: TerminalFrameProps) {
  return <section aria-label={title} className={cn('flex flex-col overflow-hidden rounded-md border border-border-subtle bg-surface-terminal font-code text-xs text-text-on-terminal', className)} {...props}>{header ?? <div className="flex flex-wrap items-center gap-2 border-b border-border-subtle bg-background px-3 py-2 text-text-primary"><span className={cx('size-1.5 rounded-full', status === 'ready' ? 'bg-status-ready' : status === 'running' ? 'bg-status-processing' : 'bg-status-error')} /><h2 className="text-xs">[{title.toUpperCase()}]</h2><span className="text-text-secondary">{status}</span>{readOnly && <span className="text-text-secondary">· read-only mirror</span>}<div className="ml-auto">{actions}</div></div>}<div className={cn("min-h-32 p-3", bodyClassName)}>{children}</div></section>
}

export interface PaletteCommand { id: string; label: string; group?: string; shortcut?: string; icon?: ReactNode; disabled?: boolean; onSelect?: () => void }
export interface CommandPaletteProps extends Omit<HTMLAttributes<HTMLDivElement>, 'children' | 'defaultValue'> { commands: PaletteCommand[]; placeholder?: string; emptyMessage?: string; /** When supplied, render as a modal; omit for an embedded shell. */ open?: boolean; onOpenChange?: (open: boolean) => void; className?: string }
export function CommandPalette({ commands, placeholder = 'Search commands and files…', emptyMessage = 'No matching commands.', open, onOpenChange, className, ...props }: CommandPaletteProps) {
  const groups = [...new Set(commands.map(command => command.group ?? 'Commands'))]
  const content = <><CommandInput aria-label="Search commands" placeholder={placeholder} /><CommandList><CommandEmpty>{emptyMessage}</CommandEmpty>{groups.map(group => <CommandGroup heading={group} key={group}>{commands.filter(command => (command.group ?? 'Commands') === group).map(command => <CommandItem key={command.id} value={`${command.label} ${command.id}`} disabled={command.disabled} onSelect={() => { if (!command.disabled) { command.onSelect?.(); onOpenChange?.(false) } }}>{command.icon}<span>{command.label}</span>{command.shortcut && <CommandShortcut>{command.shortcut}</CommandShortcut>}</CommandItem>)}</CommandGroup>)}</CommandList></>
  const commandProps = { className: cx('border border-border-subtle font-code', className), ...props }
  return open !== undefined ? <CommandDialog open={open} onOpenChange={onOpenChange} commandProps={commandProps}>{content}</CommandDialog> : <Command label="Command palette" {...commandProps}>{content}</Command>
}

export interface AppShellProps extends HTMLAttributes<HTMLDivElement> { sidebar?: ReactNode; topbar?: ReactNode; main: ReactNode; rightPanel?: ReactNode; bottomPanel?: ReactNode; sidebarLabel?: string; rightPanelLabel?: string; variant?: 'workspace' | 'navigation' }
/** Workspace layout slots; data, navigation and editor instances belong to the app. */
export function AppShell({ sidebar, topbar, main, rightPanel, bottomPanel, sidebarLabel = 'Workspace navigation', rightPanelLabel = 'Workspace details', variant = 'workspace', children, className, ...props }: AppShellProps) {
  if (variant === 'navigation') return <div className={cn('h-screen w-screen overflow-hidden bg-surface-messages grid grid-cols-[var(--sidebar-width)_1fr]', className)} {...props}><aside aria-label={sidebarLabel} className="relative glass-sidebar border-r border-border-subtle overflow-hidden">{sidebar}</aside><main className="overflow-hidden bg-surface-messages">{main}</main>{children}</div>
  return <div className={cx('flex min-h-screen overflow-hidden bg-surface-messages font-code text-text-primary', className)} {...props}>{sidebar && <aside aria-label={sidebarLabel} className="hidden w-sidebar shrink-0 border-r border-border-subtle bg-surface-sidebar sm:block">{sidebar}</aside>}<div className="flex min-w-0 flex-1 flex-col">{topbar && <header className="border-b border-border-subtle bg-surface-card px-4 py-3">{topbar}</header>}<div className="flex min-h-0 flex-1"><main className="min-w-0 flex-1 overflow-auto bg-surface-card">{main}</main>{rightPanel && <aside aria-label={rightPanelLabel} className="hidden w-right-panel shrink-0 border-l border-border-subtle bg-surface-card lg:block">{rightPanel}</aside>}</div>{bottomPanel && <div className="border-t border-border-subtle">{bottomPanel}</div>}</div></div>
}
