/**
 * CollaborationStatus
 *
 * Shows the current collaboration connection status.
 * Displays a small indicator with connection state.
 */

import { useCollaboration } from '@/hooks/useCollaboration'
import { useIsCollaborationAvailable } from '@/components/CollaborativeWorkspaceProvider'
import { cn } from '@/lib/utils'
import { Wifi, WifiOff, Loader2 } from 'lucide-react'

interface CollaborationStatusProps {
  /** Show text label */
  showLabel?: boolean
  /** Additional class names */
  className?: string
}

export function CollaborationStatus({ showLabel = false, className }: CollaborationStatusProps) {
  const isAvailable = useIsCollaborationAvailable()

  if (!isAvailable) {
    return null
  }

  return <CollaborationStatusInner showLabel={showLabel} className={className} />
}

function CollaborationStatusInner({
  showLabel,
  className,
}: {
  showLabel: boolean
  className?: string
}) {
  const { status } = useCollaboration()

  const getStatusConfig = () => {
    switch (status) {
      case 'connected':
        return {
          icon: Wifi,
          color: 'text-green-500',
          bgColor: 'bg-green-500/10',
          label: 'Connected',
          animate: false,
        }
      case 'connecting':
      case 'reconnecting':
        return {
          icon: Loader2,
          color: 'text-yellow-500',
          bgColor: 'bg-yellow-500/10',
          label: status === 'connecting' ? 'Connecting...' : 'Reconnecting...',
          animate: true,
        }
      case 'disconnected':
        return {
          icon: WifiOff,
          color: 'text-muted-foreground',
          bgColor: 'bg-muted',
          label: 'Disconnected',
          animate: false,
        }
      default:
        return {
          icon: Wifi,
          color: 'text-muted-foreground',
          bgColor: 'bg-muted',
          label: 'Initializing...',
          animate: false,
        }
    }
  }

  const config = getStatusConfig()
  const Icon = config.icon

  return (
    <div
      className={cn(
        'flex items-center gap-1.5 px-2 py-1 rounded text-xs',
        config.bgColor,
        className
      )}
      title={`Collaboration: ${config.label}`}
    >
      <Icon
        className={cn('h-3 w-3', config.color, config.animate && 'animate-spin')}
      />
      {showLabel && (
        <span className={cn('font-medium', config.color)}>{config.label}</span>
      )}
    </div>
  )
}
