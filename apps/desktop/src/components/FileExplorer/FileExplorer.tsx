import { useEffect, useCallback } from 'react'
import { useAtom, useSetAtom } from 'jotai'
import { cn } from '@/lib/utils'
import {
  fileTreeAtom,
  rootPathAtom,
  openFileAtom,
  setDirectoryChildrenAtom,
  type FileEntry,
  type FlattenedEntry,
} from '@/store/fileExplorer'
import { FileTree } from './FileTree'
import { QuickOpen } from './QuickOpen'
import { useFileSystem } from '@/hooks/useFileSystem'
import { Folder, RefreshCw, AlertCircle } from 'lucide-react'

interface FileExplorerProps {
  rootPath: string
}

/**
 * Main file explorer component
 * Provides tree view with lazy loading, virtual list, and quick open
 */
export function FileExplorer({ rootPath }: FileExplorerProps) {
  const [, setFileTree] = useAtom(fileTreeAtom)
  const setRootPath = useSetAtom(rootPathAtom)
  const openFile = useSetAtom(openFileAtom)
  const setDirectoryChildren = useSetAtom(setDirectoryChildrenAtom)
  const { readDirectory, readFile, isLoading, error } = useFileSystem()

  // Load root directory on mount
  useEffect(() => {
    setRootPath(rootPath)

    const loadRoot = async () => {
      const entries = await readDirectory(rootPath)
      setFileTree(entries)
    }

    void loadRoot()
  }, [rootPath, setRootPath, setFileTree, readDirectory])

  // Handle file open from tree (async internally, but wrapped for callback)
  const handleFileOpenAsync = useCallback(
    async (entry: FlattenedEntry) => {
      if (entry.type === 'file') {
        const content = await readFile(entry.path)
        openFile({
          path: entry.path,
          name: entry.name,
          content,
        })
      }
    },
    [readFile, openFile]
  )

  // Wrapped version that doesn't return a promise
  const handleFileOpen = useCallback(
    (entry: FlattenedEntry) => {
      void handleFileOpenAsync(entry)
    },
    [handleFileOpenAsync]
  )

  // Handle file select from quick open
  const handleQuickOpenSelectAsync = useCallback(
    async (file: FileEntry) => {
      const content = await readFile(file.path)
      openFile({
        path: file.path,
        name: file.name,
        content,
      })
    },
    [readFile, openFile]
  )

  // Handle refresh click
  const handleRefresh = useCallback(() => {
    void readDirectory(rootPath).then((entries) => {
      setFileTree(entries)
    })
  }, [readDirectory, rootPath, setFileTree])

  // Handle quick open file select - wrapped to handle async properly
  const handleQuickOpenFileSelect = useCallback(
    (file: FileEntry) => {
      void handleQuickOpenSelectAsync(file)
    },
    [handleQuickOpenSelectAsync]
  )

  // Handle directory expand - lazy load children
  const handleExpandAsync = useCallback(
    async (entry: FlattenedEntry) => {
      if (entry.type === 'directory' && !entry.children) {
        const children = await readDirectory(entry.path)
        setDirectoryChildren({ path: entry.path, children })
      }
    },
    [readDirectory, setDirectoryChildren]
  )

  const handleExpand = useCallback(
    (entry: FlattenedEntry) => {
      void handleExpandAsync(entry)
    },
    [handleExpandAsync]
  )

  return (
    <div data-testid="file-explorer" className="h-full flex flex-col bg-surface-sidebar">
      {/* Header */}
      <div
        data-testid="file-explorer-root"
        className="flex items-center justify-between px-3 py-2 border-b border-border-subtle"
      >
        <div className="flex items-center gap-2 min-w-0">
          <Folder className="w-4 h-4 text-text-muted flex-shrink-0" />
          <span className="text-sm font-medium text-text-primary truncate">
            {rootPath.split('/').pop() ?? 'Files'}
          </span>
        </div>

        {/* Refresh button */}
        <button
          className="btn-icon"
          title="Refresh"
          onClick={handleRefresh}
        >
          <RefreshCw className={cn('w-4 h-4', isLoading && 'animate-spin')} />
        </button>
      </div>

      {/* Error state */}
      {error && (
        <div className="px-3 py-2 flex items-center gap-2 text-xs text-status-error bg-status-error/10 border-b border-status-error/20">
          <AlertCircle className="w-3.5 h-3.5" />
          {error}
        </div>
      )}

      {/* Loading state */}
      {isLoading && (
        <div className="px-3 py-4 space-y-2">
          {[1, 2, 3, 4, 5].map((i) => (
            <div
              key={i}
              className="h-6 bg-surface-control rounded shimmer"
              style={{ width: `${String(60 + Math.random() * 30)}%` }}
            />
          ))}
        </div>
      )}

      {/* File tree */}
      {!isLoading && (
        <div className="flex-1 overflow-hidden fade-mask-y">
          <FileTree onFileOpen={handleFileOpen} onExpand={handleExpand} />
        </div>
      )}

      {/* Quick open dialog */}
      <QuickOpen onFileSelect={handleQuickOpenFileSelect} />
    </div>
  )
}
