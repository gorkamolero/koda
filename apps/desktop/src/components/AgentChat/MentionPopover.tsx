import { memo, forwardRef, useEffect, useRef } from 'react'
import { cn } from '@/lib/utils'
import { File, Folder, Code, FileText, Image } from 'lucide-react'

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
// File Icon Helper
// ============================================================================

function getFileIcon(suggestion: FileSuggestion) {
  if (suggestion.isDirectory) {
    return <Folder className="w-4 h-4 text-text-accent" />
  }

  const ext = suggestion.extension?.toLowerCase()

  // Code files
  if (['ts', 'tsx', 'js', 'jsx', 'py', 'rs', 'go', 'java', 'rb', 'php'].includes(ext ?? '')) {
    return <Code className="w-4 h-4 text-status-success" />
  }

  // Text/doc files
  if (['md', 'txt', 'json', 'yaml', 'yml', 'toml', 'xml'].includes(ext ?? '')) {
    return <FileText className="w-4 h-4 text-text-muted" />
  }

  // Image files
  if (['png', 'jpg', 'jpeg', 'gif', 'svg', 'webp'].includes(ext ?? '')) {
    return <Image className="w-4 h-4 text-status-warning" />
  }

  return <File className="w-4 h-4 text-text-dim" />
}

// ============================================================================
// MentionItem Component
// ============================================================================

const MentionItem = forwardRef<HTMLButtonElement, MentionItemProps>(
  function MentionItem({ suggestion, isSelected, onClick }, ref) {
    return (
      <button
        ref={ref}
        onClick={onClick}
        className={cn(
          'w-full flex items-center gap-2 px-3 py-2 text-left transition-colors',
          isSelected
            ? 'bg-surface-hover text-text-primary'
            : 'text-text-muted hover:bg-surface-hover hover:text-text-primary'
        )}
      >
        {getFileIcon(suggestion)}
        <div className="flex-1 min-w-0">
          <div className="text-sm font-medium truncate">{suggestion.name}</div>
          <div className="text-xs text-text-dim truncate">{suggestion.path}</div>
        </div>
      </button>
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
  const selectedRef = useRef<HTMLButtonElement>(null)

  // Scroll selected item into view
  useEffect(() => {
    if (selectedRef.current) {
      selectedRef.current.scrollIntoView({ block: 'nearest' })
    }
  }, [selectedIndex])

  if (!isOpen || suggestions.length === 0) return null

  return (
    <div
      className={cn(
        'absolute bottom-full left-0 mb-2 z-50',
        'w-80 max-h-64 overflow-y-auto',
        'glass-popover rounded-lg',
        'border border-border-strong shadow-xl',
        'py-1 animate-fade-in'
      )}
    >
      {/* Header */}
      <div className="px-3 py-1.5 border-b border-border-subtle">
        <span className="text-xs text-text-faint">
          Files matching <span className="text-text-accent">@{query}</span>
        </span>
      </div>

      {/* Suggestions */}
      <div className="py-1">
        {suggestions.map((suggestion, index) => (
          <MentionItem
            key={suggestion.path}
            ref={index === selectedIndex ? selectedRef : undefined}
            suggestion={suggestion}
            isSelected={index === selectedIndex}
            onClick={() => { onSelect(suggestion) }}
          />
        ))}
      </div>

      {/* Footer hint */}
      <div className="px-3 py-1.5 border-t border-border-subtle text-xs text-text-dim">
        <span className="text-text-faint">↑↓</span> navigate
        <span className="mx-2">•</span>
        <span className="text-text-faint">Tab</span> select
        <span className="mx-2">•</span>
        <span className="text-text-faint">Esc</span> close
      </div>
    </div>
  )
})
