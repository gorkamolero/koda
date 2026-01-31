import { useCallback, useEffect, useRef, useState } from 'react'
import Editor, { type Monaco } from '@monaco-editor/react'
import { type editor } from 'monaco-editor'
import { useAtom } from 'jotai'
import { atomWithStorage } from 'jotai/utils'
import { cn } from '@/lib/utils'
import { FileText, ChevronDown, ChevronRight, Plus, Trash2, Clock } from 'lucide-react'
import { ConversationHistory } from '@/components/ConversationHistory'

type ScratchpadTab = 'notes' | 'history'

/**
 * Scratchpad note interface
 */
interface ScratchpadNote {
  id: string
  title: string
  content: string
  createdAt: number
  updatedAt: number
}

/**
 * Scratchpad state per workspace
 */
interface WorkspaceScratchpad {
  notes: ScratchpadNote[]
  activeNoteId: string | null
}

/**
 * Global scratchpad state - persisted to localStorage
 */
const scratchpadAtom = atomWithStorage<Record<string, WorkspaceScratchpad>>(
  'koda-scratchpads',
  {}
)

interface ScratchpadProps {
  workspaceId: string
  className?: string
}

/**
 * Conductor-style Scratchpad with markdown editor.
 * Supports multiple notes per workspace with persistence.
 */
