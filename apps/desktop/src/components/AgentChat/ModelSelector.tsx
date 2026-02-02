import { useState, useRef } from 'react'
import { useAtom } from 'jotai'
import { cn } from '@/lib/utils'
import { selectedModelAtom, AGENT_MODELS, type AgentModel } from '@/store/chat'
import { useClickOutside } from '@/hooks/useClickOutside'

/**
 * Dropdown selector for choosing the AI model.
 * Terminal aesthetic with bracket notation.
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
    <div ref={containerRef} className="relative font-mono">
      <button
        data-testid="model-selector"
        onClick={() => { setIsOpen(!isOpen) }}
        className={cn(
          'inline-flex items-center gap-1.5',
          'px-2 py-1 text-xs',
          'bg-transparent border border-dashed border-border-subtle',
          'text-text-muted hover:text-text-accent hover:border-text-accent',
          'transition-colors'
        )}
        aria-haspopup="listbox"
        aria-expanded={isOpen}
      >
        <span className="text-text-faint">[</span>
        <span className="text-text-accent">MODEL:</span>
        <span className="uppercase">{currentModel?.name ?? 'SELECT'}</span>
        <span className="text-text-faint">]</span>
        <span className={cn('text-text-faint transition-transform', isOpen && 'rotate-180')}>▼</span>
      </button>

      {isOpen && (
        <div
          role="listbox"
          data-testid="model-selector-dropdown"
          className={cn(
            'absolute top-full left-0 mt-1 z-50',
            'w-72 bg-[#0a0a0a]',
            'border border-dashed border-border-strong',
            'py-1'
          )}
        >
          {/* Header */}
          <div className="px-3 py-1.5 border-b border-dashed border-border-subtle text-xs">
            <span className="text-text-faint">┌─ </span>
            <span className="text-text-accent">SELECT MODEL</span>
            <span className="text-text-faint"> {'─'.repeat(14)}┐</span>
          </div>

          {/* Model options */}
          {AGENT_MODELS.map((model) => (
            <button
              key={model.id}
              role="option"
              data-testid={`model-option-${model.id}`}
              aria-selected={model.id === selectedModel}
              onClick={() => { handleSelect(model.id) }}
              className={cn(
                'w-full text-left px-3 py-2',
                'hover:bg-surface-hover',
                'transition-colors',
                model.id === selectedModel && 'bg-surface-active'
              )}
            >
              <div className="flex items-center justify-between text-xs">
                <span className="flex items-center gap-2">
                  <span className="text-text-faint">{model.id === selectedModel ? '[●]' : '[ ]'}</span>
                  <span className="text-text-primary uppercase">{model.name}</span>
                </span>
                <span className="text-text-dim">{formatContextLimit(model.contextLimit)}</span>
              </div>
              <p className="text-xs text-text-faint mt-1 ml-6">
                {model.description}
              </p>
            </button>
          ))}

          {/* Footer */}
          <div className="px-3 py-1 text-xs text-text-faint">
            └{'─'.repeat(32)}┘
          </div>
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
