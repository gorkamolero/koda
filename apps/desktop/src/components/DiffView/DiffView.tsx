import { useEffect, useRef, useCallback } from 'react'
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
    <div
      className="group flex items-center py-1.5 px-3 gap-2 hover:bg-surface-hover cursor-pointer text-xs font-mono transition-colors"
      data-testid={testId}
      data-file-status={file.status}
      onClick={onClick}
    >
      {/* Status indicator */}
      <span className={cn('w-4 text-center', statusColor)}>[{statusLabel}]</span>

      {/* File path */}
      <div className="flex-1 min-w-0 overflow-hidden flex items-baseline">
        {directory && (
          <span className="text-text-faint truncate">{directory}</span>
        )}
        <span className="text-text-primary truncate">{filename}</span>
      </div>

      {/* Stats - visible by default, hide on hover */}
      <div className="flex items-center gap-2 group-hover:hidden">
        {(file.additions ?? 0) > 0 && (
          <span className="text-[--git-green]">+{file.additions}</span>
        )}
        {(file.deletions ?? 0) > 0 && (
          <span className="text-[--git-red]">-{file.deletions}</span>
        )}
      </div>

      {/* Actions - hidden by default, show on hover */}
      <div className="hidden group-hover:flex items-center gap-1">
        <button
          className="p-1 text-text-muted hover:text-text-accent transition-colors"
          title="Undo changes"
          onClick={(e) => { e.stopPropagation() }}
        >
          <Undo2 className="size-3" />
        </button>
        <button
          className="p-1 text-text-muted hover:text-text-accent transition-colors"
          onClick={(e) => { e.stopPropagation() }}
        >
          <ChevronDown className="size-3" />
        </button>
      </div>
    </div>
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

  // Fetch worktree diff
  const { data: diffData, isLoading } = useWorktreeDiff(workspaceId)
  const files = diffData?.files ?? []

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
      <div className="flex-1 flex flex-col items-center justify-center text-text-faint text-xs font-mono">
        <div>Loading...</div>
        <div className="mt-2">████████░░░░░░░░</div>
      </div>
    )
  }

  if (files.length === 0) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center text-text-faint text-xs font-mono p-4">
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
              <FileRow file={file} onClick={() => void handleFileClick(file)} />
            </div>
          )
        })}
      </div>
    </div>
  )
}
