import { useEffect, useId, useRef, useState, type ButtonHTMLAttributes, type HTMLAttributes, type ReactNode } from 'react'
import { ChevronDown, ChevronRight, Copy, File, FileCode, FileJson, FileText, Folder, FolderOpen, Terminal } from 'lucide-react'
import { Button } from '../primitives'
import { Slot } from '@radix-ui/react-slot'
import { cn } from '../primitives/utils'
import './brand.css'

const cx = (...values: (string | false | undefined)[]) => values.filter(Boolean).join(' ')
const focus = 'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus focus-visible:ring-offset-2 focus-visible:ring-offset-surface-messages'

/** The original Koda splash logo, preserved from desktop's kodaArt.ts. */
export const KODA_ASCII = `██╗  ██╗ ██████╗ ██████╗  █████╗
██║ ██╔╝██╔═══██╗██╔══██╗██╔══██╗
█████╔╝ ██║   ██║██║  ██║███████║
██╔═██╗ ██║   ██║██║  ██║██╔══██║
██║  ██╗╚██████╔╝██████╔╝██║  ██║
╚═╝  ╚═╝ ╚═════╝ ╚═════╝ ╚═╝  ╚═╝`

function useFrame(speed: number, length: number, animated = true) {
  const [frame, setFrame] = useState(0)
  useEffect(() => {
    const media = window.matchMedia('(prefers-reduced-motion: reduce)')
    if (!animated || media.matches) return
    const timer = window.setInterval(() => setFrame(value => (value + 1) % length), speed)
    return () => window.clearInterval(timer)
  }, [speed, length, animated])
  return frame
}

export interface KodaLogoProps extends HTMLAttributes<HTMLPreElement> {
  /** Original ASCII mark at three display sizes. */
  size?: 'sm' | 'md' | 'lg'
  /** Scan the logo line by line; respects reduced motion. */
  animated?: boolean
}
export function KodaLogo({ size = 'lg', animated = false, className, ...props }: KodaLogoProps) {
  const frame = useFrame(100, 9, animated)
  return <pre role="img" aria-label="Koda" className={cx('koda-logo font-code leading-tight', `koda-logo-${size}`, className)} {...props}>{KODA_ASCII.split('\n').map((line, index) => <span aria-hidden="true" key={line} className={cx('block transition-colors duration-fast', animated && frame === index ? 'text-text-action koda-text-glow' : animated && Math.abs(frame - index) === 1 ? 'text-status-success-foreground' : 'text-text-secondary')}>{line}</span>)}</pre>
}

export type SpinnerVariant = 'wave' | 'scan' | 'pulse' | 'matrix' | 'bounce'
export interface SpinnerProps extends HTMLAttributes<HTMLSpanElement> {
  variant?: SpinnerVariant
  label?: string
  showLabel?: boolean
  /** Override the frame interval, in milliseconds. */
  speed?: number
}
const speeds: Record<SpinnerVariant, number> = { wave: 150, scan: 120, pulse: 400, matrix: 80, bounce: 200 }
const lengths: Record<SpinnerVariant, number> = { wave: 5, scan: 8, pulse: 3, matrix: 40, bounce: 4 }
const matrixChars = '01アイウエオカキクケコサシスセソタチツテトナニヌネノ'
/** Koda's five original letter animations, with a stable accessible status label. */
export function Spinner({ variant = 'wave', label = 'Loading', showLabel = true, speed, className, ...props }: SpinnerProps) {
  const frame = useFrame(speed ?? speeds[variant], lengths[variant])
  return <span role="status" aria-label={label} className={cx('inline-flex items-center gap-2 font-code text-sm', className)} {...props}>
    <span aria-hidden="true" className={cx('inline-flex tracking-wider', variant === 'pulse' && cx('transition-all duration-normal', frame === 0 ? 'scale-105 text-text-action koda-text-glow' : 'text-text-secondary'))}>
      {'KODA'.split('').map((letter, index) => {
        const distance = Math.abs(frame - index * 2)
        const character = variant === 'matrix' && frame < 20 + index * 5 ? matrixChars[(frame * 7 + index * 13) % matrixChars.length] : letter
        return <span key={letter} className={cx('inline-block transition-all duration-fast',
          variant === 'wave' && (frame === index ? 'text-text-action scale-110 font-bold' : index < frame ? 'text-status-success-foreground' : 'text-text-dim'),
          variant === 'scan' && (distance < 2 ? 'text-text-action koda-text-glow' : 'text-text-dim'),
          variant === 'matrix' && (character === letter ? 'text-status-success-foreground' : 'text-text-action'),
          variant === 'bounce' && (index === frame ? '-translate-y-1 text-text-action' : 'text-text-secondary'))}
          style={variant === 'scan' ? { opacity: distance === 0 ? 1 : distance === 1 ? 0.7 : distance === 2 ? 0.4 : 0.2 } : undefined}>{character}</span>
      })}
    </span>{showLabel && <span aria-hidden="true" className="text-text-secondary text-xs">{label}</span>}
  </span>
}

