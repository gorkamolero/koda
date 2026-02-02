import { useCallback, useEffect, useRef, useState } from 'react'
import Editor, { type Monaco } from '@monaco-editor/react'
import { type editor } from 'monaco-editor'
import { useAtom } from 'jotai'
import { atomWithStorage } from 'jotai/utils'
import { cn } from '@/lib/utils'
import { ChevronDown, ChevronRight, Trash2 } from 'lucide-react'
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
 * Terminal-style Scratchpad with markdown editor.
 * ┌─ SCRATCHPAD ─────────────────────┐
 * │ [NOTES] [HISTORY]          [+]  │
 * ├──────────────────────────────────┤
 * │ ▼ Notes (3)                      │
 * │   Note 1 ◀                       │
 * │   Note 2                         │
 * ├──────────────────────────────────┤
 * │ # My Note                        │
 * │ Content here...                  │
 * └──────────────────────────────────┘
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
        wordPattern: /(-?\d*\.\d\w*)|([^`~!@#%^&*()=+[\]{}\\|;:'",.<>/?s-]+)/g,
      })

      // Set editor options - terminal aesthetic
      editor.updateOptions({
        wordWrap: 'on',
        lineNumbers: 'off',
        minimap: { enabled: false },
        scrollBeyondLastLine: false,
        fontSize: 12,
        fontFamily: '"JetBrains Mono", "Fira Code", monospace',
        lineHeight: 1.5,
        padding: { top: 12, bottom: 12 },
        renderLineHighlight: 'none',
        overviewRulerLanes: 0,
        hideCursorInOverviewRuler: true,
        scrollbar: {
          vertical: 'auto',
          horizontal: 'hidden',
          verticalScrollbarSize: 6,
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
    <div className={cn('flex flex-col h-full font-mono bg-[#000000]', className)} data-testid="scratchpad-container">
      {/* Header with tabs */}
      <div className="flex items-center justify-between px-3 py-2 border-b border-dashed border-border-subtle" data-testid="scratchpad-header">
        <div className="flex items-center gap-1 text-xs">
          <span className="text-text-faint mr-1">┌─</span>
          
          {/* Notes tab */}
          <button
            onClick={() => { setActiveTab('notes') }}
            data-testid="scratchpad-tab-notes"
            data-active={activeTab === 'notes'}
            className={cn(
              'px-2 py-1 transition-colors',
              activeTab === 'notes'
                ? 'text-text-accent bg-surface-active'
                : 'text-text-muted hover:text-text-primary hover:bg-surface-hover'
            )}
          >
            [NOTES]
          </button>

          {/* History tab */}
          <button
            onClick={() => { setActiveTab('history') }}
            data-testid="scratchpad-tab-history"
            data-active={activeTab === 'history'}
            className={cn(
              'px-2 py-1 transition-colors',
              activeTab === 'history'
                ? 'text-text-accent bg-surface-active'
                : 'text-text-muted hover:text-text-primary hover:bg-surface-hover'
            )}
          >
            [HISTORY]
          </button>
        </div>

        {activeTab === 'notes' && (
          <button
            onClick={createNote}
            data-testid="scratchpad-new-note"
            className="px-2 py-1 text-xs text-text-muted hover:text-text-accent transition-colors"
            title="New note"
          >
            [+]
          </button>
        )}
      </div>

      {/* Notes tab content */}
      {activeTab === 'notes' && (
        <>
          {/* Notes list (collapsible) */}
          <div className="border-b border-dashed border-border-subtle">
            <button
              onClick={() => { setIsNotesExpanded(!isNotesExpanded) }}
              className="w-full flex items-center gap-2 px-3 py-2 text-xs text-text-muted hover:text-text-primary transition-colors"
            >
              <span className="text-text-faint">│</span>
              {isNotesExpanded ? (
                <ChevronDown className="size-3" />
              ) : (
                <ChevronRight className="size-3" />
              )}
              <span>Notes ({notes.length})</span>
            </button>

            {isNotesExpanded && (
              <div className="px-3 pb-2 space-y-0.5 max-h-32 overflow-y-auto">
                {notes.map((note) => (
                  <div
                    key={note.id}
                    className={cn(
                      'group flex items-center justify-between px-2 py-1 text-xs cursor-pointer transition-colors',
                      note.id === activeNoteId
                        ? 'text-text-accent bg-surface-active'
                        : 'text-text-muted hover:bg-surface-hover hover:text-text-primary'
                    )}
                    onClick={() => { selectNote(note.id) }}
                  >
                    <span className="truncate flex-1">
                      {note.id === activeNoteId && <span className="mr-1">▶</span>}
                      {note.title}
                    </span>
                    {notes.length > 1 && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation()
                          deleteNote(note.id)
                        }}
                        className="p-0.5 opacity-0 group-hover:opacity-100 text-text-faint hover:text-status-error transition-opacity"
                      >
                        <Trash2 className="size-3" />
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
                onChange={(value) => { updateNoteContent(value ?? '') }}
                onMount={handleEditorMount}
                theme="vs-dark"
                options={{
                  readOnly: false,
                }}
              />
            ) : (
              <div className="flex flex-col items-center justify-center h-full text-text-faint text-xs">
                <div>┌────────────────────┐</div>
                <div>│   NO NOTES YET     │</div>
                <div>│   Click [+] to     │</div>
                <div>│   create one       │</div>
                <div>└────────────────────┘</div>
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
