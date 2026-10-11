import * as React from 'react'
import { cn, focusRing } from './utils'
export const controlClasses = `w-full rounded-md border border-border-strong bg-surface-control px-3 py-2 font-code text-sm text-text-primary placeholder:text-text-secondary disabled:cursor-not-allowed disabled:bg-surface-control-disabled disabled:text-text-on-control-disabled disabled:opacity-50 aria-[invalid=true]:border-status-error ${focusRing}`
export const Input = React.forwardRef<HTMLInputElement, React.ComponentProps<'input'>>(({ className, ...props }, ref) => <input ref={ref} className={cn(controlClasses, 'h-9', className)} {...props} />)
Input.displayName = 'Input'
export const Textarea = React.forwardRef<HTMLTextAreaElement, React.ComponentProps<'textarea'>>(({ className, ...props }, ref) => <textarea ref={ref} className={cn(controlClasses, 'min-h-20', className)} {...props} />)
Textarea.displayName = 'Textarea'
export interface FieldProps extends Omit<React.HTMLAttributes<HTMLDivElement>, 'children'> {
  /** Label is bound to the control's id. */
  label: React.ReactNode
  hint?: React.ReactNode
  error?: React.ReactNode
  children: React.ReactElement<{ id?: string; 'aria-describedby'?: string; 'aria-invalid'?: boolean }>
  htmlFor?: string
}
export function Field({ label, hint, error, children, htmlFor, className, ...props }: FieldProps) {
  const generated = React.useId(); const id = htmlFor ?? children.props.id ?? generated
  const description = [children.props['aria-describedby'], hint ? `${id}-hint` : '', error ? `${id}-error` : ''].filter(Boolean).join(' ')
  return <div className={cn('space-y-2 font-code text-sm text-text-primary', className)} {...props}><label className="block font-medium" htmlFor={id}>{label}</label>{React.cloneElement(children, { id, 'aria-describedby': description || undefined, 'aria-invalid': error ? true : children.props['aria-invalid'] })}{hint && <p id={`${id}-hint`} className="text-xs text-text-secondary">{hint}</p>}{error && <p id={`${id}-error`} className="flex gap-2 text-xs text-text-primary"><span aria-hidden="true">!</span>{error}</p>}</div>
}
export interface InputGroupProps extends React.HTMLAttributes<HTMLDivElement> { leading?: React.ReactNode; trailing?: React.ReactNode }
export function InputGroup({ leading, trailing, children, className, ...props }: InputGroupProps) { return <div className={cn('flex items-center gap-2 rounded-md border border-border-strong bg-surface-control px-3 font-code text-sm text-text-primary focus-within:ring-2 focus-within:ring-focus [&_input]:border-0 [&_input]:px-0 [&_input]:focus-visible:ring-0 [&_textarea]:border-0 [&_textarea]:px-0 [&_textarea]:focus-visible:ring-0 has-[[aria-invalid=true]]:border-status-error has-[:disabled]:opacity-50', className)} {...props}>{leading && <span className="shrink-0">{leading}</span>}{children}{trailing && <span className="shrink-0">{trailing}</span>}</div> }