export interface LoadingScreenProps extends HTMLAttributes<HTMLDivElement> { message?: string; progress?: number }
export function LoadingScreen({ message = 'Initializing workspace…', progress, className, ...props }: LoadingScreenProps) {
  return <div className={cx('flex min-h-80 flex-col items-center justify-center gap-6 bg-surface-messages p-8 font-code', className)} {...props}>
    <KodaLogo animated /><Spinner label={message} />
    {progress !== undefined && <progress aria-label={message} max={100} value={Math.max(0, Math.min(100, progress))} className="koda-progress h-1 w-48" />}
  </div>
}

export interface WorkingIndicatorProps extends HTMLAttributes<HTMLSpanElement> { compact?: boolean; elapsedMs?: number; label?: string }
export function WorkingIndicator({ compact = false, elapsedMs = 0, label = 'working', className, ...props }: WorkingIndicatorProps) {
  const seconds = Math.max(0, Math.floor(elapsedMs / 1000))
  const elapsed = seconds < 60 ? `${seconds}s` : `${Math.floor(seconds / 60)}m ${seconds % 60}s`
  return <span className={cx('inline-flex items-center font-code text-text-secondary', compact ? 'gap-1 text-xs' : 'gap-2 text-sm', className)} {...props}>
    <span aria-hidden="true">[</span><Spinner showLabel={false} label={label} className={compact ? 'text-xs' : undefined} /><span aria-hidden="true">]</span><span>{label}</span><span className="tabular-nums">{elapsed}</span>
  </span>
}
export function CompactWorkingIndicator(props: Omit<WorkingIndicatorProps, 'compact'>) { return <WorkingIndicator compact {...props} /> }

export interface TerminalSectionProps extends Omit<HTMLAttributes<HTMLElement>, 'title'> { title: string; description?: string; action?: ReactNode; compact?: boolean }
export function TerminalSection({ title, description, action, compact = false, children, className, ...props }: TerminalSectionProps) {
  const id = useId()
  if (compact) return <section aria-labelledby={id} className={cx('font-code text-xs', className)} {...props}>
    <div className="flex items-center text-text-faint mb-2"><span aria-hidden="true">┌─ </span><h2 id={id} className="text-xs text-text-action">{title}</h2><span aria-hidden="true"> {'─'.repeat(Math.max(0, 30 - title.length))}</span>{action}<span aria-hidden="true">┐</span></div>
    <div className="px-4 py-3 border-x border-dashed border-border-subtle">{description && <p className="text-text-muted mb-3">{description}</p>}{children}</div>
    <div aria-hidden="true" className="text-text-faint">└{'─'.repeat(34)}┘</div>
  </section>
  return <section aria-labelledby={id} className={cx('font-code text-xs', className)} {...props}>
    <div className="mb-2 flex items-center gap-1 text-text-secondary"><span aria-hidden="true">┌─</span><h2 id={id} className="text-xs uppercase text-text-action">{title}</h2><span aria-hidden="true" className="min-w-0 flex-1 overflow-hidden whitespace-nowrap"> {'─'.repeat(60)}</span>{action}<span aria-hidden="true">┐</span></div>
    <div className="border-x border-dashed border-border-subtle px-4 py-3">{description && <p className="mb-3 text-text-secondary">{description}</p>}{children}</div>
    <div aria-hidden="true" className="flex text-text-secondary"><span>└</span><span className="min-w-0 flex-1 overflow-hidden whitespace-nowrap">{'─'.repeat(80)}</span><span>┘</span></div>
  </section>
}

