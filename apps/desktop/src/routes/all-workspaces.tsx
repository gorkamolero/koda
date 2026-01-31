import { createFileRoute } from '@tanstack/react-router'
import { AllWorkspacesPage } from '@/pages/AllWorkspacesPage'

export const Route = createFileRoute('/all-workspaces')({
  component: AllWorkspacesPage,
})
