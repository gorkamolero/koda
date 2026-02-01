import { memo, useCallback, useMemo, useState } from 'react'
import { useAtom } from 'jotai'
import { messagesAtom, type ChatMessage } from '@/store/chat'
import {
  X,
  Clock,
  Search,
  MessageSquare,
  User,
  Trash2,
} from 'lucide-react'

// ============================================================================
// Types
// ============================================================================

interface ConversationHistoryDialogProps {
  isOpen: boolean
  onClose: () => void
}

interface ConversationEntry {
  id: string
  preview: string
  messageCount: number
  tokenCount: number
  timestamp: number
  messages: ChatMessage[]
}

// ============================================================================
// Helpers
// ============================================================================

function formatTimeAgo(timestamp: number): string {
  const now = Date.now()
  const diff = now - timestamp

  if (diff < 60000) return 'just now'
  if (diff < 3600000) return `${String(Math.floor(diff / 60000))}m ago`
  if (diff < 86400000) return `${String(Math.floor(diff / 3600000))}h ago`
  if (diff < 604800000) return `${String(Math.floor(diff / 86400000))}d ago`

  return new Date(timestamp).toLocaleDateString()
}

function formatDate(timestamp: number): string {
  const date = new Date(timestamp)
  const now = new Date()
  const yesterday = new Date(now)
  yesterday.setDate(yesterday.getDate() - 1)

  if (date.toDateString() === now.toDateString()) return 'Today'
  if (date.toDateString() === yesterday.toDateString()) return 'Yesterday'

  return date.toLocaleDateString(undefined, {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  })
}

function groupByDate(entries: ConversationEntry[]): Map<string, ConversationEntry[]> {
  const groups = new Map<string, ConversationEntry[]>()

  for (const entry of entries) {
    const dateKey = formatDate(entry.timestamp)
    const existing = groups.get(dateKey) ?? []
    existing.push(entry)
    groups.set(dateKey, existing)
  }

  return groups
}

// ============================================================================
// ConversationHistoryDialog Component
// ============================================================================

export const ConversationHistoryDialog = memo(function ConversationHistoryDialog({
  isOpen,
  onClose,
}: ConversationHistoryDialogProps) {
  const [messages, setMessages] = useAtom(messagesAtom)
  const [searchQuery, setSearchQuery] = useState('')

  // Create a single "current conversation" entry from messages
  // In a full implementation, this would show saved conversations from storage
  const conversations = useMemo((): ConversationEntry[] => {
    if (messages.length === 0) return []

    // Get first user message as preview
    const firstUserMessage = messages.find(m => m.role === 'user')
    const preview = firstUserMessage?.content.slice(0, 100) ?? 'Empty conversation'

    const totalTokens = messages.reduce((sum, m) => sum + (m.tokenCount ?? 0), 0)

    return [{
      id: 'current',
      preview,
      messageCount: messages.length,
      tokenCount: totalTokens,
      timestamp: messages[0]?.timestamp ?? Date.now(),
      messages,
    }]
  }, [messages])

  // Filter conversations by search query
  const filteredConversations = useMemo(() => {
    if (!searchQuery.trim()) return conversations

    const query = searchQuery.toLowerCase()
    return conversations.filter(c =>
      c.preview.toLowerCase().includes(query) ||
      c.messages.some(m => m.content.toLowerCase().includes(query))
    )
  }, [conversations, searchQuery])

  // Group by date
  const groupedConversations = useMemo(
    () => groupByDate(filteredConversations),
    [filteredConversations]
  )

  const handleClearHistory = useCallback(() => {
    if (window.confirm('Are you sure you want to clear all conversation history?')) {
      setMessages([])
      onClose()
    }
  }, [setMessages, onClose])

  const handleLoadConversation = useCallback((_entry: ConversationEntry) => {
    // In full implementation, this would load saved conversation
    onClose()
  }, [onClose])

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/50 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Dialog */}
      <div className="relative w-full max-w-lg max-h-[80vh] bg-surface-base border border-border rounded-xl shadow-2xl flex flex-col overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-border-subtle">
          <div className="flex items-center gap-2">
            <Clock className="w-4 h-4 text-text-muted" />
            <h2 className="text-sm font-semibold text-text-primary">
              Conversation History
            </h2>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded hover:bg-surface-hover text-text-muted hover:text-text-primary transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Search */}
        <div className="px-4 py-2 border-b border-border-subtle">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-text-dim" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => { setSearchQuery(e.target.value) }}
              placeholder="Search conversations..."
              className="w-full pl-9 pr-3 py-2 text-sm bg-surface-control border border-border-subtle rounded-lg focus:outline-none focus:border-border-accent text-text-primary placeholder:text-text-dim"
            />
          </div>
        </div>

        {/* Conversations list */}
        <div className="flex-1 overflow-y-auto">
          {filteredConversations.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <MessageSquare className="w-8 h-8 text-text-dim mb-3" />
              <p className="text-sm text-text-muted">No conversations found</p>
              <p className="text-xs text-text-faint mt-1">
                {searchQuery ? 'Try a different search term' : 'Start a conversation to see it here'}
              </p>
            </div>
          ) : (
            Array.from(groupedConversations.entries()).map(([dateLabel, entries]) => (
              <div key={dateLabel}>
                {/* Date header */}
                <div className="px-4 py-2 text-xs font-medium text-text-faint bg-surface-card/50">
                  {dateLabel}
                </div>

                {/* Entries */}
                {entries.map(entry => (
                  <button
                    key={entry.id}
                    onClick={() => { handleLoadConversation(entry) }}
                    className="w-full flex items-start gap-3 px-4 py-3 text-left hover:bg-surface-hover transition-colors border-b border-border-subtle/50"
                  >
                    <div className="flex-shrink-0 w-8 h-8 rounded-full bg-surface-card flex items-center justify-center">
                      <User className="w-4 h-4 text-text-muted" />
                    </div>

                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-text-primary line-clamp-2">
                        {entry.preview}
                      </p>

                      <div className="flex items-center gap-3 mt-1.5 text-xs text-text-faint">
                        <span className="flex items-center gap-1">
                          <MessageSquare className="w-3 h-3" />
                          {entry.messageCount} messages
                        </span>
                        <span>~{entry.tokenCount.toLocaleString()} tokens</span>
                        <span>{formatTimeAgo(entry.timestamp)}</span>
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            ))
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-4 py-3 border-t border-border-subtle bg-surface-card/30">
          <span className="text-xs text-text-faint">
            {filteredConversations.length} conversation{filteredConversations.length !== 1 ? 's' : ''}
          </span>

          <button
            onClick={handleClearHistory}
            className="flex items-center gap-1.5 px-2 py-1 text-xs text-status-error hover:bg-status-error/10 rounded transition-colors"
          >
            <Trash2 className="w-3 h-3" />
            Clear all
          </button>
        </div>
      </div>
    </div>
  )
})
