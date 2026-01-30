import { useRef, useCallback, type KeyboardEvent, type ChangeEvent } from 'react'
import { useAtom, useSetAtom, useAtomValue } from 'jotai'
import {
  inputValueAtom,
  isStreamingAtom,
  addMessageAtom,
  selectedModelAtom,
  estimateTokenCount,
} from '@/store/chat'

interface InputAreaProps {
  onSendMessage?: (message: string) => void
}

/**
 * Chat input area with textarea, send button, and attachment support
 */
export function InputArea({ onSendMessage }: InputAreaProps) {
  const [inputValue, setInputValue] = useAtom(inputValueAtom)
  const isStreaming = useAtomValue(isStreamingAtom)
  const addMessage = useSetAtom(addMessageAtom)
  const selectedModel = useAtomValue(selectedModelAtom)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  const handleSend = useCallback(() => {
    const trimmedValue = inputValue.trim()
    if (!trimmedValue || isStreaming) return

    // Add user message
    addMessage({
      role: 'user',
      content: trimmedValue,
      status: 'complete',
    })

    // Clear input
    setInputValue('')

    // Reset textarea height
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto'
    }

    // Notify parent
    onSendMessage?.(trimmedValue)
  }, [inputValue, isStreaming, addMessage, setInputValue, onSendMessage])

  const handleKeyDown = useCallback(
    (event: KeyboardEvent<HTMLTextAreaElement>) => {
      // Cmd+Enter or Ctrl+Enter sends the message
      if ((event.metaKey || event.ctrlKey) && event.key === 'Enter') {
        event.preventDefault()
        handleSend()
        return
      }
      // Enter without shift sends the message
      if (event.key === 'Enter' && !event.shiftKey) {
        event.preventDefault()
        handleSend()
      }
      // Shift+Enter adds a new line (default behavior)
    },
    [handleSend]
  )

  const handleChange = useCallback(
    (event: ChangeEvent<HTMLTextAreaElement>) => {
      const value = event.target.value
      setInputValue(value)

      // Auto-resize textarea
      const textarea = textareaRef.current
      if (textarea) {
        textarea.style.height = 'auto'
        textarea.style.height = `${String(Math.min(textarea.scrollHeight, 200))}px`
      }
    },
    [setInputValue]
  )

  const inputTokenCount = estimateTokenCount(inputValue)

  return (
    <div className="border-t border-border bg-background p-4">
      <div className="max-w-4xl mx-auto">
        <div className="flex gap-3">
          {/* Textarea */}
          <div className="flex-1 relative">
            <textarea
              ref={textareaRef}
              data-testid="chat-input"
              value={inputValue}
              onChange={handleChange}
              onKeyDown={handleKeyDown}
              placeholder="Type a message... (Enter or Cmd+Enter to send)"
              disabled={isStreaming}
              rows={1}
              className="
                w-full resize-none rounded-md
                border border-border bg-background
                px-4 py-3 text-sm
                placeholder:text-muted-foreground
                focus:outline-none focus:ring-2 focus:ring-primary/50
                disabled:opacity-50 disabled:cursor-not-allowed
              "
              style={{ minHeight: '44px', maxHeight: '200px' }}
            />

            {/* Token count indicator */}
            {inputValue.length > 0 && (
              <div className="absolute bottom-2 right-3 text-xs text-muted-foreground">
                ~{inputTokenCount} tokens
              </div>
            )}
          </div>

          {/* Send button */}
          <button
            data-testid="send-button"
            onClick={handleSend}
            disabled={!inputValue.trim() || isStreaming}
            className="
              inline-flex items-center justify-center
              rounded-md px-4 py-2
              bg-primary text-primary-foreground
              hover:bg-primary/90
              disabled:opacity-50 disabled:cursor-not-allowed
              transition-colors
            "
            title={`Send message using ${selectedModel}`}
          >
            {isStreaming ? (
              <LoadingIcon className="w-5 h-5 animate-spin" />
            ) : (
              <SendIcon className="w-5 h-5" />
            )}
          </button>
        </div>

        {/* Hint text */}
        <div className="mt-2 text-xs text-muted-foreground flex items-center justify-between">
          <span>
            Press <kbd className="px-1.5 py-0.5 rounded bg-muted font-mono text-xs">Enter</kbd> or <kbd className="px-1.5 py-0.5 rounded bg-muted font-mono text-xs">Cmd+Enter</kbd> to send, <kbd className="px-1.5 py-0.5 rounded bg-muted font-mono text-xs">Shift+Enter</kbd> for new line
          </span>
          {isStreaming && (
            <span className="text-primary animate-pulse">Agent is responding...</span>
          )}
        </div>
      </div>
    </div>
  )
}

function SendIcon({ className }: { className?: string }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 20 20"
      fill="currentColor"
      className={className}
    >
      <path d="M3.105 2.289a.75.75 0 00-.826.95l1.414 4.925A1.5 1.5 0 005.135 9.25h6.115a.75.75 0 010 1.5H5.135a1.5 1.5 0 00-1.442 1.086l-1.414 4.926a.75.75 0 00.826.95 28.896 28.896 0 0015.293-7.154.75.75 0 000-1.115A28.897 28.897 0 003.105 2.289z" />
    </svg>
  )
}

function LoadingIcon({ className }: { className?: string }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      fill="none"
      viewBox="0 0 24 24"
      className={className}
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
  )
}
