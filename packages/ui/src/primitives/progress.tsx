import * as React from 'react'
import * as Primitive from '@radix-ui/react-progress'
import { cn } from './utils'
export interface ProgressProps extends React.ComponentPropsWithoutRef<typeof Primitive.Root> { 'aria-label': string }
export const Progress = React.forwardRef<React.ElementRef<typeof Primitive.Root>, ProgressProps>(({ className, value, max = 100, ...props }, ref) => <Primitive.Root ref={ref} value={value} max={max} className={cn('relative h-2 w-full overflow-hidden rounded-full bg-surface-control', className)} {...props}><Primitive.Indicator className={cn('h-full bg-text-primary transition-all duration-normal', value == null && 'w-1/3 animate-pulse motion-reduce:animate-none')} style={value == null ? undefined : { width: `${Math.max(0, Math.min(100, value / max * 100))}%` }} /></Primitive.Root>)
Progress.displayName = 'Progress'
export interface MeterProps extends React.HTMLAttributes<HTMLDivElement> {
  value: number
  max?: number
  segments?: number
  /** Accessible description of what is being measured. */
  label: string
  valueText?: string
  variant?: 'segmented' | 'continuous'
  valueDisplay?: React.ReactNode
}
export function Meter({ value, max = 100, segments = 12, label, valueText, variant = 'segmented', valueDisplay, className, ...props }: MeterProps) {
  const safeMax = Math.max(1, max); const ratio = Math.max(0, Math.min(1, value / safeMax)); const count = Math.max(1, Math.min(100, segments)); const filled = Math.ceil(ratio * count)
  return <div role="meter" aria-label={label} aria-valuemin={0} aria-valuemax={safeMax} aria-valuenow={Math.min(safeMax, Math.max(0, value))} aria-valuetext={valueText} className={cn('flex items-center gap-3 font-code text-xs text-text-primary', className)} {...props}>{variant === 'continuous' ? <div aria-hidden="true" className="h-1.5 w-32 overflow-hidden rounded-full bg-surface-control"><div className={cn('h-full rounded-full bg-gradient-to-r transition-all duration-slow', ratio >= 0.9 ? 'from-status-warning to-status-error' : ratio >= 0.7 ? 'from-[var(--meter-start)] to-status-warning' : 'from-[var(--meter-start)] to-[var(--meter-end)]')} style={{ width: `${ratio * 100}%` }} /></div> : <div className="flex flex-1 gap-0.5" aria-hidden="true">{Array.from({ length: count }, (_, index) => <span key={index} className={cn('h-2 min-w-1 flex-1', index >= filled ? 'bg-surface-control' : ratio >= 0.9 ? 'bg-status-error' : ratio >= 0.7 ? 'bg-status-warning' : 'bg-status-success')} />)}</div>}{valueDisplay ?? <span>{valueText ?? `${Math.round(ratio * 100)}%`}</span>}</div>
}
