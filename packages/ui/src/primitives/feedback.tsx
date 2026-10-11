import type * as React from 'react'
import { Info, CheckCircle, AlertTriangle, XCircle, Eye, X } from 'lucide-react'
import { cn } from './utils'
import { Button, IconButton } from './button'
export type FeedbackTone = 'info' | 'success' | 'warning' | 'error'
const borders = { info: 'border-border-accent', success: 'border-status-success', warning: 'border-status-warning', error: 'border-status-error', 'view-only': 'border-border-strong' }
const icons = { info: Info, success: CheckCircle, warning: AlertTriangle, error: XCircle, 'view-only': Eye }
export interface ToastProps extends Omit<React.HTMLAttributes<HTMLDivElement>, 'title'> {
  tone?: FeedbackTone
  title: React.ReactNode
  description?: React.ReactNode
  action?: { label: string; onClick: () => void }
  onDismiss?: () => void
}
/** A notification view. Hosts own its lifetime and queue. */
export function Toast({ tone = 'info', title, description, action, onDismiss, className, ...props }: ToastProps) {
  const Icon = icons[tone]
  return <div role={tone === 'error' ? 'alert' : 'status'} className={cn('flex w-full max-w-md items-start gap-3 rounded-md border bg-surface-popover p-4 font-code text-sm text-text-primary shadow-popover', borders[tone], className)} {...props}><Icon aria-hidden="true" className="mt-0.5 size-4 shrink-0" /><div className="min-w-0 flex-1"><p className="font-semibold">{title}</p>{description && <p className="mt-1 text-xs text-text-muted">{description}</p>}{action && <Button variant="bracket" size="sm" className="mt-2" onClick={action.onClick}>{action.label}</Button>}</div>{onDismiss && <IconButton aria-label="Dismiss notification" onClick={onDismiss}><X /></IconButton>}</div>
}
export interface CalloutProps extends Omit<React.HTMLAttributes<HTMLDivElement>, 'title'> { tone?: 'info' | 'warning' | 'error' | 'view-only'; title?: React.ReactNode }
export function Callout({ tone = 'info', title, children, className, ...props }: CalloutProps) {
  const Icon = icons[tone]
  return <div role={tone === 'error' ? 'alert' : 'note'} className={cn('flex items-start gap-2 border border-dashed bg-surface-card-muted p-3 font-code text-xs text-text-primary', borders[tone], className)} {...props}><Icon aria-hidden="true" className="size-4 shrink-0" /><div className="space-y-1">{title && <p className="font-semibold">{title}</p>}<div>{children}</div></div></div>
}
