import { memo } from 'react'
import { cn } from '@/lib/utils'
import type {
  ChatMessage,
  ContentBlock,
  ToolUseContentBlock,
  ToolResultContentBlock,
} from '@/store/chat'
import { Bot, Terminal } from 'lucide-react'

// AI Elements imports
import { Message, MessageContent, MessageResponse } from '@/components/ai-elements/message'
import { Tool, ToolHeader, ToolContent, ToolInput, ToolOutput } from '@/components/ai-elements/tool'
import { Reasoning, ReasoningTrigger, ReasoningContent } from '@/components/ai-elements/reasoning'
import { CodeBlock } from '@/components/ai-elements/code-block'
import type { BundledLanguage } from 'shiki'
import { Shimmer } from '@/components/ai-elements/shimmer'

// ============================================================================
// Types
// ============================================================================

interface MessageItemProps {
  message: ChatMessage
  onAnswerQuestion?: (toolUseId: string, answers: (string | string[])[]) => void
}

// Map our status to AI Elements tool state
type AIElementsToolState = 'input-streaming' | 'input-available' | 'output-available' | 'output-error' | 'output-denied'

function mapStatusToToolState(status?: string, hasResult?: boolean): AIElementsToolState {
  if (status === 'pending') return 'input-streaming'
  if (status === 'running') return 'input-available'
  if (status === 'error') return 'output-error'
  if (hasResult) return 'output-available'
  return 'input-available'
}

// ============================================================================
// Tool Block Renderer (using AI Elements)
// ============================================================================

function renderToolBlock(
  block: ToolUseContentBlock,
  result?: ToolResultContentBlock
): React.ReactNode {
  const toolState = mapStatusToToolState(block.status, !!result)
  const toolName = block.name

  // For code-related tools, show syntax-highlighted output
  const isCodeOutput = ['Read', 'Grep', 'Glob'].includes(toolName) && result?.output

  return (
    <Tool key={block.id} defaultOpen={toolState !== 'output-available'}>
      <ToolHeader
        type="dynamic-tool"
        toolName={toolName}
        state={toolState}
        title={getToolTitle(toolName, block.input)}
      />
      <ToolContent>
        <ToolInput input={block.input} />
        {isCodeOutput ? (
          <div className="p-4 space-y-2">
            <h4 className="font-medium text-muted-foreground text-xs uppercase tracking-wide">
              Result
            </h4>
            <CodeBlock
              code={result?.output ?? ''}
              language={getLanguageFromTool(toolName, block.input) as BundledLanguage}
            />
          </div>
        ) : (
          <ToolOutput
            output={result?.output}
            errorText={result?.error}
          />
        )}
      </ToolContent>
    </Tool>
  )
}

// Helper to generate a friendly title for the tool
function getToolTitle(toolName: string, input: Record<string, unknown>): string {
  switch (toolName) {
    case 'Bash':
      return String(input.description ?? input.command ?? 'Execute command').slice(0, 50)
    case 'Read':
      return `Read ${getFileName(String(input.file_path ?? input.path ?? ''))}`
    case 'Edit':
    case 'Write':
      return `${toolName} ${getFileName(String(input.file_path ?? input.path ?? ''))}`
    case 'Glob':
      return `Find ${String(input.pattern ?? '')}`
    case 'Grep':
      return `Search: ${String(input.pattern ?? '').slice(0, 30)}`
    case 'WebFetch':
      return `Fetch ${String(input.url ?? '').slice(0, 40)}`
    case 'WebSearch':
      return `Search: ${String(input.query ?? '').slice(0, 30)}`
    case 'Task':
      return String(input.description ?? 'Run agent')
    default:
      return toolName
  }
}

function getFileName(path: string): string {
  return path.split('/').pop() ?? path
}

// Returns a language string for Shiki - cast to BundledLanguage at call site
function getLanguageFromTool(toolName: string, input: Record<string, unknown>): string {
  if (toolName === 'Grep' || toolName === 'Glob') return 'text'
  const path = String(input.file_path ?? input.path ?? '')
  const ext = path.split('.').pop()?.toLowerCase()
  const langMap: Record<string, string> = {
    ts: 'typescript', tsx: 'tsx', js: 'javascript', jsx: 'jsx',
    json: 'json', py: 'python', rs: 'rust', go: 'go',
    md: 'markdown', sh: 'bash', bash: 'bash', css: 'css',
    scss: 'scss', html: 'html', sql: 'sql', yaml: 'yaml', yml: 'yaml',
  }
  return langMap[ext ?? ''] ?? 'text'
}

// ============================================================================
// Content Block Renderer
// ============================================================================

