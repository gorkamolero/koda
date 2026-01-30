import { useState, useRef, useEffect } from 'react'
import { useAtom } from 'jotai'
import { selectedModelAtom, AGENT_MODELS, type AgentModel } from '@/store/chat'

/**
 * Dropdown selector for choosing the AI model
 */
export function ModelSelector() {
  const [selectedModel, setSelectedModel] = useAtom(selectedModelAtom)
  const [isOpen, setIsOpen] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)

  const currentModel = AGENT_MODELS.find((m) => m.id === selectedModel)

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (
        containerRef.current &&
        !containerRef.current.contains(event.target as Node)
      ) {
        setIsOpen(false)
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [])

  // Close dropdown on escape key
  useEffect(() => {
    function handleEscape(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        setIsOpen(false)
      }
    }

    document.addEventListener('keydown', handleEscape)
    return () => {
      document.removeEventListener('keydown', handleEscape)
    }
  }, [])

  const handleSelect = (model: AgentModel) => {
    setSelectedModel(model)
    setIsOpen(false)
  }

  return (
    <div ref={containerRef} className="relative">
      <button
        data-testid="model-selector"
        onClick={() => { setIsOpen(!isOpen) }}
        className="
          inline-flex items-center justify-between gap-2
          px-3 py-2 rounded-md text-sm
          bg-background border border-border
          hover:bg-accent hover:text-accent-foreground
          transition-colors min-w-[140px]
        "
        aria-haspopup="listbox"
        aria-expanded={isOpen}
      >
        <span className="font-medium">{currentModel?.name ?? 'Select Model'}</span>
        <ChevronDownIcon className={`w-4 h-4 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
      </button>

      {isOpen && (
        <div
          role="listbox"
          className="
            absolute top-full left-0 mt-1 z-50
            w-64 rounded-md border border-border
            bg-background shadow-lg
            py-1
          "
        >
          {AGENT_MODELS.map((model) => (
            <button
              key={model.id}
              role="option"
              aria-selected={model.id === selectedModel}
              onClick={() => { handleSelect(model.id) }}
              className={`
                w-full text-left px-3 py-2
                hover:bg-accent hover:text-accent-foreground
                transition-colors
                ${model.id === selectedModel ? 'bg-accent/50' : ''}
              `}
            >
              <div className="font-medium text-sm">{model.name}</div>
              <div className="text-xs text-muted-foreground mt-0.5">
                {model.description}
              </div>
              <div className="text-xs text-muted-foreground mt-0.5">
                {formatContextLimit(model.contextLimit)} context
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

function ChevronDownIcon({ className }: { className?: string }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 20 20"
      fill="currentColor"
      className={className}
    >
      <path
        fillRule="evenodd"
        d="M5.23 7.21a.75.75 0 011.06.02L10 11.168l3.71-3.938a.75.75 0 111.08 1.04l-4.25 4.5a.75.75 0 01-1.08 0l-4.25-4.5a.75.75 0 01.02-1.06z"
        clipRule="evenodd"
      />
    </svg>
  )
}

function formatContextLimit(limit: number): string {
  if (limit >= 1000000) {
    return `${(limit / 1000000).toFixed(1)}M`
  }
  return `${(limit / 1000).toFixed(0)}K`
}
