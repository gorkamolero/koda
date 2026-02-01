import { useState, useRef } from 'react'
import { useAtom } from 'jotai'
import { cn } from '@/lib/utils'
import { selectedModelAtom, AGENT_MODELS, type AgentModel } from '@/store/chat'
import { useClickOutside } from '@/hooks/useClickOutside'
import { ChevronDown, Check, Sparkles } from 'lucide-react'

/**
 * Dropdown selector for choosing the AI model.
 */
export function ModelSelector(): React.ReactElement {
  const [selectedModel, setSelectedModel] = useAtom(selectedModelAtom)
  const [isOpen, setIsOpen] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)

  const currentModel = AGENT_MODELS.find((m) => m.id === selectedModel)

  useClickOutside(containerRef, {
    onClickOutside: () => { setIsOpen(false) },
    onEscape: () => { setIsOpen(false) },
    enabled: isOpen,
  })

  function handleSelect(modelId: AgentModel): void {
    setSelectedModel(modelId)
    setIsOpen(false)
  }

  return (
    <div ref={containerRef} className="relative">
      <button
        data-testid="model-selector"
        onClick={() => { setIsOpen(!isOpen) }}
        className={cn(
          'inline-flex items-center justify-between gap-2',
          'px-3 py-1.5 rounded-lg text-sm',
          'bg-surface-control border border-border-subtle',
          'text-text-muted hover:text-text-primary hover:bg-surface-control-hover',
          'transition-colors min-w-[140px]'
        )}
        aria-haspopup="listbox"
        aria-expanded={isOpen}
      >
        <div className="flex items-center gap-1.5">
          <Sparkles className="w-3.5 h-3.5 text-text-accent" />
          <span className="font-medium">{currentModel?.name ?? 'Select Model'}</span>
        </div>
        <ChevronDown className={cn('w-4 h-4 transition-transform', isOpen && 'rotate-180')} />
      </button>

      {isOpen && (
        <div
          role="listbox"
          data-testid="model-selector-dropdown"
          className={cn(
            'absolute top-full left-0 mt-1 z-50',
            'w-72 glass-popover rounded-lg',
            'border border-border-strong shadow-xl',
            'py-1 animate-fade-in'
          )}
        >
          {AGENT_MODELS.map((model) => (
            <button
              key={model.id}
              role="option"
              data-testid={`model-option-${model.id}`}
              aria-selected={model.id === selectedModel}
              onClick={() => { handleSelect(model.id) }}
              className={cn(
                'w-full text-left px-3 py-2.5',
                'hover:bg-surface-hover',
                'transition-colors',
                model.id === selectedModel && 'bg-surface-active'
              )}
            >
              <div className="flex items-center justify-between">
                <span className="font-medium text-sm text-text-primary">{model.name}</span>
                {model.id === selectedModel && (
                  <Check className="w-4 h-4 text-status-success" />
                )}
              </div>
              <p className="text-xs text-text-faint mt-0.5">
                {model.description}
              </p>
              <div className="flex items-center gap-2 mt-1">
                <span className="text-xs text-text-dim bg-surface-control px-1.5 py-0.5 rounded">
                  {formatContextLimit(model.contextLimit)} context
                </span>
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

function formatContextLimit(limit: number): string {
  if (limit >= 1000000) {
    return `${(limit / 1000000).toFixed(1)}M`
  }
  return `${(limit / 1000).toFixed(0)}K`
}
