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
import { InputArea } from './InputArea'
import { PlanModeIndicator } from './PlanModeIndicator'
import { useNotifications } from '@/hooks/useNotifications'

interface AgentChatProps {
  worktreeId: string
  sessionId?: string
}

/**
 * Main agent chat component
 * Combines MessageList, InputArea, ModelSelector, and ContextMeter
 */
export function AgentChat({ worktreeId, sessionId: _sessionId }: AgentChatProps) {
  // TODO: Use sessionId to scope messages to specific session
  void _sessionId
  const setCurrentWorkspaceId = useSetAtom(currentWorkspaceIdAtom)
  const addMessage = useSetAtom(addMessageAtom)
  const updateMessage = useSetAtom(updateMessageAtom)
  const setIsStreaming = useSetAtom(isStreamingAtom)
  const selectedModel = useAtomValue(selectedModelAtom)
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
    setCurrentWorkspaceId(worktreeId)
    return () => {
      setCurrentWorkspaceId(null)
      // Clean up polling on unmount
      if (pollingRef.current) {
        clearInterval(pollingRef.current)
      }
    }
  }, [worktreeId, setCurrentWorkspaceId])

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

        // Process the event based on Claude stream-json format
        const event = msg.event

        // Handle assistant messages (streaming text content)
        if (event.type === 'assistant') {
          // Stream-json format: message has 'text' directly, not content array
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
          // Session complete - result contains final text if not already accumulated
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
            // Use accumulated text if available, otherwise use result
            const finalContent = accumulatedTextRef.current || resultText || 'Done'
            updateMessage({
              id: currentMessageIdRef.current,
              update: {
                content: finalContent,
                status: isError ? 'error' : 'complete',
              },
            })
          }
          
          // Stop polling
          if (pollingRef.current) {
            clearInterval(pollingRef.current)
            pollingRef.current = null
          }
          activeSessionRef.current = null
          setIsStreaming(false)
        } else if (event.type === 'tool_use') {
          // Tool call - append to accumulated text as indicator
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
          // Tool result - just update status indicator
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

      // Also check session status
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
      // Add user message
      addMessage({
        role: 'user',
        content,
        status: 'complete',
        model: selectedModel,
      })

      // Call sidecar to start Claude session
      setIsStreaming(true)
      accumulatedTextRef.current = ''
      messageIndexRef.current = 0

      try {
        // Create placeholder for assistant response with known ID for later updates
        const messageId = generateMessageId()
        currentMessageIdRef.current = messageId
        addMessage({
          id: messageId,
          role: 'assistant',
          content: '',
          status: 'streaming',
          model: selectedModel,
        })

        // Start Claude session
        const result = await rpcRequest<ClaudeStartResult>(
          RPC_METHODS.CLAUDE_START,
          {
            worktreeId,
            prompt: content,
          } satisfies ClaudeStartParams
        )

        activeSessionRef.current = result.sessionId

        // Start polling for messages
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
    [selectedModel, worktreeId, setIsStreaming, addMessage, pollMessages]
  )

  return (
    <div
      data-testid="agent-chat-container"
      className="h-full flex flex-col"
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

      {/* Input area */}
      <InputArea onSendMessage={(msg) => void handleSendMessage(msg)} />
    </div>
  )
}
