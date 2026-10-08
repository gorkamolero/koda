import { useRef, useCallback, useState, useMemo, type KeyboardEvent, type ChangeEvent, type DragEvent, type ClipboardEvent } from 'react'
import { useAtom, useSetAtom, useAtomValue } from 'jotai'
import { cn } from '@/lib/utils'
import {
  inputValueAtom,
  isStreamingAtom,
  addMessageAtom,
  selectedModelAtom,
  clearMessagesAtom,
  type MessageMention,
} from '@/store/chat'
import { thinkingEnabledDefaultAtom, planModeEnabledAtom } from '@/store/settings'
import { ArrowUp, Loader2, Brain, Map } from 'lucide-react'
import { CommandPopover } from './CommandPopover'
import { MentionPopover, type FileSuggestion } from './MentionPopover'
import { filterCommands, type SlashCommand } from '@/lib/slashCommands'
import { detectMentionContext, completeMention, parseMentions } from '@/hooks/useMentionParser'

interface InputAreaProps {
  onSendMessage?: (message: string, mentions?: MessageMention[]) => void
  onSwitchTab?: (tab: string) => void
  disabled?: boolean
  placeholder?: string
}

/**
 * Terminal-style chat input
 * ┌─ INPUT ──────────────────────────────────────────┐
 * │ > type your message here...                      │
 * │                                                  │
 * ├──────────────────────────────────────────────────┤
 * │ [MODEL:opus] [THINK] [PLAN]           [+] [SEND] │
 * └──────────────────────────────────────────────────┘
 */
