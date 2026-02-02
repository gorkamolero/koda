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
  pendingPromptAtom,
  type MessageMention,
  type ContentBlock,
  type ToolUseContentBlock,
  type ToolResultContentBlock,
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
    tool_id?: string
    tool_use_id?: string
    input?: Record<string, unknown>
    output?: string
    error?: string
    text?: string  // For text_delta events
    [key: string]: unknown
  }
  timestamp: number
}

interface AgentChatProps {
  worktreeId: string
  sessionId?: string
  workingDirectory?: string
}

/**
 * Main agent chat component
 * Combines MessageList, InputArea, ModelSelector, and ContextMeter
 */
export function AgentChat({ worktreeId, sessionId: _sessionId, workingDirectory }: AgentChatProps) {
  // TODO: Use sessionId to scope messages to specific session
  void _sessionId
  const setCurrentWorkspaceId = useSetAtom(currentWorkspaceIdAtom)
  const addMessage = useSetAtom(addMessageAtom)
  const updateMessage = useSetAtom(updateMessageAtom)
  const setIsStreaming = useSetAtom(isStreamingAtom)
  const selectedModel = useAtomValue(selectedModelAtom)
  const planMode = useAtomValue(planModeAtom)
  const exitPlanMode = useSetAtom(exitPlanModeAtom)
  const pendingPrompt = useAtomValue(pendingPromptAtom)
  const setPendingPrompt = useSetAtom(pendingPromptAtom)
  const { showToast } = useNotifications()
  
  // Track active session
  const activeSessionRef = useRef<string | null>(null)
  const currentMessageIdRef = useRef<string | null>(null)
  const accumulatedTextRef = useRef('')
  const contentBlocksRef = useRef<ContentBlock[]>([])

  // Set current workspace when component mounts
  useEffect(() => {
    setCurrentWorkspaceId(worktreeId)
    return () => {
      setCurrentWorkspaceId(null)
    }
  }, [worktreeId, setCurrentWorkspaceId])

  // Debug counter for tracking duplicate events
  const eventCounterRef = useRef(0)

  // Process a streaming event (shared by notification listener)
  const processEvent = useCallback((event: MessageNotificationPayload['event'], sessionId: string) => {
    // Debug: log all incoming events with counter
    eventCounterRef.current++
    console.log(`[AgentChat] Event #${eventCounterRef.current}:`, event.type, 'text_delta' in event ? (event as { text?: string }).text?.substring(0, 20) : '')

    // Ignore events from other sessions
    if (activeSessionRef.current !== sessionId) return

    // Handle streaming text deltas (real-time character-by-character streaming)
    if (event.type === 'text_delta') {
      const deltaText = event.text
      if (deltaText) {
        accumulatedTextRef.current += deltaText
        if (currentMessageIdRef.current) {
          updateMessage({
            id: currentMessageIdRef.current,
            update: {
              content: accumulatedTextRef.current,
              status: 'streaming',
              contentBlocks: contentBlocksRef.current.length > 0 ? [...contentBlocksRef.current] : undefined,
            },
          })
        }
      }
    } else if (event.type === 'assistant') {
      // Complete assistant messages arrive after streaming is done
      // Only use them if we haven't received any text_delta events (fallback mode)
      if (!accumulatedTextRef.current) {
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
                contentBlocks: contentBlocksRef.current.length > 0 ? [...contentBlocksRef.current] : undefined,
              },
            })
          }
        }
      }
      // Otherwise ignore - we already have the text from text_delta events
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
            contentBlocks: contentBlocksRef.current.length > 0 ? [...contentBlocksRef.current] : undefined,
          },
        })
      }

      activeSessionRef.current = null
      contentBlocksRef.current = []
      setIsStreaming(false)
    } else if (event.type === 'tool_use') {
      const toolName = event.tool ?? 'tool'
      const toolId = event.tool_id ?? `tool-${Date.now()}`
      const toolInput = event.input ?? {}
      
      // Create tool_use content block
      const toolUseBlock: ToolUseContentBlock = {
        type: 'tool_use',
        id: toolId,
        name: toolName,
        input: toolInput,
        status: 'running',
      }
      contentBlocksRef.current = [...contentBlocksRef.current, toolUseBlock]
      
      if (currentMessageIdRef.current) {
        updateMessage({
          id: currentMessageIdRef.current,
          update: {
            content: accumulatedTextRef.current || `Using ${toolName}...`,
            status: 'streaming',
            contentBlocks: [...contentBlocksRef.current],
          },
        })
      }
    } else if (event.type === 'tool_result') {
      const toolUseId = event.tool_use_id ?? ''
      const toolOutput = event.output ?? event.result ?? ''
      const toolError = event.error
      const toolName = event.tool ?? 'tool'
      
      // Update the corresponding tool_use block status
      contentBlocksRef.current = contentBlocksRef.current.map(block => {
        if (block.type === 'tool_use' && block.id === toolUseId) {
          return { ...block, status: toolError ? 'error' : 'complete' } as ToolUseContentBlock
        }
        return block
      })
      
      // Create tool_result content block
      const toolResultBlock: ToolResultContentBlock = {
        type: 'tool_result',
        toolUseId,
        toolName,
        output: typeof toolOutput === 'string' ? toolOutput : JSON.stringify(toolOutput),
        error: toolError,
      }
      contentBlocksRef.current = [...contentBlocksRef.current, toolResultBlock]
      
      if (currentMessageIdRef.current) {
        updateMessage({
          id: currentMessageIdRef.current,
          update: {
            content: accumulatedTextRef.current || 'Processing...',
            status: 'streaming',
            contentBlocks: [...contentBlocksRef.current],
          },
        })
      }
    }
  }, [updateMessage, setIsStreaming, showToast])

  // Listen for streaming notifications from Tauri (real-time)
  useEffect(() => {
    if (!isTauriContext()) return

    let unlisten: (() => void) | undefined
    let mounted = true

    const setupListener = async () => {
      const { listen } = await import('@tauri-apps/api/event')

      // Check if still mounted (handles React StrictMode double-invoke)
      if (!mounted) return

      // Listen for message notifications
      unlisten = await listen<MessageNotificationPayload>('sidecar-notification:message', (event) => {
        const { sessionId, event: streamEvent } = event.payload
        processEvent(streamEvent, sessionId)
      })
    }

    void setupListener()

    return () => {
      mounted = false
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
      contentBlocksRef.current = []

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
            options: workingDirectory ? { workingDirectory } : undefined,
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
    [selectedModel, worktreeId, workingDirectory, setIsStreaming, addMessage]
  )

  // Process pending prompts from other components (e.g., PR buttons)
  useEffect(() => {
    if (pendingPrompt) {
      void handleSendMessage(pendingPrompt)
      setPendingPrompt(null)
    }
  }, [pendingPrompt, handleSendMessage, setPendingPrompt])

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
