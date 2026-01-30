import { atom } from 'jotai'

/**
 * File system entry types
 */
export type FileType = 'file' | 'directory'

/**
 * File entry in the tree
 */
export interface FileEntry {
  name: string
  path: string
  type: FileType
  size?: number
  modifiedAt?: number
  children?: FileEntry[]
  isExpanded?: boolean
  isLoading?: boolean
}

/**
 * Map file extension to icon type
 */
export function getFileIconType(
  filename: string
): 'ts' | 'tsx' | 'js' | 'jsx' | 'css' | 'json' | 'md' | 'html' | 'rust' | 'default' {
  const ext = filename.split('.').pop()?.toLowerCase()
  switch (ext) {
    case 'ts':
      return 'ts'
    case 'tsx':
      return 'tsx'
    case 'js':
      return 'js'
    case 'jsx':
      return 'jsx'
    case 'css':
    case 'scss':
    case 'sass':
    case 'less':
      return 'css'
    case 'json':
      return 'json'
    case 'md':
    case 'mdx':
      return 'md'
    case 'html':
    case 'htm':
      return 'html'
    case 'rs':
      return 'rust'
    default:
      return 'default'
  }
}

/**
 * Flatten file tree for virtual list rendering
 */
export interface FlattenedEntry extends FileEntry {
  depth: number
  parentPath: string | null
}

/**
 * Flatten the file tree into a list, respecting expanded state
 */
export function flattenFileTree(
  entries: FileEntry[],
  depth = 0,
  parentPath: string | null = null
): FlattenedEntry[] {
  const result: FlattenedEntry[] = []

  for (const entry of entries) {
    result.push({
      ...entry,
      depth,
      parentPath,
    })

    if (entry.type === 'directory' && entry.isExpanded && entry.children) {
      result.push(...flattenFileTree(entry.children, depth + 1, entry.path))
    }
  }

  return result
}

/**
 * Fuzzy match for quick open search
 */
export function fuzzyMatch(pattern: string, str: string): boolean {
  const patternLower = pattern.toLowerCase()
  const strLower = str.toLowerCase()
  let patternIdx = 0
  let strIdx = 0

  while (patternIdx < patternLower.length && strIdx < strLower.length) {
    if (patternLower[patternIdx] === strLower[strIdx]) {
      patternIdx++
    }
    strIdx++
  }

  return patternIdx === patternLower.length
}

/**
 * Collect all files from tree (for quick open)
 */
export function collectAllFiles(entries: FileEntry[]): FileEntry[] {
  const files: FileEntry[] = []

  for (const entry of entries) {
    if (entry.type === 'file') {
      files.push(entry)
    }
    if (entry.type === 'directory' && entry.children) {
      files.push(...collectAllFiles(entry.children))
    }
  }

  return files
}

/**
 * Root directory path atom
 */
export const rootPathAtom = atom<string | null>(null)

/**
 * File tree atom - contains the hierarchical file structure
 */
export const fileTreeAtom = atom<FileEntry[]>([])

/**
 * Cache for directory contents keyed by path
 */
export const directoryCache = atom<Map<string, FileEntry[]>>(new Map())

/**
 * Expanded directories set
 */
export const expandedPathsAtom = atom<Set<string>>(new Set<string>())

/**
 * Currently selected file path
 */
export const selectedPathAtom = atom<string | null>(null)

/**
 * Open files (tabs in editor)
 */
export interface OpenFile {
  path: string
  name: string
  content: string
  isDirty: boolean
  language: string
}

export const openFilesAtom = atom<OpenFile[]>([])

/**
 * Active file path (currently focused in editor)
 */
export const activeFilePathAtom = atom<string | null>(null)

/**
 * Quick open dialog visibility
 */
export const quickOpenVisibleAtom = atom(false)

/**
 * Quick open search query
 */
export const quickOpenQueryAtom = atom('')

/**
 * Derived: flattened file tree for virtual list
 */
