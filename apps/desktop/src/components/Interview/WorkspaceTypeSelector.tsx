import { useState, useRef, useEffect, useCallback } from 'react'
import { useAtom } from 'jotai'
import {
  workspaceTypeAtom,
  WORKSPACE_TYPES,
  type WorkspaceType,
} from '@/store/interview'
import { rpcRequest } from '@/lib/tauri'

interface WorkspaceTypeSelectorProps {
  workspaceId: string
  mockMode?: boolean
  onTypeChange?: (type: WorkspaceType) => void
}

/**
 * Dropdown selector for workspace type
 */
export function WorkspaceTypeSelector({
  workspaceId,
  mockMode = false,
  onTypeChange,
}: WorkspaceTypeSelectorProps) {
  const [workspaceType, setWorkspaceType] = useAtom(workspaceTypeAtom)
  const [isOpen, setIsOpen] = useState(false)
  const [isUpdating, setIsUpdating] = useState(false)
  const dropdownRef = useRef<HTMLDivElement>(null)

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(event.target as Node)
      ) {
        setIsOpen(false)
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [])

  const handleSelect = useCallback(
    async (type: WorkspaceType) => {
      if (type === workspaceType) {
        setIsOpen(false)
        return
      }

      setIsUpdating(true)

      try {
        // In mock mode, skip RPC and just update local state
        if (mockMode) {
          setWorkspaceType(type)
          onTypeChange?.(type)
        } else {
          // Update workspace type via RPC
          await rpcRequest('workspace.update', {
            id: workspaceId,
            workspaceType: type,
          })
          // Only update local state after successful RPC
          setWorkspaceType(type)
          onTypeChange?.(type)
        }
      } catch (error) {
        console.error('Failed to update workspace type:', error)
        // In case of RPC error, don't update local state
      } finally {
        setIsUpdating(false)
        setIsOpen(false)
      }
    },
    [workspaceId, workspaceType, mockMode, setWorkspaceType, onTypeChange]
  )

  const currentType = WORKSPACE_TYPES.find((t) => t.id === workspaceType)

  return (
    <div ref={dropdownRef} className="relative">
      <button
        data-testid="workspace-type-selector"
        onClick={() => { setIsOpen(!isOpen) }}
        disabled={isUpdating}
        className="inline-flex items-center justify-between gap-2 rounded-md border border-border bg-background px-3 py-2 text-sm font-medium hover:bg-accent hover:text-accent-foreground transition-colors min-w-[140px] disabled:opacity-50"
        role="combobox"
        aria-expanded={isOpen}
        aria-haspopup="listbox"
      >
        <span>{currentType?.name ?? 'Standard'}</span>
        <svg
          className={`w-4 h-4 text-muted-foreground transition-transform ${
            isOpen ? 'rotate-180' : ''
          }`}
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M19 9l-7 7-7-7"
          />
        </svg>
      </button>

      {isOpen && (
        <div
          className="absolute top-full left-0 mt-1 w-64 rounded-md border border-border bg-background shadow-lg z-50"
          role="listbox"
        >
          {WORKSPACE_TYPES.map((type) => (
            <button
              key={type.id}
              role="option"
              aria-selected={type.id === workspaceType}
              onClick={() => void handleSelect(type.id)}
              className={`
                w-full text-left px-3 py-2 text-sm transition-colors
                ${
                  type.id === workspaceType
                    ? 'bg-primary/10 text-primary'
                    : 'hover:bg-accent'
                }
                first:rounded-t-md last:rounded-b-md
              `}
            >
              <div className="font-medium">{type.name}</div>
              <div className="text-xs text-muted-foreground mt-0.5">
                {type.description}
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