export function InputArea({ onSendMessage, onSwitchTab, disabled = false, placeholder = 'type message, @mention files, use /commands...' }: InputAreaProps): React.ReactElement {
  const [inputValue, setInputValue] = useAtom(inputValueAtom)
  const isStreaming = useAtomValue(isStreamingAtom)
  const addMessage = useSetAtom(addMessageAtom)
  const clearMessages = useSetAtom(clearMessagesAtom)
  const selectedModel = useAtomValue(selectedModelAtom)
  const [thinkingEnabled, setThinkingEnabled] = useAtom(thinkingEnabledDefaultAtom)
  const [planModeEnabled, setPlanModeEnabled] = useAtom(planModeEnabledAtom)
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

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

  // Mock file suggestions
  const mentionSuggestions = useMemo((): FileSuggestion[] => {
    if (!mentionContext.isActive) return []
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

  const handleCommandSelect = useCallback((command: SlashCommand) => {
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
        addMessage({
          role: 'system',
          content: 'Available commands: /search, /context, /clear, /model, /diff, /terminal, /help',
          status: 'complete',
        })
        setInputValue('')
        break
      default:
        if (command.hasArgs) {
          setInputValue(`${command.trigger} `)
        } else {
          setInputValue('')
        }
    }
    setCommandSelectedIndex(0)
    textareaRef.current?.focus()
  }, [clearMessages, addMessage, setInputValue, onSwitchTab])

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
    if (!trimmedValue || isStreaming || disabled) return

    const parsedMentions = parseMentions(trimmedValue)
    const mentions: MessageMention[] = parsedMentions.map(m => ({
      path: m.path,
      displayName: m.displayName,
    }))

    setInputValue('')
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto'
    }
    onSendMessage?.(trimmedValue, mentions.length > 0 ? mentions : undefined)
  }, [inputValue, isStreaming, disabled, setInputValue, onSendMessage])

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
          if (selected) handleCommandSelect(selected)
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
          if (selected) handleMentionSelect(selected)
          return
        }
        if (event.key === 'Escape') {
          setCursorPosition(0)
          setMentionSelectedIndex(0)
          return
        }
      }

      // Cmd+Enter or Ctrl+Enter sends
      if ((event.metaKey || event.ctrlKey) && event.key === 'Enter') {
        event.preventDefault()
        handleSend()
        return
      }
      // Enter without shift sends
      if (event.key === 'Enter' && !event.shiftKey) {
        event.preventDefault()
        handleSend()
      }
    },
    [handleSend, showCommandPopover, filteredCommands, commandSelectedIndex, handleCommandSelect, setInputValue, mentionContext.isActive, mentionSuggestions, mentionSelectedIndex, handleMentionSelect]
  )

  const handleChange = useCallback(
    (event: ChangeEvent<HTMLTextAreaElement>) => {
      const value = event.target.value
      setInputValue(value)
      setCursorPosition(event.target.selectionStart)

      const textarea = textareaRef.current
      if (textarea) {
        textarea.style.height = 'auto'
        textarea.style.height = `${String(Math.min(textarea.scrollHeight, 200))}px`
      }
    },
    [setInputValue]
  )

  const handlePaste = useCallback((event: ClipboardEvent<HTMLTextAreaElement>) => {
    const items = event.clipboardData?.items
    if (!items) return
    const imageItems = Array.from(items).filter(item => item.type.startsWith('image/'))
    if (imageItems.length > 0) {
      event.preventDefault()
      // TODO: Handle image paste
    }
  }, [])

  const handleDragOver = useCallback((event: DragEvent<HTMLDivElement>) => {
    event.preventDefault()
    event.stopPropagation()
  }, [])

  const handleDrop = useCallback((event: DragEvent<HTMLDivElement>) => {
    event.preventDefault()
    event.stopPropagation()
    // TODO: Handle file drop
  }, [])

  // Model display name - terminal style
  const modelDisplayName = selectedModel === 'codex' ? 'CODEX' : selectedModel === 'kimi' ? 'KIMI' : selectedModel.includes('opus') ? 'OPUS' :
    selectedModel.includes('sonnet') ? 'SNNT' :
    selectedModel.includes('haiku') ? 'HAIK' : 'CLDE'

  const canSend = inputValue.trim().length > 0 && !isStreaming && !disabled

  return (
    <div className="px-4 py-3 font-mono bg-surface-messages">
      <div
        className="relative"
        onDragOver={handleDragOver}
        onDrop={handleDrop}
      >
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

        {/* Main input container */}
        <div className="group border border-dashed border-border-subtle focus-within:border-text-accent transition-colors">
          {/* Textarea with prompt indicator */}
          <div className="flex min-h-[80px] max-h-[200px] overflow-y-auto px-3 py-3">
            <span className="text-text-accent text-sm mr-2 mt-0.5 select-none">&gt;</span>
            <textarea
              ref={textareaRef}
              data-testid="chat-input"
              value={inputValue}
              onChange={handleChange}
              onKeyDown={handleKeyDown}
              onPaste={handlePaste}
              onSelect={(e) => { setCursorPosition(e.currentTarget.selectionStart) }}
              placeholder={placeholder}
              disabled={isStreaming || disabled}
              spellCheck={false}
              autoComplete="off"
              autoCorrect="off"
              autoCapitalize="off"
              className={cn(
                "flex-1 min-h-[60px] resize-none bg-transparent",
                "text-sm text-text-primary placeholder:text-text-faint",
                "focus:outline-none",
                "disabled:opacity-50 disabled:cursor-not-allowed"
              )}
            />
          </div>

          {/* Hidden file input */}
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            multiple
            className="hidden"
          />

          {/* Footer controls - integrated into the box */}
          <div className="flex items-center justify-between px-3 py-2 border-t border-dashed border-border-subtle group-focus-within:border-text-accent/50 bg-[#050505] transition-colors">
            {/* Left controls: Model, Thinking, Plan */}
            <div className="flex items-center gap-1 text-xs">
              {/* Model selector */}
              <button
                type="button"
                className="px-1.5 py-0.5 text-text-muted hover:text-text-accent transition-colors"
              >
                [{modelDisplayName}]
              </button>

              <span className="text-text-faint">·</span>

              {/* Thinking toggle */}
              <button
                type="button"
                onClick={() => { setThinkingEnabled(!thinkingEnabled) }}
                className={cn(
                  "flex items-center gap-1 px-1.5 py-0.5 transition-colors",
                  thinkingEnabled
                    ? "text-text-accent"
                    : "text-text-faint hover:text-text-muted"
                )}
                title={thinkingEnabled ? "Thinking enabled" : "Thinking disabled"}
              >
                <Brain className="size-3" />
                <span>{thinkingEnabled ? 'ON' : 'OFF'}</span>
              </button>

              <span className="text-text-faint">·</span>

              {/* Plan mode toggle */}
              <button
                type="button"
                onClick={() => { setPlanModeEnabled(!planModeEnabled) }}
                className={cn(
                  "flex items-center gap-1 px-1.5 py-0.5 transition-colors",
                  planModeEnabled
                    ? "text-status-warning"
                    : "text-text-faint hover:text-text-muted"
                )}
                title={planModeEnabled ? "Plan mode enabled" : "Plan mode disabled"}
              >
                <Map className="size-3" />
                <span>{planModeEnabled ? 'PLAN' : 'OFF'}</span>
              </button>
            </div>

            {/* Right controls: Add, Send */}
            <div className="flex items-center gap-2 text-xs">
              {/* Add/attach button */}
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="px-1.5 py-0.5 text-text-faint hover:text-text-accent transition-colors"
                title="Attach files"
              >
                [+]
              </button>

              {/* Send button */}
              <button
                data-testid="send-button"
                type="button"
                onClick={handleSend}
                disabled={!canSend}
                className={cn(
                  "flex items-center gap-1 px-2 py-1 transition-colors",
                  canSend
                    ? "text-text-accent hover:bg-text-accent/10"
                    : "text-text-faint cursor-not-allowed"
                )}
                title="Send message (Enter)"
              >
                {isStreaming ? (
                  <>
                    <Loader2 className="size-3 animate-spin" />
                    <span>[...]</span>
                  </>
                ) : (
                  <>
                    <ArrowUp className="size-3" />
                    <span>[SEND]</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
