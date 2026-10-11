import { memo, useEffect, useState } from 'react'
import { WorkingIndicator as Indicator } from '@koda/ui'
import { cn } from '@/lib/utils'

interface WorkingIndicatorProps { startTime: number; className?: string; label?: string }

/** Elapsed time belongs to the running transcript, not the presentational indicator. */
function useElapsed(startTime: number) {
  const [elapsed, setElapsed] = useState(() => Date.now() - startTime)
  useEffect(() => {
    setElapsed(Date.now() - startTime)
    const timer = setInterval(() => setElapsed(Date.now() - startTime), 100)
    return () => clearInterval(timer)
  }, [startTime])
  return elapsed
}
export const WorkingIndicator = memo(function WorkingIndicator({ startTime, className, label }: WorkingIndicatorProps) {
  return <Indicator elapsedMs={useElapsed(startTime)} label={label} className={cn('font-mono', className)} />
})
export const CompactWorkingIndicator = memo(function CompactWorkingIndicator({ startTime, className, label = 'working' }: WorkingIndicatorProps) {
  return <Indicator compact elapsedMs={useElapsed(startTime)} label={label} className={cn('font-mono', className)} />
})
