import { Command, CommandList, CommandItem as UICommandItem } from '@koda/ui'
import { useEffect, useRef, memo, forwardRef } from 'react'
import { cn } from '@/lib/utils'
import {
  type SlashCommand,
  CATEGORY_LABELS,
  groupCommandsByCategory,
} from '@/lib/slashCommands'

interface CommandPopoverProps {
  isOpen: boolean
  commands: SlashCommand[]
  selectedIndex: number
  onSelect: (command: SlashCommand) => void
  onClose: () => void
}

/**
 * Popover showing slash command suggestions
 * Terminal aesthetic with ASCII borders
 */
export const CommandPopover = memo(function CommandPopover({
  isOpen,
  commands,
  selectedIndex,
  onSelect,
  onClose,
}: CommandPopoverProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const selectedRef = useRef<HTMLDivElement>(null)

  // Scroll selected item into view
  useEffect(() => {
    if (selectedRef.current && containerRef.current) {
      selectedRef.current.scrollIntoView({ block: 'nearest' })
    }
  }, [selectedIndex])

  // Close on click outside
  useEffect(() => {
    if (!isOpen) return

    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        onClose()
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    return () => { document.removeEventListener('mousedown', handleClickOutside); }
  }, [isOpen, onClose])

  if (!isOpen || commands.length === 0) return null

  const grouped = groupCommandsByCategory(commands)
  let flatIndex = 0

  return (
    <Command
      shouldFilter={false}
      value={commands[selectedIndex]?.trigger}
      ref={containerRef}
      className={cn(
        'absolute bottom-full left-0 mb-2 z-popover',
        'h-auto rounded-none w-80 max-h-64 overflow-y-auto',
        'shadow-popover font-mono',
        'border border-dashed border-border-strong'
      )}
      label="Slash commands"
    >
      {/* Header */}
      <div className="px-3 py-1.5 border-b border-dashed border-border-subtle text-xs">
        <span className="text-text-faint">┌─ </span>
        <span className="text-text-accent">COMMANDS</span>
        <span className="text-text-faint"> {'─'.repeat(20)}┐</span>
      </div>

      <CommandList aria-label="Slash commands">
      {Object.entries(grouped).map(([category, cmds]) => (
        <div key={category} className="py-1">
          {/* Category header */}
          <div className="flex items-center gap-1.5 px-3 py-1 text-xs text-text-faint">
            <span>├─</span>
            <span className="uppercase">{CATEGORY_LABELS[category] ?? category}</span>
            <span>{'─'.repeat(Math.max(0, 18 - (CATEGORY_LABELS[category]?.length ?? category.length)))}</span>
          </div>

          {/* Commands in category */}
          {cmds.map((cmd) => {
            const isSelected = flatIndex === selectedIndex
            flatIndex++

            return (
              <CommandItem
                key={cmd.trigger}
                ref={isSelected ? selectedRef : null}
                command={cmd}
                isSelected={isSelected}
                onClick={() => { onSelect(cmd); }}
              />
            )
          })}
        </div>
      ))}

      </CommandList>
      {/* Footer */}
      <div className="px-3 py-1 text-xs text-text-faint">
        └{'─'.repeat(36)}┘
      </div>
    </Command>
  )
})

interface CommandItemProps {
  command: SlashCommand
  isSelected: boolean
  onClick: () => void
}

const CommandItem = memo(forwardRef<HTMLDivElement, CommandItemProps>(
  function CommandItem({ command, isSelected, onClick }, ref) {
    return (
      <UICommandItem
        value={command.trigger}
        ref={ref}
        role="option"
        aria-selected={isSelected}
        onSelect={onClick}
        className={cn(
          'rounded-none w-full text-left px-3 py-1.5 flex items-start gap-2',
          'transition-colors cursor-pointer text-xs',
          isSelected
            ? 'bg-surface-active text-text-primary'
            : 'text-text-muted hover:bg-surface-hover hover:text-text-primary'
        )}
      >
        {/* Selection indicator */}
        <span className="text-text-faint flex-shrink-0">
          {isSelected ? '▸' : '│'}
        </span>

        {/* Content */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="text-text-accent">{command.trigger}</span>
            {command.hasArgs && (
              <span className="text-text-dim">{command.argsPlaceholder}</span>
            )}
          </div>
          <p className="text-text-faint mt-0.5 truncate">
            {command.description}
          </p>
        </div>
      </UICommandItem>
    )
  }
))
