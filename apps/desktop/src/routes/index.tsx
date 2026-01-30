import { createFileRoute } from '@tanstack/react-router'
import { WorkspaceList } from '@/pages/WorkspaceList'

export const Route = createFileRoute('/')({
  component: WorkspaceList,
})
