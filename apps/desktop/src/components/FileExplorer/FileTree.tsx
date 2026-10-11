import { useRef, useCallback, useMemo } from 'react'
import { useVirtualizer } from '@tanstack/react-virtual'
import { useAtomValue, useSetAtom } from 'jotai'
import { Tree, FileIcon, EmptyState, type TreeItem } from '@koda/ui'
import { Folder, Loader2 } from 'lucide-react'
import { fileTreeAtom, flattenedTreeAtom, expandedPathsAtom, toggleExpandedAtom, selectedPathAtom, type FileEntry, type FlattenedEntry } from '@/store/fileExplorer'

interface FileTreeProps {
  onFileOpen: (entry: FlattenedEntry) => void
  onExpand?: (entry: FlattenedEntry) => void
}

/** The feature owns directory data and virtualization; Tree supplies rows and keyboard behavior. */
export function FileTree({ onFileOpen, onExpand }: FileTreeProps) {
  const tree = useAtomValue(fileTreeAtom)
  const flattenedTree = useAtomValue(flattenedTreeAtom)
  const expandedPaths = useAtomValue(expandedPathsAtom)
  const toggleExpanded = useSetAtom(toggleExpandedAtom)
  const setSelectedPath = useSetAtom(selectedPathAtom)
  const selectedPath = useAtomValue(selectedPathAtom)
  const parentRef = useRef<HTMLDivElement>(null)
  const entries = useMemo(() => new Map(flattenedTree.map(entry => [entry.path, entry])), [flattenedTree])
  const items = useMemo(() => {
    const map = (nodes: FileEntry[]): TreeItem[] => nodes.map(entry => ({
      id: entry.path, label: entry.name, icon: <FileIcon appearance="filled" filename={entry.name} type={entry.type} isExpanded={expandedPaths.has(entry.path)} />,
      children: entry.type === 'directory' ? map(entry.children ?? []) : undefined,
      meta: <>{entry.isLoading && <Loader2 className="size-3 animate-spin text-text-dim" />}{entry.type === 'directory' && expandedPaths.has(entry.path) && entry.children && <span data-testid="folder-children" className="hidden" />}</>,
    }))
    return map(tree)
  }, [tree, expandedPaths])
  const virtualizer = useVirtualizer({ count: flattenedTree.length, getScrollElement: () => parentRef.current, estimateSize: useCallback(() => 28, []), overscan: 10 })

  if (!flattenedTree.length) return <EmptyState data-testid="file-tree" data-virtualized="true" className="h-full" icon={<Folder className="size-10" />} message="No files loaded" />

  // Measured offsets avoid scrollToIndex leaving a verification frame alive after panel unmount.
  return <Tree items={items} containerRef={parentRef} label="Files" data-testid="file-tree" data-virtualized="true" className="h-full overflow-auto pt-2" rowClassName="gap-1 py-1 text-sm" expandButtonTestId="expand-button" selectedId={selectedPath ?? undefined} expandedIds={expandedPaths}
    onSelect={item => { const entry = entries.get(item.id); if (entry) { setSelectedPath(entry.path); if (entry.type === 'file') onFileOpen(entry) } }}
    onExpandedChange={(item, expanded) => { const entry = entries.get(item.id); if (expanded && entry) onExpand?.(entry); toggleExpanded(item.id) }}
    rowProps={item => ({ 'data-testid': `file-item-${item.label.replace(/\./g, '-').toLowerCase()}`, 'data-type': item.children ? 'directory' : 'file', 'data-selected': selectedPath === item.id })}
    virtual={{ rows: virtualizer.getVirtualItems(), totalSize: virtualizer.getTotalSize(), measureElement: virtualizer.measureElement, scrollToIndex: index => { const offset = virtualizer.getOffsetForIndex(index, 'auto'); if (offset) virtualizer.scrollToOffset(offset[0]) } }} />
}
