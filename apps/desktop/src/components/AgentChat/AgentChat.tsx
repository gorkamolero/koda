import { useEffect, useCallback, useRef, useState } from 'react'
import { useSetAtom, useAtomValue } from 'jotai'
import { Sparkles, Brain, Map, Plus, ArrowUp, Square } from 'lucide-react'
import {
  currentWorkspaceIdAtom,
  addMessageAtom,
  updateMessageAtom,
  isStreamingAtom,
  selectedModelAtom,
  generateMessageId,
  planModeAtom,
  enterPlanModeAtom,
  exitPlanModeAtom,
  AGENT_MODELS,
  type AgentModel,
} from '@/store/chat'
import { rpcRequest } from '@/lib/tauri'
import {
  RPC_METHODS,
  type ClaudeStartParams,
  type ClaudeStartResult,
  type ClaudeSessionInfo,
  type StoredMessage,
  type ClaudeGetMessagesParams,
} from '@/lib/rpc'
import { MessageList } from './MessageList'
import { PlanModeIndicator } from './PlanModeIndicator'
import { useNotifications } from '@/hooks/useNotifications'
import { cn } from '@/lib/utils'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { ContextStatsPopover } from './ContextStatsPopover'

interface AgentChatProps {
  workspaceId: string
  sessionId?: string
}

/** Get display name for model */
function getModelDisplayName(model: AgentModel): string {
  switch (model) {
    case 'claude':
      return 'Opus 4.5'
    case 'codex':
      return 'Codex'
    case 'kimi':
      return 'Kimi'
    default:
      return model
  }
}

/**
 * Main agent chat component - Conductor-style layout
 *
 * Footer layout (matching Conductor screenshot):
 * [✱ Model] [🧠 Thinking] [📖 Context] .............. [+] [↑]
 */
