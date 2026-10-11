import { Button, NavItem, IconButton, DiffStat } from '@koda/ui'
import { useEffect, useRef, useCallback, useState } from 'react'
import { useVirtualizer } from '@tanstack/react-virtual'
import { useSetAtom } from 'jotai'
import { cn } from '@/lib/utils'
import { useWorktreeDiff } from '@/hooks/useRpc'
import { useFileSystem } from '@/hooks/useFileSystem'
import { openFileAtom } from '@/store/fileExplorer'
import { Undo2, ChevronDown } from 'lucide-react'
import type { FileDiff } from '@/lib/rpc'

interface DiffViewProps {
  /** Worktree ID for loading diff data */
  workspaceId: string
  /** Root path of the worktree for resolving file paths */
  rootPath?: string
}

/**
 * Get status label for file status - terminal style
 */
function getStatusLabel(status: FileDiff['status']): { label: string; color: string } {
  switch (status) {
    case 'added':
      return { label: '+', color: 'text-[--git-green]' }
    case 'deleted':
      return { label: '-', color: 'text-[--git-red]' }
    case 'modified':
      return { label: 'M', color: 'text-[--git-yellow]' }
    case 'renamed':
      return { label: 'R', color: 'text-[--git-blue]' }
    default:
      return { label: '?', color: 'text-text-muted' }
  }
}

/**
 * Split file path into directory and filename
 */
function splitPath(path: string): { directory: string; filename: string } {
  const lastSlash = path.lastIndexOf('/')
  if (lastSlash === -1) {
    return { directory: '', filename: path }
  }
  return {
    directory: path.slice(0, lastSlash + 1),
    filename: path.slice(lastSlash + 1),
  }
}

/**
 * Terminal-style file row
 * │ [M] src/components/Button.tsx        +12 -3 │
 */
function FileRow({
  file,
  onClick,
}: {
  file: FileDiff
  onClick?: () => void
}) {
  const { directory, filename } = splitPath(file.path)
  const { label: statusLabel, color: statusColor } = getStatusLabel(file.status)
  const testId = `diff-file-${filename.replace(/\./g, '-').toLowerCase()}`

  return (
    <NavItem label={file.path} onClick={onClick} data-testid={testId} data-file-status={file.status} className="text-xs" buttonClassName="py-1.5 px-3 gap-2 rounded-none font-mono"
      actions={<>
        <IconButton variant="unstyled" aria-label="Undo changes" title="Undo changes" className="p-1 text-text-muted hover:text-text-accent" onClick={event => event.stopPropagation()}><Undo2 className="size-3" /></IconButton>
        <IconButton variant="unstyled" aria-label="File actions" className="p-1 text-text-muted hover:text-text-accent" onClick={event => event.stopPropagation()}><ChevronDown className="size-3" /></IconButton>
      </>}>
      <span className={cn('w-4 text-center', statusColor)}>[{statusLabel}]</span>
      <span className="flex min-w-0 flex-1 items-baseline overflow-hidden">{directory && <span className="truncate text-text-faint">{directory}</span>}<span className="truncate text-text-primary">{filename}</span></span>
      <DiffStat additions={file.additions ?? 0} deletions={file.deletions ?? 0} showBar={false} className="group-hover:hidden" />
    </NavItem>
  )
}

/**
 * Terminal-style diff view - flat file list with status indicators
 * ┌─ CHANGES ────────────────────────┐
 * │ [M] src/App.tsx           +5 -2  │
 * │ [+] src/utils/new.ts     +42     │
 * │ [-] src/old.ts                -8 │
 * └──────────────────────────────────┘
 */
export function DiffView({ workspaceId, rootPath }: DiffViewProps) {
  const parentRef = useRef<HTMLDivElement>(null)
  const openFile = useSetAtom(openFileAtom)
  const { readFile } = useFileSystem()
  const [selectedPath, setSelectedPath] = useState<string | null>(null)

  // Fetch worktree diff
  const { data: diffData, isLoading } = useWorktreeDiff(workspaceId)
  const files = diffData?.files ?? []
  const selectedDiff = files.find(file => file.path === selectedPath)

  // Handle file click - open in editor tab
  const handleFileClick = useCallback(
    async (file: FileDiff) => {
      console.log('[DiffView] handleFileClick called', { rootPath, file: file.path, status: file.status })

      if (!rootPath) {
        console.warn('[DiffView] No rootPath, cannot open file')
        return
      }
      if (file.status === 'deleted') {
        console.log('[DiffView] Skipping deleted file')
        return
      }

      const fullPath = `${rootPath}/${file.path}`
      const filename = file.path.split('/').pop() ?? file.path
      console.log('[DiffView] Opening file:', { fullPath, filename })

      try {
        const content = await readFile(fullPath)
        console.log('[DiffView] File read success, length:', content.length)
        openFile({
          path: fullPath,
          name: filename,
          content,
        })
      } catch (err) {
        console.error('[DiffView] Failed to open file:', err)
      }
    },
    [rootPath, readFile, openFile]
  )

  const virtualizer = useVirtualizer({
    count: files.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 32,
    overscan: 5,
  })

  // Reset scroll when files change
  useEffect(() => {
    if (parentRef.current) {
      parentRef.current.scrollTop = 0
    }
  }, [workspaceId])

  if (isLoading) {
    return (
      <div
        className="flex-1 flex flex-col items-center justify-center text-text-faint text-xs font-mono"
        data-testid="diff-view-container"
        data-loading="true"
      >
        <div>Loading...</div>
        <div className="mt-2">████████░░░░░░░░</div>
      </div>
    )
  }

  if (files.length === 0) {
    return (
      <div
        className="flex-1 flex flex-col items-center justify-center text-text-faint text-xs font-mono p-4"
        data-testid="diff-view-container"
        data-empty="true"
      >
        <div className="text-center">
          <div>┌────────────────────┐</div>
          <div>│   NO CHANGES       │</div>
          <div>│   Working tree     │</div>
          <div>│   is clean         │</div>
          <div>└────────────────────┘</div>
        </div>
      </div>
    )
  }

  return (
    <div
      ref={parentRef}
      className="flex-1 min-h-0 overflow-auto font-mono"
      data-testid="diff-view-container"
    >
      <div
        style={{
          height: `${virtualizer.getTotalSize()}px`,
          width: '100%',
          position: 'relative',
        }}
      >
        {virtualizer.getVirtualItems().map((virtualItem) => {
          const file = files[virtualItem.index]
          if (!file) return null

          return (
            <div
              key={virtualItem.key}
              style={{
                position: 'absolute',
                left: 0,
                top: 0,
                height: `${virtualItem.size}px`,
                width: '100%',
                transform: `translateY(${virtualItem.start}px)`,
              }}
            >
              <FileRow file={file} onClick={() => setSelectedPath(file.path)} />
            </div>
          )
        })}
      </div>
      {selectedDiff && (
        <section className="border-t border-dashed border-border-subtle p-3 text-xs">
          <div className="flex items-center justify-between mb-2">
            <span className="text-text-primary">{selectedDiff.path}</span>
            {selectedDiff.status !== 'deleted' && <Button variant="unstyled" onClick={() => void handleFileClick(selectedDiff)} className="text-text-accent">Open file</Button>}
          </div>
          <pre data-testid="selected-file-diff" className="whitespace-pre overflow-x-auto text-text-muted">{selectedDiff.diff || 'No text diff available'}</pre>
        </section>
      )}
    </div>
  )
}
