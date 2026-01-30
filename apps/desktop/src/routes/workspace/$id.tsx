import { createFileRoute } from '@tanstack/react-router'
import { WorkspaceView } from '@/pages/WorkspaceView'

interface WorkspaceSearchParams {
  mock?: boolean
  mode?: string
}

export const Route = createFileRoute('/workspace/$id')({
  component: WorkspaceView,
  validateSearch: (search: Record<string, unknown>): WorkspaceSearchParams => {
    return {
      // TanStack Router auto-parses 'true'/'false' as booleans
      mock: search.mock === true || search.mock === 'true',
      mode: typeof search.mode === 'string' ? search.mode : undefined,
    }
  },
})
