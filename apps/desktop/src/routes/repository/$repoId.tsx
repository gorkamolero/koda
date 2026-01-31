import { createFileRoute } from '@tanstack/react-router'
import { RepositoryPage } from '@/pages/RepositoryPage'

export const Route = createFileRoute('/repository/$repoId')({
  component: RepositoryPage,
})
