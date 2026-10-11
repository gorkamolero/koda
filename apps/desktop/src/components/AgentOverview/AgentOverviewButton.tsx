import { Button } from '@koda/ui'
import { Cpu } from 'lucide-react'
import { cn } from '@/lib/utils'

interface AgentOverviewButtonProps {
  onClick: () => void
  isOpen?: boolean
}

/**
 * Button in the main navigation to open the Agent Overview panel.
 * Shows when any agents are active.
 */
export function AgentOverviewButton({ onClick, isOpen }: AgentOverviewButtonProps) {
  return (
    <Button variant="unstyled"
      data-testid="agent-overview-button"
      onClick={onClick}
      className={cn(
        'flex items-center gap-1.5 px-2 py-1 text-xs font-mono',
        'border border-dashed transition-colors',
        isOpen
          ? 'border-text-accent text-text-accent bg-surface-active'
          : 'border-border-subtle text-text-muted hover:border-text-accent hover:text-text-accent'
      )}
      title="Agent Overview"
    >
      <Cpu className="size-3" />
      <span>[AGENTS]</span>
    </Button>
  )
}
