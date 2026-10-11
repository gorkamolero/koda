import { Button, Composer } from '@koda/ui'
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
        // Fit measured content within the Composer's token-sized viewport.
        const limit = Number.parseFloat(getComputedStyle(textarea.parentElement ?? textarea).maxHeight)
        textarea.style.height = `${Math.min(textarea.scrollHeight, Number.isFinite(limit) ? limit : textarea.scrollHeight)}px`
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

        <Composer
          appearance="terminal"
          value={inputValue}
          running={isStreaming}
          disabled={disabled}
          placeholder={placeholder}
          onSend={handleSend}
          textareaRef={textareaRef}
          textareaProps={{
            'data-testid': 'chat-input',
            onChange: handleChange,
            onKeyDown: handleKeyDown,
            onPaste: handlePaste,
            onSelect: event => setCursorPosition(event.currentTarget.selectionStart),
            spellCheck: false,
            autoComplete: 'off',
            autoCorrect: 'off',
            autoCapitalize: 'off',
          }}
          footer={<>
          {/* Hidden file input */}
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            multiple
            className="hidden"
          />

          {/* Footer controls - integrated into the box */}
          <div className="flex items-center justify-between px-3 py-2 border-t border-dashed border-border-subtle group-focus-within:border-text-accent/50 bg-surface-composer transition-colors">
            {/* Left controls: Model, Thinking, Plan */}
            <div className="flex items-center gap-1 text-xs">
              {/* Model selector */}
              <Button variant="unstyled"
                type="button"
                className="h-auto rounded-none border-0 px-1.5 py-0.5 text-text-muted hover:text-text-accent transition-colors"
              >
                [{modelDisplayName}]
              </Button>

              <span className="text-text-faint">·</span>

              {/* Thinking toggle */}
              <Button variant="unstyled"
                type="button"
                onClick={() => { setThinkingEnabled(!thinkingEnabled) }}
                className={cn(
                  "h-auto rounded-none border-0 flex items-center gap-1 px-1.5 py-0.5 transition-colors",
                  thinkingEnabled
                    ? "text-text-accent"
                    : "text-text-faint hover:text-text-muted"
                )}
                title={thinkingEnabled ? "Thinking enabled" : "Thinking disabled"}
              >
                <Brain className="size-3" />
                <span>{thinkingEnabled ? 'ON' : 'OFF'}</span>
              </Button>

              <span className="text-text-faint">·</span>

              {/* Plan mode toggle */}
              <Button variant="unstyled"
                type="button"
                onClick={() => { setPlanModeEnabled(!planModeEnabled) }}
                className={cn(
                  "h-auto rounded-none border-0 flex items-center gap-1 px-1.5 py-0.5 transition-colors",
                  planModeEnabled
                    ? "text-status-warning"
                    : "text-text-faint hover:text-text-muted"
                )}
                title={planModeEnabled ? "Plan mode enabled" : "Plan mode disabled"}
              >
                <Map className="size-3" />
                <span>{planModeEnabled ? 'PLAN' : 'OFF'}</span>
              </Button>
            </div>

            {/* Right controls: Add, Send */}
            <div className="flex items-center gap-2 text-xs">
              {/* Add/attach button */}
              <Button variant="unstyled"
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="h-auto rounded-none border-0 px-1.5 py-0.5 text-text-faint hover:text-text-accent transition-colors"
                title="Attach files"
              >
                [+]
              </Button>

              {/* Send button */}
              <Button variant="unstyled"
                data-testid="send-button"
                type="button"
                onClick={handleSend}
                disabled={!canSend}
                className={cn(
                  "h-auto rounded-none border-0 flex items-center gap-1 px-2 py-1 transition-colors disabled:opacity-100",
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
              </Button>
            </div>
          </div>
          </>}
        />
      </div>
    </div>
  )
}
