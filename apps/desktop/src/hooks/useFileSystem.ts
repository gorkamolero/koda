import { useState, useCallback, useRef } from 'react'
import { writeTextFile } from '@tauri-apps/plugin-fs'
import { rpcRequest } from '@/lib/tauri'
import { RPC_METHODS, type FileEntry as RpcFileEntry } from '@/lib/rpc'
import type { FileEntry } from '@/store/fileExplorer'

interface UseFileSystemReturn {
  readDirectory: (path: string) => Promise<FileEntry[]>
  readFile: (path: string) => Promise<string>
  writeFile: (path: string, content: string) => Promise<void>
  isLoading: boolean
  error: string | null
}

/**
 * Hook for file system operations
 *
 * Uses RPC calls to sidecar for read operations (works in both Tauri and E2E contexts)
 * Uses Tauri plugin for write operations (Tauri-only)
 */
export function useFileSystem(): UseFileSystemReturn {
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Cache for directory contents
  const cache = useRef<Map<string, FileEntry[]>>(new Map())

  /**
   * Read directory contents via RPC
   */
  const readDirectory = useCallback(
    async (dirPath: string): Promise<FileEntry[]> => {
      // Check cache
      const cached = cache.current.get(dirPath)
      if (cached) {
        return cached
      }

      setIsLoading(true)
      setError(null)

      try {
        const entries = await rpcRequest<RpcFileEntry[]>(
          RPC_METHODS.FS_READ_DIRECTORY,
          { path: dirPath }
        )

        // Convert to FileEntry format (already sorted by sidecar)
        const fileEntries: FileEntry[] = entries.map((entry) => ({
          name: entry.name,
          path: entry.path,
          type: entry.type,
        }))

        // Cache result
        cache.current.set(dirPath, fileEntries)

        return fileEntries
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err)
        setError(`Failed to read directory: ${message}`)
        return []
      } finally {
        setIsLoading(false)
      }
    },
    []
  )

  /**
   * Read file contents via RPC
   */
  const readFile = useCallback(async (filePath: string): Promise<string> => {
    setError(null)

    try {
      const content = await rpcRequest<string>(
        RPC_METHODS.FS_READ_FILE,
        { path: filePath }
      )
      return content
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      setError(`Failed to read file: ${message}`)
      return ''
    }
  }, [])

  /**
   * Write file contents (still uses Tauri plugin)
   */
  const writeFile = useCallback(async (filePath: string, content: string): Promise<void> => {
    setError(null)

    try {
      await writeTextFile(filePath, content)
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
