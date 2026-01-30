import { useEffect, useCallback } from 'react'
import { useAtom, useSetAtom } from 'jotai'
import {
  fileTreeAtom,
  rootPathAtom,
  openFileAtom,
  type FileEntry,
  type FlattenedEntry,
} from '@/store/fileExplorer'
import { FileTree } from './FileTree'
import { QuickOpen } from './QuickOpen'
import { useFileSystem } from '@/hooks/useFileSystem'

interface FileExplorerProps {
  rootPath: string
  mockMode?: boolean
}

/**
 * Main file explorer component
 * Provides tree view with lazy loading, virtual list, and quick open
 */
export function FileExplorer({ rootPath, mockMode = false }: FileExplorerProps) {
  const [, setFileTree] = useAtom(fileTreeAtom)
  const setRootPath = useSetAtom(rootPathAtom)
  const openFile = useSetAtom(openFileAtom)
  const { readDirectory, readFile, isLoading, error } = useFileSystem({ mockMode })

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

  return (
    <div data-testid="file-explorer" className="h-full flex flex-col">
      {/* Header */}
      <div
        data-testid="file-explorer-root"
        className="flex items-center justify-between px-3 py-2 border-b border-border bg-background"
      >
        <div className="flex items-center gap-2 min-w-0">
          <svg
            className="w-4 h-4 text-muted-foreground flex-shrink-0"
            viewBox="0 0 24 24"
            fill="currentColor"
          >
            <path d="M10 4H4c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V8c0-1.1-.9-2-2-2h-8l-2-2z" />
          </svg>
          <span className="text-sm font-medium truncate">
            {rootPath.split('/').pop() ?? 'Files'}
          </span>
        </div>

        {/* Refresh button */}
        <button
          className="p-1 hover:bg-accent rounded transition-colors"
          title="Refresh"
          onClick={handleRefresh}
        >
          <svg
            className={`w-4 h-4 text-muted-foreground ${isLoading ? 'animate-spin' : ''}`}
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
          >
            <path d="M21 12a9 9 0 11-9-9" />
          </svg>
        </button>
      </div>

      {/* Error state */}
      {error && (
        <div className="px-3 py-2 text-xs text-red-500 bg-red-500/10">
          {error}
        </div>
      )}

      {/* Loading state */}
      {isLoading && (
        <div className="px-3 py-4 space-y-2">
          {[1, 2, 3, 4, 5].map((i) => (
            <div
              key={i}
              className="h-6 bg-muted/50 rounded animate-pulse"
              style={{ width: `${String(60 + Math.random() * 30)}%` }}
            />
          ))}
        </div>
      )}

      {/* File tree */}
      {!isLoading && (
        <div className="flex-1 overflow-hidden">
          <FileTree onFileOpen={handleFileOpen} />
        </div>
      )}

      {/* Quick open dialog */}
      <QuickOpen onFileSelect={handleQuickOpenFileSelect} />
    </div>
  )
}
