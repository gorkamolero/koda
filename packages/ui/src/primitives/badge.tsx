import type * as React from 'react'
import { cn } from './utils'
export interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  variant?: 'neutral' | 'accent' | 'outline'
  size?: 'sm' | 'md'
}
export function Badge({ variant = 'neutral', size = 'md', className, ...props }: BadgeProps) {
  return <span className={cn('inline-flex items-center gap-1.5 rounded-sm border font-code text-text-primary', size === 'sm' ? 'px-1.5 py-0.5 text-xs' : 'px-2 py-1 text-sm', { neutral: 'border-border-muted bg-surface-control', accent: 'border-border-accent bg-surface-active', outline: 'border-border-strong bg-transparent' }[variant], className)} {...props} />
}
export type Status = 'success' | 'warning' | 'error' | 'processing' | 'reviewing' | 'ready' | 'unread' | 'unknown'
export const statusClasses: Record<Status, string> = { success: 'bg-status-success', warning: 'bg-status-warning', error: 'bg-status-error', processing: 'bg-status-processing', reviewing: 'bg-status-reviewing', ready: 'bg-status-ready', unread: 'bg-status-unread', unknown: 'bg-status-unknown' }
export interface StatusDotProps extends React.HTMLAttributes<HTMLSpanElement> { status: Status; label?: string }
export function StatusDot({ status, label, className, ...props }: StatusDotProps) {
  return <span role={label ? 'img' : undefined} aria-label={label} aria-hidden={label ? undefined : true} className={cn('inline-block size-2 shrink-0 rounded-full', statusClasses[status], className)} {...props} />
}
export interface StatusBadgeProps extends BadgeProps { status: Status; showDot?: boolean }
export function StatusBadge({ status, children, showDot = true, ...props }: StatusBadgeProps) { return <Badge {...props}>{showDot && <StatusDot status={status} />}{children ?? status}</Badge> }
export function Kbd({ className, ...props }: React.HTMLAttributes<HTMLElement>) { return <kbd className={cn('inline-flex items-center rounded-sm border border-border-muted bg-surface-control px-1.5 py-0.5 font-code text-xs text-text-primary', className)} {...props} /> }
