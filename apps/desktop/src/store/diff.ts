import { atom } from 'jotai'

/**
 * Diff view mode: split shows side-by-side, unified shows combined
 */
export type DiffMode = 'split' | 'unified'

/**
 * File change status
 */
export type FileStatus = 'added' | 'modified' | 'deleted' | 'renamed'

/**
 * Visual comparison mode
 */
export type VisualCompareMode = 'slider' | 'side-by-side' | 'overlay'

/**
 * A file in the diff tree
 */
export interface DiffFile {
  id: string
  path: string
  filename: string
  status: FileStatus
  additions: number
  deletions: number
  /** Original content (before) */
  originalContent?: string
  /** Modified content (after) */
  modifiedContent?: string
  /** Original language for syntax highlighting */
  language?: string
  /** Has visual diff (screenshots) */
  hasVisualDiff?: boolean
  /** Before screenshot URL */
  screenshotBefore?: string
  /** After screenshot URL */
  screenshotAfter?: string
}

/**
 * Folder node in the tree
 */
export interface DiffFolder {
  id: string
  path: string
  name: string
  children: (DiffFile | DiffFolder)[]
  expanded: boolean
}

/**
 * Tree node type
 */
export type DiffTreeNode = DiffFile | DiffFolder

/**
 * Check if node is a folder
 */
export function isDiffFolder(node: DiffTreeNode): node is DiffFolder {
  return 'children' in node
}

/**
 * Inline comment on a diff line
 */
export interface DiffComment {
  id: string
  fileId: string
  lineNumber: number
  /** 'original' for left side, 'modified' for right side */
  side: 'original' | 'modified'
  content: string
  author: string
  createdAt: number
  updatedAt: number
  /** Whether this is marked as a review item */
  isReviewItem: boolean
  /** Review item status */
  reviewStatus?: 'pending' | 'resolved' | 'wontfix'
}

/**
 * Visual diff state
 */
export interface VisualDiffState {
  isEnabled: boolean
  showPixelOverlay: boolean
  sliderPosition: number
  differencePercent: number
  compareMode: VisualCompareMode
}

/**
 * File filter options for the diff panel
 */
export type DiffFileFilter = 'all' | 'added' | 'modified' | 'deleted' | 'renamed'

/**
 * Diff view state
 */
export interface DiffViewState {
  /** Currently selected file ID */
  selectedFileId: string | null
  /** Diff display mode */
  mode: DiffMode
  /** All files in the diff */
  files: DiffFile[]
  /** Folder tree structure */
  tree: DiffTreeNode[]
  /** Expanded folder IDs */
  expandedFolders: Set<string>
  /** Comments on diff lines */
  comments: DiffComment[]
  /** Active comment input (if any) */
  activeCommentInput: {
    fileId: string
    lineNumber: number
    side: 'original' | 'modified'
  } | null
  /** Visual diff state */
  visual: VisualDiffState
  /** Loading state */
  isLoading: boolean
  /** Active tab */
  activeTab: 'code' | 'visual'
  /** File filter */
  fileFilter: DiffFileFilter
}

/**
 * Initial diff view state
 */
function createInitialDiffState(): DiffViewState {
  return {
    selectedFileId: null,
    mode: 'split',
    files: [],
    tree: [],
    expandedFolders: new Set(),
    comments: [],
    activeCommentInput: null,
    visual: {
      isEnabled: false,
      showPixelOverlay: false,
      sliderPosition: 50,
      differencePercent: 0,
      compareMode: 'slider',
    },
    isLoading: false,
    activeTab: 'code',
    fileFilter: 'all',
  }
}

/**
 * Main diff state atom
 */
export const diffStateAtom = atom<DiffViewState>(createInitialDiffState())

/**
 * Selected file ID atom (derived)
 */
export const selectedFileIdAtom = atom(
  (get) => get(diffStateAtom).selectedFileId,
  (get, set, fileId: string | null) => {
    const state = get(diffStateAtom)
    set(diffStateAtom, { ...state, selectedFileId: fileId })
  }
)

/**
 * Selected file atom (derived)
 */
export const selectedFileAtom = atom((get) => {
  const state = get(diffStateAtom)
  if (!state.selectedFileId) return null
  return state.files.find((f) => f.id === state.selectedFileId) ?? null
})

/**
 * Diff mode atom (derived)
 */
export const diffModeAtom = atom(
  (get) => get(diffStateAtom).mode,
  (get, set, mode: DiffMode) => {
    const state = get(diffStateAtom)
    set(diffStateAtom, { ...state, mode })
  }
)

/**
 * Files atom (derived)
 */
