import {
  useEffect,
  useRef,
  useCallback,
  type KeyboardEvent,
  type ChangeEvent,
} from 'react'
import { useAtom, useAtomValue } from 'jotai'
import {
  quickOpenVisibleAtom,
  quickOpenQueryAtom,
  quickOpenResultsAtom,
  type FileEntry,
} from '@/store/fileExplorer'
import { FileIcon } from './FileIcon'

interface QuickOpenProps {
  onFileSelect: (file: FileEntry) => void
}

/**
 * Quick open dialog (Cmd+P) for fuzzy file search
 */
export function QuickOpen({ onFileSelect }: QuickOpenProps) {
  const [isVisible, setIsVisible] = useAtom(quickOpenVisibleAtom)
  const [query, setQuery] = useAtom(quickOpenQueryAtom)
  const results = useAtomValue(quickOpenResultsAtom)
  const inputRef = useRef<HTMLInputElement>(null)
  const selectedIndex = useRef(0)

  // Focus input when dialog opens
  useEffect(() => {
    if (isVisible && inputRef.current) {
      inputRef.current.focus()
      selectedIndex.current = 0
    }
  }, [isVisible])

  // Global keyboard handler for Cmd+P
  useEffect(() => {
    const handleKeyDown = (e: globalThis.KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'p') {
        e.preventDefault()
        setIsVisible(true)
      }
    }

    document.addEventListener('keydown', handleKeyDown)
    return () => {
      document.removeEventListener('keydown', handleKeyDown)
    }
  }, [setIsVisible])

  const handleClose = useCallback(() => {
    setIsVisible(false)
    setQuery('')
    selectedIndex.current = 0
  }, [setIsVisible, setQuery])

  const handleInputChange = useCallback(
    (e: ChangeEvent<HTMLInputElement>) => {
      setQuery(e.target.value)
      selectedIndex.current = 0
    },
    [setQuery]
  )

  const handleSelect = useCallback(
    (file: FileEntry) => {
      onFileSelect(file)
      handleClose()
    },
    [onFileSelect, handleClose]
  )

  const handleKeyDown = useCallback(
    (e: KeyboardEvent<HTMLInputElement>) => {
      if (e.key === 'Escape') {
        handleClose()
      } else if (e.key === 'ArrowDown') {
        e.preventDefault()
        selectedIndex.current = Math.min(
          selectedIndex.current + 1,
          results.length - 1
        )
        // Force re-render by updating query with same value
        // This is a hack, but keeps things simple
      } else if (e.key === 'ArrowUp') {
        e.preventDefault()
        selectedIndex.current = Math.max(selectedIndex.current - 1, 0)
      } else if (e.key === 'Enter' && results.length > 0) {
        e.preventDefault()
        const selected = results[selectedIndex.current]
        if (selected) {
          handleSelect(selected)
        }
      }
    },
    [handleClose, results, handleSelect]
  )

  const handleResultClick = useCallback(
    (file: FileEntry) => {
      handleSelect(file)
    },
    [handleSelect]
  )

  if (!isVisible) return null

  return (
    <div
      data-testid="quick-open-dialog"
      className="fixed inset-0 z-50 flex items-start justify-center pt-[15vh]"
      onClick={handleClose}
    >
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/50" />

      {/* Dialog */}
      <div
        className="relative w-full max-w-xl bg-background border border-border rounded-lg shadow-2xl overflow-hidden"
        onClick={(e) => {
          e.stopPropagation()
        }}
      >
        {/* Search input */}
        <div className="flex items-center border-b border-border px-4 py-3">
          <svg
            className="w-5 h-5 text-muted-foreground mr-3"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
          >
            <circle cx="11" cy="11" r="8" />
            <path d="m21 21-4.35-4.35" />
          </svg>
          <input
            ref={inputRef}
            data-testid="quick-open-input"
            type="text"
            value={query}
            onChange={handleInputChange}
            onKeyDown={handleKeyDown}
            placeholder="Search files by name..."
            className="flex-1 bg-transparent outline-none text-foreground placeholder:text-muted-foreground"
          />
        </div>

        {/* Results */}
        <div
          data-testid="quick-open-results"
          className="max-h-80 overflow-auto"
        >
          {results.length === 0 && query && (
            <div className="px-4 py-8 text-center text-muted-foreground text-sm">
              No files found
            </div>
          )}

          {results.length === 0 && !query && (
            <div className="px-4 py-8 text-center text-muted-foreground text-sm">
              Type to search for files
            </div>
          )}

          {results.map((file, index) => {
            const testId = `quick-open-result-${file.name.replace(/\./g, '-').toLowerCase()}`
            const isSelected = index === selectedIndex.current

            return (
              <button
                key={file.path}
                data-testid={testId}
                className={`
                  w-full flex items-center gap-3 px-4 py-2 text-left
                  hover:bg-accent/50 transition-colors
                  ${isSelected ? 'bg-accent' : ''}
                `}
                onClick={() => {
                  handleResultClick(file)
                }}
              >
                <FileIcon filename={file.name} type={file.type} />
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium truncate">{file.name}</div>
                  <div className="text-xs text-muted-foreground truncate">
                    {file.path}
                  </div>
                </div>
              </button>
            )
          })}
        </div>

        {/* Footer hint */}
        <div className="px-4 py-2 border-t border-border text-xs text-muted-foreground flex items-center gap-4">
          <span>
            <kbd className="px-1.5 py-0.5 bg-muted rounded">Enter</kbd> to open
          </span>
          <span>
            <kbd className="px-1.5 py-0.5 bg-muted rounded">Esc</kbd> to close
          </span>
        </div>
      </div>
    </div>
  )
}