export const flattenedTreeAtom = atom((get) => {
  const tree = get(fileTreeAtom)
  const expandedPaths = get(expandedPathsAtom)

  // Update isExpanded on tree based on expandedPaths
  const updateExpanded = (entries: FileEntry[]): FileEntry[] =>
    entries.map((entry) => ({
      ...entry,
      isExpanded: expandedPaths.has(entry.path),
      children: entry.children ? updateExpanded(entry.children) : undefined,
    }))

  const expandedTree = updateExpanded(tree)
  return flattenFileTree(expandedTree)
})

/**
 * Derived: quick open results
 */
export const quickOpenResultsAtom = atom((get) => {
  const tree = get(fileTreeAtom)
  const query = get(quickOpenQueryAtom)

  if (!query) return []

  const allFiles = collectAllFiles(tree)
  return allFiles
    .filter((f) => fuzzyMatch(query, f.name) || fuzzyMatch(query, f.path))
    .slice(0, 20) // Limit results
})

/**
 * Action: toggle directory expansion
 */
export const toggleExpandedAtom = atom(null, (get, set, path: string) => {
  const expanded = get(expandedPathsAtom)
  const newExpanded = new Set(expanded)

  if (newExpanded.has(path)) {
    newExpanded.delete(path)
  } else {
    newExpanded.add(path)
  }

  set(expandedPathsAtom, newExpanded)
})

/**
 * Action: open file in editor
 */
export const openFileAtom = atom(
  null,
  (get, set, file: { path: string; name: string; content: string }) => {
    const openFiles = get(openFilesAtom)

    // Check if file is already open
    const existing = openFiles.find((f) => f.path === file.path)
    if (existing) {
      set(activeFilePathAtom, file.path)
      return
    }

    // Determine language from extension
    const ext = file.name.split('.').pop()?.toLowerCase()
    let language = 'plaintext'
    switch (ext) {
      case 'ts':
      case 'tsx':
        language = 'typescript'
        break
      case 'js':
      case 'jsx':
        language = 'javascript'
        break
      case 'css':
        language = 'css'
        break
      case 'json':
        language = 'json'
        break
      case 'md':
      case 'mdx':
        language = 'markdown'
        break
      case 'html':
        language = 'html'
        break
      case 'rs':
        language = 'rust'
        break
    }

    const newFile: OpenFile = {
      path: file.path,
      name: file.name,
      content: file.content,
      isDirty: false,
      language,
    }

    set(openFilesAtom, [...openFiles, newFile])
    set(activeFilePathAtom, file.path)
  }
)

/**
 * Action: close file
 */
export const closeFileAtom = atom(null, (get, set, path: string) => {
  const openFiles = get(openFilesAtom)
  const activeFile = get(activeFilePathAtom)

  const newFiles = openFiles.filter((f) => f.path !== path)
  set(openFilesAtom, newFiles)

  // If we closed the active file, activate the last one
  if (activeFile === path && newFiles.length > 0) {
    const lastFile = newFiles[newFiles.length - 1]
    if (lastFile) {
      set(activeFilePathAtom, lastFile.path)
    }
  } else if (newFiles.length === 0) {
    set(activeFilePathAtom, null)
  }
})

/**
 * Action: mark file as dirty
 */
export const markFileDirtyAtom = atom(
  null,
  (get, set, { path, isDirty }: { path: string; isDirty: boolean }) => {
    const openFiles = get(openFilesAtom)
    set(
      openFilesAtom,
      openFiles.map((f) => (f.path === path ? { ...f, isDirty } : f))
    )
  }
)

/**
 * Action: update file content
 */
export const updateFileContentAtom = atom(
  null,
  (get, set, { path, content }: { path: string; content: string }) => {
    const openFiles = get(openFilesAtom)
    set(
      openFilesAtom,
      openFiles.map((f) =>
        f.path === path ? { ...f, content, isDirty: true } : f
      )
    )
  }
)
