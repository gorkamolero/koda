import { Button, DiffStat, Tree, type TreeItem } from '@koda/ui'
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
  type FileStatus,
  type DiffFileFilter,
} from '@/store/diff'
import { Plus, Minus, FileEdit, Files } from 'lucide-react'

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

  const files = flattenedItems.filter(({ node }) => !isDiffFolder(node))
  const handleKeyDown = useCallback((event: React.KeyboardEvent) => {
    if (!['j', 'k', 'n', 'p'].includes(event.key)) return
    event.preventDefault()
    const current = files.findIndex(({ node }) => node.id === selectedFileId)
    const next = files[current + (event.key === 'j' || event.key === 'n' ? 1 : -1)]
    if (next) setSelectedFileId(next.node.id)
    if (event.key === 'n') onNavigateNext?.()
    if (event.key === 'p') onNavigatePrev?.()
  }, [files, selectedFileId, setSelectedFileId, onNavigateNext, onNavigatePrev])
  useEffect(() => {
    const index = flattenedItems.findIndex(({ node }) => node.id === selectedFileId)
    const offset = index >= 0 ? virtualizer.getOffsetForIndex(index, 'auto') : undefined
    if (offset) virtualizer.scrollToOffset(offset[0])
  }, [selectedFileId, flattenedItems, virtualizer])
  const nodes = new Map(flattenedItems.map(({ node }) => [node.id, node]))
  function toItems(nodes: DiffTreeNode[]): TreeItem[] {
    return nodes.map(node => isDiffFolder(node) ? { id: node.id, label: node.name, children: toItems(node.children) } : {
      id: node.id, label: node.path,
      icon: <span className={cn('flex size-4 shrink-0 items-center justify-center rounded text-2xs font-bold', STATUS_COLORS[node.status].bg, STATUS_COLORS[node.status].text)} data-testid="file-status-badge" data-status={node.status}>{STATUS_LABELS[node.status]}</span>,
      meta: <DiffStat hideZero additionClassName="text-[var(--git-green)]" deletionClassName="text-[var(--git-red)]" deletionSign="-" additions={node.additions} deletions={node.deletions} showBar={false} />,
    })
  }

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
            <Button variant="unstyled"
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
                    'px-1 py-0.5 text-2xs rounded',
                    isActive
                      ? 'bg-surface-control text-text-primary'
                      : 'bg-surface-control/50 text-text-faint'
                  )}
                >
                  {count}
                </span>
              )}
            </Button>
          )
        })}
      </div>

      <Tree items={toItems(tree)} label="Changed files" containerRef={parentRef} className="flex-1 overflow-auto fade-mask-y" data-virtualized="true" selectedId={selectedFileId ?? undefined} expandedIds={expandedFolders} indent="3" rowClassName="text-sm"
        onSelect={item => { if (!item.children) setSelectedFileId(item.id) }} onExpandedChange={item => toggleFolder(item.id)} onKeyDown={handleKeyDown}
        rowProps={item => { const node = nodes.get(item.id); return node && !isDiffFolder(node) ? { 'data-testid': `diff-file-${node.path.replace(/[./]/g, '-')}`, 'data-selected': selectedFileId === node.id, 'data-file-status': node.status } : { 'data-testid': 'diff-folder-item', 'data-expanded': expandedFolders.has(item.id) } }}
        virtual={{ rows: virtualizer.getVirtualItems(), totalSize: virtualizer.getTotalSize(), measureElement: virtualizer.measureElement, scrollToIndex: index => { const offset = virtualizer.getOffsetForIndex(index, 'auto'); if (offset) virtualizer.scrollToOffset(offset[0]) } }} />
    </div>
  )
}
