import { cn } from '@/lib/utils'
import { X, Sparkles, Zap, Brain, Bot } from 'lucide-react'

// ============================================================================
// Model Configuration
// ============================================================================

interface ModelOption {
  id: string
  name: string
  description: string
  icon: React.ReactNode
  badge?: string
  badgeColor?: string
}

const AVAILABLE_MODELS: ModelOption[] = [
  {
    id: 'claude-sonnet-4-20250514',
    name: 'Claude Sonnet',
    description: 'Fast & capable',
    icon: <Zap className="w-4 h-4" />,
    badge: 'Default',
    badgeColor: 'bg-status-unread/20 text-status-unread',
  },
  {
    id: 'claude-opus-4-20250514',
    name: 'Claude Opus',
    description: 'Most capable',
    icon: <Sparkles className="w-4 h-4" />,
    badge: 'Pro',
    badgeColor: 'bg-purple-500/20 text-purple-400',
  },
  {
    id: 'codex',
    name: 'OpenAI Codex',
    description: 'Code specialist',
    icon: <Brain className="w-4 h-4" />,
  },
  {
    id: 'claude-haiku',
    name: 'Claude Haiku',
    description: 'Quick responses',
    icon: <Bot className="w-4 h-4" />,
    badge: 'Fast',
    badgeColor: 'bg-status-success/20 text-status-success',
  },
]

// ============================================================================
// NewSessionPicker Component
// ============================================================================

export interface NewSessionPickerProps {
  onSelect: (model: string) => void
  onCancel: () => void
}

export function NewSessionPicker({ onSelect, onCancel }: NewSessionPickerProps) {
  return (
    <div className="p-3">
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <span className="text-sm font-medium text-text-primary">New Session</span>
        <button
          onClick={onCancel}
          className="p-1 rounded hover:bg-surface-hover text-text-muted hover:text-text-primary transition-colors"
        >
          <X className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* Model options */}
      <div className="space-y-1">
        {AVAILABLE_MODELS.map((model) => (
          <button
            key={model.id}
            onClick={() => { onSelect(model.id) }}
            className={cn(
              'flex items-center gap-3 w-full px-3 py-2 rounded-md transition-colors text-left',
              'hover:bg-surface-hover group'
            )}
          >
            {/* Icon */}
            <div className="text-text-muted group-hover:text-text-primary transition-colors">
              {model.icon}
            </div>

            {/* Content */}
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium text-text-primary truncate">
                  {model.name}
                </span>
                {model.badge && (
                  <span className={cn('text-xs px-1.5 py-0.5 rounded', model.badgeColor)}>
                    {model.badge}
                  </span>
                )}
              </div>
              <span className="text-xs text-text-faint">
                {model.description}
              </span>
            </div>
          </button>
        ))}
      </div>

      {/* Quick action hint */}
      <p className="mt-3 text-xs text-text-faint text-center">
        Press <kbd className="px-1 py-0.5 rounded bg-surface-inset text-text-muted">Enter</kbd> to use default
      </p>
    </div>
  )
}
