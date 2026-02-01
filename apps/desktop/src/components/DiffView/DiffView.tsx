import { useEffect, useRef, useCallback } from 'react'
import { useVirtualizer } from '@tanstack/react-virtual'
import { useSetAtom } from 'jotai'
import { cn } from '@/lib/utils'
import { useWorktreeDiff } from '@/hooks/useRpc'
import { useFileSystem } from '@/hooks/useFileSystem'
import { openFileAtom } from '@/store/fileExplorer'
import { Undo2, ChevronDown, SquareDot, Plus, Minus } from 'lucide-react'
import type { FileDiff } from '@/lib/rpc'

interface DiffViewProps {
  /** Worktree ID for loading diff data */
  workspaceId: string
  /** Root path of the worktree for resolving file paths */
  rootPath?: string
}

/**
 * Get status icon and color for file status
 */
function getStatusStyle(status: FileDiff['status']) {
  switch (status) {
    case 'added':
      return { icon: Plus, color: 'text-[--git-green]' }
    case 'deleted':
      return { icon: Minus, color: 'text-[--git-red]' }
    case 'modified':
      return { icon: SquareDot, color: 'text-[--git-yellow]' }
    case 'renamed':
      return { icon: SquareDot, color: 'text-[--git-blue]' }
    default:
      return { icon: SquareDot, color: 'text-[--git-yellow]' }
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
 * File row component
 */
function FileRow({
  file,
  onClick,
}: {
  file: FileDiff
  onClick?: () => void
}) {
  const { directory, filename } = splitPath(file.path)
  const { icon: StatusIcon, color: statusColor } = getStatusStyle(file.status)

  return (
    <div
      className="group flex items-center py-1 px-3 mx-2 gap-1.5 hover:bg-accent has-[button:hover]:bg-transparent rounded-md cursor-pointer text-sm relative"
      data-state="closed"
      onClick={onClick}
    >
      {/* File path */}
      <div className="flex-1 min-w-0 overflow-hidden flex items-center gap-2">
        <div className="truncate">
          <span className="font-sans flex items-baseline min-w-0">
            {directory && (
              <span className="truncate min-w-0 text-muted-foreground">
                {directory}
              </span>
            )}
            <span className="truncate min-w-0">{filename}</span>
          </span>
        </div>
      </div>

      {/* Actions grid - overlapping visible/hover states */}
      <div
        className="grid min-w-10 shrink-0 items-center"
        style={{ gridTemplateAreas: '"content"' }}
      >
        {/* Hover actions */}
        <div
          className="flex items-center justify-end h-full invisible group-hover:visible"
          style={{
            gridRowStart: 'content',
            gridColumnStart: 'content',
            gridRowEnd: 'content',
            gridColumnEnd: 'content',
          }}
        >
          <button
            className="inline-flex px-2 items-center gap-2 whitespace-nowrap ring-offset-background focus-visible:outline-none focus-visible:ring-none disabled:pointer-events-none disabled:opacity-50 text-foreground/90 hover:bg-sidebar-accent hover:text-accent-foreground font-450 h-6 w-6 text-xs justify-center rounded-sm"
            data-state="closed"
            title="Undo changes"
          >
            <Undo2 className="size-3" aria-hidden="true" />
          </button>
          <button
            className="inline-flex items-center whitespace-nowrap ring-offset-background focus-visible:outline-none focus-visible:ring-none disabled:pointer-events-none disabled:opacity-50 text-foreground/90 hover:bg-sidebar-accent hover:text-accent-foreground h-6 w-6 text-xs justify-center rounded-sm gap-1 font-mono font-medium max-w-32 px-1.5"
            type="button"
            aria-haspopup="menu"
            aria-expanded="false"
            data-state="closed"
          >
            <ChevronDown className="size-3" aria-hidden="true" />
          </button>
        </div>

        {/* Default state - stats */}
        <div
          className="flex items-center justify-end gap-2 px-1.5 h-full visible group-hover:invisible"
          style={{
            gridRowStart: 'content',
            gridColumnStart: 'content',
            gridRowEnd: 'content',
            gridColumnEnd: 'content',
          }}
        >
          <div className="flex items-center gap-1">
            <div className="flex items-center gap-1 text-[10px] font-mono font-medium flex-shrink-0">
              {(file.additions ?? 0) > 0 && (
                <span className="text-[--git-green]">+{file.additions}</span>
              )}
              {(file.deletions ?? 0) > 0 && (
                <span className="text-[--git-red]">-{file.deletions}</span>
              )}
            </div>
            <StatusIcon
              className={cn('size-3 flex-shrink-0', statusColor)}
              aria-hidden="true"
            />
          </div>
        </div>
      </div>
    </div>
  )
}

/**
 * Main diff view component - Conductor-style flat file list
 *
 * Shows git diff of worktree against its merge base (target branch)
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
      if (!rootPath || file.status === 'deleted') return

      const fullPath = `${rootPath}/${file.path}`
      const filename = file.path.split('/').pop() ?? file.path

      try {
        const content = await readFile(fullPath)
        openFile({
          path: fullPath,
          name: filename,
          content,
        })
      } catch (err) {
        console.error('Failed to open file:', err)
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
      <div className="flex-1 flex items-center justify-center text-muted-foreground text-sm">
        Loading...
      </div>
    )
  }

  if (files.length === 0) {
    return (
      <div className="flex-1 flex items-center justify-center text-muted-foreground text-sm">
        No changes
      </div>
    )
  }

  return (
    <div
      ref={parentRef}
      className="flex-1 min-h-0 overflow-auto pt-2"
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
