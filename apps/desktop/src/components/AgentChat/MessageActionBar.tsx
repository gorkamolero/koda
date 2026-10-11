import { Button } from '@koda/ui'
import { memo, useCallback } from 'react'
import { useSetAtom } from 'jotai'
import { cn } from '@/lib/utils'
import { useClipboard } from '@/hooks/useClipboard'
import { extractMessageContent } from '@/lib/messageContent'
import type { ChatMessage } from '@/store/chat'
import { revertToMessageAtom, splitAtMessageAtom } from '@/store/chat'

// ============================================================================
// Types
// ============================================================================

interface MessageActionBarProps {
  message: ChatMessage
  className?: string
}

// ============================================================================
// ActionButton Component - Terminal style
// ============================================================================

interface ActionButtonProps {
  onClick: () => void
  title: string
  label: string
  activeLabel?: string
  isActive?: boolean
  variant?: 'default' | 'danger'
}

const ActionButton = memo(function ActionButton({
  onClick,
  title,
  label,
  activeLabel,
  isActive = false,
  variant = 'default',
}: ActionButtonProps) {
  return (
    <Button variant="unstyled"
      onClick={onClick}
      title={title}
      className={cn(
        'h-auto rounded-none border-0 px-1.5 py-0.5 transition-colors text-xs',
        variant === 'default' && 'text-text-muted hover:text-text-accent',
        variant === 'danger' && 'text-text-muted hover:text-status-error',
        isActive && 'text-[--git-green]'
      )}
    >
      {isActive && activeLabel ? activeLabel : label}
    </Button>
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
        'flex items-center font-mono',
        'bg-surface-popover border border-dashed border-border-strong shadow-popover',
        'opacity-0 group-hover:opacity-100 transition-opacity duration-150',
        className
      )}
    >
      <span className="text-text-faint text-xs px-1">│</span>
      
      {/* Copy button */}
      <ActionButton
        onClick={handleCopy}
        title={isCopied ? 'Copied!' : 'Copy message'}
        label="[CPY]"
        activeLabel="[✓]"
        isActive={isCopied}
      />

      <span className="text-text-faint text-xs">·</span>

      {/* Split/Fork button */}
      <ActionButton
        onClick={handleSplit}
        title="Fork conversation from here"
        label="[FRK]"
      />

      <span className="text-text-faint text-xs">·</span>

      {/* Undo/Revert button */}
      <ActionButton
        onClick={handleUndo}
        title="Revert to this message"
        label="[REV]"
        variant="danger"
      />

      <span className="text-text-faint text-xs px-1">│</span>
    </div>
  )
})