export interface PanelHeaderProps extends Omit<HTMLAttributes<HTMLDivElement>, 'title'> { title: string; count?: number; actions?: ReactNode }
export function PanelHeader({ title, count, actions, className, ...props }: PanelHeaderProps) {
  return <div className={cx('flex items-center gap-2 border-b border-border-subtle px-3 py-2 font-code text-xs', className)} {...props}><h2 className="flex-1 uppercase text-text-secondary">[{title}]{count !== undefined && <span className="ml-2 text-text-primary">{count}</span>}</h2>{actions}</div>
}
export interface PanelProps extends Omit<HTMLAttributes<HTMLElement>, 'title'> { title: string; count?: number; actions?: ReactNode; variant?: 'sidebar' | 'right' }
export function Panel({ title, count, actions, variant = 'sidebar', children, className, ...props }: PanelProps) {
  return <section aria-label={title} className={cx('flex min-h-0 flex-col border border-border-subtle', variant === 'sidebar' ? 'bg-surface-sidebar' : 'bg-surface-card', className)} {...props}><PanelHeader title={title} count={count} actions={actions} /><div className="min-h-0 overflow-auto">{children}</div></section>
}

export interface EmptyStateProps extends HTMLAttributes<HTMLDivElement> { message: string; description?: string; art?: string; icon?: ReactNode; action?: ReactNode }
export function EmptyState({ message, description, art, icon, action, className, ...props }: EmptyStateProps) {
  return <div className={cx('flex flex-col items-center justify-center gap-3 p-8 text-center font-code', className)} {...props}>{art ? <pre aria-hidden="true" className="text-text-secondary">{art}</pre> : icon && <span aria-hidden="true" className="text-text-secondary">{icon}</span>}<p className="text-sm text-text-primary">{message}</p>{description && <p className="max-w-sm text-xs text-text-secondary">{description}</p>}{action}</div>
}

export interface NavItemProps extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'children'> {
  label: string; icon?: ReactNode; meta?: ReactNode; trailing?: ReactNode; actions?: ReactNode
  active?: boolean; unread?: boolean; running?: boolean
  /** Compose a router link without nesting interactive elements. */
  asChild?: boolean
  /** Custom row content keeps feature-specific metadata in the consumer. */
  children?: ReactNode
  buttonClassName?: string
}
export function NavItem({ label, icon, meta, trailing, actions, active, unread, running, disabled, className, buttonClassName, asChild = false, children, ...props }: NavItemProps) {
  const Control = asChild ? Slot : 'button'
  return <div className={cn('group flex items-center font-code text-xs', active ? 'bg-surface-active' : 'hover:bg-surface-hover', disabled && 'opacity-50', className)}>
    <Control type={asChild ? undefined : 'button'} disabled={asChild ? undefined : disabled} aria-disabled={disabled || undefined} aria-current={active ? 'page' : undefined} className={cn('flex min-w-0 flex-1 items-center gap-2 rounded-sm px-3 py-2 text-left text-text-primary disabled:cursor-not-allowed', focus, buttonClassName)} {...props}>
      {children ?? <>{icon && <span aria-hidden="true" className="shrink-0 text-text-secondary">{icon}</span>}<span className="min-w-0 flex-1"><span className={cn('block truncate', unread && 'font-semibold')}>{label}</span>{meta && <span className="block truncate text-text-secondary">{meta}</span>}</span>{unread && <span className="size-1.5 rounded-full bg-status-unread"><span className="sr-only">Unread</span></span>}{running && <Spinner showLabel={false} label="Running" />}{trailing}</>}
    </Control>{actions && <fieldset disabled={disabled} aria-label="Row actions" className="flex items-center pr-2 opacity-0 focus-within:opacity-100 group-hover:opacity-100 group-focus-within:opacity-100">{actions}</fieldset>}
  </div>
}
export const ListRow = NavItem

