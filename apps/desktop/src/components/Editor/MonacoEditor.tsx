import { useCallback, useRef, useEffect } from 'react'
import Editor, { type OnMount, type OnChange } from '@monaco-editor/react'
import { useAtomValue, useSetAtom } from 'jotai'
import {
  openFilesAtom,
  activeFilePathAtom,
  updateFileContentAtom,
  markFileDirtyAtom,
} from '@/store/fileExplorer'
import { useFileSystem } from '@/hooks/useFileSystem'
import type { editor } from 'monaco-editor'

/**
 * Monaco editor component for file editing
 */
export function MonacoEditor() {
  const openFiles = useAtomValue(openFilesAtom)
  const activeFilePath = useAtomValue(activeFilePathAtom)
  const updateFileContent = useSetAtom(updateFileContentAtom)
  const markFileDirty = useSetAtom(markFileDirtyAtom)
  const { writeFile } = useFileSystem()

  const editorRef = useRef<editor.IStandaloneCodeEditor | null>(null)
  const activeFilePathRef = useRef(activeFilePath)

  // Keep ref in sync
  useEffect(() => {
    activeFilePathRef.current = activeFilePath
  }, [activeFilePath])

  // Find active file
  const activeFile = openFiles.find((f) => f.path === activeFilePath)

  // Handle save
  const handleSave = useCallback(
    async (path: string, content: string) => {
      try {
        await writeFile(path, content)
        markFileDirty({ path, isDirty: false })
      } catch (err) {
        console.error('Failed to save file:', err)
      }
    },
    [writeFile, markFileDirty]
  )

  // Handle editor mount
  const handleMount: OnMount = useCallback(
    (editorInstance, monaco) => {
      editorRef.current = editorInstance

      // Add keyboard shortcut for save (Cmd+S / Ctrl+S)
      editorInstance.addCommand(
        monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyS,
        () => {
          const path = activeFilePathRef.current
          const content = editorInstance.getValue()
          if (path && content) {
            void handleSave(path, content)
          }
        }
      )
    },
    [handleSave]
  )

  // Handle content change
  const handleChange: OnChange = useCallback(
    (value) => {
      if (activeFilePath && value !== undefined) {
        updateFileContent({ path: activeFilePath, content: value })
      }
    },
    [activeFilePath, updateFileContent]
  )

  // Global save keyboard shortcut (backup for when editor not focused)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 's') {
        e.preventDefault()
        if (activeFile && activeFile.isDirty) {
          void handleSave(activeFile.path, activeFile.content)
        }
      }
    }

    document.addEventListener('keydown', handleKeyDown)
    return () => {
      document.removeEventListener('keydown', handleKeyDown)
    }
  }, [activeFile, handleSave])

  // Empty state
  if (!activeFile) {
    return (
      <div
        data-testid="monaco-editor-empty"
        className="h-full flex items-center justify-center bg-secondary/10"
      >
        <div className="text-center text-muted-foreground">
          <svg
            className="w-16 h-16 mx-auto mb-4 opacity-30"
            viewBox="0 0 24 24"
            fill="currentColor"
          >
            <path d="M14 2H6c-1.1 0-2 .9-2 2v16c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V8l-6-6zm-1 7V3.5L18.5 9H13z" />
          </svg>
          <p className="text-sm">Select a file to edit</p>
          <p className="text-xs mt-1">
            Use <kbd className="px-1.5 py-0.5 bg-muted rounded">Cmd+P</kbd> for
            quick open
          </p>
        </div>
      </div>
    )
  }

  return (
    <div data-testid="monaco-editor" className="h-full w-full">
      <Editor
        height="100%"
        language={activeFile.language}
        value={activeFile.content}
        theme="vs-dark"
        onMount={handleMount}
        onChange={handleChange}
        options={{
          minimap: { enabled: false },
          fontSize: 13,
          lineNumbers: 'on',
          scrollBeyondLastLine: false,
          automaticLayout: true,
          tabSize: 2,
          wordWrap: 'on',
          formatOnPaste: true,
          formatOnType: true,
        }}
      />
    </div>
  )
}
