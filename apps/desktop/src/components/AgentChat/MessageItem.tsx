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
            <h4 className="font-mono text-text-faint text-xs uppercase tracking-wide">
              [RESULT]
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
// MessageItem Component - Terminal aesthetic
// ============================================================================

export const MessageItem = memo(function MessageItem({
  message,
  turnIndex,
}: MessageItemProps) {
  const isUser = message.role === 'user'
  const isSystem = message.role === 'system'
  const isStreaming = message.status === 'streaming'
  const isError = message.status === 'error'
  const hasContentBlocks = message.contentBlocks && message.contentBlocks.length > 0

  // System messages - terminal style centered notice
  if (isSystem) {
    return (
      <div
        data-testid={`message-${message.id}`}
        data-turn-index={turnIndex}
        data-message-role="system"
        className="py-2 px-6 text-xs font-mono"
      >
        <div className="flex justify-center">
          <span className="text-text-faint">─── </span>
          <span className="text-text-muted">{message.content}</span>
          <span className="text-text-faint"> ───</span>
        </div>
      </div>
    )
  }

  // User messages - terminal prompt style with '>' prefix
  if (isUser) {
    return (
      <div
        data-testid={`message-${message.id}`}
        data-turn-index={turnIndex}
        data-message-role="user"
        className="py-3 px-6 font-mono"
      >
        {message.authorName && <div className="text-xs text-text-muted mb-1" data-testid="message-author">{message.authorName}</div>}
        <div className="flex gap-2 text-sm">
          <span className="text-text-accent flex-shrink-0">&gt;</span>
          <div className="text-text-primary whitespace-pre-wrap break-words">
            {message.content}
          </div>
        </div>
      </div>
    )
  }

  // Assistant messages - boxed response with KODA header
  return (
    <div
      data-testid={`message-${message.id}`}
      data-turn-index={turnIndex}
      data-message-role="assistant"
      data-message-status={message.status}
      className="py-3 px-6 font-mono text-xs"
    >
      {/* Tool call summary row */}
      {hasContentBlocks && message.contentBlocks && (
        <ToolCallSummary
          contentBlocks={message.contentBlocks}
          className="mb-2"
        />
      )}

      {/* Response box */}
      <div className={cn(
        "border border-dashed border-border-subtle",
        isError && "border-status-error/50"
      )}>
        {/* Header */}
        <div className="flex items-center justify-between px-3 py-1.5 border-b border-dashed border-border-subtle">
          <div className="flex items-center gap-2 text-text-faint">
            <span>┌─</span>
            <span className="text-text-accent">KODA</span>
            {isStreaming && (
              <span className="text-status-warning">[STREAMING]</span>
            )}
            {isError && (
              <span className="text-status-error">[ERROR]</span>
            )}
          </div>
          {message.model && (
            <span className="text-text-faint text-[10px]">
              {message.model.includes('opus') ? 'opus-4.5' : 
               message.model.includes('sonnet') ? 'sonnet-4' : 
               message.model.includes('haiku') ? 'haiku' : message.model}
            </span>
          )}
        </div>

        {/* Content */}
        <div className="px-4 py-3">
          <div className="prose prose-sm prose-invert prose-pre:bg-[#0a0a0a] prose-pre:border prose-pre:border-dashed prose-pre:border-border-subtle max-w-none">
            {hasContentBlocks && message.contentBlocks ? (
              <div className="space-y-3">
                {message.content && !message.contentBlocks.some(block => block.type === 'text') && (
                  <MessageResponse>{message.content}</MessageResponse>
                )}
                {message.contentBlocks.map((block, idx) => (
                  <div key={`${block.type}-${String(idx)}`}>
                    {renderContentBlock(block, message.contentBlocks ?? [], isStreaming)}
                  </div>
                ))}
              </div>
            ) : (
              <>
                {isStreaming && !message.content ? (
                  <div className="text-text-muted">
                    <span className="inline-block animate-pulse">█</span>
                  </div>
                ) : (
                  <MessageResponse>{message.content}</MessageResponse>
                )}
              </>
            )}
          </div>
        </div>

        {/* Footer with working indicator during streaming */}
        {isStreaming && (
          <div className="flex items-center justify-between px-3 py-1.5 border-t border-dashed border-border-subtle">
            <WorkingIndicator
              startTime={message.startTime ?? message.timestamp}
              className="text-xs"
            />
            <span className="text-text-faint">─┘</span>
          </div>
        )}

        {/* Closed footer when not streaming */}
        {!isStreaming && (
          <div className="px-3 py-1 text-text-faint">
            └{'─'.repeat(40)}┘
          </div>
        )}
      </div>
    </div>
  )
})
