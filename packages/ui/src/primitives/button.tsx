import * as React from 'react'
import { Slot, Slottable } from '@radix-ui/react-slot'
import { cva, type VariantProps } from 'class-variance-authority'
import { LoaderCircle } from 'lucide-react'
import { cn, focusRing } from './utils'
import { Tooltip, TooltipTrigger, TooltipContent, TooltipProvider } from './tooltip'

export const buttonVariants = cva(`inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md border border-transparent font-code text-sm transition-colors duration-fast disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0 ${focusRing}`, {
  variants: {
    variant: {
      unstyled: '',
      primary: 'bg-text-primary text-surface-popover hover:bg-text-strong active:bg-text-emphasis',
      secondary: 'bg-surface-control text-text-primary hover:bg-surface-control-hover hover:text-text-on-control-hover active:bg-surface-active',
      ghost: 'text-text-primary hover:bg-surface-hover active:bg-surface-active',
      outline: 'border-border-strong bg-surface-card text-text-primary hover:bg-surface-hover active:bg-surface-active',
      destructive: 'border-status-error bg-surface-card text-text-primary hover:bg-surface-hover active:bg-surface-active',
      link: 'text-text-primary underline underline-offset-4 hover:text-text-strong',
      bracket: 'rounded-none text-text-action uppercase tracking-wider hover:bg-surface-hover active:bg-surface-active',
    },
    size: { none: '', sm: 'h-7 px-2 text-xs', md: 'h-9 px-3', lg: 'h-10 px-6', icon: 'size-8 p-0' },
  },
  defaultVariants: { variant: 'primary', size: 'md' },
})
export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement>, VariantProps<typeof buttonVariants> {
  /** Render onto a single child (for example an anchor). */
  asChild?: boolean
  /** Announces busy and prevents repeat activation. */
  loading?: boolean
}
export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(({ className, variant = 'primary', size, asChild = false, loading = false, disabled, children, onClick, onClickCapture, ...props }, ref) => {
  const Comp = asChild ? Slot : 'button'
  return <Comp ref={ref} type={asChild ? undefined : 'button'} {...props} className={cn(variant === 'unstyled' ? `${focusRing} disabled:pointer-events-none disabled:opacity-50` : buttonVariants({ variant, size }), className)} disabled={asChild ? undefined : disabled || loading} aria-disabled={disabled || loading || undefined} aria-busy={loading || undefined} onClickCapture={(event) => { if (disabled || loading) { event.preventDefault(); event.stopPropagation(); return } onClickCapture?.(event) }} onClick={(event) => { if (disabled || loading) { event.preventDefault(); return } onClick?.(event) }} tabIndex={asChild && (disabled || loading) ? -1 : props.tabIndex}>
    {loading && <LoaderCircle aria-hidden="true" className="animate-spin motion-reduce:animate-none" />}
    {variant === 'bracket' && <span aria-hidden="true">[</span>}
    <Slottable>{children}</Slottable>
    {variant === 'bracket' && <span aria-hidden="true">]</span>}
  </Comp>
})
Button.displayName = 'Button'
export interface IconButtonProps extends Omit<ButtonProps, 'size' | 'asChild'> {
  /** Accessible name is required for an icon-only action. */
  'aria-label': string
  tooltip?: string
}
export const IconButton = React.forwardRef<HTMLButtonElement, IconButtonProps>(({ tooltip, ...props }, ref) => {
  const button = <Button ref={ref} variant="ghost" size="icon" {...props}>{props.loading ? null : props.children}</Button>
  return tooltip ? <TooltipProvider><Tooltip><TooltipTrigger asChild>{button}</TooltipTrigger><TooltipContent>{tooltip}</TooltipContent></Tooltip></TooltipProvider> : button
})
IconButton.displayName = 'IconButton'
