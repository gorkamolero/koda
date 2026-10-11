/**
 * PresenceAvatars
 *
 * Shows avatars of users currently in the workspace room.
 * Displays a stack of colored circles with initials.
 */

import { useMemo } from 'react'
import { usePresence } from '@/hooks/useCollaboration'
import { useIsCollaborationAvailable } from '@/components/CollaborativeWorkspaceProvider'
import { AvatarStack, type PresenceTone } from '@koda/ui'

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
}: PresenceAvatarsProps): React.ReactElement | null {
  const isAvailable = useIsCollaborationAvailable()

  if (!isAvailable) {
    return null
  }

  return <PresenceAvatarsInner maxVisible={maxVisible} size={size} className={className} />
}

// Wire identity colors are matched to presentation tokens; custom remote values remain data.
const PRESENCE_COLORS: Record<string, PresenceTone> = {
  // koda-token-exception: These are protocol identity values from machineId, mapped to named tokens.
  '#ef4444': 'red', '#f97316': 'orange', '#eab308': 'yellow', '#22c55e': 'presence-green', '#14b8a6': 'teal', '#3b82f6': 'presence-blue', '#8b5cf6': 'violet', '#ec4899': 'pink', '#6366f1': 'indigo', '#06b6d4': 'presence-cyan',
}

function PresenceAvatarsInner({
  maxVisible,
  size,
  className,
}: Required<Pick<PresenceAvatarsProps, 'maxVisible' | 'size'>> & { className?: string }): React.ReactElement | null {
  const { peers, self } = usePresence()

  const people = useMemo(() => [
    ...(self ? [{ id: self.machineId, name: self.name, color: self.color }] : []),
    ...peers.map(peer => ({ id: `${peer.machineId}:${peer.connectionId}`, name: peer.name, color: peer.color })),
  ].map(person => ({ ...person, tone: PRESENCE_COLORS[person.color.toLowerCase()], color: PRESENCE_COLORS[person.color.toLowerCase()] ? undefined : person.color })), [self, peers])

  if (people.length <= 1) return null

  return <AvatarStack data-testid="presence-avatars" people={people} maxVisible={maxVisible} size={size} compact className={className} />
}