function renderContentBlock(
  block: ContentBlock,
  allBlocks: ContentBlock[],
  isStreaming: boolean
): React.ReactNode {
  switch (block.type) {
    case 'text':
      return (
        <MessageResponse key={`text-${block.text.slice(0, 20)}`}>
          {block.text}
        </MessageResponse>
      )

    case 'tool_use': {
      const result = allBlocks.find(
        (b): b is ToolResultContentBlock =>
          b.type === 'tool_result' && b.toolUseId === block.id
      )
      return renderToolBlock(block, result)
    }

    case 'tool_result':
      // Rendered with tool_use block
      return null

    case 'thinking':
      return (
        <Reasoning
          key={`thinking-${block.content.slice(0, 20)}`}
          isStreaming={isStreaming}
          duration={block.durationMs ? Math.ceil(block.durationMs / 1000) : undefined}
        >
          <ReasoningTrigger />
          <ReasoningContent>{block.content}</ReasoningContent>
        </Reasoning>
      )

    default:
      return null
  }
}

// ============================================================================
// MessageItem Component
// ============================================================================

export const MessageItem = memo(function MessageItem({
  message,
  onAnswerQuestion: _onAnswerQuestion,
}: MessageItemProps) {
  const isUser = message.role === 'user'
  const isSystem = message.role === 'system'
  const isStreaming = message.status === 'streaming'
  const isError = message.status === 'error'

  const hasContentBlocks = message.contentBlocks && message.contentBlocks.length > 0

  // Use AI Elements Message for structure
  return (
    <div
      data-testid={`message-${message.id}`}
      data-role={message.role}
      data-status={message.status}
      className="px-4 py-4"
    >
      <Message from={isUser ? 'user' : isSystem ? 'system' : 'assistant'}>
        {/* Avatar for assistant */}
        {!isUser && !isSystem && (
          <div className="flex items-start gap-3">
            <div className="flex-shrink-0 w-8 h-8 rounded-full bg-surface-card-strong flex items-center justify-center">
              <Bot className="w-4 h-4 text-muted-foreground" />
            </div>
            <div className="flex-1 min-w-0">
              {/* Header */}
              <div className="flex items-center gap-2 mb-1.5">
                <span className="text-sm font-medium">Agent</span>
                {message.model && (
                  <span className="text-xs text-muted-foreground bg-muted px-1.5 py-0.5 rounded">
                    {message.model}
                  </span>
                )}
                <span className="text-xs text-muted-foreground">
                  {formatTimestamp(message.timestamp)}
                </span>
              </div>

              {/* Content */}
              <MessageContent className={cn(isError && 'border-l-2 border-destructive pl-3')}>
                {hasContentBlocks ? (
                  <div className="space-y-3">
                    {message.contentBlocks!.map((block, idx) => (
                      <div key={`${block.type}-${String(idx)}`}>
                        {renderContentBlock(block, message.contentBlocks!, isStreaming)}
                      </div>
                    ))}
                  </div>
                ) : (
                  <>
                    {isStreaming ? (
                      <Shimmer duration={1.5}>{message.content || 'Thinking...'}</Shimmer>
                    ) : (
                      <MessageResponse>{message.content}</MessageResponse>
                    )}
                  </>
                )}

                {/* Error indicator */}
                {isError && !hasContentBlocks && (
                  <div className="mt-2 text-xs text-destructive flex items-center gap-1.5">
                    Failed to generate response
                  </div>
                )}
              </MessageContent>

              {/* Token count */}
              {message.tokenCount !== undefined && message.tokenCount > 0 && (
                <div className="mt-1.5 text-xs text-muted-foreground">
                  ~{message.tokenCount.toLocaleString()} tokens
                </div>
              )}
            </div>
          </div>
        )}

        {/* User message */}
        {isUser && (
          <MessageContent>
            <MessageResponse>{message.content}</MessageResponse>
            <div className="mt-1 text-xs text-muted-foreground/70 text-right">
              {formatTimestamp(message.timestamp)}
            </div>
          </MessageContent>
        )}

        {/* System message */}
        {isSystem && (
          <div className="flex items-center justify-center">
            <MessageContent className="bg-muted px-4 py-2 rounded-lg text-center">
              <div className="flex items-center justify-center gap-2 mb-1">
                <Terminal className="w-3.5 h-3.5 text-muted-foreground" />
                <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                  System
                </span>
              </div>
              <p className="text-xs text-muted-foreground">{message.content}</p>
            </MessageContent>
          </div>
        )}
      </Message>
    </div>
  )
})

// ============================================================================
// Helpers
// ============================================================================

function formatTimestamp(timestamp: number): string {
  const date = new Date(timestamp)
  return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
}