export interface TreeItem {
  id: string
  label: string
  children?: TreeItem[]
  icon?: ReactNode
  disabled?: boolean
  meta?: ReactNode
  /** Optional label markup while retaining label for keyboard typeahead. */
  content?: ReactNode
  /** Depth offset for an independently rendered row. */
  depth?: number
}
export type TreeRowProps = HTMLAttributes<HTMLDivElement> & { [attribute: `data-${string}`]: string | number | boolean | undefined }
export interface TreeProps extends Omit<HTMLAttributes<HTMLDivElement>, 'onSelect'> {
  items: TreeItem[]
  selectedId?: string
  onSelect?: (item: TreeItem) => void
  defaultExpandedIds?: string[]
  /** Controlled expansion lets the caller load children without moving data logic here. */
  expandedIds?: ReadonlySet<string>
  onExpandedChange?: (item: TreeItem, expanded: boolean) => void
  rowProps?: (item: TreeItem) => TreeRowProps
  label?: string
  containerRef?: React.Ref<HTMLDivElement>
  /** Measured rows supplied by the caller's virtualizer. */
  virtual?: { rows: { index: number; start: number; key: string | number | bigint }[]; totalSize: number; measureElement?: (element: HTMLDivElement | null) => void; scrollToIndex?: (index: number) => void }
  expandButtonTestId?: string
  rowClassName?: string
  indent?: '3' | '4'
}
/** A roving-tabindex ARIA tree with controlled expansion, virtual rows and typeahead. */
export function Tree({ items, selectedId, onSelect, defaultExpandedIds = [], expandedIds, onExpandedChange, rowProps, label = 'Files', className, containerRef, virtual, expandButtonTestId, rowClassName, indent = '4', ...props }: TreeProps) {
  const [localExpanded, setExpanded] = useState(new Set(defaultExpandedIds))
  const expanded = expandedIds ?? localExpanded
  const [focused, setFocused] = useState<string | undefined>(selectedId)
  const refs = useRef(new Map<string, HTMLDivElement>())
  const typeahead = useRef({ text: '', time: 0 })
  const rows: { item: TreeItem; level: number; parent?: string; pos: number; count: number }[] = []
  function visit(nodes: TreeItem[], level: number, parent?: string) { nodes.forEach((item, index) => { rows.push({ item, level: level + (item.depth ?? 0), parent, pos: index + 1, count: nodes.length }); if (item.children && expanded.has(item.id)) visit(item.children, level + 1, item.id) }) }
  visit(items, 1)
  const enabled = rows.filter(row => !row.item.disabled)
  const focusId = enabled.some(row => row.item.id === focused) ? focused : enabled[0]?.item.id
  useEffect(() => { if (focused) refs.current.get(focused)?.focus({ preventScroll: true }) }, [focused, virtual?.rows])
  function move(id?: string) { if (id) { setFocused(id); const element = refs.current.get(id); if (element) element.focus(); else virtual?.scrollToIndex?.(rows.findIndex(row => row.item.id === id)) } }
  function toggle(item: TreeItem, open: boolean) {
    if (!expandedIds) setExpanded(current => { const next = new Set(current); if (open) next.add(item.id); else next.delete(item.id); return next })
    onExpandedChange?.(item, open)
  }
  function renderRow({ item, level, parent, pos, count }: typeof rows[number]) {
    const custom = rowProps?.(item)
    return <div key={item.id} {...custom} ref={element => { if (element) refs.current.set(item.id, element); else refs.current.delete(item.id) }} role="treeitem" aria-label={item.label} tabIndex={item.id === focusId ? 0 : -1} aria-level={level} aria-posinset={pos} aria-setsize={count} aria-selected={selectedId === item.id} aria-expanded={item.children ? expanded.has(item.id) : undefined} aria-disabled={item.disabled || undefined}
      className={cn('flex cursor-default items-center gap-2 rounded-sm px-2 py-1.5 text-text-primary hover:bg-surface-hover', focus, selectedId === item.id && 'bg-surface-active', item.disabled && 'opacity-50', rowClassName, custom?.className)}
      style={{ ...custom?.style, paddingLeft: `calc(var(--space-2) + ${level - 1} * var(--space-${indent}))` }}
      onFocus={() => setFocused(item.id)} onClick={() => { if (!item.disabled) { move(item.id); onSelect?.(item); if (item.children) toggle(item, !expanded.has(item.id)) } }}
      onKeyDown={event => {
        custom?.onKeyDown?.(event)
        if (item.disabled || event.defaultPrevented) return
        const index = enabled.findIndex(row => row.item.id === item.id)
        if (['ArrowDown', 'ArrowUp', 'ArrowRight', 'ArrowLeft', 'Home', 'End', 'Enter', ' '].includes(event.key)) event.preventDefault()
        if (event.key === 'ArrowDown') move(enabled[Math.min(enabled.length - 1, index + 1)]?.item.id)
        if (event.key === 'ArrowUp') move(enabled[Math.max(0, index - 1)]?.item.id)
        if (event.key === 'Home') move(enabled[0]?.item.id)
        if (event.key === 'End') move(enabled.at(-1)?.item.id)
        if (event.key === 'ArrowRight' && item.children) { if (!expanded.has(item.id)) toggle(item, true); else move(item.children.find(child => !child.disabled)?.id) }
        if (event.key === 'ArrowLeft') { if (item.children && expanded.has(item.id)) toggle(item, false); else { let ancestor = rows.find(row => row.item.id === parent); while (ancestor?.item.disabled) ancestor = rows.find(row => row.item.id === ancestor?.parent); move(ancestor?.item.id) } }
        if (event.key === 'Enter' || event.key === ' ') { onSelect?.(item); if (item.children) toggle(item, !expanded.has(item.id)) }
        if (event.key.length === 1 && event.key !== ' ' && !event.metaKey && !event.ctrlKey && !event.altKey) {
          const now = Date.now(); typeahead.current.text = now - typeahead.current.time > 600 ? event.key : typeahead.current.text + event.key; typeahead.current.time = now
          const ordered = [...enabled.slice(index + 1), ...enabled.slice(0, index + 1)]
          move(ordered.find(row => row.item.label.toLowerCase().startsWith(typeahead.current.text.toLowerCase()))?.item.id)
        }
      }}>
      {item.children ? <button type="button" tabIndex={-1} disabled={item.disabled} data-testid={expandButtonTestId} aria-label={expanded.has(item.id) ? 'Collapse' : 'Expand'} className="shrink-0 rounded-sm p-0.5 hover:bg-surface-control" onClick={event => { event.stopPropagation(); toggle(item, !expanded.has(item.id)) }}>{expanded.has(item.id) ? <ChevronDown aria-hidden="true" className="size-3" /> : <ChevronRight aria-hidden="true" className="size-3" />}</button> : <span aria-hidden="true" className="w-4 shrink-0" />}
      {item.icon ?? <FileIcon filename={item.label} type={item.children ? 'directory' : 'file'} isExpanded={expanded.has(item.id)} />}<span className="min-w-0 flex-1 truncate">{item.content ?? item.label}</span>{item.meta}
    </div>
  }
  return <div ref={containerRef} role="tree" aria-label={label} className={cn('font-code text-xs', className)} {...props}>
    {virtual ? <div className="relative w-full" style={{ height: virtual.totalSize }}>{virtual.rows.map(row => rows[row.index] && <div key={String(row.key)} data-index={row.index} ref={virtual.measureElement} className="absolute left-0 top-0 w-full" style={{ transform: `translateY(${row.start}px)` }}>{renderRow(rows[row.index]!)}</div>)}</div> : rows.map(renderRow)}
  </div>
}

