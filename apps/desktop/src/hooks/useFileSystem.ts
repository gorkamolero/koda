import { useState, useCallback, useRef } from 'react'
import { readDir, readTextFile, writeTextFile, type DirEntry } from '@tauri-apps/plugin-fs'
import type { FileEntry } from '@/store/fileExplorer'

interface UseFileSystemReturn {
  readDirectory: (path: string) => Promise<FileEntry[]>
  readFile: (path: string) => Promise<string>
  writeFile: (path: string, content: string) => Promise<void>
  isLoading: boolean
  error: string | null
}

/**
 * Hook for file system operations with Tauri fs plugin
 */
export function useFileSystem(): UseFileSystemReturn {
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Cache for directory contents
  const cache = useRef<Map<string, FileEntry[]>>(new Map())

  /**
   * Convert Tauri DirEntry to our FileEntry format
   */
  const convertDirEntry = useCallback(
    (entry: DirEntry, parentPath: string): FileEntry => ({
      name: entry.name,
      path: `${parentPath}/${entry.name}`,
      type: entry.isDirectory ? 'directory' : 'file',
    }),
    []
  )

  /**
   * Read directory contents
   */
  const readDirectory = useCallback(
    async (path: string): Promise<FileEntry[]> => {
      // Check cache
      const cached = cache.current.get(path)
      if (cached) {
        return cached
      }

      setIsLoading(true)
      setError(null)

      try {
        const entries = await readDir(path)

        // Sort: directories first, then alphabetically
        const sorted = entries.sort((a, b) => {
          if (a.isDirectory && !b.isDirectory) return -1
          if (!a.isDirectory && b.isDirectory) return 1
          return a.name.localeCompare(b.name)
        })

        const fileEntries = sorted.map((entry) => convertDirEntry(entry, path))

        // Cache result
        cache.current.set(path, fileEntries)

        return fileEntries
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err)
        setError(`Failed to read directory: ${message}`)
        return []
      } finally {
        setIsLoading(false)
      }
    },
    [convertDirEntry]
  )

  /**
   * Read file contents
   */
  const readFile = useCallback(async (path: string): Promise<string> => {
    setError(null)

    try {
      const content = await readTextFile(path)
      return content
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      setError(`Failed to read file: ${message}`)
      return ''
    }
  }, [])

  /**
   * Write file contents
   */
  const writeFile = useCallback(async (path: string, content: string): Promise<void> => {
    setError(null)

    try {
      await writeTextFile(path, content)
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      setError(`Failed to write file: ${message}`)
      throw err
    }
  }, [])

  return {
    readDirectory,
    readFile,
    writeFile,
    isLoading,
    error,
  }
}
