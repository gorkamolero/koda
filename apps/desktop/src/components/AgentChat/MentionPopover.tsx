import { Command, CommandList, CommandItem } from '@koda/ui'
import { memo, forwardRef, useEffect, useRef } from 'react'
import { cn } from '@/lib/utils'

// ============================================================================
// Types
// ============================================================================

export interface FileSuggestion {
  path: string
  name: string
  isDirectory: boolean
  extension?: string
}

interface MentionPopoverProps {
  isOpen: boolean
  suggestions: FileSuggestion[]
  selectedIndex: number
  query: string
  onSelect: (suggestion: FileSuggestion) => void
  onClose: () => void
}

interface MentionItemProps {
  suggestion: FileSuggestion
  isSelected: boolean
  onClick: () => void
}

// ============================================================================
// File Icon Helper - Terminal style
// ============================================================================

function getFileIcon(suggestion: FileSuggestion): string {
  if (suggestion.isDirectory) return '[DIR]'

  const ext = suggestion.extension?.toLowerCase()

  // Code files
  if (['ts', 'tsx', 'js', 'jsx', 'py', 'rs', 'go', 'java', 'rb', 'php'].includes(ext ?? '')) {
    return '[COD]'
  }

  // Text/doc files
  if (['md', 'txt', 'json', 'yaml', 'yml', 'toml', 'xml'].includes(ext ?? '')) {
    return '[TXT]'
  }

  // Image files
  if (['png', 'jpg', 'jpeg', 'gif', 'svg', 'webp'].includes(ext ?? '')) {
    return '[IMG]'
  }

  return '[FIL]'
}

function getFileIconColor(suggestion: FileSuggestion): string {
  if (suggestion.isDirectory) return 'text-text-accent'

  const ext = suggestion.extension?.toLowerCase()

  if (['ts', 'tsx', 'js', 'jsx', 'py', 'rs', 'go', 'java', 'rb', 'php'].includes(ext ?? '')) {
    return 'text-[--git-green]'
  }

  if (['md', 'txt', 'json', 'yaml', 'yml', 'toml', 'xml'].includes(ext ?? '')) {
    return 'text-text-muted'
  }

  if (['png', 'jpg', 'jpeg', 'gif', 'svg', 'webp'].includes(ext ?? '')) {
    return 'text-status-warning'
  }

  return 'text-text-dim'
}

// ============================================================================
// MentionItem Component
// ============================================================================

const MentionItem = forwardRef<HTMLDivElement, MentionItemProps>(
  function MentionItem({ suggestion, isSelected, onClick }, ref) {
    return (
      <CommandItem
        value={suggestion.path}
        ref={ref}
        onSelect={onClick}
        className={cn(
          'rounded-none w-full flex items-center gap-2 px-3 py-1.5 text-left transition-colors text-xs',
          isSelected
            ? 'bg-surface-active text-text-primary'
            : 'text-text-muted hover:bg-surface-hover hover:text-text-primary'
        )}
      >
        <span className="text-text-faint">{isSelected ? '▸' : '│'}</span>
        <span className={cn('flex-shrink-0', getFileIconColor(suggestion))}>
          {getFileIcon(suggestion)}
        </span>
        <div className="flex-1 min-w-0">
          <span className="truncate">{suggestion.name}</span>
          <span className="text-text-dim ml-2 truncate">{suggestion.path}</span>
        </div>
      </CommandItem>
    )
  }
)

// ============================================================================
// MentionPopover Component
// ============================================================================

export const MentionPopover = memo(function MentionPopover({
  isOpen,
  suggestions,
  selectedIndex,
  query,
  onSelect,
  onClose: _onClose,
}: MentionPopoverProps) {
  const selectedRef = useRef<HTMLDivElement>(null)

  // Scroll selected item into view
  useEffect(() => {
    if (selectedRef.current) {
      selectedRef.current.scrollIntoView({ block: 'nearest' })
    }
  }, [selectedIndex])

  if (!isOpen || suggestions.length === 0) return null

  return (
    <Command
      shouldFilter={false}
      value={suggestions[selectedIndex]?.path}
      label="Mention files"
      className={cn(
        'absolute bottom-full left-0 mb-2 z-popover',
        'h-auto rounded-none w-96 max-h-64 overflow-y-auto',
        'bg-[var(--black-soft)] font-mono',
        'border border-dashed border-border-strong'
      )}
    >
      {/* Header */}
      <div className="px-3 py-1.5 border-b border-dashed border-border-subtle text-xs">
        <span className="text-text-faint">┌─ </span>
        <span className="text-text-accent">FILES MATCHING</span>
        <span className="text-text-primary"> @{query}</span>
        <span className="text-text-faint"> {'─'.repeat(Math.max(0, 15 - query.length))}┐</span>
      </div>

      {/* Suggestions */}
      <CommandList aria-label="Mention files" className="py-1">
        {suggestions.map((suggestion, index) => (
          <MentionItem
            key={suggestion.path}
            ref={index === selectedIndex ? selectedRef : undefined}
            suggestion={suggestion}
            isSelected={index === selectedIndex}
            onClick={() => { onSelect(suggestion) }}
          />
        ))}
      </CommandList>

      {/* Footer hint */}
      <div className="px-3 py-1.5 border-t border-dashed border-border-subtle text-xs text-text-faint flex items-center gap-3">
        <span>│</span>
        <span>[↑↓] NAV</span>
        <span>[TAB] SELECT</span>
        <span>[ESC] CLOSE</span>
      </div>

      {/* Bottom border */}
      <div className="px-3 text-xs text-text-faint">
        └{'─'.repeat(44)}┘
      </div>
    </Command>
  )
})
