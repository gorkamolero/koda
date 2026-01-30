import { memo, useCallback, type KeyboardEvent as ReactKeyboardEvent } from 'react'
import { useSetAtom, useAtomValue } from 'jotai'
import {
  type FlattenedEntry,
  toggleExpandedAtom,
  selectedPathAtom,
} from '@/store/fileExplorer'
import { FileIcon } from './FileIcon'

interface FileTreeItemProps {
  entry: FlattenedEntry
  onSelect: (entry: FlattenedEntry) => void
  onOpen: (entry: FlattenedEntry) => void
}

/**
 * Single file/folder item in the tree
 */
export const FileTreeItem = memo(function FileTreeItem({
  entry,
  onSelect,
  onOpen,
}: FileTreeItemProps) {
  const toggleExpanded = useSetAtom(toggleExpandedAtom)
  const selectedPath = useAtomValue(selectedPathAtom)

  const isSelected = selectedPath === entry.path
  const isDirectory = entry.type === 'directory'

  // Sanitize name for test ID
  const testId = `file-item-${entry.name.replace(/\./g, '-').toLowerCase()}`

  const handleClick = useCallback(() => {
    onSelect(entry)
    if (!isDirectory) {
      onOpen(entry)
    }
  }, [entry, isDirectory, onSelect, onOpen])

  const handleExpandClick = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation()
      if (isDirectory) {
        toggleExpanded(entry.path)
      }
    },
    [isDirectory, entry.path, toggleExpanded]
  )

  const handleKeyDown = useCallback(
    (e: ReactKeyboardEvent) => {
      if (e.key === 'Enter') {
        if (isDirectory) {
          toggleExpanded(entry.path)
        } else {
          onOpen(entry)
        }
      } else if (e.key === 'ArrowRight' && isDirectory && !entry.isExpanded) {
        toggleExpanded(entry.path)
      } else if (e.key === 'ArrowLeft' && isDirectory && entry.isExpanded) {
        toggleExpanded(entry.path)
      }
    },
    [entry, isDirectory, toggleExpanded, onOpen]
  )

  return (
    <div
      data-testid={testId}
      data-selected={isSelected}
      tabIndex={0}
      role="treeitem"
      aria-expanded={isDirectory ? entry.isExpanded : undefined}
      className={`
        flex items-center gap-1 px-2 py-1 cursor-pointer
        hover:bg-accent/50 transition-colors
        ${isSelected ? 'bg-accent text-accent-foreground' : ''}
        focus:outline-none focus:ring-1 focus:ring-primary/50
      `}
      style={{ paddingLeft: `${String(entry.depth * 16 + 8)}px` }}
      onClick={handleClick}
      onKeyDown={handleKeyDown}
    >
      {/* Expand/collapse chevron */}
      {isDirectory ? (
        <button
          data-testid="expand-button"
          className="p-0.5 hover:bg-accent rounded transition-colors"
          onClick={handleExpandClick}
          aria-label={entry.isExpanded ? 'Collapse' : 'Expand'}
        >
          <svg
            className={`w-3 h-3 text-muted-foreground transition-transform ${
              entry.isExpanded ? 'rotate-90' : ''
            }`}
            viewBox="0 0 24 24"
            fill="currentColor"
          >
            <path d="M8.59 16.59L13.17 12 8.59 7.41 10 6l6 6-6 6-1.41-1.41z" />
          </svg>
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
      <span className="text-sm truncate flex-1">{entry.name}</span>

      {/* Loading indicator */}
      {entry.isLoading && (
        <svg
          className="w-3 h-3 animate-spin text-muted-foreground"
          viewBox="0 0 24 24"
        >
          <circle
            cx="12"
            cy="12"
            r="10"
            stroke="currentColor"
            strokeWidth="4"
            fill="none"
            opacity="0.25"
          />
          <path
            fill="currentColor"
            d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
          />
        </svg>
      )}
    </div>
  )
})
