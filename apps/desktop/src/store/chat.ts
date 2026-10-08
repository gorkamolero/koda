import { atom } from 'jotai'

/**
 * Available AI models for agent chat
 */
export type AgentModel = 'claude' | 'codex' | 'kimi'

export interface AgentModelOption {
  id: AgentModel
  name: string
  description: string
  contextLimit: number
}

export const AGENT_MODELS: AgentModelOption[] = [
  {
    id: 'claude',
    name: 'Claude Code',
    description: 'Anthropic Claude for code generation',
    contextLimit: 200000,
  },
  {
    id: 'codex',
    name: 'Codex',
    description: 'OpenAI Codex for code completion',
    contextLimit: 128000,
  },
  {
    id: 'kimi',
    name: 'Kimi Code',
    description: 'Moonshot Kimi for long context',
    contextLimit: 2000000,
  },
]

/**
 * Message role - who sent the message
 */
export type MessageRole = 'user' | 'assistant' | 'system'

/**
 * Message status for streaming support
 */
export type MessageStatus = 'pending' | 'streaming' | 'complete' | 'error'

/**
 * Content block types for rich message rendering
 */
export type ContentBlockType = 'text' | 'tool_use' | 'tool_result' | 'thinking'

/**
 * Base content block
 */
export interface BaseContentBlock {
  type: ContentBlockType
}

/**
 * Text content block
 */
export interface TextContentBlock extends BaseContentBlock {
  type: 'text'
  text: string
}

/**
 * Tool use content block (agent calling a tool)
 */
export interface ToolUseContentBlock extends BaseContentBlock {
  type: 'tool_use'
  id: string
  name: string
  input: Record<string, unknown>
  status?: 'pending' | 'running' | 'success' | 'error' | 'cancelled'
  durationMs?: number
}

/**
 * Tool result content block (tool response)
 */
export interface ToolResultContentBlock extends BaseContentBlock {
  type: 'tool_result'
  toolUseId: string
  toolName: string
  output?: string
  error?: string
  isError?: boolean
}

/**
 * Thinking content block (extended thinking)
 */
export interface ThinkingContentBlock extends BaseContentBlock {
  type: 'thinking'
  content: string
  durationMs?: number
}

/**
 * Union of all content block types
 */
export type ContentBlock =
  | TextContentBlock
  | ToolUseContentBlock
  | ToolResultContentBlock
  | ThinkingContentBlock

/**
 * A file mention in a message
 */
export interface MessageMention {
  path: string
  displayName: string
}

/**
 * A single chat message
 */
export interface ChatMessage {
  /** Shared-message author, persisted with the host transcript. */
  authorName?: string
  authorMachineId?: string
  id: string
  role: MessageRole
  content: string
  /** Structured content blocks for rich rendering */
  contentBlocks?: ContentBlock[]
  timestamp: number
  status: MessageStatus
  model?: AgentModel
  tokenCount?: number
  /** Time in ms from user request to response completion (assistant messages only) */
  responseTimeMs?: number
  /** File @mentions in this message */
  mentions?: MessageMention[]
  /** Start time for tracking elapsed time during streaming */
  startTime?: number
}

/**
 * Chat session state
 */
export interface ChatSession {
  workspaceId: string
  messages: ChatMessage[]
  selectedModel: AgentModel
  isStreaming: boolean
  inputValue: string
  totalTokens: number
}

/**
 * Initial chat session state
 */
function createInitialSession(workspaceId: string): ChatSession {
  return {
    workspaceId,
    messages: [],
    selectedModel: 'codex',
    isStreaming: false,
    inputValue: '',
    totalTokens: 0,
  }
}

/**
 * Map of workspace ID to chat session
 */
const chatSessionsAtom = atom<Map<string, ChatSession>>(new Map())

/**
 * Current workspace ID atom
 */
export const currentWorkspaceIdAtom = atom<string | null>(null)

/**
 * Current chat session atom (derived)
 */
export const currentChatSessionAtom = atom(
  (get) => {
    const workspaceId = get(currentWorkspaceIdAtom)
    if (!workspaceId) return null

    const sessions = get(chatSessionsAtom)
    return sessions.get(workspaceId) ?? createInitialSession(workspaceId)
  },
  (get, set, update: Partial<ChatSession>) => {
    const workspaceId = get(currentWorkspaceIdAtom)
    if (!workspaceId) return

    const sessions = get(chatSessionsAtom)
    const currentSession =
      sessions.get(workspaceId) ?? createInitialSession(workspaceId)

    const newSession = { ...currentSession, ...update }
    const newSessions = new Map(sessions)
    newSessions.set(workspaceId, newSession)

    set(chatSessionsAtom, newSessions)
  }
)

