import { useEffect, useCallback, useMemo } from 'react'
import { useSetAtom, useAtomValue } from 'jotai'
import {
  diffFilesAtom,
  diffModeAtom,
  selectedFileIdAtom,
  activeTabAtom,
  activeCommentInputAtom,
  isLoadingAtom,
  type DiffFile,
} from '@/store/diff'
import { useCheckpoints, useCheckpointDiff, useWorkspace } from '@/hooks/useRpc'
import { parseUnifiedDiff, getExtension, extensionToLanguage } from '@/lib/diffParser'
import { FileTree } from './FileTree'
import { DiffEditor } from './DiffEditor'
import { InlineComments } from './InlineComments'
import { VisualComparison } from './VisualComparison'

interface DiffViewProps {
  /** Workspace ID for loading diff data */
  workspaceId: string
}

/**
 * Main diff view component
 * Displays file tree, Monaco diff editor, and visual comparison
 */
export function DiffView({ workspaceId }: DiffViewProps) {
  const setFiles = useSetAtom(diffFilesAtom)
  const selectedFileId = useAtomValue(selectedFileIdAtom)
  const setSelectedFileId = useSetAtom(selectedFileIdAtom)
  const diffMode = useAtomValue(diffModeAtom)
  const setDiffMode = useSetAtom(diffModeAtom)
  const activeTab = useAtomValue(activeTabAtom)
  const setActiveTab = useSetAtom(activeTabAtom)
  const setActiveCommentInput = useSetAtom(activeCommentInputAtom)
  const setIsLoading = useSetAtom(isLoadingAtom)
  const isLoading = useAtomValue(isLoadingAtom)

  // Fetch workspace data
  const { data: workspace } = useWorkspace(workspaceId)

  // Fetch checkpoints for this workspace
  const { data: checkpoints, isLoading: loadingCheckpoints } = useCheckpoints(workspaceId)

  // Get the two most recent checkpoints for diffing
  const [checkpoint1Id, checkpoint2Id] = useMemo(() => {
    if (!checkpoints || checkpoints.length < 2) return [null, null]
    // Sort by creation time descending
    const sorted = [...checkpoints].sort(
      (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    )
    // Compare second most recent to most recent (to show what changed)
    return [sorted[1]?.id ?? null, sorted[0]?.id ?? null]
  }, [checkpoints])

  // Get the worktree path from workspace
  const repoPath = workspace?.directoryName
    ? `/Users/gorkolas/.koda/worktrees/${workspace.directoryName}`
    : ''

  // Fetch the diff between checkpoints
  const {
    data: diffData,
    isLoading: loadingDiff,
    error: diffError,
  } = useCheckpointDiff(
    checkpoint1Id ?? '',
    checkpoint2Id ?? '',
    repoPath
  )

  // Convert checkpoint diff to DiffFile format
  useEffect(() => {
    if (loadingCheckpoints || loadingDiff) {
      setIsLoading(true)
      return
    }

    setIsLoading(false)

    if (!diffData || !diffData.files.length) {
      setFiles([])
      return
    }

    // Convert FileDiff[] to DiffFile[]
    const diffFiles: DiffFile[] = diffData.files.map((file, index) => {
      const { originalContent, modifiedContent } = parseUnifiedDiff(file.diff)
      const ext = getExtension(file.path)
      const filename = file.path.split('/').pop() ?? file.path

      return {
        id: `file_${String(index)}`,
        path: file.path,
        filename,
        status: file.status,
        additions: file.additions ?? 0,
        deletions: file.deletions ?? 0,
        originalContent,
        modifiedContent,
        language: extensionToLanguage(ext),
      }
    })

    setFiles(diffFiles)

    // Auto-select first file if none selected
    if (!selectedFileId && diffFiles.length > 0 && diffFiles[0]) {
      setSelectedFileId(diffFiles[0].id)
    }
  }, [
    diffData,
    loadingCheckpoints,
    loadingDiff,
    setFiles,
    setIsLoading,
    selectedFileId,
    setSelectedFileId,
  ])

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Don't handle shortcuts when typing in input
      if (
        e.target instanceof HTMLInputElement ||
        e.target instanceof HTMLTextAreaElement
      ) {
        return
      }

      switch (e.key) {
        case 'c': {
          // Open comment input if a file is selected
          if (selectedFileId) {
            setActiveCommentInput({
              fileId: selectedFileId,
              lineNumber: 1,
              side: 'modified',
            })
          }
          break
        }
        case 's': {
          // Toggle split/unified mode
          e.preventDefault()
          setDiffMode(diffMode === 'split' ? 'unified' : 'split')
          break
        }
        case 'v': {
          // Toggle visual comparison
          e.preventDefault()
          setActiveTab(activeTab === 'code' ? 'visual' : 'code')
          break
        }
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => {
      window.removeEventListener('keydown', handleKeyDown)
    }
  }, [
    selectedFileId,
    diffMode,
    activeTab,
    setActiveCommentInput,
    setDiffMode,
    setActiveTab,
  ])

  const handleLineClick = useCallback(
    (lineNumber: number, side: 'original' | 'modified') => {
      if (selectedFileId) {
        setActiveCommentInput({
          fileId: selectedFileId,
          lineNumber,
          side,
        })
      }
    },
    [selectedFileId, setActiveCommentInput]
  )

  // Show empty state when no checkpoints
  const hasNoCheckpoints = !loadingCheckpoints && (!checkpoints || checkpoints.length < 2)

  return (
    <div className="h-full flex" data-testid="diff-view-container">
      {/* File tree sidebar */}
      <div className="w-72 border-r border-border flex-shrink-0">
        <FileTree />
      </div>

      {/* Main content area */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Toolbar */}
        <div className="flex items-center justify-between px-4 py-2 border-b border-border bg-secondary/30">
          {/* Tabs */}
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={() => {
                setActiveTab('code')
              }}
              className={`
                px-3 py-1.5 text-sm rounded-md transition-colors
                ${activeTab === 'code' ? 'bg-background text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'}
              `}
            >
              Code
            </button>
            <button
              type="button"
              onClick={() => {
                setActiveTab('visual')
              }}
              className={`
                px-3 py-1.5 text-sm rounded-md transition-colors
                ${activeTab === 'visual' ? 'bg-background text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'}
              `}
              data-testid="diff-visual-tab"
            >
              Visual
            </button>
          </div>

          {/* Mode toggle (only for code tab) */}
          {activeTab === 'code' && (
            <div
              className="flex items-center gap-1 bg-secondary rounded-md p-0.5"
              data-testid="diff-mode-toggle"
            >
              <button
                type="button"
                onClick={() => {
                  setDiffMode('split')
                }}
                className={`
                  px-3 py-1 text-xs font-medium rounded transition-colors
                  ${diffMode === 'split' ? 'bg-background text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'}
                `}
                data-testid="diff-mode-split"
                data-active={diffMode === 'split'}
              >
                Split
              </button>
              <button
                type="button"
                onClick={() => {
                  setDiffMode('unified')
                }}
                className={`
                  px-3 py-1 text-xs font-medium rounded transition-colors
                  ${diffMode === 'unified' ? 'bg-background text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'}
                `}
                data-testid="diff-mode-unified"
                data-active={diffMode === 'unified'}
              >
                Unified
              </button>
            </div>
          )}
        </div>

        {/* Content area */}
        <div className="flex-1 relative overflow-hidden">
          {/* Loading state */}
          {isLoading && (
            <div className="h-full flex items-center justify-center">
              <div className="flex items-center gap-2 text-muted-foreground">
                <svg
                  className="w-5 h-5 animate-spin"
                  fill="none"
                  viewBox="0 0 24 24"
                >
                  <circle
                    className="opacity-25"
                    cx="12"
                    cy="12"
                    r="10"
                    stroke="currentColor"
                    strokeWidth="4"
                  />
                  <path
                    className="opacity-75"
                    fill="currentColor"
                    d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                  />
                </svg>
                <span className="text-sm">Loading diff...</span>
              </div>
            </div>
          )}

          {/* Error state */}
          {diffError && !isLoading && (
            <div className="h-full flex items-center justify-center">
              <div className="text-center text-muted-foreground">
                <svg
                  className="w-12 h-12 mx-auto mb-4 text-destructive/50"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={1.5}
                    d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
                  />
                </svg>
                <p className="text-sm">Failed to load diff</p>
                <p className="text-xs mt-1 text-destructive">
                  {diffError instanceof Error ? diffError.message : 'Unknown error'}
                </p>
              </div>
            </div>
          )}

          {/* No checkpoints state */}
          {hasNoCheckpoints && !isLoading && !diffError && (
            <div className="h-full flex items-center justify-center">
              <div className="text-center text-muted-foreground">
                <svg
                  className="w-16 h-16 mx-auto mb-4 opacity-30"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={1.5}
                    d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                  />
                </svg>
                <p className="text-sm">No changes to show yet</p>
                <p className="text-xs mt-1">
                  Agent changes will appear here after the first turn
                </p>
              </div>
            </div>
          )}

          {/* Main content */}
          {!isLoading && !diffError && !hasNoCheckpoints && (
            <>
              {activeTab === 'code' ? (
                <>
                  <DiffEditor onLineClick={handleLineClick} />
                  <InlineComments />
                </>
              ) : (
                <VisualComparison />
              )}
            </>
          )}
        </div>
      </div>
    </div>
  )
}
