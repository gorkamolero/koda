import { memo, useCallback, type KeyboardEvent as ReactKeyboardEvent } from 'react'
import { useSetAtom, useAtomValue } from 'jotai'
import { cn } from '@/lib/utils'
import {
  type FlattenedEntry,
  toggleExpandedAtom,
  selectedPathAtom,
} from '@/store/fileExplorer'
import { FileIcon } from './FileIcon'
import { ChevronRight, Loader2 } from 'lucide-react'

interface FileTreeItemProps {
  entry: FlattenedEntry
  onSelect: (entry: FlattenedEntry) => void
  onOpen: (entry: FlattenedEntry) => void
  onExpand?: (entry: FlattenedEntry) => void
}

/**
 * Single file/folder item in the tree
 */
export const FileTreeItem = memo(function FileTreeItem({
  entry,
  onSelect,
  onOpen,
  onExpand,
}: FileTreeItemProps) {
  const toggleExpanded = useSetAtom(toggleExpandedAtom)
  const selectedPath = useAtomValue(selectedPathAtom)

  const isSelected = selectedPath === entry.path
  const isDirectory = entry.type === 'directory'

  // Sanitize name for test ID
  const testId = `file-item-${entry.name.replace(/\./g, '-').toLowerCase()}`

  const handleClick = useCallback(() => {
    onSelect(entry)
    if (isDirectory) {
      // Clicking folder name also toggles expansion
      if (!entry.isExpanded && onExpand) {
        onExpand(entry)
      }
      toggleExpanded(entry.path)
    } else {
      onOpen(entry)
    }
  }, [entry, isDirectory, onSelect, onOpen, onExpand, toggleExpanded])

  const handleExpandClick = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation()
      if (isDirectory) {
        // If expanding (not collapsing) and no children loaded yet, trigger load
        if (!entry.isExpanded && onExpand) {
          onExpand(entry)
        }
        toggleExpanded(entry.path)
      }
    },
    [isDirectory, entry, toggleExpanded, onExpand]
  )

  const handleKeyDown = useCallback(
    (e: ReactKeyboardEvent) => {
      if (e.key === 'Enter') {
        if (isDirectory) {
          if (!entry.isExpanded && onExpand) {
            onExpand(entry)
          }
          toggleExpanded(entry.path)
        } else {
          onOpen(entry)
        }
      } else if (e.key === 'ArrowRight' && isDirectory && !entry.isExpanded) {
        if (onExpand) {
          onExpand(entry)
        }
        toggleExpanded(entry.path)
      } else if (e.key === 'ArrowLeft' && isDirectory && entry.isExpanded) {
        toggleExpanded(entry.path)
      }
    },
    [entry, isDirectory, toggleExpanded, onOpen, onExpand]
  )

  return (
    <div
      data-testid={testId}
      data-type={entry.type}
      data-selected={isSelected}
      tabIndex={0}
      role="treeitem"
      aria-expanded={isDirectory ? entry.isExpanded : undefined}
      className={cn(
        'flex items-center gap-1 px-2 py-1 cursor-pointer',
        'hover:bg-surface-hover transition-colors',
        'focus:outline-none focus:ring-1 focus:ring-border-accent-soft',
        isSelected && 'bg-surface-active text-text-strong'
      )}
      style={{ paddingLeft: `${String(entry.depth * 16 + 8)}px` }}
      onClick={handleClick}
      onKeyDown={handleKeyDown}
    >
      {/* Expand/collapse chevron */}
      {isDirectory ? (
        <button
          data-testid="expand-button"
          className="p-0.5 hover:bg-surface-control rounded transition-colors"
          onClick={handleExpandClick}
          aria-label={entry.isExpanded ? 'Collapse' : 'Expand'}
        >
          <ChevronRight
            className={cn(
              'w-3 h-3 text-text-dim transition-transform',
              entry.isExpanded && 'rotate-90'
            )}
          />
        </button>
      ) : (
        <span className="w-4" /> // Spacer for alignment
      )}

      {/* File/folder icon */}
      <FileIcon
        filename={entry.name}
        type={entry.type}
        isExpanded={entry.isExpanded}
      />

      {/* Name */}
      <span className={cn(
        'text-sm truncate flex-1',
        isSelected ? 'text-text-strong' : 'text-text-primary'
      )}>
        {entry.name}
      </span>

      {/* Loading indicator */}
      {entry.isLoading && (
        <Loader2 className="w-3 h-3 animate-spin text-text-dim" />
      )}
    </div>
  )
})
