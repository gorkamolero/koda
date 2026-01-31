import { useRef, useCallback, type KeyboardEvent, type ChangeEvent } from 'react'
import { useAtom, useSetAtom, useAtomValue } from 'jotai'
import { cn } from '@/lib/utils'
import {
  inputValueAtom,
  isStreamingAtom,
  addMessageAtom,
  selectedModelAtom,
  estimateTokenCount,
} from '@/store/chat'
import { Send, Loader2 } from 'lucide-react'

interface InputAreaProps {
  onSendMessage?: (message: string) => void
}

/**
 * Chat input area (Composer) with textarea, send button, and token counter
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
    <div className="glass bg-surface-composer border-t border-border-subtle px-4 py-3">
      <div className="max-w-4xl mx-auto">
        {/* Meta bar */}
        <div className="flex items-center gap-3 mb-2 text-xs">
          <span className="text-text-faint">
            Model: <span className="text-text-muted">{selectedModel}</span>
          </span>
          {isStreaming && (
            <>
              <span className="text-text-dim">•</span>
              <span className="text-text-accent animate-pulse flex items-center gap-1.5">
                <Loader2 className="w-3 h-3 animate-spin" />
                Generating...
              </span>
            </>
          )}
        </div>

        {/* Input row */}
        <div className="flex items-end gap-3">
          {/* Textarea */}
          <div className="flex-1 relative">
            <textarea
              ref={textareaRef}
              data-testid="chat-input"
              value={inputValue}
              onChange={handleChange}
              onKeyDown={handleKeyDown}
              placeholder="Message..."
              disabled={isStreaming}
              rows={1}
              className={cn(
                'w-full resize-none rounded-xl',
                'bg-surface-control border border-border-subtle',
                'px-4 py-3 text-sm text-text-primary',
                'placeholder:text-text-dim',
                'focus:outline-none focus:border-border-accent focus:ring-1 focus:ring-border-accent-soft',
                'disabled:opacity-50 disabled:cursor-not-allowed',
                'transition-colors'
              )}
              style={{ minHeight: '48px', maxHeight: '200px' }}
            />

            {/* Token count indicator */}
            {inputValue.length > 0 && (
              <div className="absolute bottom-3 right-3 text-xs text-text-dim">
                ~{inputTokenCount} tokens
              </div>
            )}
          </div>

          {/* Send button */}
          <button
            data-testid="send-button"
            onClick={handleSend}
            disabled={!inputValue.trim() || isStreaming}
            className={cn(
              'btn-primary h-12 px-5',
              'disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none disabled:shadow-none'
            )}
            title={`Send message using ${selectedModel}`}
          >
            {isStreaming ? (
              <Loader2 className="w-5 h-5 animate-spin" />
            ) : (
              <Send className="w-5 h-5" />
            )}
          </button>
        </div>

        {/* Hint text */}
        <div className="mt-2 text-xs text-text-dim flex items-center justify-between">
          <span className="flex items-center gap-1">
            <kbd className="px-1.5 py-0.5 rounded bg-surface-control text-text-faint font-mono text-[10px]">
              Enter
            </kbd>
            <span className="text-text-faint">or</span>
            <kbd className="px-1.5 py-0.5 rounded bg-surface-control text-text-faint font-mono text-[10px]">
              ⌘↵
            </kbd>
            <span className="text-text-faint">to send</span>
          </span>
          <span className="text-text-faint">
            <kbd className="px-1.5 py-0.5 rounded bg-surface-control text-text-faint font-mono text-[10px]">
              ⇧↵
            </kbd>
            <span className="ml-1">for new line</span>
          </span>
        </div>
      </div>
    </div>
  )
}
