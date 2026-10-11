import { useCallback, useRef, useEffect, useState } from 'react'
import { useAtomValue, useSetAtom } from 'jotai'
import { DiffEditor as MonacoDiffEditor, type Monaco } from '@monaco-editor/react'
import type { editor } from 'monaco-editor'
import {
  selectedFileAtom,
  diffModeAtom,
  activeCommentInputAtom,
  currentFileCommentsAtom,
  getLanguageFromFilename,
  type DiffComment,
} from '@/store/diff'

interface DiffEditorProps {
  /** Callback when line is clicked for comment */
  onLineClick?: (lineNumber: number, side: 'original' | 'modified') => void
}

/**
 * Monaco diff editor component
 */
export function DiffEditor({ onLineClick }: DiffEditorProps) {
  const selectedFile = useAtomValue(selectedFileAtom)
  const diffMode = useAtomValue(diffModeAtom)
  const comments = useAtomValue(currentFileCommentsAtom)
  const setActiveCommentInput = useSetAtom(activeCommentInputAtom)

  const editorRef = useRef<editor.IStandaloneDiffEditor | null>(null)
  const monacoRef = useRef<Monaco | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  // Handle editor mount
  const handleEditorDidMount = useCallback(
    (editor: editor.IStandaloneDiffEditor, monaco: Monaco) => {
      editorRef.current = editor
      monacoRef.current = monaco
      setIsLoading(false)

      // Add line number click handlers
      const originalEditor = editor.getOriginalEditor()
      const modifiedEditor = editor.getModifiedEditor()

      // Handle click on original editor line numbers
      originalEditor.onMouseDown((e) => {
        if (e.target.type === monaco.editor.MouseTargetType.GUTTER_LINE_NUMBERS) {
          const lineNumber = e.target.position?.lineNumber
          if (lineNumber && selectedFile) {
            setActiveCommentInput({
              fileId: selectedFile.id,
              lineNumber,
              side: 'original',
            })
            onLineClick?.(lineNumber, 'original')
          }
        }
      })

      // Handle click on modified editor line numbers
      modifiedEditor.onMouseDown((e) => {
        if (e.target.type === monaco.editor.MouseTargetType.GUTTER_LINE_NUMBERS) {
          const lineNumber = e.target.position?.lineNumber
          if (lineNumber && selectedFile) {
            setActiveCommentInput({
              fileId: selectedFile.id,
              lineNumber,
              side: 'modified',
            })
            onLineClick?.(lineNumber, 'modified')
          }
        }
      })
    },
    [selectedFile, setActiveCommentInput, onLineClick]
  )

  // Add comment decorations
  useEffect(() => {
    if (!editorRef.current || !monacoRef.current || !comments.length) return

    const monaco = monacoRef.current
    const editor = editorRef.current

    const originalDecorations: editor.IModelDeltaDecoration[] = []
    const modifiedDecorations: editor.IModelDeltaDecoration[] = []

    for (const comment of comments) {
      const decoration: editor.IModelDeltaDecoration = {
        range: new monaco.Range(comment.lineNumber, 1, comment.lineNumber, 1),
        options: {
          isWholeLine: true,
          linesDecorationsClassName: 'diff-comment-marker',
          glyphMarginClassName: 'diff-comment-glyph',
          glyphMarginHoverMessage: { value: comment.content },
        },
      }

      if (comment.side === 'original') {
        originalDecorations.push(decoration)
      } else {
        modifiedDecorations.push(decoration)
      }
    }

    // Apply decorations
    const originalEditor = editor.getOriginalEditor()
    const modifiedEditor = editor.getModifiedEditor()

    originalEditor.createDecorationsCollection(originalDecorations)
    modifiedEditor.createDecorationsCollection(modifiedDecorations)
  }, [comments])

  if (!selectedFile) {
    return (
      <div
        className="h-full flex items-center justify-center"
        data-testid="diff-monaco-container"
      >
        <div className="text-center text-muted-foreground">
          <svg
            className="w-16 h-16 mx-auto mb-4 opacity-50"
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
          <p className="text-sm">Select a file to view diff</p>
        </div>
      </div>
    )
  }

  const language = selectedFile.language ?? getLanguageFromFilename(selectedFile.filename)

  return (
    <div className="h-full relative" data-testid="diff-monaco-container">
      {isLoading && (
        <div className="absolute inset-0 flex items-center justify-center bg-background/50 z-10">
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

      <MonacoDiffEditor
        original={selectedFile.originalContent ?? ''}
        modified={selectedFile.modifiedContent ?? ''}
        language={language}
        theme="vs-dark"
        onMount={handleEditorDidMount}
        options={{
          readOnly: true,
          renderSideBySide: diffMode === 'split',
          enableSplitViewResizing: true,
          renderIndicators: true,
          renderMarginRevertIcon: false,
          glyphMargin: true,
          lineNumbersMinChars: 3,
          scrollBeyondLastLine: false,
          minimap: { enabled: false },
          fontSize: 13,
          lineHeight: 20,
          automaticLayout: true,
          diffWordWrap: 'on',
          originalEditable: false,
          renderOverviewRuler: true,
        }}
      />

      {/* Comment markers overlay */}
      <CommentMarkers comments={comments} />
    </div>
  )
}

interface CommentMarkersProps {
  comments: DiffComment[]
}

/**
 * Overlay for comment markers on diff lines
 */
function CommentMarkers({ comments }: CommentMarkersProps) {
  if (comments.length === 0) return null

  return (
    <>
      {comments.map((comment) => (
        <div
          key={comment.id}
          className="absolute left-0 w-4 h-4 bg-primary rounded-full flex items-center justify-center cursor-pointer hover:scale-110 transition-transform"
          style={{
            // This is a simplified positioning - in production we'd calculate from line height
            top: `${String((comment.lineNumber - 1) * 20 + 28)}px`,
            left: comment.side === 'original' ? 'var(--space-1)' : '50%',
          }}
          data-testid="diff-comment-marker"
          data-line={comment.lineNumber}
          data-side={comment.side}
        >
          <svg
            className="w-3 h-3 text-primary-foreground"
            fill="currentColor"
            viewBox="0 0 20 20"
          >
            <path
              fillRule="evenodd"
              d="M18 10c0 3.866-3.582 7-8 7a8.841 8.841 0 01-4.083-.98L2 17l1.338-3.123C2.493 12.767 2 11.434 2 10c0-3.866 3.582-7 8-7s8 3.134 8 7zM7 9H5v2h2V9zm8 0h-2v2h2V9zM9 9h2v2H9V9z"
              clipRule="evenodd"
            />
          </svg>
        </div>
      ))}
    </>
  )
}
