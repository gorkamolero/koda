import { memo } from 'react'
import { MessageBubble, ToolBlock as UIToolBlock, CodeBlock, Badge } from '@koda/ui'
import { CheckCircle, ChevronDown, Circle, Clock, Wrench, XCircle } from 'lucide-react'
import { useClipboard } from '@/hooks/useClipboard'
import type {
  ChatMessage,
  ContentBlock,
  ToolUseContentBlock,
  ToolResultContentBlock,
} from '@/store/chat'
import { ToolCallSummary } from './ToolCallSummary'
import { WorkingIndicator } from './WorkingIndicator'

import { MessageResponse } from './MessageResponse'
import { Reasoning, ReasoningTrigger, ReasoningContent } from './Reasoning'

// ============================================================================
// Types
// ============================================================================

interface MessageItemProps {
  message: ChatMessage
  turnIndex: number
  onAnswerQuestion?: (toolUseId: string, answers: (string | string[])[]) => void
}

/** The transcript owns tool payloads; the UI component owns disclosure chrome. */
function ToolBlock({ block, result }: { block: ToolUseContentBlock; result?: ToolResultContentBlock }): React.ReactElement {
  const { copy, isCopied } = useClipboard()
  const status = block.status === 'error' || block.status === 'cancelled' || result?.error || result?.isError ? 'failed' : result ? 'done' : 'running'
  const label = block.status === 'cancelled' ? 'Stopped' : status === 'failed' ? 'Error' : status === 'done' ? 'Completed' : block.status === 'pending' ? 'Pending' : 'Running'
  const Icon = block.status === 'pending' ? Circle : status === 'running' ? Clock : status === 'done' ? CheckCircle : XCircle
  const isCodeOutput = ['Read', 'Grep', 'Glob'].includes(block.name) && result?.output
  return <UIToolBlock
    tool={block.name}
    status={status}
    className="group not-prose mb-4 w-full rounded-md border-solid bg-transparent [&>button]:justify-between [&>button]:gap-4 [&>button]:p-3"
    bodyClassName="border-0 p-0"
    header={<><span className="flex items-center gap-2"><Wrench className="size-4 text-muted-foreground" /><span className="font-medium text-sm">{getToolTitle(block.name, block.input)}</span><Badge className="gap-1.5 rounded-full text-xs"><Icon className={`size-4 ${status === 'running' ? 'animate-pulse' : status === 'done' ? 'text-status-success' : 'text-status-error'}`} />{label}</Badge></span><ChevronDown className="size-4 text-muted-foreground transition-transform group-has-[button[aria-expanded=true]]:rotate-180" /></>}
  >
    <div className="space-y-2 overflow-hidden p-4"><h4 className="font-medium text-muted-foreground text-xs uppercase tracking-wide">Parameters</h4><CodeBlock code={JSON.stringify(block.input, null, 2)} language="json" onCopy={text => void copy(text)} copied={isCopied} /></div>
    {(result?.output || result?.error) && <div className="p-4 space-y-2"><h4 className="font-code text-text-faint text-xs uppercase tracking-wide">{result.error ? 'Error' : isCodeOutput ? '[RESULT]' : 'Result'}</h4>{result.error && <div className="bg-destructive/10 text-destructive">{result.error}</div>}<CodeBlock code={result.output ?? ''} language={isCodeOutput ? getLanguageFromTool(block.name, block.input) : 'json'} onCopy={text => void copy(text)} copied={isCopied} /></div>}
  </UIToolBlock>
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
      return <ToolBlock key={block.id} block={block} result={result} />
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

  if (isSystem || isUser) return <MessageBubble
    appearance="terminal"
    variant={isSystem ? 'system' : 'user'}
    author={message.authorName}
    data-testid={`message-${message.id}`}
    data-turn-index={turnIndex}
    data-message-role={message.role}
  >{message.content}</MessageBubble>

  return <MessageBubble
    appearance="terminal"
    variant="assistant"
    data-testid={`message-${message.id}`}
    data-turn-index={turnIndex}
    data-message-role="assistant"
    data-message-status={message.status}
    error={isError}
    summary={hasContentBlocks && message.contentBlocks ? <ToolCallSummary contentBlocks={message.contentBlocks} className="mb-2" /> : undefined}
    heading={<><div className="flex items-center gap-2 text-text-faint"><span>┌─</span><span className="text-text-accent">KODA</span>{isStreaming && <span className="text-status-warning">[STREAMING]</span>}{isError && <span className="text-status-error">[ERROR]</span>}</div>{message.model && <span className="text-text-faint text-2xs">{message.model.includes('opus') ? 'opus-4.5' : message.model.includes('sonnet') ? 'sonnet-4' : message.model.includes('haiku') ? 'haiku' : message.model}</span>}</>}
    footer={isStreaming ? <div className="flex items-center justify-between px-3 py-1.5 border-t border-dashed border-border-subtle"><WorkingIndicator startTime={message.startTime ?? message.timestamp} className="text-xs" /><span className="text-text-faint">─┘</span></div> : <div className="px-3 py-1 text-text-faint">└{'─'.repeat(40)}┘</div>}
  >
    <div className="prose prose-sm prose-invert prose-pre:bg-[var(--black-soft)] prose-pre:border prose-pre:border-dashed prose-pre:border-border-subtle max-w-none">
      {hasContentBlocks && message.contentBlocks ? <div className="space-y-3">
        {message.content && !message.contentBlocks.some(block => block.type === 'text') && <MessageResponse>{message.content}</MessageResponse>}
        {message.contentBlocks.map((block, index) => <div key={`${block.type}-${index}`}>{renderContentBlock(block, message.contentBlocks ?? [], isStreaming)}</div>)}
      </div> : isStreaming && !message.content ? <div className="text-text-muted"><span className="inline-block animate-pulse">█</span></div> : <MessageResponse>{message.content}</MessageResponse>}
    </div>
  </MessageBubble>
})