export function Scratchpad({ workspaceId, className }: ScratchpadProps) {
  const [scratchpads, setScratchpads] = useAtom(scratchpadAtom)
  const editorRef = useRef<editor.IStandaloneCodeEditor | null>(null)
  const [isNotesExpanded, setIsNotesExpanded] = useState(true)
  const [activeTab, setActiveTab] = useState<ScratchpadTab>('notes')

  // Get or initialize workspace scratchpad
  const workspaceScratchpad = scratchpads[workspaceId] ?? {
    notes: [],
    activeNoteId: null,
  }

  const { notes, activeNoteId } = workspaceScratchpad
  const activeNote = notes.find((n) => n.id === activeNoteId)

  // Update workspace scratchpad
  const updateScratchpad = useCallback(
    (update: Partial<WorkspaceScratchpad>) => {
      setScratchpads((prev) => ({
        ...prev,
        [workspaceId]: {
          ...prev[workspaceId],
          notes: prev[workspaceId]?.notes ?? [],
          activeNoteId: prev[workspaceId]?.activeNoteId ?? null,
          ...update,
        },
      }))
    },
    [workspaceId, setScratchpads]
  )

  // Create new note
  const createNote = useCallback(() => {
    const newNote: ScratchpadNote = {
      id: `note-${Date.now()}-${Math.random().toString(36).slice(2)}`,
      title: `Note ${notes.length + 1}`,
      content: '# New Note\n\nStart writing here...',
      createdAt: Date.now(),
      updatedAt: Date.now(),
    }
    updateScratchpad({
      notes: [...notes, newNote],
      activeNoteId: newNote.id,
    })
  }, [notes, updateScratchpad])

  // Delete note
  const deleteNote = useCallback(
    (noteId: string) => {
      const newNotes = notes.filter((n) => n.id !== noteId)
      const newActiveId =
        activeNoteId === noteId
          ? newNotes[0]?.id ?? null
          : activeNoteId
      updateScratchpad({
        notes: newNotes,
        activeNoteId: newActiveId,
      })
    },
    [notes, activeNoteId, updateScratchpad]
  )

  // Update note content
  const updateNoteContent = useCallback(
    (content: string) => {
      if (!activeNoteId) return
      const newNotes = notes.map((n) =>
        n.id === activeNoteId
          ? { ...n, content, updatedAt: Date.now() }
          : n
      )
      updateScratchpad({ notes: newNotes })
    },
    [activeNoteId, notes, updateScratchpad]
  )

  // Select note
  const selectNote = useCallback(
    (noteId: string) => {
      updateScratchpad({ activeNoteId: noteId })
    },
    [updateScratchpad]
  )

  // Handle editor mount
  const handleEditorMount = useCallback(
    (editor: editor.IStandaloneCodeEditor, monaco: Monaco) => {
      editorRef.current = editor

      // Configure markdown settings
      monaco.languages.setLanguageConfiguration('markdown', {
        wordPattern: /(-?\d*\.\d\w*)|([^\`\~\!\@\#\%\^\&\*\(\)\-\=\+\[\{\]\}\\\|\;\:\'\"\,\.\<\>\/\?\s]+)/g,
      })

      // Set editor options
      editor.updateOptions({
        wordWrap: 'on',
        lineNumbers: 'off',
        minimap: { enabled: false },
        scrollBeyondLastLine: false,
        fontSize: 13,
        lineHeight: 1.6,
        padding: { top: 12, bottom: 12 },
        renderLineHighlight: 'none',
        overviewRulerLanes: 0,
        hideCursorInOverviewRuler: true,
        scrollbar: {
          vertical: 'auto',
          horizontal: 'hidden',
          verticalScrollbarSize: 8,
        },
      })
    },
    []
  )

  // Create initial note if none exist
  useEffect(() => {
    if (notes.length === 0) {
      createNote()
    }
  }, [notes.length, createNote])

  return (
    <div className={cn('flex flex-col h-full bg-surface-sidebar', className)} data-testid="scratchpad-container">
      {/* Header with tabs */}
      <div className="flex items-center justify-between px-3 py-2 border-b border-border-subtle" data-testid="scratchpad-header">
        <div className="flex items-center gap-1">
          {/* Notes tab */}
          <button
            onClick={() => setActiveTab('notes')}
            data-testid="scratchpad-tab-notes"
            data-active={activeTab === 'notes'}
            className={cn(
              'flex items-center gap-1.5 px-2 py-1 text-xs rounded transition-colors',
              activeTab === 'notes'
                ? 'bg-surface-active text-text-strong'
                : 'text-text-muted hover:text-text-primary hover:bg-surface-hover'
            )}
          >
            <FileText className="w-3.5 h-3.5" />
            <span>Notes</span>
          </button>

          {/* History tab */}
          <button
            onClick={() => setActiveTab('history')}
            data-testid="scratchpad-tab-history"
            data-active={activeTab === 'history'}
            className={cn(
              'flex items-center gap-1.5 px-2 py-1 text-xs rounded transition-colors',
              activeTab === 'history'
                ? 'bg-surface-active text-text-strong'
                : 'text-text-muted hover:text-text-primary hover:bg-surface-hover'
            )}
          >
            <Clock className="w-3.5 h-3.5" />
            <span>History</span>
          </button>
        </div>

        {activeTab === 'notes' && (
          <button
            onClick={createNote}
            data-testid="scratchpad-new-note"
            className="p-1 rounded hover:bg-surface-hover text-text-muted hover:text-text-primary transition-colors"
            title="New note"
          >
            <Plus className="w-4 h-4" />
          </button>
        )}
      </div>

      {/* Notes tab content */}
      {activeTab === 'notes' && (
        <>
          {/* Notes list (collapsible) */}
          <div className="border-b border-border-subtle">
            <button
              onClick={() => setIsNotesExpanded(!isNotesExpanded)}
              className="w-full flex items-center gap-2 px-3 py-2 text-xs text-text-muted hover:text-text-primary transition-colors"
            >
              {isNotesExpanded ? (
                <ChevronDown className="w-3 h-3" />
              ) : (
                <ChevronRight className="w-3 h-3" />
              )}
              <span>Notes ({notes.length})</span>
            </button>

            {isNotesExpanded && (
              <div className="px-2 pb-2 space-y-0.5 max-h-32 overflow-y-auto">
                {notes.map((note) => (
                  <div
                    key={note.id}
                    className={cn(
                      'flex items-center justify-between px-2 py-1.5 rounded text-xs group cursor-pointer',
                      note.id === activeNoteId
                        ? 'bg-surface-active text-text-strong'
                        : 'text-text-muted hover:bg-surface-hover hover:text-text-primary'
                    )}
                    onClick={() => selectNote(note.id)}
                  >
                    <span className="truncate flex-1">{note.title}</span>
                    {notes.length > 1 && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation()
                          deleteNote(note.id)
                        }}
                        className="p-0.5 opacity-0 group-hover:opacity-100 text-text-faint hover:text-status-error transition-opacity"
                      >
                        <Trash2 className="w-3 h-3" />
                      </button>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Editor */}
          <div className="flex-1 min-h-0">
            {activeNote ? (
              <Editor
                height="100%"
                defaultLanguage="markdown"
                value={activeNote.content}
                onChange={(value) => updateNoteContent(value ?? '')}
                onMount={handleEditorMount}
                theme="vs-dark"
                options={{
                  readOnly: false,
                }}
              />
            ) : (
              <div className="flex items-center justify-center h-full text-text-faint text-sm">
                No notes yet
              </div>
            )}
          </div>
        </>
      )}

      {/* History tab content */}
      {activeTab === 'history' && (
        <ConversationHistory className="flex-1" />
      )}
    </div>
  )
}
