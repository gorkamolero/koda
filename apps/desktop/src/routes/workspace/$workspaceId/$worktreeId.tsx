import { createFileRoute } from '@tanstack/react-router'
import { WorkspaceView } from '@/pages/WorkspaceView'

interface WorkspaceSearchParams {
  mock?: boolean
  mode?: string
}

export const Route = createFileRoute('/workspace/$workspaceId/$worktreeId')({
  component: WorkspaceView,
  validateSearch: (search: Record<string, unknown>): WorkspaceSearchParams => {
    return {
      mock: search.mock === true || search.mock === 'true',
      mode: typeof search.mode === 'string' ? search.mode : undefined,
    }
  },
})