/**
 * Messages atom for current session (derived)
 */
export const messagesAtom = atom(
  (get) => {
    const session = get(currentChatSessionAtom)
    return session?.messages ?? []
  },
  (_get, set, messages: ChatMessage[]) => {
    const totalTokens = messages.reduce((sum, m) => sum + (m.tokenCount ?? 0), 0)
    set(currentChatSessionAtom, { messages, totalTokens })
  }
)

/**
 * Selected model atom (derived)
 */
export const selectedModelAtom = atom(
  (get) => {
    const session = get(currentChatSessionAtom)
    return session?.selectedModel ?? 'codex'
  },
  (_get, set, model: AgentModel) => {
    set(currentChatSessionAtom, { selectedModel: model })
  }
)

/**
 * Is streaming atom (derived)
 */
export const isStreamingAtom = atom(
  (get) => {
    const session = get(currentChatSessionAtom)
    return session?.isStreaming ?? false
  },
  (_get, set, isStreaming: boolean) => {
    set(currentChatSessionAtom, { isStreaming })
  }
)

/**
 * Input value atom (derived)
 */
export const inputValueAtom = atom(
  (get) => {
    const session = get(currentChatSessionAtom)
    return session?.inputValue ?? ''
  },
  (_get, set, inputValue: string) => {
    set(currentChatSessionAtom, { inputValue })
  }
)

/**
 * Total tokens atom (derived)
 */
export const totalTokensAtom = atom((get) => {
  const session = get(currentChatSessionAtom)
  return session?.totalTokens ?? 0
})

/**
 * Context limit for selected model
 */
export const contextLimitAtom = atom((get) => {
  const selectedModel = get(selectedModelAtom)
  const model = AGENT_MODELS.find((m) => m.id === selectedModel)
  return model?.contextLimit ?? 200000
})

/**
 * Context usage percentage
 */
export const contextUsagePercentAtom = atom((get) => {
  const totalTokens = get(totalTokensAtom)
  const contextLimit = get(contextLimitAtom)
  return Math.min((totalTokens / contextLimit) * 100, 100)
})

/**
 * Generate a unique message ID
 */
export function generateMessageId(): string {
  return `msg_${String(Date.now())}_${Math.random().toString(36).substring(2, 9)}`
}

/**
 * Estimate token count from text (rough approximation)
 * More accurate estimation would require a tokenizer
 */
export function estimateTokenCount(text: string): number {
  // Rough estimate: ~4 characters per token on average
  return Math.ceil(text.length / 4)
}

/**
 * Add message action atom
 * Accepts optional id to allow pre-generating IDs for later updates
 */
export const addMessageAtom = atom(
  null,
  (get, set, message: Omit<ChatMessage, 'id' | 'timestamp' | 'tokenCount'> & { id?: string }) => {
    const messages = get(messagesAtom)
    const newMessage: ChatMessage = {
      ...message,
      id: message.id ?? generateMessageId(),
      timestamp: Date.now(),
      tokenCount: estimateTokenCount(message.content),
    }
    set(messagesAtom, [...messages, newMessage])
    return newMessage
  }
)

/**
 * Clear all messages action atom
 */
export const clearMessagesAtom = atom(
  null,
  (_get, set) => {
    set(messagesAtom, [])
  }
)

/**
 * Update message action atom (for streaming updates)
 */
export const updateMessageAtom = atom(
  null,
  (
    get,
    set,
    { id, update }: { id: string; update: Partial<ChatMessage> }
  ) => {
    const messages = get(messagesAtom)
    const updatedMessages = messages.map((msg) =>
      msg.id === id
        ? {
            ...msg,
            ...update,
            tokenCount: update.content
              ? estimateTokenCount(update.content)
              : msg.tokenCount,
          }
        : msg
    )
    set(messagesAtom, updatedMessages)
  }
)

/**
 * Plan mode types
 */
export interface PlanStep {
  id: string
  title: string
  status: 'pending' | 'in_progress' | 'completed' | 'skipped'
  description?: string
}

export interface PlanModeState {
  isActive: boolean
  planTitle: string
  steps: PlanStep[]
  currentStepIndex: number
}

