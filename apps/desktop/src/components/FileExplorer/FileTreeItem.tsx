import { memo } from 'react'
import { useSetAtom, useAtomValue } from 'jotai'
import { Tree } from '@koda/ui'
import { Loader2 } from 'lucide-react'
import { type FlattenedEntry, toggleExpandedAtom, selectedPathAtom } from '@/store/fileExplorer'

interface FileTreeItemProps {
  entry: FlattenedEntry
  onSelect: (entry: FlattenedEntry) => void
  onOpen: (entry: FlattenedEntry) => void
  onExpand?: (entry: FlattenedEntry) => void
}

/** Standalone feature adapter, using the same Tree row as the virtualized explorer. */
export const FileTreeItem = memo(function FileTreeItem({ entry, onSelect, onOpen, onExpand }: FileTreeItemProps) {
  const toggleExpanded = useSetAtom(toggleExpandedAtom)
  const selectedPath = useAtomValue(selectedPathAtom)
  return <Tree items={[{ id: entry.path, label: entry.name, depth: entry.depth, children: entry.type === 'directory' ? [] : undefined, meta: entry.isLoading ? <Loader2 className="size-3 animate-spin text-text-dim" /> : undefined }]}
    selectedId={selectedPath ?? undefined} expandedIds={new Set(entry.isExpanded ? [entry.path] : [])} expandButtonTestId="expand-button" rowClassName="gap-1 py-1 text-sm"
    onSelect={() => { onSelect(entry); if (entry.type === 'file') onOpen(entry) }}
    onExpandedChange={(_, expanded) => { if (expanded) onExpand?.(entry); toggleExpanded(entry.path) }}
    rowProps={() => ({ 'data-testid': `file-item-${entry.name.replace(/\./g, '-').toLowerCase()}`, 'data-type': entry.type, 'data-selected': selectedPath === entry.path })} />
})