export type FileIconType = 'ts' | 'tsx' | 'js' | 'jsx' | 'css' | 'json' | 'md' | 'html' | 'rust' | 'default'
/** The desktop file extension mapping, independent of its file explorer store. */
export function getFileIconType(filename: string): FileIconType {
  const extension = filename.split('.').at(-1)?.toLowerCase()
  if (extension === 'rs') return 'rust'
  if (extension === 'mdx') return 'md'
  if (extension === 'htm') return 'html'
  if (extension && ['scss', 'sass', 'less'].includes(extension)) return 'css'
  return extension && ['ts', 'tsx', 'js', 'jsx', 'css', 'json', 'md', 'html'].includes(extension) ? extension as FileIconType : 'default'
}
export interface FileIconProps extends Omit<HTMLAttributes<SVGSVGElement>, 'children'> { filename: string; type?: 'file' | 'directory'; isExpanded?: boolean; size?: 12 | 14 | 16; appearance?: 'outline' | 'filled' }
export function FileIcon({ filename, type = 'file', isExpanded = false, size = 16, appearance = 'outline', className, ...props }: FileIconProps) {
  const fileType = getFileIconType(filename)
  if (appearance === 'filled') {
    const tone = { folder: 'text-file-icon-folder', ts: 'text-file-icon-ts', tsx: 'text-file-icon-tsx', js: 'text-file-icon-js', jsx: 'text-file-icon-jsx', css: 'text-file-icon-css', json: 'text-file-icon-json', md: 'text-file-icon-md', html: 'text-file-icon-html', rust: 'text-file-icon-rust', default: 'text-file-icon-default' }[type === 'directory' ? 'folder' : fileType]
    return <svg aria-hidden="true" data-testid={type === 'directory' ? isExpanded ? 'folder-icon-open' : 'folder-icon' : `file-icon-${fileType}`} className={cn('shrink-0', size === 12 ? 'size-3' : size === 14 ? 'size-3.5' : 'size-4', tone, className)} viewBox="0 0 24 24" fill="currentColor" {...props}>
      <path d={type === 'directory' ? isExpanded ? 'M20 6h-8l-2-2H4c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V8c0-1.1-.9-2-2-2zm0 12H4V8h16v10z' : 'M10 4H4c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V8c0-1.1-.9-2-2-2h-8l-2-2z' : 'M14 2H6c-1.1 0-2 .9-2 2v16c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V8l-6-6zm-1 7V3.5L18.5 9H13z'} />
    </svg>
  }
  const Icon = type === 'directory' ? isExpanded ? FolderOpen : Folder : fileType === 'json' ? FileJson : fileType === 'md' ? FileText : fileType === 'default' ? File : FileCode
  const tone = type === 'directory' || ['js', 'jsx', 'json'].includes(fileType) ? 'text-status-warning' : ['ts', 'tsx', 'css'].includes(fileType) ? 'text-text-action' : ['rust', 'html'].includes(fileType) ? 'text-status-reviewing' : 'text-text-secondary'
  return <Icon aria-hidden="true" data-testid={type === 'directory' ? isExpanded ? 'folder-icon-open' : 'folder-icon' : `file-icon-${fileType}`} className={cx('shrink-0', size === 12 ? 'size-3' : size === 14 ? 'size-3.5' : 'size-4', tone, className)} {...props} />
}

