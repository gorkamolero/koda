import { useRef, useCallback, useEffect, useMemo } from 'react'
import { useAtomValue, useSetAtom } from 'jotai'
import { useVirtualizer } from '@tanstack/react-virtual'
import { cn } from '@/lib/utils'
import {
  filteredTreeAtom,
  expandedFoldersAtom,
  selectedFileIdAtom,
  toggleFolderAtom,
  flattenTree,
  isDiffFolder,
  fileFilterAtom,
  fileCountsByStatusAtom,
  type DiffTreeNode,
  type DiffFile,
  type FileStatus,
  type DiffFileFilter,
} from '@/store/diff'
import { ChevronRight, Folder, Plus, Minus, FileEdit, Files } from 'lucide-react'

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
 * Filter tab configuration
 */
const FILTER_TABS: Array<{
  id: DiffFileFilter
  label: string
  icon: React.ComponentType<{ className?: string }>
  color: string
}> = [
  { id: 'all', label: 'All', icon: Files, color: 'text-text-muted' },
  { id: 'added', label: 'Added', icon: Plus, color: 'text-[--git-green]' },
  { id: 'modified', label: 'Modified', icon: FileEdit, color: 'text-[--git-yellow]' },
  { id: 'deleted', label: 'Deleted', icon: Minus, color: 'text-[--git-red]' },
]

/**
 * Virtualized file tree for diff navigation
 */
export function FileTree({ onNavigateNext, onNavigatePrev }: FileTreeProps) {
  const tree = useAtomValue(filteredTreeAtom)
  const expandedFolders = useAtomValue(expandedFoldersAtom)
  const selectedFileId = useAtomValue(selectedFileIdAtom)
  const setSelectedFileId = useSetAtom(selectedFileIdAtom)
  const toggleFolder = useSetAtom(toggleFolderAtom)
  const activeFilter = useAtomValue(fileFilterAtom)
  const setFileFilter = useSetAtom(fileFilterAtom)
  const fileCounts = useAtomValue(fileCountsByStatusAtom)

  const parentRef = useRef<HTMLDivElement>(null)

  // Flatten tree for virtual list
  const flattenedItems = useMemo(
    () => flattenTree(tree, expandedFolders),
    [tree, expandedFolders]
  )

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
      {/* Header with title */}
      <div className="px-3 py-2 border-b border-border-subtle">
        <span className="text-sm font-medium text-text-primary">Changed Files</span>
        <span
          className="ml-2 text-xs text-text-faint bg-surface-control px-1.5 py-0.5 rounded"
          data-testid="diff-file-count"
        >
          {fileCounts.all}
        </span>
      </div>

      {/* Filter tabs */}
      <div className="px-2 py-2 border-b border-border-subtle flex flex-wrap gap-1">
        {FILTER_TABS.map((tab) => {
          const count = fileCounts[tab.id]
          const isActive = activeFilter === tab.id
          const Icon = tab.icon

          // Don't show tabs with 0 count (except 'all')
          if (count === 0 && tab.id !== 'all') return null

          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => { setFileFilter(tab.id); }}
              className={cn(
                'flex items-center gap-1 px-2 py-1 text-xs rounded-md transition-colors',
                isActive
                  ? 'bg-surface-active text-text-strong'
                  : 'text-text-muted hover:bg-surface-hover hover:text-text-primary'
              )}
              data-testid={`filter-${tab.id}`}
              data-active={isActive}
            >
              <Icon className={cn('w-3 h-3', isActive && tab.color)} />
              <span>{tab.label}</span>
              {count > 0 && (
                <span
                  className={cn(
                    'px-1 py-0.5 text-[10px] rounded',
                    isActive
                      ? 'bg-surface-control text-text-primary'
                      : 'bg-surface-control/50 text-text-faint'
                  )}
                >
                  {count}
                </span>
              )}
            </button>
          )
        })}
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
        'w-full flex items-center gap-2 px-2 py-1.5 transition-colors text-left group',
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
      {/* Status badge - show first like Conductor */}
      <span
        className={cn(
          'w-4 h-4 flex items-center justify-center rounded text-[10px] font-bold flex-shrink-0',
          statusColor.bg,
          statusColor.text
        )}
        data-testid="file-status-badge"
        data-status={file.status}
      >
        {statusLabel}
      </span>

      {/* Full file path - like Conductor */}
      <span className="text-sm truncate flex-1 text-text-primary font-mono">
        {file.path}
      </span>

      {/* Change stats - colored like Conductor */}
      <div className="flex items-center gap-1.5 text-xs flex-shrink-0 tabular-nums">
        {file.additions > 0 && (
          <span className="text-[--git-green]">+{file.additions}</span>
        )}
        {file.deletions > 0 && (
          <span className="text-[--git-red]">-{file.deletions}</span>
        )}
      </div>
    </button>
  )
}
