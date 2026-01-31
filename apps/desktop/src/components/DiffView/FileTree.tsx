import { useRef, useCallback, useEffect } from 'react'
import { useAtomValue, useSetAtom } from 'jotai'
import { useVirtualizer } from '@tanstack/react-virtual'
import { cn } from '@/lib/utils'
import {
  diffTreeAtom,
  expandedFoldersAtom,
  selectedFileIdAtom,
  toggleFolderAtom,
  flattenTree,
  isDiffFolder,
  type DiffTreeNode,
  type DiffFile,
  type FileStatus,
} from '@/store/diff'
import { ChevronRight, File, Folder } from 'lucide-react'

/**
 * File status badge colors - using design tokens
 */
const STATUS_COLORS: Record<FileStatus, { bg: string; text: string }> = {
  added: { bg: 'bg-status-success/20', text: 'text-status-success' },
  modified: { bg: 'bg-status-warning/20', text: 'text-status-warning' },
  deleted: { bg: 'bg-status-error/20', text: 'text-status-error' },
  renamed: { bg: 'bg-text-accent/20', text: 'text-text-accent' },
}

/**
 * File status badge labels
 */
const STATUS_LABELS: Record<FileStatus, string> = {
  added: 'A',
  modified: 'M',
  deleted: 'D',
  renamed: 'R',
}

interface FileTreeProps {
  /** Callback when keyboard navigation moves to next file */
  onNavigateNext?: () => void
  /** Callback when keyboard navigation moves to previous file */
  onNavigatePrev?: () => void
}

/**
 * Virtualized file tree for diff navigation
 */
