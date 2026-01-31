import { useRef, useCallback, type KeyboardEvent } from 'react'
import { useVirtualizer } from '@tanstack/react-virtual'
import { useAtomValue, useSetAtom } from 'jotai'
import {
  flattenedTreeAtom,
  selectedPathAtom,
  type FlattenedEntry,
} from '@/store/fileExplorer'
import { FileTreeItem } from './FileTreeItem'
import { Folder } from 'lucide-react'

interface FileTreeProps {
  onFileOpen: (entry: FlattenedEntry) => void
}

/**
 * Virtualized file tree component
 * Uses @tanstack/react-virtual for 60fps scrolling performance
 */
export function FileTree({ onFileOpen }: FileTreeProps) {
  const flattenedTree = useAtomValue(flattenedTreeAtom)
  const setSelectedPath = useSetAtom(selectedPathAtom)
  const selectedPath = useAtomValue(selectedPathAtom)
  const parentRef = useRef<HTMLDivElement>(null)

  // Virtual list setup
  const virtualizer = useVirtualizer({
    count: flattenedTree.length,
    getScrollElement: () => parentRef.current,
    estimateSize: useCallback(() => 28, []), // Height per row
    overscan: 10, // Render extra rows for smooth scrolling
  })

  const virtualItems = virtualizer.getVirtualItems()

  // Handle selection
  const handleSelect = useCallback(
    (entry: FlattenedEntry) => {
      setSelectedPath(entry.path)
    },
    [setSelectedPath]
  )

  // Keyboard navigation for the tree
  const handleKeyDown = useCallback(
    (e: KeyboardEvent<HTMLDivElement>) => {
      if (flattenedTree.length === 0) return

      const currentIndex = flattenedTree.findIndex(
        (item) => item.path === selectedPath
      )

      if (e.key === 'ArrowDown') {
        e.preventDefault()
        const nextIndex = currentIndex < flattenedTree.length - 1 ? currentIndex + 1 : 0
        const nextItem = flattenedTree[nextIndex]
        if (nextItem) {
          setSelectedPath(nextItem.path)
          virtualizer.scrollToIndex(nextIndex)
        }
      } else if (e.key === 'ArrowUp') {
        e.preventDefault()
        const prevIndex = currentIndex > 0 ? currentIndex - 1 : flattenedTree.length - 1
        const prevItem = flattenedTree[prevIndex]
        if (prevItem) {
          setSelectedPath(prevItem.path)
          virtualizer.scrollToIndex(prevIndex)
        }
      }
    },
    [flattenedTree, selectedPath, setSelectedPath, virtualizer]
  )

  if (flattenedTree.length === 0) {
    return (
      <div
        data-testid="file-tree"
        data-virtualized="true"
        className="h-full flex flex-col items-center justify-center text-center p-8"
      >
        <Folder className="w-10 h-10 text-text-dim mb-3" />
        <p className="text-text-muted text-sm">No files loaded</p>
      </div>
    )
  }

  return (
    <div
      ref={parentRef}
      data-testid="file-tree"
      data-virtualized="true"
      role="tree"
      tabIndex={0}
      className="h-full overflow-auto focus:outline-none"
      onKeyDown={handleKeyDown}
    >
      <div
        style={{
          height: `${String(virtualizer.getTotalSize())}px`,
          width: '100%',
          position: 'relative',
        }}
      >
        {virtualItems.map((virtualItem) => {
          const entry = flattenedTree[virtualItem.index]
          if (!entry) return null

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
              <FileTreeItem
                entry={entry}
                onSelect={handleSelect}
                onOpen={onFileOpen}
              />
              {/* Render folder children indicator for collapsed state */}
              {entry.type === 'directory' && entry.isExpanded && entry.children && (
                <div data-testid="folder-children" className="hidden" />
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
