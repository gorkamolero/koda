/**
 * CollaborationStatus
 *
 * Shows the current collaboration connection status.
 * Displays a small indicator with connection state.
 */

import { useCollaboration } from '@/hooks/useCollaboration'
import { useIsCollaborationAvailable } from '@/components/CollaborativeWorkspaceProvider'
import { cn, SharedBadge } from '@koda/ui'

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

  const legacyTone = status === 'connected' ? 'text-presence-green bg-[color-mix(in_srgb,var(--presence-green)_10%,transparent)]' : status === 'connecting' || status === 'reconnecting' ? 'text-presence-yellow bg-[color-mix(in_srgb,var(--presence-yellow)_10%,transparent)]' : undefined
  return <SharedBadge connectionOnly status={status === 'initial' ? 'initializing' : status} showLabel={showLabel} data-testid="collaboration-status" className={cn(legacyTone, className)} />
}
