import { useCallback, useEffect, useRef } from 'react'
import Editor, { type Monaco } from '@monaco-editor/react'
import { type editor } from 'monaco-editor'
import { useAtom } from 'jotai'
import { atomWithStorage } from 'jotai/utils'
import { cn } from '@/lib/utils'

/**
 * Simple scratchpad content per workspace
 */
const scratchpadAtom = atomWithStorage<Record<string, string>>(
  'koda-scratchpad',
  {}
)

interface ScratchpadProps {
  workspaceId: string
  className?: string
}

/**
 * Terminal-style Scratchpad - one buffer per workspace.
 * 
 * ┌─ SCRATCH ──────────────────────────┐
 * │ > _                                │
 * │                                    │
 * │ Notes, code snippets, thoughts...  │
 * │                                    │
 * └────────────────────────────────────┘
 */
export function Scratchpad({ workspaceId, className }: ScratchpadProps) {
  const [scratchpads, setScratchpads] = useAtom(scratchpadAtom)
  const editorRef = useRef<editor.IStandaloneCodeEditor | null>(null)
  const monacoRef = useRef<Monaco | null>(null)

  // Get content for this workspace
  const content = scratchpads[workspaceId] ?? ''

  // Update content
  const updateContent = useCallback(
    (newContent: string) => {
      setScratchpads((prev) => ({
        ...prev,
        [workspaceId]: newContent,
      }))
    },
    [workspaceId, setScratchpads]
  )

  // Define KODA Obsidian theme for Monaco
  const defineKodaTheme = useCallback((monaco: Monaco) => {
    monaco.editor.defineTheme('koda-obsidian', {
      base: 'vs-dark',
      inherit: false,
      rules: [
        // Base text
        { token: '', foreground: 'a3a3a3', background: '000000' },
        
        // Comments - faint
        { token: 'comment', foreground: '525252', fontStyle: 'italic' },
        
        // Strings - terracotta accent
        { token: 'string', foreground: 'e07a5f' },
        { token: 'string.escape', foreground: 'c4634a' },
        
        // Numbers - slightly brighter
        { token: 'number', foreground: 'd4d4d4' },
        
        // Keywords - accent
        { token: 'keyword', foreground: 'e07a5f' },
        { token: 'keyword.control', foreground: 'e07a5f' },
        
        // Types - neutral bright
        { token: 'type', foreground: 'd4d4d4' },
        { token: 'type.identifier', foreground: 'd4d4d4' },
        
        // Functions - primary text
        { token: 'function', foreground: 'fafafa' },
        { token: 'function.call', foreground: 'fafafa' },
        
        // Variables
        { token: 'variable', foreground: 'a3a3a3' },
        { token: 'variable.parameter', foreground: 'a3a3a3' },
        
        // Operators
        { token: 'operator', foreground: '737373' },
        { token: 'delimiter', foreground: '525252' },
        
        // Markdown specific
        { token: 'markup.heading', foreground: 'e07a5f', fontStyle: 'bold' },
        { token: 'markup.bold', foreground: 'fafafa', fontStyle: 'bold' },
        { token: 'markup.italic', foreground: 'fafafa', fontStyle: 'italic' },
        { token: 'markup.inline.raw', foreground: 'a3a3a3', background: '141414' },
        { token: 'markup.list', foreground: '737373' },
        { token: 'markup.quote', foreground: '737373', fontStyle: 'italic' },
        { token: 'markup.link', foreground: 'e07a5f' },
        
        // Invalid
        { token: 'invalid', foreground: 'ef4444' },
      ],
      colors: {
        // Editor background - pure black
        'editor.background': '#000000',
        'editor.foreground': '#a3a3a3',
        
        // Selection - terracotta tinted
        'editor.selectionBackground': '#e07a5f33',
        'editor.selectionHighlightBackground': '#e07a5f1a',
        'editor.inactiveSelectionBackground': '#e07a5f1a',
        
        // Line highlighting
        'editor.lineHighlightBackground': '#0a0a0a',
        'editor.lineHighlightBorder': '#00000000',
        
        // Cursor
        'editorCursor.foreground': '#e07a5f',
        'editorCursor.background': '#000000',
        
        // Whitespace
        'editorWhitespace.foreground': '#262626',
        
        // Indent guides
        'editorIndentGuide.background': '#1a1a1a',
        'editorIndentGuide.activeBackground': '#333333',
        
        // Line numbers
        'editorLineNumber.foreground': '#333333',
        'editorLineNumber.activeForeground': '#525252',
        
        // Gutter
        'editorGutter.background': '#000000',
        
        // Scrollbar - subtle
        'scrollbar.shadow': '#00000000',
        'scrollbarSlider.background': '#ffffff0d',
        'scrollbarSlider.hoverBackground': '#ffffff1a',
        'scrollbarSlider.activeBackground': '#e07a5f33',
        
        // Widget (autocomplete, etc)
        'editorWidget.background': '#0a0a0a',
        'editorWidget.border': '#262626',
        'editorWidget.foreground': '#a3a3a3',
        
        // Hover widget
        'editorHoverWidget.background': '#0a0a0a',
        'editorHoverWidget.border': '#262626',
        
        // Find/replace
        'editor.findMatchBackground': '#e07a5f4d',
        'editor.findMatchHighlightBackground': '#e07a5f26',
        
        // Bracket matching
        'editorBracketMatch.background': '#e07a5f1a',
        'editorBracketMatch.border': '#e07a5f4d',
        
        // Overview ruler (right edge)
        'editorOverviewRuler.border': '#00000000',
        'editorOverviewRuler.findMatchForeground': '#e07a5f4d',
        'editorOverviewRuler.selectionHighlightForeground': '#e07a5f33',
      },
    })
  }, [])

  // Handle editor mount
  const handleEditorMount = useCallback(
    (editor: editor.IStandaloneCodeEditor, monaco: Monaco) => {
      editorRef.current = editor
      monacoRef.current = monaco

      // Define and apply KODA theme
      defineKodaTheme(monaco)
      monaco.editor.setTheme('koda-obsidian')

      // Configure markdown
      monaco.languages.setLanguageConfiguration('markdown', {
        wordPattern: /(-?\d*\.\d\w*)|([^`~!@#%^&*()=+[\]{}\\|;:'",.<>/?s-]+)/g,
      })

      // Terminal-native editor options
      editor.updateOptions({
        wordWrap: 'on',
        lineNumbers: 'off',
        minimap: { enabled: false },
        scrollBeyondLastLine: false,
        fontSize: 13,
        fontFamily: '"JetBrains Mono", "Fira Code", "SF Mono", monospace',
        fontLigatures: true,
        lineHeight: 1.6,
        letterSpacing: 0.3,
        padding: { top: 16, bottom: 16 },
        renderLineHighlight: 'none',
        overviewRulerLanes: 0,
        hideCursorInOverviewRuler: true,
        cursorStyle: 'line',
        cursorBlinking: 'smooth',
        cursorWidth: 1,
        smoothScrolling: true,
        scrollbar: {
          vertical: 'auto',
          horizontal: 'hidden',
          verticalScrollbarSize: 6,
          useShadows: false,
        },
        // Clean appearance
        folding: false,
        glyphMargin: false,
        lineDecorationsWidth: 16,
        lineNumbersMinChars: 0,
        renderWhitespace: 'none',
        guides: {
          indentation: false,
          bracketPairs: false,
        },
      })

      // Focus editor
      editor.focus()
    },
    [defineKodaTheme]
  )

  // Set placeholder on empty content
  useEffect(() => {
    if (!content && editorRef.current) {
      // Could set placeholder text here if desired
    }
  }, [content])

  return (
    <div 
      className={cn('flex flex-col h-full font-mono bg-surface-messages', className)} 
      data-testid="scratchpad-container"
    >
      {/* Minimal header */}
      <div 
        className="flex items-center px-4 py-2 border-b border-dashed border-border-subtle"
        data-testid="scratchpad-header"
      >
        <span className="text-xs text-text-faint tracking-wider">
          <span className="text-text-accent">&gt;</span> SCRATCH
        </span>
      </div>

      {/* Editor */}
      <div className="flex-1 min-h-0">
        <Editor
          height="100%"
          defaultLanguage="markdown"
          value={content}
          onChange={(value) => { updateContent(value ?? '') }}
          onMount={handleEditorMount}
          theme="koda-obsidian"
          loading={
            <div className="flex items-center justify-center h-full text-text-faint text-xs">
              <span className="animate-pulse">Loading...</span>
            </div>
          }
          options={{
            readOnly: false,
          }}
        />
      </div>
    </div>
  )
}
