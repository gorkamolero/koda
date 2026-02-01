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
  type MessageMention,
} from '@/store/chat'
import { rpcRequest, isTauriContext } from '@/lib/tauri'
import {
  RPC_METHODS,
  type ClaudeStartParams,
  type ClaudeStartResult,
} from '@/lib/rpc'
import { MessageList } from './MessageList'
import { InputArea } from './InputArea'
import { PlanModeIndicator } from './PlanModeIndicator'
import { useNotifications } from '@/hooks/useNotifications'

// Notification payload types
interface MessageNotificationPayload {
  sessionId: string
  event: {
    type: string
    message?: { content?: Array<{ type: string; text?: string }> }
    result?: string
    is_error?: boolean
    tool?: string
    [key: string]: unknown
  }
  timestamp: number
}

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
  
  // Track active session
  const activeSessionRef = useRef<string | null>(null)
  const currentMessageIdRef = useRef<string | null>(null)
  const accumulatedTextRef = useRef('')

  // Set current workspace when component mounts
  useEffect(() => {
    setCurrentWorkspaceId(worktreeId)
    return () => {
      setCurrentWorkspaceId(null)
    }
  }, [worktreeId, setCurrentWorkspaceId])

  // Process a streaming event (shared by notification listener)
  const processEvent = useCallback((event: MessageNotificationPayload['event'], sessionId: string) => {
    // Ignore events from other sessions
    if (activeSessionRef.current !== sessionId) return

    // Handle assistant messages (streaming text content)
    if (event.type === 'assistant') {
      const message = event.message
      if (message?.content) {
        for (const block of message.content) {
          if (block.type === 'text' && block.text) {
            accumulatedTextRef.current += block.text
          }
        }

        if (currentMessageIdRef.current && accumulatedTextRef.current) {
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
      // Session complete
      const resultText = event.result
      const isError = event.is_error

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

      activeSessionRef.current = null
      setIsStreaming(false)
    } else if (event.type === 'tool_use') {
      const toolName = event.tool ?? 'tool'
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
  }, [updateMessage, setIsStreaming, showToast])

  // Listen for streaming notifications from Tauri (real-time)
  useEffect(() => {
    if (!isTauriContext()) return

    let unlisten: (() => void) | undefined

    const setupListener = async () => {
      const { listen } = await import('@tauri-apps/api/event')

      // Listen for message notifications
      unlisten = await listen<MessageNotificationPayload>('sidecar-notification:message', (event) => {
        const { sessionId, event: streamEvent } = event.payload
        processEvent(streamEvent, sessionId)
      })
    }

    void setupListener()

    return () => {
      unlisten?.()
    }
  }, [processEvent])

  const handleSendMessage = useCallback(
    async (content: string, mentions?: MessageMention[]) => {
      // Add user message
      addMessage({
        role: 'user',
        content,
        status: 'complete',
        model: selectedModel,
        mentions,
      })

      // Call sidecar to start Claude session
      setIsStreaming(true)
      accumulatedTextRef.current = ''

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

        // Start Claude session - notifications will stream via Tauri events
        const result = await rpcRequest<ClaudeStartResult>(
          RPC_METHODS.CLAUDE_START,
          {
            workspaceId: worktreeId,
            prompt: content,
          } satisfies ClaudeStartParams
        )

        activeSessionRef.current = result.sessionId

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
    [selectedModel, worktreeId, setIsStreaming, addMessage]
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
