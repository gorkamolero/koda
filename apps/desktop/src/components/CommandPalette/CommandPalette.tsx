import {
  useEffect,
  useRef,
  useCallback,
  useState,
  type KeyboardEvent,
  type ChangeEvent,
} from 'react'
import { useAtomValue, useSetAtom } from 'jotai'
import {
  commandPaletteVisibleAtom,
  commandPaletteQueryAtom,
  filteredCommandsAtom,
  closeCommandPaletteAtom,
  executeCommandAtom,
  type Command,
} from '@/store/ui'

/**
 * Command palette dialog (Cmd+K) for quick actions
 */
export function CommandPalette() {
  const isVisible = useAtomValue(commandPaletteVisibleAtom)
  const query = useAtomValue(commandPaletteQueryAtom)
  const setQuery = useSetAtom(commandPaletteQueryAtom)
  const commands = useAtomValue(filteredCommandsAtom)
  const closeCommandPalette = useSetAtom(closeCommandPaletteAtom)
  const executeCommand = useSetAtom(executeCommandAtom)
  const inputRef = useRef<HTMLInputElement>(null)
  const [selectedIndex, setSelectedIndex] = useState(0)

  // Focus input when dialog opens
  useEffect(() => {
    if (isVisible && inputRef.current) {
      inputRef.current.focus()
      setSelectedIndex(0)
    }
  }, [isVisible])

  // Reset selected index when commands change
  useEffect(() => {
    setSelectedIndex(0)
  }, [commands])

  const handleClose = useCallback(() => {
    closeCommandPalette()
    setSelectedIndex(0)
  }, [closeCommandPalette])

  const handleInputChange = useCallback(
    (e: ChangeEvent<HTMLInputElement>) => {
      setQuery(e.target.value)
      setSelectedIndex(0)
    },
    [setQuery]
  )

  const handleSelect = useCallback(
    (command: Command) => {
      executeCommand(command)
    },
    [executeCommand]
  )

  const handleKeyDown = useCallback(
    (e: KeyboardEvent<HTMLInputElement>) => {
      if (e.key === 'Escape') {
        handleClose()
      } else if (e.key === 'ArrowDown') {
        e.preventDefault()
        setSelectedIndex((prev) => Math.min(prev + 1, commands.length - 1))
      } else if (e.key === 'ArrowUp') {
        e.preventDefault()
        setSelectedIndex((prev) => Math.max(prev - 1, 0))
      } else if (e.key === 'Enter' && commands.length > 0) {
        e.preventDefault()
        const selected = commands[selectedIndex]
        if (selected) {
          handleSelect(selected)
        }
      }
    },
    [handleClose, commands, handleSelect, selectedIndex]
  )

  const handleResultClick = useCallback(
    (command: Command) => {
      handleSelect(command)
    },
    [handleSelect]
  )

  const handleBackdropClick = useCallback(() => {
    handleClose()
  }, [handleClose])

  if (!isVisible) return null

  return (
    <div
      data-testid="command-palette"
      className="fixed inset-0 z-50 flex items-start justify-center pt-[15vh]"
      onClick={handleBackdropClick}
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
            <path d="M4 6h16M4 12h16M4 18h7" />
          </svg>
          <input
            ref={inputRef}
            data-testid="command-palette-input"
            type="text"
            value={query}
            onChange={handleInputChange}
            onKeyDown={handleKeyDown}
            placeholder="Type a command or search..."
            className="flex-1 bg-transparent outline-none text-foreground placeholder:text-muted-foreground"
          />
          <kbd className="ml-2 px-2 py-1 bg-muted rounded text-xs text-muted-foreground">
            Esc
          </kbd>
        </div>

        {/* Results */}
        <div
          data-testid="command-palette-results"
          className="max-h-80 overflow-auto"
          role="listbox"
        >
          {commands.length === 0 && query && (
            <div className="px-4 py-8 text-center text-muted-foreground text-sm">
              No commands found
            </div>
          )}

          {commands.length === 0 && !query && (
            <div className="px-4 py-8 text-center text-muted-foreground text-sm">
              Type to search commands
            </div>
          )}

          {commands.map((command, index) => {
            const isSelected = index === selectedIndex

            return (
              <button
                key={command.id}
                role="option"
                aria-selected={isSelected}
                className={`
                  w-full flex items-center justify-between gap-3 px-4 py-3 text-left
                  hover:bg-accent/50 transition-colors
                  ${isSelected ? 'bg-accent' : ''}
                `}
                onClick={() => {
                  handleResultClick(command)
                }}
              >
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium">{command.name}</div>
                  {command.description && (
                    <div className="text-xs text-muted-foreground truncate">
                      {command.description}
                    </div>
                  )}
                </div>

                {/* Category badge */}
                <span className="px-2 py-0.5 bg-muted rounded text-xs text-muted-foreground capitalize">
                  {command.category}
                </span>

                {/* Shortcut hint */}
                {command.shortcut && (
                  <kbd className="px-2 py-1 bg-muted rounded text-xs font-mono">
                    {command.shortcut}
                  </kbd>
                )}
              </button>
            )
          })}
        </div>

        {/* Footer hint */}
        <div className="px-4 py-2 border-t border-border text-xs text-muted-foreground flex items-center gap-4">
          <span>
            <kbd className="px-1.5 py-0.5 bg-muted rounded">Enter</kbd> to
            execute
          </span>
          <span>
            <kbd className="px-1.5 py-0.5 bg-muted rounded">Esc</kbd> to close
          </span>
          <span>
            <kbd className="px-1.5 py-0.5 bg-muted rounded">Up/Down</kbd> to
            navigate
          </span>
        </div>
      </div>
    </div>
  )
}
