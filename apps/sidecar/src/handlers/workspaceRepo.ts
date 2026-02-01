/**
 * Workspace Repo Handlers
 *
 * Manages the many-to-many relationship between workspaces and repos.
 * This is purely about visibility: "repo X is available in workspace Y"
 * Repos are horizontal - no hierarchy, no "primary".
 */

import { z } from 'zod'
import { eq, and } from 'drizzle-orm'
import { randomUUID } from 'node:crypto'
import { getDb } from '../db/index.js'
import { workspaceRepos, repos, workspaces } from '../db/schema.js'

// =============================================================================
// Schemas
// =============================================================================

export const AttachRepoSchema = z.object({
  workspaceId: z.string().uuid(),
  repoId: z.string().uuid(),
})

export const DetachRepoSchema = z.object({
  workspaceId: z.string().uuid(),
  repoId: z.string().uuid(),
})

export const ListWorkspaceReposSchema = z.object({
  workspaceId: z.string().uuid(),
})

export const CreateStandaloneWorkspaceSchema = z.object({
  name: z.string().min(1),
  description: z.string().optional(),
})

// Use z.input for handler function signatures (allows optional fields before defaults)
export type AttachRepoInput = z.input<typeof AttachRepoSchema>
export type DetachRepoInput = z.input<typeof DetachRepoSchema>
export type ListWorkspaceReposInput = z.input<typeof ListWorkspaceReposSchema>
export type CreateStandaloneWorkspaceInput = z.input<typeof CreateStandaloneWorkspaceSchema>

// =============================================================================
// Handlers
// =============================================================================

/**
 * Attach a repo to a workspace
 * Just creates the link - does NOT create worktrees
 */
export async function attachRepo(input: AttachRepoInput) {
  const db = getDb()

  // Check if already attached
  const existing = await db.query.workspaceRepos.findFirst({
    where: and(
      eq(workspaceRepos.workspaceId, input.workspaceId),
      eq(workspaceRepos.repoId, input.repoId)
    ),
  })

  if (existing) {
    throw new Error('Repo is already attached to this workspace')
  }

  const workspaceRepo = {
    id: randomUUID(),
    workspaceId: input.workspaceId,
    repoId: input.repoId,
  }

  await db.insert(workspaceRepos).values(workspaceRepo)

  return workspaceRepo
}

/**
 * Detach a repo from a workspace
 */
export async function detachRepo(input: DetachRepoInput) {
  const db = getDb()

  const existing = await db.query.workspaceRepos.findFirst({
    where: and(
      eq(workspaceRepos.workspaceId, input.workspaceId),
      eq(workspaceRepos.repoId, input.repoId)
    ),
  })

  if (!existing) {
    throw new Error('Repo is not attached to this workspace')
  }

  await db
    .delete(workspaceRepos)
    .where(
      and(
        eq(workspaceRepos.workspaceId, input.workspaceId),
        eq(workspaceRepos.repoId, input.repoId)
      )
    )

  return { success: true }
}

/**
 * List all repos attached to a workspace
 */
export async function listWorkspaceRepos(input: ListWorkspaceReposInput) {
  const db = getDb()

  const attachedRepos = await db
    .select({
      id: workspaceRepos.id,
      workspaceId: workspaceRepos.workspaceId,
      repoId: workspaceRepos.repoId,
      createdAt: workspaceRepos.createdAt,
      // Repo details
      repoName: repos.name,
      repoRootPath: repos.rootPath,
      repoRemoteUrl: repos.remoteUrl,
      repoDefaultBranch: repos.defaultBranch,
    })
    .from(workspaceRepos)
    .leftJoin(repos, eq(workspaceRepos.repoId, repos.id))
    .where(eq(workspaceRepos.workspaceId, input.workspaceId))

  return attachedRepos
}

/**
 * Create a standalone workspace (pure container, no repo attached)
 */
export async function createStandaloneWorkspace(input: CreateStandaloneWorkspaceInput) {
  const db = getDb()

  const workspace = {
    id: randomUUID(),
    name: input.name,
    description: input.description ?? null,
  }

  await db.insert(workspaces).values(workspace)

  return workspace
}
