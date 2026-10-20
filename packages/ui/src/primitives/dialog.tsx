import * as React from 'react'
import * as Primitive from '@radix-ui/react-dialog'
import { cn } from './utils'
import { Button } from './button'
export const Dialog = Primitive.Root
export const DialogTrigger = Primitive.Trigger
export const DialogClose = Primitive.Close
export const DialogPortal = Primitive.Portal
export interface DialogContentProps extends React.ComponentPropsWithoutRef<typeof Primitive.Content> { size?: 'sm' | 'md' | 'lg'; closeLabel?: string; showClose?: boolean; overlayClassName?: string; footerClassName?: string; closeButtonClassName?: string }
export const DialogOverlay = React.forwardRef<React.ElementRef<typeof Primitive.Overlay>, React.ComponentPropsWithoutRef<typeof Primitive.Overlay>>(({ className, ...props }, ref) => <Primitive.Overlay ref={ref} className={cn('fixed inset-0 z-modal bg-surface-overlay', className)} {...props} />)
DialogOverlay.displayName = 'DialogOverlay'
// A DialogFooter takes the close action into its own row, at the far left of the dialog's actions; dialogs without one keep it in a row of its own.
interface DialogCloseSlot { closeLabel: string; showClose: boolean; closeButtonClassName?: string; registerFooter: () => () => void }
const DialogCloseContext = React.createContext<DialogCloseSlot | null>(null)
function DialogCloseButton({ slot, className }: { slot: DialogCloseSlot; className?: string }) { return <Primitive.Close asChild><Button variant="ghost" size="sm" className={cn(className, slot.closeButtonClassName)}>{slot.closeLabel}</Button></Primitive.Close> }
export const DialogContent = React.forwardRef<React.ElementRef<typeof Primitive.Content>, DialogContentProps>(({ size = 'md', closeLabel = '[ESC] CLOSE', showClose = true, overlayClassName, footerClassName, closeButtonClassName, children, className, ...props }, ref) => {
  const [footers, setFooters] = React.useState(0)
  const registerFooter = React.useCallback(() => { setFooters(count => count + 1); return () => setFooters(count => count - 1) }, [])
  const slot = React.useMemo(() => ({ closeLabel, showClose, closeButtonClassName, registerFooter }), [closeLabel, showClose, closeButtonClassName, registerFooter])
  return <Primitive.Portal><DialogOverlay className={overlayClassName} /><Primitive.Content ref={ref} className={cn('fixed left-1/2 top-1/2 z-modal flex max-h-[90vh] w-11/12 -translate-x-1/2 -translate-y-1/2 flex-col overflow-auto border border-dashed border-border-strong bg-surface-popover font-code text-text-primary shadow-popover focus:outline-none', { sm: 'max-w-sm', md: 'max-w-lg', lg: 'max-w-3xl' }[size], className)} {...props}><DialogCloseContext.Provider value={slot}>{children}</DialogCloseContext.Provider>{showClose && footers === 0 && <div className={cn("flex justify-end border-t border-dashed border-border-muted px-4 py-2", footerClassName)}><DialogCloseButton slot={slot} /></div>}</Primitive.Content></Primitive.Portal>
})
DialogContent.displayName = 'DialogContent'
export function DialogHeader({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) { return <div className={cn('space-y-2 border-b border-dashed border-border-muted px-4 py-3', className)} {...props} /> }
export function DialogBody({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) { return <div className={cn('px-4 py-4', className)} {...props} /> }
export function DialogFooter({ className, children, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  const slot = React.useContext(DialogCloseContext)
  React.useLayoutEffect(() => slot?.registerFooter(), [slot])
  return <div className={cn('flex flex-wrap items-center justify-end gap-2 border-t border-dashed border-border-muted px-4 py-3', className)} {...props}>{slot?.showClose && <DialogCloseButton slot={slot} className="-ml-2 mr-auto" />}{children}</div>
}
export const DialogTitle = React.forwardRef<React.ElementRef<typeof Primitive.Title>, React.ComponentPropsWithoutRef<typeof Primitive.Title> & { decorate?: boolean }>(({ className, children, decorate = true, ...props }, ref) => <Primitive.Title ref={ref} className={cn('font-code text-sm font-medium uppercase tracking-wider text-text-primary', className)} {...props}>{decorate && <span aria-hidden="true">┌─ </span>}{children}{decorate && <span aria-hidden="true"> ─┐</span>}</Primitive.Title>)
DialogTitle.displayName = 'DialogTitle'
export const DialogDescription = React.forwardRef<React.ElementRef<typeof Primitive.Description>, React.ComponentPropsWithoutRef<typeof Primitive.Description>>(({ className, ...props }, ref) => <Primitive.Description ref={ref} className={cn('font-code text-xs text-text-secondary', className)} {...props} />)
DialogDescription.displayName = 'DialogDescription'
