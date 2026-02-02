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
import { ArrowUp, Loader2, Plus, Brain, Map } from 'lucide-react'
import { CommandPopover } from './CommandPopover'
import { MentionPopover, type FileSuggestion } from './MentionPopover'
import { filterCommands, type SlashCommand } from '@/lib/slashCommands'
import { detectMentionContext, completeMention, parseMentions } from '@/hooks/useMentionParser'

interface InputAreaProps {
  onSendMessage?: (message: string, mentions?: MessageMention[]) => void
  onSwitchTab?: (tab: string) => void
}

/**
 * Conductor-style chat input:
 * - Rounded box with textarea
 * - Bottom-left: Model selector, Thinking toggle, Plan toggle
 * - Bottom-right: Add button, Send button
 */
export function InputArea({ onSendMessage, onSwitchTab }: InputAreaProps): React.ReactElement {
  const [inputValue, setInputValue] = useAtom(inputValueAtom)
  const isStreaming = useAtomValue(isStreamingAtom)
  const addMessage = useSetAtom(addMessageAtom) // For slash commands (system messages)
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
    if (!trimmedValue || isStreaming) return

    // Parse mentions for the parent to handle
    const parsedMentions = parseMentions(trimmedValue)
    const mentions: MessageMention[] = parsedMentions.map(m => ({
      path: m.path,
      displayName: m.displayName,
    }))

    setInputValue('')
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto'
    }
    // Let parent (AgentChat) handle adding the message to the store
    onSendMessage?.(trimmedValue, mentions.length > 0 ? mentions : undefined)
  }, [inputValue, isStreaming, setInputValue, onSendMessage])

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

  // Model display name
  const modelDisplayName = selectedModel.includes('opus') ? 'Opus 4.5' :
    selectedModel.includes('sonnet') ? 'Sonnet 4' :
    selectedModel.includes('haiku') ? 'Haiku' : 'Claude'

  const canSend = inputValue.trim().length > 0 && !isStreaming

  return (
    <div className="px-4 py-3">
      <div
        className={cn(
          "relative px-4 py-3 min-h-36 rounded-lg border border-border",
          "bg-background/50 shadow-sm",
          "focus-within:ring-1 focus-within:ring-ring/20"
        )}
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

        {/* Textarea - takes up most of the space, with bottom padding for controls */}
        <div className="min-h-[80px] max-h-[200px] overflow-y-auto mb-10">
          <textarea
            ref={textareaRef}
            data-testid="chat-input"
            value={inputValue}
            onChange={handleChange}
            onKeyDown={handleKeyDown}
            onPaste={handlePaste}
            onSelect={(e) => { setCursorPosition(e.currentTarget.selectionStart) }}
            placeholder="Ask to make changes, @mention files, run /commands"
            disabled={isStreaming}
            spellCheck={false}
            autoComplete="off"
            autoCorrect="off"
            autoCapitalize="off"
            className={cn(
              "w-full min-h-[80px] resize-none bg-transparent",
              "text-sm text-foreground placeholder:text-muted-foreground",
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

        {/* Bottom left controls: Model, Thinking, Plan */}
        <div className="absolute bottom-3 left-3 flex items-center gap-1">
          {/* Model selector */}
          <button
            type="button"
            className="h-7 flex items-center gap-1.5 px-2.5 text-xs font-medium rounded-md hover:bg-accent text-foreground/90 transition-colors"
          >
            {/* Claude icon */}
            <svg stroke="currentColor" fill="currentColor" strokeWidth="0" viewBox="0 0 24 24" className="size-3" height="1em" width="1em" xmlns="http://www.w3.org/2000/svg">
              <path d="m4.7144 15.9555 4.7174-2.6471.079-.2307-.079-.1275h-.2307l-.7893-.0486-2.6956-.0729-2.3375-.0971-2.2646-.1214-.5707-.1215-.5343-.7042.0546-.3522.4797-.3218.686.0608 1.5179.1032 2.2767.1578 1.6514.0972 2.4468.255h.3886l.0546-.1579-.1336-.0971-.1032-.0972L6.973 9.8356l-2.55-1.6879-1.3356-.9714-.7225-.4918-.3643-.4614-.1578-1.0078.6557-.7225.8803.0607.2246.0607.8925.686 1.9064 1.4754 2.4893 1.8336.3643.3035.1457-.1032.0182-.0728-.164-.2733-1.3539-2.4467-1.445-2.4893-.6435-1.032-.17-.6194c-.0607-.255-.1032-.4674-.1032-.7285L6.287.1335 6.6997 0l.9957.1336.419.3642.6192 1.4147 1.0018 2.2282 1.5543 3.0296.4553.8985.2429.8318.091.255h.1579v-.1457l.1275-1.706.2368-2.0947.2307-2.6957.0789-.7589.3764-.9107.7468-.4918.5828.2793.4797.686-.0668.4433-.2853 1.8517-.5586 2.9021-.3643 1.9429h.2125l.2429-.2429.9835-1.3053 1.6514-2.0643.7286-.8196.85-.9046.5464-.4311h1.0321l.759 1.1293-.34 1.1657-1.0625 1.3478-.8804 1.1414-1.2628 1.7-.7893 1.36.0729.1093.1882-.0183 2.8535-.607 1.5421-.2794 1.8396-.3157.8318.3886.091.3946-.3278.8075-1.967.4857-2.3072.4614-3.4364.8136-.0425.0304.0486.0607 1.5482.1457.6618.0364h1.621l3.0175.2247.7892.522.4736.6376-.079.4857-1.2142.6193-1.6393-.3886-3.825-.9107-1.3113-.3279h-.1822v.1093l1.0929 1.0686 2.0035 1.8092 2.5075 2.3314.1275.5768-.3218.4554-.34-.0486-2.2039-1.6575-.85-.7468-1.9246-1.621h-.1275v.17l.4432.6496 2.3436 3.5214.1214 1.0807-.17.3521-.6071.2125-.6679-.1214-1.3721-1.9246L14.38 17.959l-1.1414-1.9428-.1397.079-.674 7.2552-.3156.3703-.7286.2793-.6071-.4614-.3218-.7468.3218-1.4753.3886-1.9246.3157-1.53.2853-1.9004.17-.6314-.0121-.0425-.1397.0182-1.4328 1.9672-2.1796 2.9446-1.7243 1.8456-.4128.164-.7164-.3704.0667-.6618.4008-.5889 2.386-3.0357 1.4389-1.882.929-1.0868-.0062-.1579h-.0546l-6.3385 4.1164-1.1293.1457-.4857-.4554.0608-.7467.2307-.2429 1.9064-1.3114Z"></path>
            </svg>
            <span>{modelDisplayName}</span>
          </button>

          {/* Thinking toggle */}
          <button
            type="button"
            onClick={() => { setThinkingEnabled(!thinkingEnabled) }}
            className={cn(
              "h-6 flex items-center gap-1.5 px-2 py-0.5 rounded-md text-xs font-medium transition-all duration-200",
              thinkingEnabled
                ? "bg-[#e07a5f] hover:bg-[#d06a4f] text-white"
                : "hover:bg-accent text-muted-foreground hover:text-foreground"
            )}
            title={thinkingEnabled ? "Thinking enabled" : "Thinking disabled"}
          >
            <Brain className="size-4" />
            <span>Thinking</span>
          </button>

          {/* Plan mode toggle */}
          <button
            type="button"
            onClick={() => { setPlanModeEnabled(!planModeEnabled) }}
            className={cn(
              "h-6 flex items-center gap-1.5 px-2 py-0.5 rounded-md text-xs font-medium transition-all duration-200",
              planModeEnabled
                ? "bg-amber-500/90 hover:bg-amber-500/80 text-white"
                : "hover:bg-accent text-muted-foreground hover:text-foreground"
            )}
            title={planModeEnabled ? "Plan mode enabled" : "Plan mode disabled"}
          >
            <Map className="size-4" />
          </button>
        </div>

        {/* Bottom right controls: Add, Send */}
        <div className="absolute bottom-3 right-3 flex items-center gap-2">
          {/* Add/attach button */}
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="h-7 px-2.5 flex items-center justify-center rounded-md text-muted-foreground hover:bg-accent hover:text-foreground transition-colors"
            title="Attach files"
          >
            <Plus className="size-4" />
          </button>

          {/* Send button */}
          <button
            data-testid="send-button"
            type="button"
            onClick={handleSend}
            disabled={!canSend}
            className={cn(
              "h-6 w-6 flex items-center justify-center rounded-sm transition-colors",
              canSend
                ? "bg-foreground/80 hover:bg-foreground text-background"
                : "bg-foreground/30 text-background cursor-not-allowed"
            )}
            title="Send message"
          >
            {isStreaming ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <ArrowUp className="size-4" strokeWidth={1.5} />
            )}
          </button>
        </div>
      </div>
    </div>
  )
}
