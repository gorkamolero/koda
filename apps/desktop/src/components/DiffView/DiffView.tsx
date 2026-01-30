import { useEffect, useCallback } from 'react'
import { useSetAtom, useAtomValue } from 'jotai'
import {
  diffFilesAtom,
  diffModeAtom,
  selectedFileIdAtom,
  activeTabAtom,
  activeCommentInputAtom,
  type DiffFile,
} from '@/store/diff'
import { FileTree } from './FileTree'
import { DiffEditor } from './DiffEditor'
import { InlineComments } from './InlineComments'
import { VisualComparison } from './VisualComparison'

interface DiffViewProps {
  /** Workspace ID for loading diff data */
  workspaceId: string
  /** Optional mock mode for testing */
  mockMode?: boolean
}

/**
 * Main diff view component
 * Displays file tree, Monaco diff editor, and visual comparison
 */
export function DiffView({ workspaceId, mockMode = false }: DiffViewProps) {
  const setFiles = useSetAtom(diffFilesAtom)
  const selectedFileId = useAtomValue(selectedFileIdAtom)
  const setSelectedFileId = useSetAtom(selectedFileIdAtom)
  const diffMode = useAtomValue(diffModeAtom)
  const setDiffMode = useSetAtom(diffModeAtom)
  const activeTab = useAtomValue(activeTabAtom)
  const setActiveTab = useSetAtom(activeTabAtom)
  const setActiveCommentInput = useSetAtom(activeCommentInputAtom)

  // Load diff data on mount
  useEffect(() => {
    if (mockMode) {
      // Load mock data for testing
      setFiles(generateMockDiffFiles())
    } else {
      // TODO: Load real diff data from API
      void loadDiffData(workspaceId).then(setFiles)
    }
  }, [workspaceId, mockMode, setFiles])

  // Select first file automatically
  useEffect(() => {
    const files = generateMockDiffFiles()
    const firstFile = files[0]
    if (firstFile && !selectedFileId) {
      setSelectedFileId(firstFile.id)
    }
  }, [selectedFileId, setSelectedFileId])

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
    return () => { window.removeEventListener('keydown', handleKeyDown) }
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
              onClick={() => { setActiveTab('code') }}
              className={`
                px-3 py-1.5 text-sm rounded-md transition-colors
                ${activeTab === 'code' ? 'bg-background text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'}
              `}
            >
              Code
            </button>
            <button
              type="button"
              onClick={() => { setActiveTab('visual') }}
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
                onClick={() => { setDiffMode('split') }}
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
                onClick={() => { setDiffMode('unified') }}
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
          {activeTab === 'code' ? (
            <>
              <DiffEditor onLineClick={handleLineClick} />
              <InlineComments />
            </>
          ) : (
            <VisualComparison />
          )}
        </div>
      </div>
    </div>
  )
}

/**
 * Load diff data from API (placeholder)
 */
function loadDiffData(_workspaceId: string): Promise<DiffFile[]> {
  // TODO: Implement actual API call
  return Promise.resolve(generateMockDiffFiles())
}

/**
 * Generate mock diff files for testing
 */
