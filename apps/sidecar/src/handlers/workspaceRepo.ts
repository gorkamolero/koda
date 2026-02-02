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
import { workspaceRepos, repos, workspaces, worktrees } from '../db/schema.js'

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
 * Creates the workspace-repo link AND ensures a main worktree exists
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

  // Get the repo details
  const repo = await db.query.repos.findFirst({
    where: eq(repos.id, input.repoId),
  })

  if (!repo) {
    throw new Error(`Repo not found: ${input.repoId}`)
  }

  // Create the workspace-repo link
  const workspaceRepo = {
    id: randomUUID(),
    workspaceId: input.workspaceId,
    repoId: input.repoId,
  }

  await db.insert(workspaceRepos).values(workspaceRepo)

  // Check if a main worktree already exists for this repo
  const mainBranch = repo.defaultBranch ?? 'main'
  const existingMainWorktree = await db.query.worktrees.findFirst({
    where: and(
      eq(worktrees.repoId, input.repoId),
      eq(worktrees.branch, mainBranch)
    ),
  })

  if (existingMainWorktree) {
    // Main worktree exists - add this workspace to its workspaceIds
    let workspaceIds: string[] = []
    if (existingMainWorktree.workspaceIds) {
      try {
        workspaceIds = JSON.parse(existingMainWorktree.workspaceIds) as string[]
      } catch {
        workspaceIds = []
      }
    }
    if (!workspaceIds.includes(input.workspaceId)) {
      workspaceIds.push(input.workspaceId)
      await db
        .update(worktrees)
        .set({
          workspaceIds: JSON.stringify(workspaceIds),
          updatedAt: new Date().toISOString(),
        })
        .where(eq(worktrees.id, existingMainWorktree.id))
    }
  } else {
    // Create a worktree record for the main branch (at repo's rootPath)
    const mainWorktree = {
      id: randomUUID(),
      repoId: input.repoId,
      branch: mainBranch,
      worktreePath: repo.rootPath,
      workspaceIds: JSON.stringify([input.workspaceId]),
      worktreeType: 'standard',
      state: 'active',
      derivedStatus: 'in-progress',
    }

    await db.insert(worktrees).values(mainWorktree)
  }

  return workspaceRepo
}

/**
 * Detach a repo from a workspace
 * Removes the workspace-repo link AND removes workspace from worktrees' workspaceIds
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

  // Remove workspace ID from all worktrees belonging to this repo
  const repoWorktrees = await db.query.worktrees.findMany({
    where: eq(worktrees.repoId, input.repoId),
  })

  for (const worktree of repoWorktrees) {
    if (worktree.workspaceIds) {
      try {
        const workspaceIds = JSON.parse(worktree.workspaceIds) as string[]
        const updatedIds = workspaceIds.filter((id) => id !== input.workspaceId)
        await db
          .update(worktrees)
          .set({
            workspaceIds: JSON.stringify(updatedIds),
            updatedAt: new Date().toISOString(),
          })
          .where(eq(worktrees.id, worktree.id))
      } catch {
        // Invalid JSON, skip
      }
    }
  }

  // Delete the workspace-repo link
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
 * Auto-creates missing main worktrees (self-healing)
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

  // Auto-create missing main worktrees (self-healing)
  for (const wsRepo of attachedRepos) {
    if (!wsRepo.repoRootPath) continue

    const mainBranch = wsRepo.repoDefaultBranch ?? 'main'
    const existingMainWorktree = await db.query.worktrees.findFirst({
      where: and(
        eq(worktrees.repoId, wsRepo.repoId),
        eq(worktrees.branch, mainBranch)
      ),
    })

    if (existingMainWorktree) {
      // Ensure this workspace is in workspaceIds
      let workspaceIds: string[] = []
      if (existingMainWorktree.workspaceIds) {
        try {
          workspaceIds = JSON.parse(existingMainWorktree.workspaceIds) as string[]
        } catch {
          workspaceIds = []
        }
      }
      if (!workspaceIds.includes(input.workspaceId)) {
        workspaceIds.push(input.workspaceId)
        await db
          .update(worktrees)
          .set({
            workspaceIds: JSON.stringify(workspaceIds),
            updatedAt: new Date().toISOString(),
          })
          .where(eq(worktrees.id, existingMainWorktree.id))
      }
    } else {
      // Create main worktree
      const mainWorktree = {
        id: randomUUID(),
        repoId: wsRepo.repoId,
        branch: mainBranch,
        worktreePath: wsRepo.repoRootPath,
        workspaceIds: JSON.stringify([input.workspaceId]),
        worktreeType: 'standard',
        state: 'active',
        derivedStatus: 'in-progress',
      }
      await db.insert(worktrees).values(mainWorktree)
    }
  }

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