export interface DiffStatProps extends HTMLAttributes<HTMLSpanElement> { additions: number; deletions: number; showBar?: boolean; hideZero?: boolean; variant?: 'status' | 'git' }
export function DiffStat({ additions, deletions, showBar = true, hideZero = false, variant = 'status', className, ...props }: DiffStatProps) {
  const added = Math.max(0, additions), removed = Math.max(0, deletions), total = added + removed
  const green = total ? Math.round(added / total * 5) : 0
  return <span role="img" aria-label={`${added} additions, ${removed} deletions`} className={cx('inline-flex items-center gap-2 font-code text-xs', className)} {...props}>{(!hideZero || added > 0) && <span aria-hidden="true" className={variant === 'git' ? 'text-[var(--git-green)]' : 'text-status-success-foreground'}>+{added}</span>}{(!hideZero || removed > 0) && <span aria-hidden="true" className={variant === 'git' ? 'text-[var(--git-red)]' : 'text-status-error-foreground'}>{variant === 'git' ? '-' : '−'}{removed}</span>}{showBar && <span aria-hidden="true" className="inline-flex gap-0.5">{Array.from({ length: 5 }, (_, index) => <span key={index} className={cx('h-2 w-1', !total ? 'bg-border-subtle' : index < green ? 'bg-status-success' : 'bg-status-error')} />)}</span>}</span>
}

export interface CodeBlockProps extends Omit<HTMLAttributes<HTMLDivElement>, 'onCopy'> { code: string; language?: string; wrap?: boolean; copied?: boolean; onCopy?: (code: string) => void }
export function CodeBlock({ code, language = 'text', wrap = false, copied = false, onCopy, className, ...props }: CodeBlockProps) {
  return <div className={cx('overflow-hidden rounded-md border border-border-subtle bg-surface-card font-code', className)} {...props}><div className="flex items-center gap-2 border-b border-border-subtle px-3 py-1.5 text-xs text-text-secondary"><Terminal aria-hidden="true" className="size-3" /><span className="flex-1">{language}</span><Button variant="ghost" size="sm" aria-label={copied ? 'Code copied' : 'Copy code'} onClick={() => onCopy?.(code)} disabled={!onCopy}><Copy aria-hidden="true" className="size-3" />{copied ? 'Copied' : 'Copy'}</Button></div><pre className={cx('overflow-auto p-3 text-xs text-text-primary', wrap ? 'whitespace-pre-wrap break-words' : 'whitespace-pre')}><code>{code}</code></pre></div>
}
export interface InlineCodeProps extends HTMLAttributes<HTMLElement> { children?: ReactNode }
export function InlineCode({ children, className, ...props }: InlineCodeProps) { return <code className={cx('rounded-sm border border-border-subtle bg-surface-card px-1 py-0.5 font-code text-xs text-text-primary', className)} {...props}>{children}</code> }