/**
 * Plan mode state atom
 */
export const planModeAtom = atom<PlanModeState>({
  isActive: false,
  planTitle: '',
  steps: [],
  currentStepIndex: 0,
})

/**
 * Enter plan mode action
 */
export const enterPlanModeAtom = atom(
  null,
  (_get, set, { title, steps }: { title: string; steps?: PlanStep[] }) => {
    set(planModeAtom, {
      isActive: true,
      planTitle: title,
      steps: steps ?? [],
      currentStepIndex: 0,
    })
  }
)

/**
 * Update plan step action
 */
export const updatePlanStepAtom = atom(
  null,
  (get, set, { stepId, status, description }: { stepId: string; status: PlanStep['status']; description?: string }) => {
    const state = get(planModeAtom)
    const steps = state.steps.map((step, index) => {
      if (step.id === stepId) {
        // If marking as in_progress, also update currentStepIndex
        if (status === 'in_progress') {
          set(planModeAtom, { ...state, currentStepIndex: index })
        }
        return { ...step, status, description: description ?? step.description }
      }
      return step
    })
    set(planModeAtom, { ...get(planModeAtom), steps })
  }
)

/**
 * Exit plan mode action
 */
export const exitPlanModeAtom = atom(
  null,
  (_get, set) => {
    set(planModeAtom, {
      isActive: false,
      planTitle: '',
      steps: [],
      currentStepIndex: 0,
    })
  }
)

// ============================================================================
// Message History & Undo/Split
// ============================================================================

/**
 * Message history for undo functionality
 * Stores snapshots of messages array for reverting
 */
export const messageHistoryAtom = atom<ChatMessage[][]>([])

/**
 * Maximum history entries to keep
 */
const MAX_HISTORY_ENTRIES = 50

/**
 * Push current messages to history (call before making changes)
 */
export const pushHistoryAtom = atom(
  null,
  (get, set) => {
    const messages = get(messagesAtom)
    const history = get(messageHistoryAtom)

    // Don't push if messages are empty
    if (messages.length === 0) return

    // Keep history bounded
    const newHistory = [...history, [...messages]].slice(-MAX_HISTORY_ENTRIES)
    set(messageHistoryAtom, newHistory)
  }
)

/**
 * Revert conversation to the state at a specific message
 * Removes all messages after the specified message
 */
export const revertToMessageAtom = atom(
  null,
  (get, set, messageId: string) => {
    const messages = get(messagesAtom)

    // Push current state to history before reverting
    set(pushHistoryAtom)

    // Find the message index
    const messageIndex = messages.findIndex(m => m.id === messageId)
    if (messageIndex === -1) return

    // Keep messages up to and including the target message
    const newMessages = messages.slice(0, messageIndex + 1)
    set(messagesAtom, newMessages)
  }
)

/**
 * Split/fork conversation at a specific message
 * Creates a new conversation branch starting from this point
 * For now, this just reverts to the message (full branching TBD)
 */
export const splitAtMessageAtom = atom(
  null,
  (get, set, messageId: string) => {
    const messages = get(messagesAtom)

    // Push current state to history
    set(pushHistoryAtom)

    // Find the message index
    const messageIndex = messages.findIndex(m => m.id === messageId)
    if (messageIndex === -1) return

    // For now, split behaves like revert
    // Full branching would require conversation tree support
    const newMessages = messages.slice(0, messageIndex + 1)
    set(messagesAtom, newMessages)

    // Could emit event for UI to show "forked from X" indicator
  }
)

/**
 * Undo last action (pop from history)
 */
export const undoLastActionAtom = atom(
  null,
  (get, set) => {
    const history = get(messageHistoryAtom)
    if (history.length === 0) return

    const previousState = history[history.length - 1]
    const newHistory = history.slice(0, -1)

    if (previousState) {
      set(messagesAtom, previousState)
    }
    set(messageHistoryAtom, newHistory)
  }
)

// ============================================================================
// Pending Prompt (for sending messages from other components)
// ============================================================================

/**
 * Pending prompt atom - when set, AgentChat will send this message
 * Used by components like RightSidebar to send commands to the agent
 */
export const pendingPromptAtom = atom<string | null>(null)

/**
 * Send a prompt to the agent from any component
 * Sets the pending prompt which AgentChat will pick up and process
 */
export const sendAgentPromptAtom = atom(
  null,
  (_get, set, prompt: string) => {
    set(pendingPromptAtom, prompt)
  }
)
