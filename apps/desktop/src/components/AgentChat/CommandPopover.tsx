import { useEffect, useRef, memo, forwardRef } from 'react'
import { cn } from '@/lib/utils'
import {
  type SlashCommand,
  CATEGORY_LABELS,
  groupCommandsByCategory,
} from '@/lib/slashCommands'
import { Search, MessageSquare, Sparkles, Navigation, Terminal, FileText, HelpCircle, Trash2 } from 'lucide-react'

interface CommandPopoverProps {
  isOpen: boolean
  commands: SlashCommand[]
  selectedIndex: number
  onSelect: (command: SlashCommand) => void
  onClose: () => void
}

const COMMAND_ICONS: Record<string, React.ReactNode> = {
  '/search': <Search className="w-4 h-4" />,
  '/context': <FileText className="w-4 h-4" />,
  '/clear': <Trash2 className="w-4 h-4" />,
  '/model': <Sparkles className="w-4 h-4" />,
  '/diff': <FileText className="w-4 h-4" />,
  '/terminal': <Terminal className="w-4 h-4" />,
  '/help': <HelpCircle className="w-4 h-4" />,
}

const CATEGORY_ICONS: Record<string, React.ReactNode> = {
  file: <FileText className="w-3 h-3" />,
  chat: <MessageSquare className="w-3 h-3" />,
  model: <Sparkles className="w-3 h-3" />,
  navigation: <Navigation className="w-3 h-3" />,
}

/**
 * Popover showing slash command suggestions
 */
export const CommandPopover = memo(function CommandPopover({
  isOpen,
  commands,
  selectedIndex,
  onSelect,
  onClose,
}: CommandPopoverProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const selectedRef = useRef<HTMLButtonElement>(null)

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
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [isOpen, onClose])

  if (!isOpen || commands.length === 0) return null

  const grouped = groupCommandsByCategory(commands)
  let flatIndex = 0

  return (
    <div
      ref={containerRef}
      className={cn(
        'absolute bottom-full left-0 mb-2 z-50',
        'w-72 max-h-64 overflow-y-auto',
        'bg-surface-popover backdrop-blur-xl',
        'border border-border-strong rounded-lg shadow-xl',
        'py-1 animate-in fade-in slide-in-from-bottom-2 duration-150'
      )}
      role="listbox"
      aria-label="Slash commands"
    >
      {Object.entries(grouped).map(([category, cmds]) => (
        <div key={category} className="py-1">
          {/* Category header */}
          <div className="flex items-center gap-1.5 px-3 py-1 text-xs font-medium text-text-faint uppercase tracking-wider">
            {CATEGORY_ICONS[category]}
            <span>{CATEGORY_LABELS[category] ?? category}</span>
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
                onClick={() => onSelect(cmd)}
              />
            )
          })}
        </div>
      ))}
    </div>
  )
})

interface CommandItemProps {
  command: SlashCommand
  isSelected: boolean
  onClick: () => void
}

const CommandItem = memo(forwardRef<HTMLButtonElement, CommandItemProps>(
  function CommandItem({ command, isSelected, onClick }, ref) {
    return (
      <button
        ref={ref}
        role="option"
        aria-selected={isSelected}
        onClick={onClick}
        className={cn(
          'w-full text-left px-3 py-2 flex items-start gap-3',
          'transition-colors cursor-pointer',
          isSelected
            ? 'bg-surface-active text-text-primary'
            : 'text-text-muted hover:bg-surface-hover hover:text-text-primary'
        )}
      >
        {/* Icon */}
        <div className="flex-shrink-0 mt-0.5 text-text-faint">
          {COMMAND_ICONS[command.trigger] ?? <Terminal className="w-4 h-4" />}
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="font-mono text-sm font-medium">{command.trigger}</span>
            {command.hasArgs && (
              <span className="text-xs text-text-dim">{command.argsPlaceholder}</span>
            )}
          </div>
          <p className="text-xs text-text-faint mt-0.5 truncate">
            {command.description}
          </p>
        </div>
      </button>
    )
  }
))
