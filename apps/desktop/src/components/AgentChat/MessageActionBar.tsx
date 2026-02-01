import { memo, useCallback } from 'react'
import { useSetAtom } from 'jotai'
import { cn } from '@/lib/utils'
import { useClipboard } from '@/hooks/useClipboard'
import { extractMessageContent } from '@/lib/messageContent'
import type { ChatMessage } from '@/store/chat'
import { revertToMessageAtom, splitAtMessageAtom } from '@/store/chat'
import { Copy, Check, GitBranch, Undo2 } from 'lucide-react'

// ============================================================================
// Types
// ============================================================================

interface MessageActionBarProps {
  message: ChatMessage
  className?: string
}

// ============================================================================
// ActionButton Component
// ============================================================================

interface ActionButtonProps {
  onClick: () => void
  title: string
  icon: React.ReactNode
  activeIcon?: React.ReactNode
  isActive?: boolean
  variant?: 'default' | 'danger'
}

const ActionButton = memo(function ActionButton({
  onClick,
  title,
  icon,
  activeIcon,
  isActive = false,
  variant = 'default',
}: ActionButtonProps) {
  return (
    <button
      onClick={onClick}
      title={title}
      className={cn(
        'p-1.5 rounded-md transition-colors',
        variant === 'default' && 'hover:bg-surface-hover text-text-muted hover:text-text-primary',
        variant === 'danger' && 'hover:bg-status-error/20 text-text-muted hover:text-status-error',
        isActive && 'text-status-success'
      )}
    >
      {isActive && activeIcon ? activeIcon : icon}
    </button>
  )
})

// ============================================================================
// MessageActionBar Component
// ============================================================================

export const MessageActionBar = memo(function MessageActionBar({
  message,
  className,
}: MessageActionBarProps) {
  const { copy, isCopied } = useClipboard({ timeout: 2000 })
  const revertToMessage = useSetAtom(revertToMessageAtom)
  const splitAtMessage = useSetAtom(splitAtMessageAtom)

  const handleCopy = useCallback(() => {
    const content = extractMessageContent(message)
    void copy(content)
  }, [message, copy])

  const handleSplit = useCallback(() => {
    splitAtMessage(message.id)
  }, [message.id, splitAtMessage])

  const handleUndo = useCallback(() => {
    revertToMessage(message.id)
  }, [message.id, revertToMessage])

  return (
    <div
      className={cn(
        'flex items-center gap-0.5 px-1 py-0.5 rounded-lg',
        'bg-surface-card border border-border-subtle shadow-sm',
        'opacity-0 group-hover:opacity-100 transition-opacity duration-150',
        className
      )}
    >
      {/* Copy button */}
      <ActionButton
        onClick={handleCopy}
        title={isCopied ? 'Copied!' : 'Copy message'}
        icon={<Copy className="w-3.5 h-3.5" />}
        activeIcon={<Check className="w-3.5 h-3.5" />}
        isActive={isCopied}
      />

      {/* Split/Fork button */}
      <ActionButton
        onClick={handleSplit}
        title="Fork conversation from here"
        icon={<GitBranch className="w-3.5 h-3.5" />}
      />

      {/* Undo/Revert button */}
      <ActionButton
        onClick={handleUndo}
        title="Revert to this message"
        icon={<Undo2 className="w-3.5 h-3.5" />}
        variant="danger"
      />
    </div>
  )
})