export const diffFilesAtom = atom(
  (get) => get(diffStateAtom).files,
  (get, set, files: DiffFile[]) => {
    const state = get(diffStateAtom)
    const tree = buildFileTree(files)
    // Auto-expand all folders when files are loaded
    const expandedFolders = collectFolderIds(tree)
    set(diffStateAtom, { ...state, files, tree, expandedFolders })
  }
)

/**
 * Collect all folder IDs from the tree for auto-expansion
 */
function collectFolderIds(nodes: DiffTreeNode[]): Set<string> {
  const ids = new Set<string>()
  for (const node of nodes) {
    if (isDiffFolder(node)) {
      ids.add(node.id)
      // Recursively collect from children
      const childIds = collectFolderIds(node.children)
      childIds.forEach((id) => ids.add(id))
    }
  }
  return ids
}

/**
 * File tree atom (derived)
 */
export const diffTreeAtom = atom((get) => get(diffStateAtom).tree)

/**
 * Expanded folders atom (derived)
 */
export const expandedFoldersAtom = atom(
  (get) => get(diffStateAtom).expandedFolders,
  (get, set, folders: Set<string>) => {
    const state = get(diffStateAtom)
    set(diffStateAtom, { ...state, expandedFolders: folders })
  }
)

/**
 * Toggle folder expansion action
 */
export const toggleFolderAtom = atom(null, (get, set, folderId: string) => {
  const state = get(diffStateAtom)
  const expanded = new Set(state.expandedFolders)
  if (expanded.has(folderId)) {
    expanded.delete(folderId)
  } else {
    expanded.add(folderId)
  }
  set(diffStateAtom, { ...state, expandedFolders: expanded })
})

/**
 * Comments for current file atom (derived)
 */
export const currentFileCommentsAtom = atom((get) => {
  const state = get(diffStateAtom)
  if (!state.selectedFileId) return []
  return state.comments.filter((c) => c.fileId === state.selectedFileId)
})

/**
 * All comments atom (derived)
 */
export const diffCommentsAtom = atom(
  (get) => get(diffStateAtom).comments,
  (get, set, comments: DiffComment[]) => {
    const state = get(diffStateAtom)
    set(diffStateAtom, { ...state, comments })
  }
)

/**
 * Review items count atom (derived)
 */
export const reviewItemsCountAtom = atom((get) => {
  const state = get(diffStateAtom)
  return state.comments.filter(
    (c) => c.isReviewItem && c.reviewStatus === 'pending'
  ).length
})

/**
 * Active comment input atom (derived)
 */
export const activeCommentInputAtom = atom(
  (get) => get(diffStateAtom).activeCommentInput,
  (
    get,
    set,
    input: { fileId: string; lineNumber: number; side: 'original' | 'modified' } | null
  ) => {
    const state = get(diffStateAtom)
    set(diffStateAtom, { ...state, activeCommentInput: input })
  }
)

/**
 * Visual state atom (derived)
 */
export const visualStateAtom = atom(
  (get) => get(diffStateAtom).visual,
  (get, set, visual: Partial<VisualDiffState>) => {
    const state = get(diffStateAtom)
    set(diffStateAtom, {
      ...state,
      visual: { ...state.visual, ...visual },
    })
  }
)

/**
 * Active tab atom (derived)
 */
export const activeTabAtom = atom(
  (get) => get(diffStateAtom).activeTab,
  (get, set, tab: 'code' | 'visual') => {
    const state = get(diffStateAtom)
    set(diffStateAtom, { ...state, activeTab: tab })
  }
)

/**
 * Loading state atom (derived)
 */
export const isLoadingAtom = atom(
  (get) => get(diffStateAtom).isLoading,
  (get, set, isLoading: boolean) => {
    const state = get(diffStateAtom)
    set(diffStateAtom, { ...state, isLoading })
  }
)

/**
 * File filter atom (derived)
 */
export const fileFilterAtom = atom(
  (get) => get(diffStateAtom).fileFilter,
  (get, set, filter: DiffFileFilter) => {
    const state = get(diffStateAtom)
    set(diffStateAtom, { ...state, fileFilter: filter })
  }
)

/**
 * File counts by status (derived)
 */
export const fileCountsByStatusAtom = atom((get) => {
  const files = get(diffStateAtom).files
  return {
    all: files.length,
    added: files.filter(f => f.status === 'added').length,
    modified: files.filter(f => f.status === 'modified').length,
    deleted: files.filter(f => f.status === 'deleted').length,
    renamed: files.filter(f => f.status === 'renamed').length,
  }
})

/**
 * Filtered files atom (derived) - filters files based on current filter
 */
