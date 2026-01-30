import { useRef, useCallback, useEffect } from 'react'
import { useAtomValue, useSetAtom } from 'jotai'
import { useVirtualizer } from '@tanstack/react-virtual'
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

/**
 * File status badge colors
 */
const STATUS_COLORS: Record<FileStatus, { bg: string; text: string }> = {
  added: { bg: 'bg-green-500/20', text: 'text-green-500' },
  modified: { bg: 'bg-yellow-500/20', text: 'text-yellow-500' },
  deleted: { bg: 'bg-red-500/20', text: 'text-red-500' },
  renamed: { bg: 'bg-blue-500/20', text: 'text-blue-500' },
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
    <div className="flex flex-col h-full" data-testid="diff-file-tree">
      {/* Header with file count */}
      <div className="px-3 py-2 border-b border-border bg-secondary/30">
        <span className="text-sm font-medium text-foreground">Changed Files</span>
        <span
          className="ml-2 text-xs text-muted-foreground"
          data-testid="diff-file-count"
        >
          ({fileCount})
        </span>
      </div>

      {/* Virtualized list */}
      <div
        ref={parentRef}
        className="flex-1 overflow-auto"
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
      className="w-full flex items-center gap-2 px-2 py-1.5 hover:bg-accent/50 transition-colors text-left"
      style={{ paddingLeft: `${String(depth * 12 + 8)}px` }}
      onClick={onClick}
      data-testid="diff-folder-item"
      data-expanded={isExpanded}
      aria-expanded={isExpanded}
      role="treeitem"
    >
      {/* Expand/collapse icon */}
      <svg
        className={`w-4 h-4 text-muted-foreground transition-transform ${
          isExpanded ? 'rotate-90' : ''
        }`}
        fill="none"
        stroke="currentColor"
        viewBox="0 0 24 24"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={2}
          d="M9 5l7 7-7 7"
        />
      </svg>

      {/* Folder icon */}
      <svg
        className="w-4 h-4 text-yellow-500"
        fill="currentColor"
        viewBox="0 0 20 20"
      >
        <path d="M2 6a2 2 0 012-2h5l2 2h5a2 2 0 012 2v6a2 2 0 01-2 2H4a2 2 0 01-2-2V6z" />
      </svg>

      <span className="text-sm text-foreground truncate">{folder.name}</span>
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
      className={`
        w-full flex items-center gap-2 px-2 py-1.5 transition-colors text-left
        ${isSelected ? 'bg-accent text-accent-foreground' : 'hover:bg-accent/50'}
      `}
      style={{ paddingLeft: `${String(depth * 12 + 8)}px` }}
      onClick={onClick}
      data-testid="diff-file-item"
      data-selected={isSelected}
      role="treeitem"
      aria-selected={isSelected}
    >
      {/* File icon */}
      <svg
        className="w-4 h-4 text-muted-foreground flex-shrink-0"
        fill="none"
        stroke="currentColor"
        viewBox="0 0 24 24"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={2}
          d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
        />
      </svg>

      {/* Filename */}
      <span className="text-sm truncate flex-1">{file.filename}</span>

      {/* Change stats */}
      <div className="flex items-center gap-1 text-xs flex-shrink-0">
        {file.additions > 0 && (
          <span className="text-green-500">+{file.additions}</span>
        )}
        {file.deletions > 0 && (
          <span className="text-red-500">-{file.deletions}</span>
        )}
      </div>

      {/* Status badge */}
      <span
        className={`
          px-1.5 py-0.5 rounded text-xs font-medium flex-shrink-0
          ${statusColor.bg} ${statusColor.text}
        `}
        data-testid="file-status-badge"
        data-status={file.status}
      >
        {statusLabel}
      </span>
    </button>
  )
}
