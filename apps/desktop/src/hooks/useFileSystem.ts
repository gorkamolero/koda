import { useState, useCallback, useRef } from 'react'
import { readDir, readTextFile, writeTextFile, type DirEntry } from '@tauri-apps/plugin-fs'
import type { FileEntry } from '@/store/fileExplorer'

interface UseFileSystemOptions {
  mockMode?: boolean
}

interface UseFileSystemReturn {
  readDirectory: (path: string) => Promise<FileEntry[]>
  readFile: (path: string) => Promise<string>
  writeFile: (path: string, content: string) => Promise<void>
  isLoading: boolean
  error: string | null
}

/**
 * Mock file tree for E2E tests
 */
const MOCK_FILE_TREE: FileEntry[] = [
  {
    name: 'src',
    path: '/workspace/src',
    type: 'directory',
    children: [
      {
        name: 'index.ts',
        path: '/workspace/src/index.ts',
        type: 'file',
      },
      {
        name: 'styles.css',
        path: '/workspace/src/styles.css',
        type: 'file',
      },
      {
        name: 'components',
        path: '/workspace/src/components',
        type: 'directory',
        children: [
          {
            name: 'App.tsx',
            path: '/workspace/src/components/App.tsx',
            type: 'file',
          },
        ],
      },
    ],
  },
  {
    name: 'package.json',
    path: '/workspace/package.json',
    type: 'file',
  },
  {
    name: 'README.md',
    path: '/workspace/README.md',
    type: 'file',
  },
]

/**
 * Mock file contents for E2E tests
 */
const MOCK_FILE_CONTENTS: Record<string, string> = {
  '/workspace/src/index.ts': `import { App } from './components/App'

export function main() {
  console.log('Hello, world!')
}
`,
  '/workspace/src/styles.css': `body {
  margin: 0;
  padding: 0;
  font-family: sans-serif;
}
`,
  '/workspace/src/components/App.tsx': `import React from 'react'

export function App() {
  return <div>Hello, App!</div>
}
`,
  '/workspace/package.json': `{
  "name": "test-workspace",
  "version": "1.0.0"
}
`,
  '/workspace/README.md': `# Test Workspace

This is a test workspace.
`,
}

/**
 * Hook for file system operations with Tauri fs plugin
 * Supports mock mode for E2E tests
 */
export function useFileSystem({
  mockMode = false,
}: UseFileSystemOptions = {}): UseFileSystemReturn {
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
      // Mock mode for E2E tests
      if (mockMode) {
        setIsLoading(true)
        await new Promise((resolve) => setTimeout(resolve, 100)) // Simulate latency
        setIsLoading(false)
        return MOCK_FILE_TREE
      }

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
    [mockMode, convertDirEntry]
  )

  /**
   * Read file contents
   */
  const readFile = useCallback(
    async (path: string): Promise<string> => {
      // Mock mode
      if (mockMode) {
        return MOCK_FILE_CONTENTS[path] ?? '// File not found'
      }

      setError(null)

      try {
        const content = await readTextFile(path)
        return content
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err)
        setError(`Failed to read file: ${message}`)
        return ''
      }
    },
    [mockMode]
  )

  /**
   * Write file contents
   */
  const writeFile = useCallback(
    async (path: string, content: string): Promise<void> => {
      // Mock mode
      if (mockMode) {
        MOCK_FILE_CONTENTS[path] = content
        return
      }

      setError(null)

      try {
        await writeTextFile(path, content)
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err)
        setError(`Failed to write file: ${message}`)
        throw err
      }
    },
    [mockMode]
  )

  return {
    readDirectory,
    readFile,
    writeFile,
    isLoading,
    error,
  }
}