export function AgentChat({ workspaceId, sessionId: _sessionId }: AgentChatProps) {
  void _sessionId
  const setCurrentWorkspaceId = useSetAtom(currentWorkspaceIdAtom)
  const addMessage = useSetAtom(addMessageAtom)
  const updateMessage = useSetAtom(updateMessageAtom)
  const isStreaming = useAtomValue(isStreamingAtom)
  const setIsStreaming = useSetAtom(isStreamingAtom)
  const selectedModel = useAtomValue(selectedModelAtom)
  const setSelectedModel = useSetAtom(selectedModelAtom)
  const planMode = useAtomValue(planModeAtom)
  const enterPlanMode = useSetAtom(enterPlanModeAtom)
  const exitPlanMode = useSetAtom(exitPlanModeAtom)
  const { showToast } = useNotifications()

  // Local state
  const [inputValue, setInputValue] = useState('')
  const [thinkingEnabled, setThinkingEnabled] = useState(true)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  // Track active session for polling
  const activeSessionRef = useRef<string | null>(null)
  const messageIndexRef = useRef(0)
  const pollingRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const currentMessageIdRef = useRef<string | null>(null)
  const accumulatedTextRef = useRef('')

  // Set current workspace when component mounts
  useEffect(() => {
    setCurrentWorkspaceId(workspaceId)
    return () => {
      setCurrentWorkspaceId(null)
      if (pollingRef.current) {
        clearInterval(pollingRef.current)
      }
    }
  }, [workspaceId, setCurrentWorkspaceId])

  // Global Cmd+L focus handler
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'l') {
        e.preventDefault()
        textareaRef.current?.focus()
      }
    }
    document.addEventListener('keydown', handleKeyDown)
    return () => {
      document.removeEventListener('keydown', handleKeyDown)
    }
  }, [])

  // Poll for messages from active session
  const pollMessages = useCallback(async () => {
    if (!activeSessionRef.current) return

    try {
      const messages = await rpcRequest<StoredMessage[]>(
        RPC_METHODS.CLAUDE_GET_MESSAGES,
        {
          sessionId: activeSessionRef.current,
          fromIndex: messageIndexRef.current,
        } satisfies ClaudeGetMessagesParams
      )

      for (const msg of messages) {
        messageIndexRef.current = msg.index + 1
        const event = msg.event

        if (event.type === 'assistant') {
          const message = event.message as { type?: string; text?: string } | undefined
          if (message?.text) {
            accumulatedTextRef.current += message.text
            if (currentMessageIdRef.current) {
              updateMessage({
                id: currentMessageIdRef.current,
                update: {
                  content: accumulatedTextRef.current,
                  status: 'streaming',
                },
              })
            }
          }
        } else if (event.type === 'result') {
          const resultText = (event as { result?: string }).result
          const isError = (event as { is_error?: boolean }).is_error

          if (isError && resultText) {
            showToast({
              type: 'error',
              title: 'Agent Error',
              message: resultText ?? 'Unknown error',
            })
          }

          if (currentMessageIdRef.current) {
            const finalContent = accumulatedTextRef.current || resultText || 'Done'
            updateMessage({
              id: currentMessageIdRef.current,
              update: {
                content: finalContent,
                status: isError ? 'error' : 'complete',
              },
            })
          }

          if (pollingRef.current) {
            clearInterval(pollingRef.current)
            pollingRef.current = null
          }
          activeSessionRef.current = null
          setIsStreaming(false)
        } else if (event.type === 'tool_use') {
          const toolName = (event as { tool?: string }).tool ?? 'tool'
          if (currentMessageIdRef.current) {
            updateMessage({
              id: currentMessageIdRef.current,
              update: {
                content: accumulatedTextRef.current || `Using ${toolName}...`,
                status: 'streaming',
              },
            })
          }
        } else if (event.type === 'tool_result') {
          if (currentMessageIdRef.current && !accumulatedTextRef.current) {
            updateMessage({
              id: currentMessageIdRef.current,
              update: {
                content: 'Processing...',
                status: 'streaming',
              },
            })
          }
        }
      }

      if (activeSessionRef.current) {
        const session = await rpcRequest<ClaudeSessionInfo | null>(
          RPC_METHODS.CLAUDE_GET_SESSION,
          { sessionId: activeSessionRef.current }
        )

        if (
          session &&
          (session.status === 'completed' ||
            session.status === 'error' ||
            session.status === 'cancelled')
        ) {
          if (pollingRef.current) {
            clearInterval(pollingRef.current)
            pollingRef.current = null
          }
          activeSessionRef.current = null
          setIsStreaming(false)

          if (currentMessageIdRef.current) {
            updateMessage({
              id: currentMessageIdRef.current,
              update: {
                status: session.status === 'completed' ? 'complete' : 'error',
              },
            })
          }
        }
      }
    } catch (error) {
      console.error('Failed to poll messages:', error)
    }
  }, [updateMessage, setIsStreaming, showToast])

  const handleSendMessage = useCallback(
    async (content: string) => {
      if (!content.trim()) return

      addMessage({
        role: 'user',
        content,
        status: 'complete',
        model: selectedModel,
      })

      setInputValue('')
      setIsStreaming(true)
      accumulatedTextRef.current = ''
      messageIndexRef.current = 0

      try {
        const messageId = generateMessageId()
        currentMessageIdRef.current = messageId
        addMessage({
          id: messageId,
          role: 'assistant',
          content: '',
          status: 'streaming',
          model: selectedModel,
        })

        const result = await rpcRequest<ClaudeStartResult>(RPC_METHODS.CLAUDE_START, {
          workspaceId,
          prompt: content,
        } satisfies ClaudeStartParams)

        activeSessionRef.current = result.sessionId

        pollingRef.current = setInterval(() => {
          void pollMessages()
        }, 300)
      } catch (error) {
        console.error('Failed to start Claude session:', error)
        setIsStreaming(false)
        addMessage({
          role: 'assistant',
          content: `Failed to connect to agent: ${error instanceof Error ? error.message : 'Unknown error'}`,
          status: 'error',
          model: selectedModel,
        })
      }
    },
    [selectedModel, workspaceId, setIsStreaming, addMessage, pollMessages]
  )

  // Handle form submit
  const handleSubmit = useCallback(
    (e: React.FormEvent) => {
      e.preventDefault()
      if (inputValue.trim() && !isStreaming) {
        void handleSendMessage(inputValue)
      }
    },
    [inputValue, isStreaming, handleSendMessage]
  )

  // Handle Enter to submit (Shift+Enter for newline)
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault()
        if (inputValue.trim() && !isStreaming) {
          void handleSendMessage(inputValue)
        }
      }
    },
    [inputValue, isStreaming, handleSendMessage]
  )

  // Auto-resize textarea
  const handleInput = useCallback((e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const textarea = e.target
    setInputValue(textarea.value)
    // Reset height to auto to get the correct scrollHeight
    textarea.style.height = 'auto'
    // Set to scrollHeight but cap at max
    textarea.style.height = `${String(Math.min(textarea.scrollHeight, 200))}px`
  }, [])

  return (
    <div data-testid="agent-chat-container" className="h-full flex flex-col bg-background">
      {/* Plan mode indicator */}
      <PlanModeIndicator
        isActive={planMode.isActive}
        planTitle={planMode.planTitle}
        steps={planMode.steps}
        currentStepIndex={planMode.currentStepIndex}
        onExitPlanMode={exitPlanMode}
      />

      {/* Message list */}
      <div className="flex-1 min-h-0 overflow-hidden">
        <MessageList />
      </div>

      {/* Conductor-style Composer */}
      <div className="px-4 pb-4 pt-2">
        <form
          onSubmit={handleSubmit}
          className={cn(
            'relative bg-[hsl(var(--composer-background))] rounded-lg border-2 transition-colors',
            planMode.isActive
              ? 'border-blue-500/50 shadow-[0_0_0_1px_rgba(59,130,246,0.2)]'
              : 'border-border'
          )}
        >
          {/* Textarea */}
          <textarea
            ref={textareaRef}
            data-testid="chat-input"
            value={inputValue}
            onChange={handleInput}
            onKeyDown={handleKeyDown}
            placeholder="Ask to make changes, @mention files, run /commands"
            disabled={isStreaming}
            rows={1}
            className="w-full px-4 py-3 bg-transparent border-none resize-none focus:outline-none focus:ring-0 text-foreground placeholder:text-muted-foreground"
            style={{ minHeight: '60px', maxHeight: '200px' }}
          />

          {/* Footer */}
          <div className="flex items-center justify-between px-3 pb-2">
            {/* Left side: Model, Thinking, Context */}
            <div className="flex items-center gap-1">
              {/* Model selector */}
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button
                    type="button"
                    className="flex items-center gap-1.5 px-2 py-1 text-xs font-medium text-muted-foreground hover:text-foreground rounded transition-colors"
                  >
                    <Sparkles className="h-3.5 w-3.5" />
                    <span>{getModelDisplayName(selectedModel)}</span>
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="start">
                  {AGENT_MODELS.map((model) => (
                    <DropdownMenuItem
                      key={model.id}
                      onClick={() => {
                        setSelectedModel(model.id)
                      }}
                      className={cn(selectedModel === model.id && 'bg-accent')}
                    >
                      <Sparkles className="h-3.5 w-3.5 mr-2" />
                      {model.name}
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuContent>
              </DropdownMenu>

              {/* Thinking toggle */}
              <button
                type="button"
                onClick={() => {
                  setThinkingEnabled(!thinkingEnabled)
                }}
                className={cn(
                  'flex items-center gap-1.5 px-2 py-1 text-xs font-medium rounded transition-colors',
                  thinkingEnabled
                    ? 'bg-[hsl(var(--destructive)/0.2)] text-[hsl(var(--destructive))]'
                    : 'text-muted-foreground hover:text-foreground'
                )}
              >
                <Brain className="h-3.5 w-3.5" />
                <span>Thinking</span>
              </button>

              {/* Plan mode toggle */}
              <button
                type="button"
                onClick={() => {
                  if (planMode.isActive) {
                    exitPlanMode()
                  } else {
                    enterPlanMode({ title: 'Plan Mode', steps: [] })
                  }
                }}
                className={cn(
                  'flex items-center justify-center size-7 rounded transition-colors',
                  planMode.isActive
                    ? 'bg-blue-500/20 text-blue-500'
                    : 'text-muted-foreground hover:text-foreground'
                )}
                title={planMode.isActive ? 'Exit plan mode' : 'Enter plan mode'}
              >
                <Map className="h-4 w-4" />
              </button>

              {/* Context stats popover */}
              <ContextStatsPopover />
            </div>

            {/* Right side: Add, Submit */}
            <div className="flex items-center gap-1">
              {/* Add attachment */}
              <button
                type="button"
                className="flex items-center justify-center size-7 text-muted-foreground hover:text-foreground rounded transition-colors"
                title="Add attachment"
              >
                <Plus className="h-4 w-4" />
              </button>

              {/* Submit button */}
              <button
                type="submit"
                disabled={isStreaming || !inputValue.trim()}
                className={cn(
                  'flex items-center justify-center size-7 rounded transition-colors',
                  isStreaming
                    ? 'bg-destructive text-destructive-foreground'
                    : inputValue.trim()
                      ? 'bg-foreground text-background hover:bg-foreground/90'
                      : 'bg-muted text-muted-foreground cursor-not-allowed'
                )}
                title={isStreaming ? 'Stop' : 'Send'}
              >
                {isStreaming ? (
                  <Square className="h-3 w-3 fill-current" />
                ) : (
                  <ArrowUp className="h-4 w-4" />
                )}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  )
}
