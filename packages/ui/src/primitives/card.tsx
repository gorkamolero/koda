import * as React from 'react'
import { cn } from './utils'
export interface SurfaceProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: 'plain' | 'strong' | 'muted' | 'approval'
  header?: React.ReactNode
  footer?: React.ReactNode
}
export const Surface = React.forwardRef<HTMLDivElement, SurfaceProps>(({ variant = 'plain', header, footer, children, className, ...props }, ref) => <div ref={ref} className={cn('rounded-md border border-border-muted font-code text-sm text-text-primary', { plain: 'bg-surface-card', strong: 'bg-surface-card-strong', muted: 'bg-surface-card-muted', approval: 'bg-surface-approval border-dashed' }[variant], className)} {...props}>{header && <div className="border-b border-border-muted px-4 py-3">{header}</div>}{children}{footer && <div className="border-t border-border-muted px-4 py-3">{footer}</div>}</div>)
Surface.displayName = 'Surface'
export const Card = React.forwardRef<HTMLDivElement, SurfaceProps>((props, ref) => <Surface ref={ref} {...props} />)
Card.displayName = 'Card'
export function CardHeader({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) { return <div className={cn('space-y-1.5 px-4 py-3', className)} {...props} /> }
export function CardTitle({ className, ...props }: React.HTMLAttributes<HTMLHeadingElement>) { return <h3 className={cn('text-sm font-semibold', className)} {...props} /> }
export function CardDescription({ className, ...props }: React.HTMLAttributes<HTMLParagraphElement>) { return <p className={cn('text-xs text-text-quiet', className)} {...props} /> }
export function CardContent({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) { return <div className={cn('p-4', className)} {...props} /> }
export function CardFooter({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) { return <div className={cn('flex items-center gap-2 px-4 py-3', className)} {...props} /> }
