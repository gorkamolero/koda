import * as React from 'react'
import * as Radio from '@radix-ui/react-radio-group'
import { cn, focusRing } from './utils'
export interface ButtonGroupProps extends React.HTMLAttributes<HTMLDivElement> { orientation?: 'horizontal' | 'vertical' }
export function ButtonGroup({ orientation = 'horizontal', className, ...props }: ButtonGroupProps) {
  return <div role="group" data-orientation={orientation} className={cn('inline-flex [&>*]:focus-visible:relative [&>*]:focus-visible:z-sticky', orientation === 'horizontal' ? '[&>*:not(:first-child)]:rounded-l-none [&>*:not(:last-child)]:rounded-r-none' : 'flex-col [&>*:not(:first-child)]:rounded-t-none [&>*:not(:last-child)]:rounded-b-none', className)} {...props} />
}
export interface SegmentedControlProps extends Omit<React.ComponentProps<typeof Radio.Root>, 'children'> {
  /** Human-readable option labels; disabled choices remain visible. */
  options: { value: string; label: React.ReactNode; disabled?: boolean; className?: string; 'data-testid'?: string }[]
  optionClassName?: string
}
export function SegmentedControl({ options, optionClassName, className, ...props }: SegmentedControlProps) {
  return <Radio.Root orientation="horizontal" className={cn('inline-flex gap-1 rounded-md border border-border-muted bg-surface-control p-1 font-code', className)} {...props}>{options.map(({ value, label, className: itemClassName, ...option }) => <Radio.Item key={value} value={value} {...option} className={cn('rounded-sm px-3 py-1.5 text-xs text-text-primary transition-colors duration-fast hover:bg-surface-hover data-[state=checked]:bg-surface-active data-[state=checked]:ring-1 data-[state=checked]:ring-border-accent disabled:opacity-50', focusRing, optionClassName, itemClassName)}>{label}</Radio.Item>)}</Radio.Root>
}
