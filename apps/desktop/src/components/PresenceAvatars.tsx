/**
 * PresenceAvatars
 *
 * Shows avatars of users currently in the workspace room.
 * Displays a stack of colored circles with initials.
 */

import { usePresence } from '@/hooks/useCollaboration'
import { useIsCollaborationAvailable } from '@/components/CollaborativeWorkspaceProvider'
import { cn } from '@/lib/utils'

interface PresenceAvatarsProps {
  /** Maximum number of avatars to show before +N */
  maxVisible?: number
  /** Size variant */
  size?: 'sm' | 'md'
  /** Additional class names */
  className?: string
}

export function PresenceAvatars({
  maxVisible = 3,
  size = 'sm',
  className,
}: PresenceAvatarsProps) {
  const isAvailable = useIsCollaborationAvailable()

  // Only render if collaboration is available
  if (!isAvailable) {
    return null
  }

  return <PresenceAvatarsInner maxVisible={maxVisible} size={size} className={className} />
}

function PresenceAvatarsInner({
  maxVisible,
  size,
  className,
}: Required<Pick<PresenceAvatarsProps, 'maxVisible' | 'size'>> & { className?: string }) {
  const { peers, self } = usePresence()

  // Include self in the display
  const allUsers = [
    ...(self ? [{ name: self.name, color: self.color, isLocal: true }] : []),
    ...peers.map((p) => ({ name: p.name, color: p.color, isLocal: p.isLocal })),
  ]

  // Don't render if alone
  if (allUsers.length <= 1) {
    return null
  }

  const visibleUsers = allUsers.slice(0, maxVisible)
  const overflowCount = allUsers.length - maxVisible

  const sizeClasses = {
    sm: 'w-6 h-6 text-[10px]',
    md: 'w-8 h-8 text-xs',
  }

  return (
    <div className={cn('flex -space-x-2', className)}>
      {visibleUsers.map((user, i) => (
        <div
          key={i}
          className={cn(
            'rounded-full flex items-center justify-center font-medium text-white border-2 border-background',
            sizeClasses[size]
          )}
          style={{ backgroundColor: user.color }}
          title={user.name}
        >
          {getInitials(user.name)}
        </div>
      ))}

      {overflowCount > 0 && (
        <div
          className={cn(
            'rounded-full flex items-center justify-center font-medium bg-muted text-muted-foreground border-2 border-background',
            sizeClasses[size]
          )}
          title={`${overflowCount} more`}
        >
          +{overflowCount}
        </div>
      )}
    </div>
  )
}

function getInitials(name: string): string {
  return name
    .split(/\s+/)
    .map((part) => part[0])
    .join('')
    .toUpperCase()
    .slice(0, 2)
}
