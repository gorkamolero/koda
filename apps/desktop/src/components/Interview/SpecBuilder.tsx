import { useState, useCallback } from 'react'
import { useSetAtom } from 'jotai'
import { generatedSpecAtom, generatedFixPlanAtom } from '@/store/interview'
import { rpcRequest } from '@/lib/tauri'

interface SpecBuilderProps {
  workspaceId: string
  initialSpec: string
  initialFixPlan: string
  mockMode?: boolean
  onBack: () => void
  onDone: () => void
}

/**
 * Component for reviewing, editing, and saving feature specs
 */
export function SpecBuilder({
  workspaceId,
  initialSpec,
  initialFixPlan,
  mockMode = false,
  onBack,
  onDone,
}: SpecBuilderProps) {
  const [spec, setSpec] = useState(initialSpec)
  const [fixPlan, setFixPlan] = useState(initialFixPlan)
  const [isEditing, setIsEditing] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [isSaved, setIsSaved] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const setGeneratedSpec = useSetAtom(generatedSpecAtom)
  const setGeneratedFixPlan = useSetAtom(generatedFixPlanAtom)

  const handleEdit = useCallback(() => {
    setIsEditing(true)
    setError(null)
  }, [])

  const handleSaveEdit = useCallback(() => {
    setIsEditing(false)
    setGeneratedSpec(spec)
    setGeneratedFixPlan(fixPlan)
  }, [spec, fixPlan, setGeneratedSpec, setGeneratedFixPlan])

  const handleCancelEdit = useCallback(() => {
    setIsEditing(false)
    setSpec(initialSpec)
    setFixPlan(initialFixPlan)
    setError(null)
  }, [initialSpec, initialFixPlan])

  const handleConfirm = useCallback(async () => {
    setIsSaving(true)
    setError(null)

    try {
      if (mockMode) {
        // Mock mode for E2E tests
        await new Promise((resolve) => setTimeout(resolve, 500))
      } else {
        // Save spec and fix plan to workspace via RPC
        await rpcRequest('workspace.update', {
          id: workspaceId,
          specContent: spec,
          fixPlanContent: fixPlan,
          workspaceType: 'spec-driven',
        })
      }

      setIsSaved(true)
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'Failed to save specification'
      )
    } finally {
      setIsSaving(false)
    }
  }, [workspaceId, spec, fixPlan, mockMode])

  if (isSaved) {
    return (
      <div className="space-y-6">
        {/* Success message */}
        <div
          data-testid="spec-saved-message"
          className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg p-4"
        >
          <div className="flex items-center gap-2">
            <svg
              className="w-5 h-5 text-green-600 dark:text-green-400"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
              />
            </svg>
            <span className="font-medium text-green-800 dark:text-green-200">
              Specification saved successfully!
            </span>
          </div>
          <p className="mt-2 text-sm text-green-700 dark:text-green-300">
            Your feature spec has been saved to the workspace and a fix plan has
            been generated.
          </p>
        </div>

        {/* Fix plan preview */}
        <div className="border border-border rounded-lg">
          <div className="px-4 py-3 border-b border-border bg-secondary/30">
            <h3 className="font-medium text-primary">Generated Fix Plan</h3>
          </div>
          <div
            data-testid="fix-plan-preview"
            className="p-4 font-mono text-sm whitespace-pre-wrap bg-background max-h-[300px] overflow-y-auto"
          >
            {fixPlan}
          </div>
        </div>

        {/* Done button */}
        <div className="flex justify-end">
          <button
            onClick={onDone}
            className="inline-flex items-center justify-center rounded-md text-sm font-medium bg-primary text-primary-foreground hover:bg-primary/90 h-10 px-6 py-2 transition-colors"
          >
            Done
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Error message */}
      {error && (
        <div className="bg-destructive/10 border border-destructive/20 rounded-lg p-4">
          <p className="text-sm text-destructive">{error}</p>
        </div>
      )}

      {/* Spec preview/editor */}
      <div className="border border-border rounded-lg">
        <div className="flex items-center justify-between px-4 py-3 border-b border-border bg-secondary/30">
          <h3 className="font-medium text-primary">Feature Specification</h3>
          {!isEditing && (
            <button
              data-testid="spec-edit-button"
              onClick={handleEdit}
              className="text-sm text-primary hover:underline"
            >
              Edit
            </button>
          )}
        </div>

        {isEditing ? (
          <div className="p-4">
            <textarea
              data-testid="spec-editor"
              value={spec}
              onChange={(e) => { setSpec(e.target.value) }}
              className="w-full min-h-[300px] rounded-md border border-border bg-background px-4 py-3 text-sm font-mono placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent resize-y"
            />
            <div className="flex justify-end gap-2 mt-4">
              <button
                onClick={handleCancelEdit}
                className="inline-flex items-center justify-center rounded-md text-sm font-medium border border-border bg-background hover:bg-accent hover:text-accent-foreground h-9 px-3 transition-colors"
              >
                Cancel
              </button>
              <button
                data-testid="spec-save-button"
                onClick={handleSaveEdit}
                className="inline-flex items-center justify-center rounded-md text-sm font-medium bg-primary text-primary-foreground hover:bg-primary/90 h-9 px-3 transition-colors"
              >
                Save Changes
              </button>
            </div>
          </div>
        ) : (
          <div
            data-testid="spec-preview"
            className="p-4 font-mono text-sm whitespace-pre-wrap bg-background max-h-[400px] overflow-y-auto"
          >
            {spec}
          </div>
        )}
      </div>

      {/* Action buttons */}
      <div className="flex items-center justify-between pt-4 border-t border-border">
        <button
          data-testid="interview-back-button"
          onClick={onBack}
          disabled={isSaving}
          className="inline-flex items-center justify-center rounded-md text-sm font-medium border border-border bg-background hover:bg-accent hover:text-accent-foreground h-10 px-4 py-2 transition-colors disabled:opacity-50 disabled:pointer-events-none"
        >
          Back to Questions
        </button>
        <button
          data-testid="spec-confirm-button"
          onClick={() => { void handleConfirm() }}
          disabled={isSaving || isEditing}
          className="inline-flex items-center justify-center rounded-md text-sm font-medium bg-primary text-primary-foreground hover:bg-primary/90 h-10 px-6 py-2 transition-colors disabled:opacity-50 disabled:pointer-events-none"
        >
          {isSaving ? (
            <span className="flex items-center gap-2">
              <svg
                className="animate-spin h-4 w-4"
                xmlns="http://www.w3.org/2000/svg"
                fill="none"
                viewBox="0 0 24 24"
              >
                <circle
                  className="opacity-25"
                  cx="12"
                  cy="12"
                  r="10"
                  stroke="currentColor"
                  strokeWidth="4"
                />
                <path
                  className="opacity-75"
                  fill="currentColor"
                  d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                />
              </svg>
              Saving...
            </span>
          ) : (
            'Save & Generate Fix Plan'
          )}
        </button>
      </div>
    </div>
  )
}
