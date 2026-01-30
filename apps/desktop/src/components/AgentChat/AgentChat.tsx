import { useEffect, useCallback, useRef } from 'react'
import { useSetAtom, useAtomValue } from 'jotai'
import {
  currentWorkspaceIdAtom,
  addMessageAtom,
  updateMessageAtom,
  isStreamingAtom,
  selectedModelAtom,
  generateMessageId,
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
import { ModelSelector } from './ModelSelector'
import { ContextMeter } from '@/components/ContextMeter'

interface AgentChatProps {
  workspaceId: string
  /** Optional mock mode for testing */
  mockMode?: boolean
}

/**
 * Main agent chat component
 * Combines MessageList, InputArea, ModelSelector, and ContextMeter
 */
export function AgentChat({ workspaceId, mockMode = false }: AgentChatProps) {
  const setCurrentWorkspaceId = useSetAtom(currentWorkspaceIdAtom)
  const addMessage = useSetAtom(addMessageAtom)
  const updateMessage = useSetAtom(updateMessageAtom)
  const setIsStreaming = useSetAtom(isStreamingAtom)
  const selectedModel = useAtomValue(selectedModelAtom)
  
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
      // Clean up polling on unmount
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
        
        // Process the event
        const event = msg.event
        
        if (event.type === 'assistant' && event.message?.text) {
          // Accumulate assistant text
          accumulatedTextRef.current += event.message.text
          
          if (currentMessageIdRef.current) {
            updateMessage({
              id: currentMessageIdRef.current,
              update: {
                content: accumulatedTextRef.current,
                status: 'streaming',
              },
            })
          }
        } else if (event.type === 'result') {
          // Session complete
          if (currentMessageIdRef.current) {
            updateMessage({
              id: currentMessageIdRef.current,
              update: {
                content: accumulatedTextRef.current || event.result || 'Done',
                status: 'complete',
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
  }, [updateMessage, setIsStreaming])

  const handleSendMessage = useCallback(
    async (content: string) => {
      // Add user message
      addMessage({
        role: 'user',
        content,
        status: 'complete',
        model: selectedModel,
      })

      if (mockMode) {
        // Mock mode for E2E tests
        setIsStreaming(true)

        const messageId = generateMessageId()
        currentMessageIdRef.current = messageId
        addMessage({
          role: 'assistant',
          content: '',
          status: 'streaming',
          model: selectedModel,
        })

        await new Promise((resolve) => setTimeout(resolve, 500))

        updateMessage({
          id: messageId,
          update: {
            content: 'Mock agent response',
            status: 'complete',
          },
        })

        setIsStreaming(false)
        return
      }

      // Real implementation - call sidecar
      setIsStreaming(true)
      accumulatedTextRef.current = ''
      messageIndexRef.current = 0

      try {
        // Create placeholder for assistant response
        const messageId = generateMessageId()
        currentMessageIdRef.current = messageId
        addMessage({
          role: 'assistant',
          content: '',
          status: 'streaming',
          model: selectedModel,
        })

        // Start Claude session
        const result = await rpcRequest<ClaudeStartResult>(
          RPC_METHODS.CLAUDE_START,
          {
            workspaceId,
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
    [mockMode, selectedModel, workspaceId, setIsStreaming, addMessage, updateMessage, pollMessages]
  )

  return (
    <div
      data-testid="agent-chat-container"
      className="h-full flex flex-col"
    >
      {/* Header with model selector and context meter */}
      <div className="flex items-center justify-between px-4 py-2 border-b border-border bg-background">
        <ModelSelector />
        <ContextMeter />
      </div>

      {/* Message list */}
      <div className="flex-1 overflow-hidden">
        <MessageList />
      </div>

      {/* Input area */}
      <InputArea onSendMessage={(msg) => void handleSendMessage(msg)} />
    </div>
  )
}