export function FileTree({ onNavigateNext, onNavigatePrev }: FileTreeProps) {
  const tree = useAtomValue(diffTreeAtom)
  const expandedFolders = useAtomValue(expandedFoldersAtom)
  const selectedFileId = useAtomValue(selectedFileIdAtom)
  const setSelectedFileId = useSetAtom(selectedFileIdAtom)
  const toggleFolder = useSetAtom(toggleFolderAtom)

  const parentRef = useRef<HTMLDivElement>(null)

  // Flatten tree for virtual list
  const flattenedItems = flattenTree(tree, expandedFolders)

  // Count total files (not folders)
  const fileCount = flattenedItems.filter(
    ({ node }) => !isDiffFolder(node)
  ).length

  const virtualizer = useVirtualizer({
    count: flattenedItems.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 32,
    overscan: 5,
  })

  const handleItemClick = useCallback(
    (node: DiffTreeNode) => {
      if (isDiffFolder(node)) {
        toggleFolder(node.id)
      } else {
        setSelectedFileId(node.id)
      }
    },
    [toggleFolder, setSelectedFileId]
  )

  // Keyboard navigation
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      const files = flattenedItems.filter(({ node }) => !isDiffFolder(node))
      const currentIndex = files.findIndex(({ node }) => {
        if (isDiffFolder(node)) return false
        return node.id === selectedFileId
      })

      switch (e.key) {
        case 'ArrowDown':
        case 'j': {
          e.preventDefault()
          const nextItem = files[currentIndex + 1]
          if (currentIndex < files.length - 1 && nextItem && !isDiffFolder(nextItem.node)) {
            setSelectedFileId(nextItem.node.id)
          }
          break
        }
        case 'ArrowUp':
        case 'k': {
          e.preventDefault()
          const prevItem = files[currentIndex - 1]
          if (currentIndex > 0 && prevItem && !isDiffFolder(prevItem.node)) {
            setSelectedFileId(prevItem.node.id)
          }
          break
        }
        case 'n': {
          e.preventDefault()
          onNavigateNext?.()
          const nextItem = files[currentIndex + 1]
          if (currentIndex < files.length - 1 && nextItem && !isDiffFolder(nextItem.node)) {
            setSelectedFileId(nextItem.node.id)
          }
          break
        }
        case 'p': {
          e.preventDefault()
          onNavigatePrev?.()
          const prevItem = files[currentIndex - 1]
          if (currentIndex > 0 && prevItem && !isDiffFolder(prevItem.node)) {
            setSelectedFileId(prevItem.node.id)
          }
          break
        }
        case 'Enter':
        case ' ': {
          e.preventDefault()
          // Toggle folder or select file at current index
          const current = flattenedItems[currentIndex]
          if (current) {
            handleItemClick(current.node)
          }
          break
        }
      }
    },
    [
      flattenedItems,
      selectedFileId,
      setSelectedFileId,
      handleItemClick,
      onNavigateNext,
      onNavigatePrev,
    ]
  )

  // Scroll selected item into view
  useEffect(() => {
    if (selectedFileId) {
      const index = flattenedItems.findIndex(({ node }) => {
        if (isDiffFolder(node)) return false
        return node.id === selectedFileId
      })
      if (index !== -1) {
        virtualizer.scrollToIndex(index, { align: 'auto' })
      }
    }
  }, [selectedFileId, flattenedItems, virtualizer])

  return (
    <div className="flex flex-col h-full bg-surface-sidebar" data-testid="diff-file-tree">
      {/* Header with file count */}
      <div className="px-3 py-2 border-b border-border-subtle">
        <span className="text-sm font-medium text-text-primary">Changed Files</span>
        <span
          className="ml-2 text-xs text-text-faint bg-surface-control px-1.5 py-0.5 rounded"
          data-testid="diff-file-count"
        >
          {fileCount}
        </span>
      </div>

      {/* Virtualized list */}
      <div
        ref={parentRef}
        className="flex-1 overflow-auto fade-mask-y"
        data-virtualized="true"
        tabIndex={0}
        onKeyDown={handleKeyDown}
        role="tree"
        aria-label="Changed files"
      >
        <div
          style={{
            height: `${String(virtualizer.getTotalSize())}px`,
            width: '100%',
            position: 'relative',
          }}
        >
          {virtualizer.getVirtualItems().map((virtualItem) => {
            const item = flattenedItems[virtualItem.index]
            if (!item) return null
            const { node, depth } = item
            const isFolder = isDiffFolder(node)
            const isSelected = !isFolder && node.id === selectedFileId

            return (
              <div
                key={virtualItem.key}
                data-index={virtualItem.index}
                ref={virtualizer.measureElement}
                style={{
                  position: 'absolute',
                  top: 0,
                  left: 0,
                  width: '100%',
                  transform: `translateY(${String(virtualItem.start)}px)`,
                }}
              >
                {isFolder ? (
                  <FolderItem
                    folder={node}
                    depth={depth}
                    isExpanded={expandedFolders.has(node.id)}
                    onClick={() => { handleItemClick(node) }}
                  />
                ) : (
                  <FileItem
                    file={node}
                    depth={depth}
                    isSelected={isSelected}
                    onClick={() => { handleItemClick(node) }}
                  />
                )}
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}

interface FolderItemProps {
  folder: {
    id: string
    name: string
  }
  depth: number
  isExpanded: boolean
  onClick: () => void
}

function FolderItem({ folder, depth, isExpanded, onClick }: FolderItemProps) {
  return (
    <button
      type="button"
      className="w-full flex items-center gap-2 px-2 py-1.5 hover:bg-surface-hover transition-colors text-left"
      style={{ paddingLeft: `${String(depth * 12 + 8)}px` }}
      onClick={onClick}
      data-testid="diff-folder-item"
      data-expanded={isExpanded}
      aria-expanded={isExpanded}
      role="treeitem"
    >
      {/* Expand/collapse icon */}
      <ChevronRight
        className={cn(
          'w-4 h-4 text-text-dim transition-transform',
          isExpanded && 'rotate-90'
        )}
      />

      {/* Folder icon */}
      <Folder className="w-4 h-4 text-status-warning" />

      <span className="text-sm text-text-primary truncate">{folder.name}</span>
    </button>
  )
}

interface FileItemProps {
  file: DiffFile
  depth: number
  isSelected: boolean
  onClick: () => void
}

function FileItem({ file, depth, isSelected, onClick }: FileItemProps) {
  const statusColor = STATUS_COLORS[file.status]
  const statusLabel = STATUS_LABELS[file.status]

  return (
    <button
      type="button"
      className={cn(
        'w-full flex items-center gap-2 px-2 py-1.5 transition-colors text-left',
        isSelected
          ? 'bg-surface-active text-text-strong'
          : 'hover:bg-surface-hover'
      )}
      style={{ paddingLeft: `${String(depth * 12 + 8)}px` }}
      onClick={onClick}
      data-testid="diff-file-item"
      data-selected={isSelected}
      role="treeitem"
      aria-selected={isSelected}
    >
      {/* File icon */}
      <File className="w-4 h-4 text-text-dim flex-shrink-0" />

      {/* Filename */}
      <span className="text-sm truncate flex-1 text-text-primary">{file.filename}</span>

      {/* Change stats */}
      <div className="flex items-center gap-1 text-xs flex-shrink-0">
        {file.additions > 0 && (
          <span className="text-status-success">+{file.additions}</span>
        )}
        {file.deletions > 0 && (
          <span className="text-status-error">-{file.deletions}</span>
        )}
      </div>

      {/* Status badge */}
      <span
        className={cn(
          'px-1.5 py-0.5 rounded text-xs font-medium flex-shrink-0',
          statusColor.bg,
          statusColor.text
        )}
        data-testid="file-status-badge"
        data-status={file.status}
      >
        {statusLabel}
      </span>
    </button>
  )
}
