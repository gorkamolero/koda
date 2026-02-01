import { z } from 'zod';
import { eq } from 'drizzle-orm';
import { getDb } from '../db/index.js';
import { workspaces, workspaceRepos, worktrees, repos } from '../db/schema.js';
import { randomUUID } from 'node:crypto';

/**
 * Workspace schemas (containers)
 */
export const CreateWorkspaceSchema = z.object({
  name: z.string().min(1),
  description: z.string().optional(),
  ownerUserId: z.string().optional(),
});

export const GetWorkspaceSchema = z.object({
  id: z.string().uuid(),
});

export const ListWorkspacesSchema = z.object({
  limit: z.number().int().positive().optional().default(100),
  offset: z.number().int().nonnegative().optional().default(0),
});

export const UpdateWorkspaceSchema = z.object({
  id: z.string().uuid(),
  name: z.string().min(1).optional(),
  description: z.string().optional(),
});

export type CreateWorkspaceInput = z.infer<typeof CreateWorkspaceSchema>;
export type GetWorkspaceInput = z.infer<typeof GetWorkspaceSchema>;
export type ListWorkspacesInput = z.infer<typeof ListWorkspacesSchema>;
export type UpdateWorkspaceInput = z.infer<typeof UpdateWorkspaceSchema>;

/**
 * Extended workspace with repos and worktrees
 */
export interface WorkspaceWithContents {
  id: string;
  name: string;
  description: string | null;
  ownerUserId: string | null;
  createdAt: string;
  updatedAt: string;
  repos: Array<{
    id: string;
    name: string | null;
    rootPath: string | null;
    remoteUrl: string | null;
    defaultBranch: string | null;
  }>;
  worktrees: Array<{
    id: string;
    repoId: string;
    branch: string | null;
    worktreePath: string | null;
    state: string | null;
    derivedStatus: string | null;
  }>;
}

/**
 * Create a new workspace (pure container)
 */
export async function createWorkspace(input: CreateWorkspaceInput) {
  const db = getDb();

  const workspace = {
    id: randomUUID(),
    name: input.name,
    description: input.description ?? null,
    ownerUserId: input.ownerUserId ?? null,
  };

  await db.insert(workspaces).values(workspace);

  return workspace;
}

/**
 * Get workspace by ID
 */
export async function getWorkspace(input: GetWorkspaceInput) {
  const db = getDb();
  const workspace = await db.query.workspaces.findFirst({
    where: eq(workspaces.id, input.id),
  });

  if (!workspace) {
    throw new Error(`Workspace not found: ${input.id}`);
  }

  return workspace;
}

/**
 * Get workspace with all its repos and worktrees
 */
export async function getWorkspaceWithContents(input: GetWorkspaceInput): Promise<WorkspaceWithContents> {
  const db = getDb();

  // Get workspace
  const workspace = await db.query.workspaces.findFirst({
    where: eq(workspaces.id, input.id),
  });

  if (!workspace) {
    throw new Error(`Workspace not found: ${input.id}`);
  }

  // Get attached repos
  const attachedRepos = await db
    .select({
      id: repos.id,
      name: repos.name,
      rootPath: repos.rootPath,
      remoteUrl: repos.remoteUrl,
      defaultBranch: repos.defaultBranch,
    })
    .from(workspaceRepos)
    .innerJoin(repos, eq(workspaceRepos.repoId, repos.id))
    .where(eq(workspaceRepos.workspaceId, input.id));

  // Get worktrees that are in this workspace
  // Parse workspace_ids JSON array and filter
  const allWorktrees = await db.query.worktrees.findMany();
  const workspaceWorktrees = allWorktrees.filter(wt => {
    if (!wt.workspaceIds) return false;
    try {
      const ids = JSON.parse(wt.workspaceIds) as string[];
      return ids.includes(input.id);
    } catch {
      return false;
    }
  }).map(wt => ({
    id: wt.id,
    repoId: wt.repoId,
    branch: wt.branch,
    worktreePath: wt.worktreePath,
    state: wt.state,
    derivedStatus: wt.derivedStatus,
  }));

  return {
    ...workspace,
    repos: attachedRepos,
    worktrees: workspaceWorktrees,
  };
}

/**
 * List all workspaces
 */
export async function listWorkspaces(input?: ListWorkspacesInput) {
  const db = getDb();
  const results = await db.query.workspaces.findMany({
    limit: input?.limit ?? 100,
    offset: input?.offset ?? 0,
  });

  return results;
}

/**
 * Update a workspace
 */
export async function updateWorkspace(input: UpdateWorkspaceInput) {
  const db = getDb();

  const updates: Partial<{ name: string; description: string }> = {};
  if (input.name) updates.name = input.name;
  if (input.description !== undefined) updates.description = input.description;

  if (Object.keys(updates).length === 0) {
    // Nothing to update, just return current
    return getWorkspace({ id: input.id });
  }

  await db
    .update(workspaces)
    .set({ ...updates, updatedAt: new Date().toISOString() })
    .where(eq(workspaces.id, input.id));

  return getWorkspace({ id: input.id });
}

/**
 * Delete a workspace (and detach all repos/worktrees)
 */
export async function deleteWorkspace(input: GetWorkspaceInput) {
  const db = getDb();

  // Get workspace first
  const workspace = await getWorkspace(input);

  // Remove all workspace_repos links
  await db.delete(workspaceRepos).where(eq(workspaceRepos.workspaceId, input.id));

  // Remove this workspace from all worktrees' workspace_ids arrays
  const allWorktrees = await db.query.worktrees.findMany();
  for (const wt of allWorktrees) {
    if (!wt.workspaceIds) continue;
    try {
      const ids = JSON.parse(wt.workspaceIds) as string[];
      const newIds = ids.filter(id => id !== input.id);
      if (newIds.length !== ids.length) {
        await db
          .update(worktrees)
          .set({ workspaceIds: JSON.stringify(newIds) })
          .where(eq(worktrees.id, wt.id));
      }
    } catch {
      // Invalid JSON, skip
    }
  }

  // Delete the workspace
  await db.delete(workspaces).where(eq(workspaces.id, input.id));

  return workspace;
}
