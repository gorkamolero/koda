import { Select, SelectTrigger, SelectContent, SelectItem } from '@koda/ui'
import { useState, useCallback } from 'react'
import { useAtom } from 'jotai'
import {
  workspaceTypeAtom,
  WORKSPACE_TYPES,
  type WorkspaceType,
} from '@/store/interview'
import { rpcRequest } from '@/lib/tauri'

interface WorkspaceTypeSelectorProps {
  workspaceId: string
  onTypeChange?: (type: WorkspaceType) => void
}

/**
 * Dropdown selector for workspace type
 */
export function WorkspaceTypeSelector({
  workspaceId,
  onTypeChange,
}: WorkspaceTypeSelectorProps) {
  const [workspaceType, setWorkspaceType] = useAtom(workspaceTypeAtom)
  const [isOpen, setIsOpen] = useState(false)
  const [isUpdating, setIsUpdating] = useState(false)
  const handleSelect = useCallback(
    async (type: WorkspaceType) => {
      if (type === workspaceType) {
        setIsOpen(false)
        return
      }

      setIsUpdating(true)

      try {
        // Update workspace type via RPC
        await rpcRequest('workspace.update', {
          id: workspaceId,
          workspaceType: type,
        })
        // Only update local state after successful RPC
        setWorkspaceType(type)
        onTypeChange?.(type)
      } catch (error) {
        console.error('Failed to update workspace type:', error)
        // In case of RPC error, don't update local state
      } finally {
        setIsUpdating(false)
        setIsOpen(false)
      }
    },
    [workspaceId, workspaceType, setWorkspaceType, onTypeChange]
  )

  const currentType = WORKSPACE_TYPES.find((t) => t.id === workspaceType)

  return <Select open={isOpen} onOpenChange={setIsOpen} value={workspaceType} disabled={isUpdating} onValueChange={value => void handleSelect(value as WorkspaceType)}>
    <SelectTrigger data-testid="workspace-type-selector" aria-label="Workspace type" className="h-auto min-w-35 w-auto rounded-md border-border bg-background px-3 py-2 text-sm font-medium hover:bg-accent hover:text-accent-foreground transition-colors"><span>{currentType?.name ?? 'Standard'}</span></SelectTrigger>
    <SelectContent className="w-64 rounded-md">
      {WORKSPACE_TYPES.map(type => <SelectItem key={type.id} value={type.id} className="w-full px-3 py-2 text-sm"><span className="block font-medium">{type.name}</span><span className="block text-xs text-muted-foreground mt-0.5">{type.description}</span></SelectItem>)}
    </SelectContent>
  </Select>
}
