import { useEffect, useCallback, useMemo } from 'react'
import { useSetAtom, useAtomValue } from 'jotai'
import { cn } from '@/lib/utils'
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
import { Loader2, AlertCircle, FileText } from 'lucide-react'

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
    <div className="h-full flex bg-surface-messages" data-testid="diff-view-container">
      {/* File tree sidebar */}
      <div className="w-72 border-r border-border-subtle flex-shrink-0">
        <FileTree />
      </div>

      {/* Main content area */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Toolbar */}
        <div className="flex items-center justify-between px-4 py-2 border-b border-border-subtle bg-surface-topbar">
          {/* Tabs */}
          <div className="flex items-center gap-1 bg-surface-control rounded-lg p-0.5">
            <button
              type="button"
              onClick={() => {
                setActiveTab('code')
              }}
              className={cn(
                'px-3 py-1.5 text-sm rounded-md transition-colors',
                activeTab === 'code'
                  ? 'bg-surface-active text-text-strong'
                  : 'text-text-muted hover:text-text-primary'
              )}
            >
              Code
            </button>
            <button
              type="button"
              onClick={() => {
                setActiveTab('visual')
              }}
              className={cn(
                'px-3 py-1.5 text-sm rounded-md transition-colors',
                activeTab === 'visual'
                  ? 'bg-surface-active text-text-strong'
                  : 'text-text-muted hover:text-text-primary'
              )}
              data-testid="diff-visual-tab"
            >
              Visual
            </button>
          </div>

          {/* Mode toggle (only for code tab) */}
          {activeTab === 'code' && (
            <div
              className="flex items-center gap-1 bg-surface-control rounded-lg p-0.5"
              data-testid="diff-mode-toggle"
            >
              <button
                type="button"
                onClick={() => {
                  setDiffMode('split')
                }}
                className={cn(
                  'px-3 py-1 text-xs font-medium rounded transition-colors',
                  diffMode === 'split'
                    ? 'bg-surface-active text-text-strong'
                    : 'text-text-muted hover:text-text-primary'
                )}
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
                className={cn(
                  'px-3 py-1 text-xs font-medium rounded transition-colors',
                  diffMode === 'unified'
                    ? 'bg-surface-active text-text-strong'
                    : 'text-text-muted hover:text-text-primary'
                )}
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
              <div className="flex items-center gap-2 text-text-muted">
                <Loader2 className="w-5 h-5 animate-spin" />
                <span className="text-sm">Loading diff...</span>
              </div>
            </div>
          )}

          {/* Error state */}
          {diffError && !isLoading && (
            <div className="h-full flex items-center justify-center">
              <div className="text-center">
                <AlertCircle className="w-12 h-12 mx-auto mb-4 text-status-error/50" />
                <p className="text-sm text-text-muted">Failed to load diff</p>
                <p className="text-xs mt-1 text-status-error">
                  {diffError instanceof Error ? diffError.message : 'Unknown error'}
                </p>
              </div>
            </div>
          )}

          {/* No checkpoints state */}
          {hasNoCheckpoints && !isLoading && !diffError && (
            <div className="h-full flex items-center justify-center">
              <div className="text-center">
                <FileText className="w-16 h-16 mx-auto mb-4 text-text-dim" />
                <p className="text-sm text-text-muted">No changes to show yet</p>
                <p className="text-xs mt-1 text-text-faint">
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