function generateMockDiffFiles(): DiffFile[] {
  return [
    {
      id: 'file_1',
      path: 'src/components/Button.tsx',
      filename: 'Button.tsx',
      status: 'modified',
      additions: 15,
      deletions: 8,
      language: 'typescript',
      originalContent: `import { ButtonHTMLAttributes } from 'react'

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary'
}

export function Button({ variant = 'primary', children, ...props }: ButtonProps) {
  return (
    <button
      className={\`btn btn-\${variant}\`}
      {...props}
    >
      {children}
    </button>
  )
}`,
      modifiedContent: `import { ButtonHTMLAttributes, forwardRef } from 'react'

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'ghost'
  size?: 'sm' | 'md' | 'lg'
  isLoading?: boolean
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ variant = 'primary', size = 'md', isLoading, children, disabled, ...props }, ref) => {
    return (
      <button
        ref={ref}
        className={\`btn btn-\${variant} btn-\${size}\`}
        disabled={disabled || isLoading}
        {...props}
      >
        {isLoading ? <Spinner /> : children}
      </button>
    )
  }
)

Button.displayName = 'Button'`,
      hasVisualDiff: true,
      screenshotBefore: 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" width="200" height="50"><rect fill="%23333" width="200" height="50"/><text x="50%" y="50%" fill="white" text-anchor="middle" dominant-baseline="middle">Before</text></svg>',
      screenshotAfter: 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" width="200" height="50"><rect fill="%23666" width="200" height="50"/><text x="50%" y="50%" fill="white" text-anchor="middle" dominant-baseline="middle">After</text></svg>',
    },
    {
      id: 'file_2',
      path: 'src/components/Input.tsx',
      filename: 'Input.tsx',
      status: 'added',
      additions: 25,
      deletions: 0,
      language: 'typescript',
      originalContent: '',
      modifiedContent: `import { InputHTMLAttributes, forwardRef } from 'react'

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string
  error?: string
}

export const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ label, error, className, ...props }, ref) => {
    return (
      <div className="input-wrapper">
        {label && <label className="input-label">{label}</label>}
        <input
          ref={ref}
          className={\`input \${error ? 'input-error' : ''} \${className || ''}\`}
          {...props}
        />
        {error && <span className="input-error-message">{error}</span>}
      </div>
    )
  }
)

Input.displayName = 'Input'`,
    },
    {
      id: 'file_3',
      path: 'src/hooks/useForm.ts',
      filename: 'useForm.ts',
      status: 'modified',
      additions: 10,
      deletions: 5,
      language: 'typescript',
      originalContent: `import { useState, useCallback } from 'react'

export function useForm<T>(initialValues: T) {
  const [values, setValues] = useState(initialValues)

  const handleChange = useCallback((name: keyof T, value: T[keyof T]) => {
    setValues(prev => ({ ...prev, [name]: value }))
  }, [])

  return { values, handleChange }
}`,
      modifiedContent: `import { useState, useCallback, useMemo } from 'react'

interface UseFormOptions<T> {
  initialValues: T
  validate?: (values: T) => Partial<Record<keyof T, string>>
}

export function useForm<T>({ initialValues, validate }: UseFormOptions<T>) {
  const [values, setValues] = useState(initialValues)
  const [touched, setTouched] = useState<Partial<Record<keyof T, boolean>>>({})

  const errors = useMemo(() => validate?.(values) ?? {}, [values, validate])

  const handleChange = useCallback((name: keyof T, value: T[keyof T]) => {
    setValues(prev => ({ ...prev, [name]: value }))
  }, [])

  const handleBlur = useCallback((name: keyof T) => {
    setTouched(prev => ({ ...prev, [name]: true }))
  }, [])

  return { values, errors, touched, handleChange, handleBlur }
}`,
    },
    {
      id: 'file_4',
      path: 'src/utils/helpers.ts',
      filename: 'helpers.ts',
      status: 'deleted',
      additions: 0,
      deletions: 12,
      language: 'typescript',
      originalContent: `export function formatDate(date: Date): string {
  return date.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  })
}

export function capitalize(str: string): string {
  return str.charAt(0).toUpperCase() + str.slice(1)
}`,
      modifiedContent: '',
    },
    {
      id: 'file_5',
      path: 'src/styles/theme.css',
      filename: 'theme.css',
      status: 'modified',
      additions: 20,
      deletions: 10,
      language: 'css',
      originalContent: `:root {
  --primary: #007bff;
  --secondary: #6c757d;
  --background: #ffffff;
  --text: #212529;
}`,
      modifiedContent: `:root {
  --primary: hsl(217, 91%, 60%);
  --primary-foreground: hsl(0, 0%, 100%);
  --secondary: hsl(210, 11%, 71%);
  --secondary-foreground: hsl(222, 47%, 11%);
  --background: hsl(0, 0%, 100%);
  --foreground: hsl(222, 47%, 11%);
  --muted: hsl(210, 40%, 96%);
  --muted-foreground: hsl(215, 16%, 47%);
  --accent: hsl(210, 40%, 96%);
  --accent-foreground: hsl(222, 47%, 11%);
  --border: hsl(214, 32%, 91%);
  --radius: 0.5rem;
}

.dark {
  --primary: hsl(217, 91%, 60%);
  --primary-foreground: hsl(0, 0%, 100%);
  --background: hsl(222, 47%, 11%);
  --foreground: hsl(210, 40%, 98%);
}`,
    },
  ]
}