export const filteredFilesAtom = atom((get) => {
  const state = get(diffStateAtom)
  const { files, fileFilter } = state

  if (fileFilter === 'all') return files
  return files.filter(f => f.status === fileFilter)
})

/**
 * Filtered tree atom (derived) - rebuilds tree with only filtered files
 */
export const filteredTreeAtom = atom((get) => {
  const filteredFiles = get(filteredFilesAtom)
  return buildFileTree(filteredFiles)
})

/**
 * Add comment action
 */
export const addCommentAtom = atom(
  null,
  (
    get,
    set,
    comment: Omit<DiffComment, 'id' | 'createdAt' | 'updatedAt'>
  ) => {
    const state = get(diffStateAtom)
    const newComment: DiffComment = {
      ...comment,
      id: `comment_${String(Date.now())}_${Math.random().toString(36).substring(2, 9)}`,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    }
    set(diffStateAtom, {
      ...state,
      comments: [...state.comments, newComment],
      activeCommentInput: null,
    })
    return newComment
  }
)

/**
 * Update comment action
 */
export const updateCommentAtom = atom(
  null,
  (get, set, { id, update }: { id: string; update: Partial<DiffComment> }) => {
    const state = get(diffStateAtom)
    const updatedComments = state.comments.map((c) =>
      c.id === id ? { ...c, ...update, updatedAt: Date.now() } : c
    )
    set(diffStateAtom, { ...state, comments: updatedComments })
  }
)

/**
 * Delete comment action
 */
export const deleteCommentAtom = atom(null, (get, set, id: string) => {
  const state = get(diffStateAtom)
  const filteredComments = state.comments.filter((c) => c.id !== id)
  set(diffStateAtom, { ...state, comments: filteredComments })
})

/**
 * Generate unique comment ID
 */
export function generateCommentId(): string {
  return `comment_${String(Date.now())}_${Math.random().toString(36).substring(2, 9)}`
}

/**
 * Build file tree from flat file list
 */
export function buildFileTree(files: DiffFile[]): DiffTreeNode[] {
  const root: Map<string, DiffTreeNode> = new Map()
  const folders: Map<string, DiffFolder> = new Map()

  for (const file of files) {
    const parts = file.path.split('/')
    let currentPath = ''

    for (let i = 0; i < parts.length - 1; i++) {
      const part = parts[i]
      if (part === undefined) continue
      const parentPath = currentPath
      currentPath = currentPath ? `${currentPath}/${part}` : part

      if (!folders.has(currentPath)) {
        const folder: DiffFolder = {
          id: `folder_${currentPath}`,
          path: currentPath,
          name: part,
          children: [],
          expanded: true,
        }
        folders.set(currentPath, folder)

        if (parentPath) {
          const parent = folders.get(parentPath)
          if (parent) {
            parent.children.push(folder)
          }
        } else {
          root.set(currentPath, folder)
        }
      }
    }

    // Add file to its parent folder or root
    const parentPath = parts.slice(0, -1).join('/')
    if (parentPath && folders.has(parentPath)) {
      const parent = folders.get(parentPath)
      if (parent) {
        parent.children.push(file)
      }
    } else {
      root.set(file.id, file)
    }
  }

  return Array.from(root.values())
}

/**
 * Flatten tree for virtual list rendering
 */
export function flattenTree(
  nodes: DiffTreeNode[],
  expandedFolders: Set<string>,
  depth = 0
): Array<{ node: DiffTreeNode; depth: number }> {
  const result: Array<{ node: DiffTreeNode; depth: number }> = []

  for (const node of nodes) {
    result.push({ node, depth })

    if (isDiffFolder(node) && expandedFolders.has(node.id)) {
      result.push(...flattenTree(node.children, expandedFolders, depth + 1))
    }
  }

  return result
}

/**
 * Get language from filename for Monaco
 */
export function getLanguageFromFilename(filename: string): string {
  const ext = filename.split('.').pop()?.toLowerCase() ?? ''
  const languageMap: Record<string, string> = {
    ts: 'typescript',
    tsx: 'typescript',
    js: 'javascript',
    jsx: 'javascript',
    json: 'json',
    md: 'markdown',
    css: 'css',
    scss: 'scss',
    html: 'html',
    xml: 'xml',
    yaml: 'yaml',
    yml: 'yaml',
    py: 'python',
    rs: 'rust',
    go: 'go',
    java: 'java',
    kt: 'kotlin',
    swift: 'swift',
    rb: 'ruby',
    php: 'php',
    sql: 'sql',
    sh: 'shell',
    bash: 'shell',
    zsh: 'shell',
  }
  return languageMap[ext] ?? 'plaintext'
}
