import { useRef, useCallback, useState, useMemo, type KeyboardEvent, type ChangeEvent, type DragEvent, type ClipboardEvent } from 'react'
import { useAtom, useSetAtom, useAtomValue } from 'jotai'
import { cn } from '@/lib/utils'
import {
  inputValueAtom,
  isStreamingAtom,
  addMessageAtom,
  selectedModelAtom,
  estimateTokenCount,
  clearMessagesAtom,
  type MessageMention,
} from '@/store/chat'
import { thinkingEnabledDefaultAtom, planModeEnabledAtom } from '@/store/settings'
import { Send, Loader2, ImagePlus, X, Brain, Map } from 'lucide-react'
import { CommandPopover } from './CommandPopover'
import { MentionPopover, type FileSuggestion } from './MentionPopover'
import { filterCommands, type SlashCommand } from '@/lib/slashCommands'
import { detectMentionContext, completeMention, parseMentions } from '@/hooks/useMentionParser'

interface AttachedImage {
  id: string
  file: File
  preview: string
}

interface InputAreaProps {
  onSendMessage?: (message: string, images?: File[]) => void
  onSwitchTab?: (tab: string) => void
}

/**
 * Chat input area (Composer) with textarea, send button, image attachment, and slash commands
 */
export function InputArea({ onSendMessage, onSwitchTab }: InputAreaProps) {
  const [inputValue, setInputValue] = useAtom(inputValueAtom)
  const isStreaming = useAtomValue(isStreamingAtom)
  const addMessage = useSetAtom(addMessageAtom)
  const clearMessages = useSetAtom(clearMessagesAtom)
  const selectedModel = useAtomValue(selectedModelAtom)
  const [thinkingEnabled, setThinkingEnabled] = useAtom(thinkingEnabledDefaultAtom)
  const [planModeEnabled, setPlanModeEnabled] = useAtom(planModeEnabledAtom)
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  // Image attachments state
  const [attachedImages, setAttachedImages] = useState<AttachedImage[]>([])
  const [isDragOver, setIsDragOver] = useState(false)

  // Slash command state
  const [commandSelectedIndex, setCommandSelectedIndex] = useState(0)
  const showCommandPopover = inputValue.startsWith('/') && !inputValue.includes(' ')
  const filteredCommands = useMemo(() => {
    if (!showCommandPopover) return []
    return filterCommands(inputValue)
  }, [inputValue, showCommandPopover])

  // @mention state
  const [cursorPosition, setCursorPosition] = useState(0)
  const [mentionSelectedIndex, setMentionSelectedIndex] = useState(0)

  // Detect if we're in a mention context
  const mentionContext = useMemo(() => {
    if (showCommandPopover) return { isActive: false, query: '', startIndex: -1 }
    return detectMentionContext(inputValue, cursorPosition)
  }, [inputValue, cursorPosition, showCommandPopover])

  // Mock file suggestions - in real app this would query the file system
  const mentionSuggestions = useMemo((): FileSuggestion[] => {
    if (!mentionContext.isActive) return []

    // This would be replaced with actual file system query
    const mockFiles: FileSuggestion[] = [
      { path: 'src/components/App.tsx', name: 'App.tsx', isDirectory: false, extension: 'tsx' },
      { path: 'src/components/AgentChat/InputArea.tsx', name: 'InputArea.tsx', isDirectory: false, extension: 'tsx' },
      { path: 'src/store/chat.ts', name: 'chat.ts', isDirectory: false, extension: 'ts' },
      { path: 'src/lib/utils.ts', name: 'utils.ts', isDirectory: false, extension: 'ts' },
      { path: 'src/hooks', name: 'hooks', isDirectory: true },
      { path: 'package.json', name: 'package.json', isDirectory: false, extension: 'json' },
      { path: 'README.md', name: 'README.md', isDirectory: false, extension: 'md' },
    ]

    const query = mentionContext.query.toLowerCase()
    return mockFiles.filter(f =>
      f.path.toLowerCase().includes(query) ||
      f.name.toLowerCase().includes(query)
    ).slice(0, 8)
  }, [mentionContext])

  // Reset selection when commands change
  const handleCommandSelect = useCallback((command: SlashCommand) => {
    // Execute the command
    switch (command.trigger) {
      case '/clear':
        clearMessages()
        setInputValue('')
        break
      case '/terminal':
        onSwitchTab?.('terminal')
        setInputValue('')
        break
      case '/diff':
        onSwitchTab?.('diff')
        setInputValue('')
        break
      case '/help':
        // Show help in chat
        addMessage({
          role: 'system',
          content: 'Available commands: /search, /context, /clear, /model, /diff, /terminal, /help',
          status: 'complete',
        })
        setInputValue('')
        break
      default:
        // For commands with args, insert the trigger and a space
        if (command.hasArgs) {
          setInputValue(`${command.trigger} `)
        } else {
          setInputValue('')
        }
    }
    setCommandSelectedIndex(0)
    textareaRef.current?.focus()
  }, [clearMessages, addMessage, setInputValue, onSwitchTab])

  // Handle @mention selection
  const handleMentionSelect = useCallback((suggestion: FileSuggestion) => {
    if (!mentionContext.isActive) return

    const { text, newCursorPosition } = completeMention(
      inputValue,
      mentionContext.startIndex,
      cursorPosition,
      suggestion.path
    )

    setInputValue(text)
    setMentionSelectedIndex(0)

    // Update cursor position after React re-render
    requestAnimationFrame(() => {
      if (textareaRef.current) {
        textareaRef.current.selectionStart = newCursorPosition
        textareaRef.current.selectionEnd = newCursorPosition
        textareaRef.current.focus()
      }
    })
  }, [inputValue, cursorPosition, mentionContext, setInputValue])

  const handleSend = useCallback(() => {
    const trimmedValue = inputValue.trim()
    if ((!trimmedValue && attachedImages.length === 0) || isStreaming) return

    // Parse mentions from the message
    const parsedMentions = parseMentions(trimmedValue)
    const mentions: MessageMention[] = parsedMentions.map(m => ({
      path: m.path,
      displayName: m.displayName,
    }))

    // Add user message with mentions
    addMessage({
      role: 'user',
      content: trimmedValue || '(Image attached)',
      status: 'complete',
      mentions: mentions.length > 0 ? mentions : undefined,
    })

    // Get image files before clearing
    const imageFiles = attachedImages.map(img => img.file)

    // Clear input
    setInputValue('')
    
    // Clean up image previews
    attachedImages.forEach(img => { URL.revokeObjectURL(img.preview) })
    setAttachedImages([])

    // Reset textarea height
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto'
    }

    // Notify parent with images
    onSendMessage?.(trimmedValue, imageFiles.length > 0 ? imageFiles : undefined)
  }, [inputValue, isStreaming, addMessage, setInputValue, onSendMessage, attachedImages])

  const handleKeyDown = useCallback(
    (event: KeyboardEvent<HTMLTextAreaElement>) => {
      // Handle command popover navigation
      if (showCommandPopover && filteredCommands.length > 0) {
        if (event.key === 'ArrowUp') {
          event.preventDefault()
          setCommandSelectedIndex(prev => Math.max(0, prev - 1))
          return
        }
        if (event.key === 'ArrowDown') {
          event.preventDefault()
          setCommandSelectedIndex(prev => Math.min(filteredCommands.length - 1, prev + 1))
          return
        }
        if (event.key === 'Tab' || (event.key === 'Enter' && !event.shiftKey)) {
          event.preventDefault()
          const selected = filteredCommands[commandSelectedIndex]
          if (selected) {
            handleCommandSelect(selected)
          }
          return
        }
        if (event.key === 'Escape') {
          setInputValue('')
          setCommandSelectedIndex(0)
          return
        }
      }

      // Handle @mention popover navigation
      if (mentionContext.isActive && mentionSuggestions.length > 0) {
        if (event.key === 'ArrowUp') {
          event.preventDefault()
          setMentionSelectedIndex(prev => Math.max(0, prev - 1))
          return
        }
        if (event.key === 'ArrowDown') {
          event.preventDefault()
          setMentionSelectedIndex(prev => Math.min(mentionSuggestions.length - 1, prev + 1))
          return
        }
        if (event.key === 'Tab') {
          event.preventDefault()
          const selected = mentionSuggestions[mentionSelectedIndex]
          if (selected) {
            handleMentionSelect(selected)
          }
          return
        }
        if (event.key === 'Escape') {
          // Just close the popover by moving cursor
          setCursorPosition(0)
          setMentionSelectedIndex(0)
          return
        }
      }

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
    [handleSend, showCommandPopover, filteredCommands, commandSelectedIndex, handleCommandSelect, setInputValue, mentionContext.isActive, mentionSuggestions, mentionSelectedIndex, handleMentionSelect]
  )

  const handleChange = useCallback(
    (event: ChangeEvent<HTMLTextAreaElement>) => {
      const value = event.target.value
      setInputValue(value)

      // Track cursor position for @mentions
      setCursorPosition(event.target.selectionStart)

      // Auto-resize textarea
      const textarea = textareaRef.current
      if (textarea) {
        textarea.style.height = 'auto'
        textarea.style.height = `${String(Math.min(textarea.scrollHeight, 200))}px`
      }
    },
    [setInputValue]
  )

  // Handle image attachment
  const handleImageAttach = useCallback((files: FileList | File[]) => {
    const imageFiles = Array.from(files).filter(file => 
      file.type.startsWith('image/')
    )

    const newImages: AttachedImage[] = imageFiles.map(file => ({
      id: `img-${String(Date.now())}-${Math.random().toString(36).slice(2)}`,
      file,
      preview: URL.createObjectURL(file),
    }))

    setAttachedImages(prev => [...prev, ...newImages])
  }, [])

  // Handle paste event for images
  const handlePaste = useCallback((event: ClipboardEvent<HTMLTextAreaElement>) => {
    const items = event.clipboardData?.items
    if (!items) return

    const imageItems = Array.from(items).filter(item => 
      item.type.startsWith('image/')
    )

    if (imageItems.length > 0) {
      event.preventDefault()
      const files = imageItems
        .map(item => item.getAsFile())
        .filter((file): file is File => file !== null)
      handleImageAttach(files)
    }
  }, [handleImageAttach])

  // Handle drag over
  const handleDragOver = useCallback((event: DragEvent<HTMLDivElement>) => {
    event.preventDefault()
    event.stopPropagation()
    setIsDragOver(true)
  }, [])

  // Handle drag leave
  const handleDragLeave = useCallback((event: DragEvent<HTMLDivElement>) => {
    event.preventDefault()
    event.stopPropagation()
    setIsDragOver(false)
  }, [])

  // Handle drop
  const handleDrop = useCallback((event: DragEvent<HTMLDivElement>) => {
    event.preventDefault()
    event.stopPropagation()
    setIsDragOver(false)

    const files = event.dataTransfer?.files
    if (files) {
      handleImageAttach(files)
    }
  }, [handleImageAttach])

  // Remove attached image
  const removeImage = useCallback((id: string) => {
    setAttachedImages(prev => {
      const image = prev.find(img => img.id === id)
      if (image) {
        URL.revokeObjectURL(image.preview)
      }
      return prev.filter(img => img.id !== id)
    })
  }, [])

  const inputTokenCount = estimateTokenCount(inputValue)

  return (
    <div
      className={cn(
        "glass bg-surface-composer border-t border-border-subtle px-4 py-3",
        isDragOver && "ring-2 ring-border-accent ring-inset"
      )}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      <div className="max-w-4xl mx-auto">
        {/* Attached images preview */}
        {attachedImages.length > 0 && (
          <div className="flex flex-wrap gap-2 mb-3">
            {attachedImages.map((image) => (
              <div
                key={image.id}
                className="relative group"
              >
                <img
                  src={image.preview}
                  alt="Attached"
                  className="h-16 w-16 object-cover rounded-lg border border-border-subtle"
                />
                <button
                  onClick={() => { removeImage(image.id) }}
                  className="absolute -top-1.5 -right-1.5 w-5 h-5 flex items-center justify-center bg-status-error text-white rounded-full opacity-0 group-hover:opacity-100 transition-opacity"
                >
                  <X className="w-3 h-3" />
                </button>
              </div>
            ))}
          </div>
        )}

        {/* Meta bar */}
        <div className="flex items-center gap-3 mb-2 text-xs">
          <span className="text-text-faint">
            Model: <span className="text-text-muted">{selectedModel}</span>
          </span>

          <span className="text-text-dim">•</span>

          {/* Thinking toggle */}
          <button
            onClick={() => { setThinkingEnabled(!thinkingEnabled) }}
            className={cn(
              "flex items-center gap-1.5 px-2 py-0.5 rounded transition-colors",
              thinkingEnabled
                ? "bg-status-success/20 text-status-success"
                : "text-text-faint hover:text-text-muted"
            )}
            title={thinkingEnabled ? "Thinking enabled" : "Thinking disabled"}
          >
            <Brain className="w-3 h-3" />
            <span>Thinking</span>
          </button>

          <span className="text-text-dim">•</span>

          {/* Plan mode toggle */}
          <button
            onClick={() => { setPlanModeEnabled(!planModeEnabled) }}
            className={cn(
              "flex items-center gap-1.5 px-2 py-0.5 rounded transition-colors",
              planModeEnabled
                ? "bg-text-accent/20 text-text-accent"
                : "text-text-faint hover:text-text-muted"
            )}
            title={planModeEnabled ? "Plan mode enabled - agent will create a plan before executing" : "Plan mode disabled"}
          >
            <Map className="w-3 h-3" />
            <span>Plan</span>
          </button>

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
          {/* Image attachment button */}
          <button
            onClick={() => fileInputRef.current?.click()}
            disabled={isStreaming}
            className="h-12 w-12 flex items-center justify-center rounded-xl bg-surface-control border border-border-subtle text-text-muted hover:text-text-primary hover:border-border-strong transition-colors disabled:opacity-50"
            title="Attach image (or paste/drop)"
          >
            <ImagePlus className="w-5 h-5" />
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            multiple
            className="hidden"
            onChange={(e) => { if (e.target.files) handleImageAttach(e.target.files) }}
          />

          {/* Textarea with command popover */}
          <div className="flex-1 relative">
            {/* Slash command popover */}
            <CommandPopover
              isOpen={showCommandPopover}
              commands={filteredCommands}
              selectedIndex={commandSelectedIndex}
              onSelect={handleCommandSelect}
              onClose={() => {
                setInputValue('')
                setCommandSelectedIndex(0)
              }}
            />

            {/* @mention popover */}
            <MentionPopover
              isOpen={mentionContext.isActive}
              suggestions={mentionSuggestions}
              selectedIndex={mentionSelectedIndex}
              query={mentionContext.query}
              onSelect={handleMentionSelect}
              onClose={() => {
                setCursorPosition(0)
                setMentionSelectedIndex(0)
              }}
            />

            <textarea
              ref={textareaRef}
              data-testid="chat-input"
              value={inputValue}
              onChange={handleChange}
              onKeyDown={handleKeyDown}
              onPaste={handlePaste}
              onSelect={(e) => { setCursorPosition(e.currentTarget.selectionStart) }}
              placeholder={isDragOver ? "Drop images here..." : "Message... (@ for files, / for commands)"}
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
            disabled={(!inputValue.trim() && attachedImages.length === 0) || isStreaming}
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
