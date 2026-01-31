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
  type ClaudeMessageContent,
} from '@/lib/rpc'
import { MessageList } from './MessageList'
import { InputArea } from './InputArea'
import { ModelSelector } from './ModelSelector'
import { ContextMeter } from '@/components/ContextMeter'
import { useNotifications } from '@/hooks/useNotifications'

interface AgentChatProps {
  workspaceId: string
  sessionId?: string
}

/**
 * Main agent chat component
 * Combines MessageList, InputArea, ModelSelector, and ContextMeter
 */
export function AgentChat({ workspaceId, sessionId: _sessionId }: AgentChatProps) {
  // TODO: Use sessionId to scope messages to specific session
  void _sessionId
  const setCurrentWorkspaceId = useSetAtom(currentWorkspaceIdAtom)
  const addMessage = useSetAtom(addMessageAtom)
  const updateMessage = useSetAtom(updateMessageAtom)
  const setIsStreaming = useSetAtom(isStreamingAtom)
  const selectedModel = useAtomValue(selectedModelAtom)
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

        if (event.type === 'assistant' && event.message?.content) {
          // Extract text from content array (stream-json format)
          const textContent = event.message.content.find(
            (c: ClaudeMessageContent) => c.type === 'text'
          )
          if (textContent?.text) {
            accumulatedTextRef.current += textContent.text

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
          // Check for errors (billing, auth, etc.)
          if (event.is_error && event.result) {
            showToast({
              type: 'error',
              title: 'Agent Error',
              message: event.result ?? 'Unknown error',
            })
          }

          // Session complete
          if (currentMessageIdRef.current) {
            updateMessage({
              id: currentMessageIdRef.current,
              update: {
                content: accumulatedTextRef.current || (event.is_error ? '' : event.result) || 'Done',
                status: event.is_error ? 'error' : 'complete',
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
    [selectedModel, workspaceId, setIsStreaming, addMessage, pollMessages]
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
