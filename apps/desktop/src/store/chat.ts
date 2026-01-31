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
  status?: 'pending' | 'running' | 'success' | 'error'
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
 * A single chat message
 */
export interface ChatMessage {
  id: string
  role: MessageRole
  content: string
  /** Structured content blocks for rich rendering */
  contentBlocks?: ContentBlock[]
  timestamp: number
  status: MessageStatus
  model?: AgentModel
  tokenCount?: number
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
    selectedModel: 'claude',
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
    return session?.selectedModel ?? 'claude'
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
