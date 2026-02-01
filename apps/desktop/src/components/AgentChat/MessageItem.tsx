import { memo } from 'react'
import { cn } from '@/lib/utils'
import type {
  ChatMessage,
  ContentBlock,
  ToolUseContentBlock,
  ToolResultContentBlock,
} from '@/store/chat'
import { ToolCallSummary } from './ToolCallSummary'
import { WorkingIndicator } from './WorkingIndicator'

// AI Elements imports
import { MessageResponse } from '@/components/ai-elements/message'
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
  turnIndex: number
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
// Tool Block Renderer
// ============================================================================

function renderToolBlock(
  block: ToolUseContentBlock,
  result?: ToolResultContentBlock
): React.ReactNode {
  const toolState = mapStatusToToolState(block.status, !!result)
  const toolName = block.name
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

function safeStr(value: unknown, fallback = ''): string {
  if (value === null || value === undefined) return fallback
  if (typeof value === 'string') return value
  if (typeof value === 'number' || typeof value === 'boolean') return String(value)
  return fallback
}

function getToolTitle(toolName: string, input: Record<string, unknown>): string {
  switch (toolName) {
    case 'Bash':
      return safeStr(input.description ?? input.command, 'Execute command').slice(0, 50)
    case 'Read':
      return `Read ${getFileName(safeStr(input.file_path ?? input.path))}`
    case 'Edit':
    case 'Write':
      return `${toolName} ${getFileName(safeStr(input.file_path ?? input.path))}`
    case 'Glob':
      return `Find ${safeStr(input.pattern)}`
    case 'Grep':
      return `Search: ${safeStr(input.pattern).slice(0, 30)}`
    case 'WebFetch':
      return `Fetch ${safeStr(input.url).slice(0, 40)}`
    case 'WebSearch':
      return `Search: ${safeStr(input.query).slice(0, 30)}`
    case 'Task':
      return safeStr(input.description, 'Run agent')
    default:
      return toolName
  }
}

function getFileName(path: string): string {
  return path.split('/').pop() ?? path
}

function getLanguageFromTool(toolName: string, input: Record<string, unknown>): string {
  if (toolName === 'Grep' || toolName === 'Glob') return 'text'
  const path = safeStr(input.file_path ?? input.path)
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
// MessageItem Component - Conductor-style clean layout
// ============================================================================

export const MessageItem = memo(function MessageItem({
  message,
  turnIndex,
  onAnswerQuestion: _onAnswerQuestion,
}: MessageItemProps) {
  const isUser = message.role === 'user'
  const isSystem = message.role === 'system'
  const isStreaming = message.status === 'streaming'
  const isError = message.status === 'error'
  const hasContentBlocks = message.contentBlocks && message.contentBlocks.length > 0

  // System messages - centered, minimal
  if (isSystem) {
    return (
      <div
        data-testid={`message-${message.id}`}
        data-turn-index={turnIndex}
        className="pb-3 max-w-6xl mx-auto scroll-mt-24"
      >
        <div className="flex justify-center px-7 py-2">
          <div className="text-xs text-muted-foreground bg-muted/50 px-3 py-1.5 rounded-full">
            {message.content}
          </div>
        </div>
      </div>
    )
  }

  // User messages - right-aligned with highlight background
  if (isUser) {
    return (
      <div
        data-testid={`message-${message.id}`}
        data-turn-index={turnIndex}
        className="pb-3 max-w-6xl mx-auto scroll-mt-24"
      >
        <div className="flex flex-col gap-1 w-full px-7 py-2">
          <div className="flex justify-end">
            <div className="relative min-w-0 max-w-full">
              <div className="max-w-xl lg:max-w-3xl p-3 rounded px-4 break-words overflow-hidden bg-accent/50 text-foreground">
                <MessageResponse>{message.content}</MessageResponse>
              </div>
            </div>
          </div>
        </div>
      </div>
    )
  }

  // Assistant messages - left-aligned, no avatar, clean
  return (
    <div
      data-testid={`message-${message.id}`}
      data-turn-index={turnIndex}
      className="pb-3 max-w-6xl mx-auto scroll-mt-24"
    >
      <div className="flex flex-col gap-1 w-full px-7 py-2">
        {/* Tool call summary if present */}
        {hasContentBlocks && message.contentBlocks && (
          <ToolCallSummary
            contentBlocks={message.contentBlocks}
            className="mb-2"
          />
        )}

        {/* Main content */}
        <div className={cn("min-w-0", isError && "border-l-2 border-destructive pl-3")}>
          {hasContentBlocks && message.contentBlocks ? (
            <div className="space-y-3">
              {message.contentBlocks.map((block, idx) => (
                <div key={`${block.type}-${String(idx)}`}>
                  {renderContentBlock(block, message.contentBlocks ?? [], isStreaming)}
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
            <div className="mt-2 text-xs text-destructive">
              Failed to generate response
            </div>
          )}
        </div>

        {/* Working indicator during streaming */}
        {isStreaming && (
          <WorkingIndicator
            startTime={message.startTime ?? message.timestamp}
            className="mt-2"
          />
        )}
      </div>
    </div>
  )
})
