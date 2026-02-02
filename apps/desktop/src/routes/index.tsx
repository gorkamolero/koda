import { createFileRoute } from '@tanstack/react-router'
import { WorkspaceList } from '@/pages/WorkspaceList'

type SearchParams = {
  repoId?: string
}

export const Route = createFileRoute('/')({
  component: WorkspaceList,
  validateSearch: (search: Record<string, unknown>): SearchParams => ({
    repoId: typeof search.repoId === 'string' ? search.repoId : undefined,
  }),
})
