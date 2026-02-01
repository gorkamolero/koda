import { useEffect, useCallback, useRef } from 'react'
import { useSetAtom, useAtomValue } from 'jotai'
import {
  currentWorkspaceIdAtom,
  addMessageAtom,
  updateMessageAtom,
  isStreamingAtom,
  selectedModelAtom,
  generateMessageId,
  planModeAtom,
  exitPlanModeAtom,
  AGENT_MODELS,
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
import { ContextMeter } from '@/components/ContextMeter'
import { useNotifications } from '@/hooks/useNotifications'
import {
  PromptInput,
  PromptInputTextarea,
  PromptInputFooter,
  PromptInputTools,
  PromptInputSubmit,
  PromptInputSelect,
  PromptInputSelectTrigger,
  PromptInputSelectContent,
  PromptInputSelectItem,
  PromptInputSelectValue,
  PromptInputActionMenu,
  PromptInputActionMenuTrigger,
  PromptInputActionMenuContent,
  PromptInputActionAddAttachments,
  type PromptInputMessage,
} from '@/components/ai-elements/prompt-input'

interface AgentChatProps {
  workspaceId: string
  sessionId?: string
}

/**
 * Main agent chat component - Conductor-style layout
 * 
 * Structure:
 * ┌─────────────────────────────────────┐
 * │ Plan Mode Indicator (if active)    │
 * ├─────────────────────────────────────┤
 * │ Message List (virtuoso)            │
 * │                                    │
 * ├─────────────────────────────────────┤
 * │ Composer (ai-elements PromptInput) │
 * │ [+] [textarea] [model ▼] [context] │
 * └─────────────────────────────────────┘
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
  const exitPlanMode = useSetAtom(exitPlanModeAtom)
  const { showToast } = useNotifications()
  
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
        
        if (session && (session.status === 'completed' || session.status === 'error' || session.status === 'cancelled')) {
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
      addMessage({
        role: 'user',
        content,
        status: 'complete',
        model: selectedModel,
      })

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

        const result = await rpcRequest<ClaudeStartResult>(
          RPC_METHODS.CLAUDE_START,
          {
            workspaceId,
            prompt: content,
          } satisfies ClaudeStartParams
        )

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

  // Handle PromptInput submit
  const handleSubmit = useCallback(
    (message: PromptInputMessage) => {
      if (message.text.trim()) {
        void handleSendMessage(message.text)
      }
    },
    [handleSendMessage]
  )

  // Get chat status for submit button
  const chatStatus = isStreaming ? 'streaming' : undefined

  return (
    <div
      data-testid="agent-chat-container"
      className="h-full flex flex-col bg-background"
    >
      {/* Plan mode indicator */}
      <PlanModeIndicator
        isActive={planMode.isActive}
        planTitle={planMode.planTitle}
        steps={planMode.steps}
        currentStepIndex={planMode.currentStepIndex}
        onExitPlanMode={exitPlanMode}
      />

      {/* Message list */}
      <div className="flex-1 overflow-hidden">
        <MessageList />
      </div>

      {/* Conductor-style Composer */}
      <div className="px-4 pb-4 pt-2">
        <PromptInput
          onSubmit={handleSubmit}
          accept="image/*"
          multiple
          className="relative shadow-sm bg-[hsl(var(--composer-background))] focus-within:ring-0 focus-within:outline-none rounded-lg"
        >
          {/* Textarea */}
          <PromptInputTextarea
            placeholder="Ask to make changes, @mention files, run /commands"
            className="bg-transparent border-none focus:ring-0 resize-none"
            disabled={isStreaming}
          />

          {/* Footer with tools, model selector, and submit */}
          <PromptInputFooter className="px-3 pb-2">
            <PromptInputTools>
              {/* Attachments menu */}
              <PromptInputActionMenu>
                <PromptInputActionMenuTrigger />
                <PromptInputActionMenuContent>
                  <PromptInputActionAddAttachments />
                </PromptInputActionMenuContent>
              </PromptInputActionMenu>

              {/* Model selector */}
              <PromptInputSelect
                value={selectedModel}
                onValueChange={setSelectedModel}
              >
                <PromptInputSelectTrigger className="h-8 w-auto min-w-[120px] text-xs">
                  <PromptInputSelectValue placeholder="Select model" />
                </PromptInputSelectTrigger>
                <PromptInputSelectContent>
                  {AGENT_MODELS.map((model) => (
                    <PromptInputSelectItem key={model.id} value={model.id}>
                      {model.name}
                    </PromptInputSelectItem>
                  ))}
                </PromptInputSelectContent>
              </PromptInputSelect>
            </PromptInputTools>

            <div className="flex items-center gap-2">
              {/* Context meter */}
              <ContextMeter />

              {/* Submit button */}
              <PromptInputSubmit
                status={chatStatus}
                disabled={isStreaming}
              />
            </div>
          </PromptInputFooter>
        </PromptInput>
      </div>
    </div>
  )
}
