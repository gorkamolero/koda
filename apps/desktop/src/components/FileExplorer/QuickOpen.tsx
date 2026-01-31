import {
  useEffect,
  useRef,
  useCallback,
  type KeyboardEvent,
  type ChangeEvent,
} from 'react'
import { useAtom, useAtomValue } from 'jotai'
import { cn } from '@/lib/utils'
import {
  quickOpenVisibleAtom,
  quickOpenQueryAtom,
  quickOpenResultsAtom,
  type FileEntry,
} from '@/store/fileExplorer'
import { FileIcon } from './FileIcon'
import { Search } from 'lucide-react'

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
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />

      {/* Dialog */}
      <div
        className="relative w-full max-w-xl glass-popover rounded-xl border border-border-strong shadow-2xl overflow-hidden animate-fade-in"
        onClick={(e) => {
          e.stopPropagation()
        }}
      >
        {/* Search input */}
        <div className="flex items-center border-b border-border-subtle px-4 py-3">
          <Search className="w-5 h-5 text-text-dim mr-3" />
          <input
            ref={inputRef}
            data-testid="quick-open-input"
            type="text"
            value={query}
            onChange={handleInputChange}
            onKeyDown={handleKeyDown}
            placeholder="Search files by name..."
            className="flex-1 bg-transparent outline-none text-text-primary placeholder:text-text-dim text-sm"
          />
        </div>

        {/* Results */}
        <div
          data-testid="quick-open-results"
          className="max-h-80 overflow-auto"
        >
          {results.length === 0 && query && (
            <div className="px-4 py-8 text-center text-text-faint text-sm">
              No files found
            </div>
          )}

          {results.length === 0 && !query && (
            <div className="px-4 py-8 text-center text-text-faint text-sm">
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
                className={cn(
                  'w-full flex items-center gap-3 px-4 py-2.5 text-left',
                  'hover:bg-surface-hover transition-colors',
                  isSelected && 'bg-surface-active'
                )}
                onClick={() => {
                  handleResultClick(file)
                }}
              >
                <FileIcon filename={file.name} type={file.type} />
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium text-text-primary truncate">{file.name}</div>
                  <div className="text-xs text-text-faint truncate">
                    {file.path}
                  </div>
                </div>
              </button>
            )
          })}
        </div>

        {/* Footer hint */}
        <div className="px-4 py-2 border-t border-border-subtle text-xs text-text-dim flex items-center gap-4">
          <span>
            <kbd className="px-1.5 py-0.5 bg-surface-control text-text-faint rounded font-mono text-[10px]">Enter</kbd>
            <span className="ml-1.5">to open</span>
          </span>
          <span>
            <kbd className="px-1.5 py-0.5 bg-surface-control text-text-faint rounded font-mono text-[10px]">Esc</kbd>
            <span className="ml-1.5">to close</span>
          </span>
        </div>
      </div>
    </div>
  )
}
