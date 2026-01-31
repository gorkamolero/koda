import { z } from 'zod';
import { eq } from 'drizzle-orm';
import { exec } from 'node:child_process';
import { promisify } from 'node:util';
import { getDb } from '../db/index.js';
import { workspaces, repos } from '../db/schema.js';
import { randomUUID } from 'node:crypto';

const execAsync = promisify(exec);

/**
 * Workspace schemas
 */
export const CreateWorkspaceSchema = z.object({
  repositoryId: z.string().optional(),
  ownerUserId: z.string().optional(),
  directoryName: z.string().min(1),
  branch: z.string().optional(),
  workspaceType: z.enum(['standard', 'spec-driven', 'ralph', 'openprose']).optional(),
});

export const GetWorkspaceSchema = z.object({
  id: z.string().uuid(),
});

export const ListWorkspacesSchema = z.object({
  limit: z.number().int().positive().optional().default(100),
  offset: z.number().int().nonnegative().optional().default(0),
});

export const GetDiffStatsSchema = z.object({
  workspaceId: z.string().uuid(),
});

export type CreateWorkspaceInput = z.infer<typeof CreateWorkspaceSchema>;
export type GetWorkspaceInput = z.infer<typeof GetWorkspaceSchema>;
export type ListWorkspacesInput = z.infer<typeof ListWorkspacesSchema>;
export type GetDiffStatsInput = z.infer<typeof GetDiffStatsSchema>;

export interface DiffStats {
  additions: number;
  deletions: number;
  filesChanged: number;
}

/**
 * Create a new workspace
 */
export async function createWorkspace(input: CreateWorkspaceInput) {
  const db = getDb();

  const workspace = {
    id: randomUUID(),
    repositoryId: input.repositoryId,
    ownerUserId: input.ownerUserId,
    directoryName: input.directoryName,
    branch: input.branch,
    workspaceType: input.workspaceType,
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
 * Get diff stats for a workspace (additions/deletions vs merge-base)
 */
export async function getDiffStats(input: GetDiffStatsInput): Promise<DiffStats> {
  const db = getDb();
  
  // Get workspace with repo info
  const workspace = await db.query.workspaces.findFirst({
    where: eq(workspaces.id, input.workspaceId),
  });
  
  if (!workspace) {
    throw new Error(`Workspace not found: ${input.workspaceId}`);
  }

  // Get repo to find the root path
  let repoPath: string | null = null;
  if (workspace.repositoryId) {
    const repo = await db.query.repos.findFirst({
      where: eq(repos.id, workspace.repositoryId),
    });
    if (repo?.rootPath) {
      // Workspace path is typically repo/workspaces/directoryName
      repoPath = `${repo.rootPath}/workspaces/${workspace.directoryName}`;
    }
  }

  if (!repoPath) {
    return { additions: 0, deletions: 0, filesChanged: 0 };
  }

  try {
    // Get merge-base with main/master
    const { stdout: mergeBase } = await execAsync(
      'git merge-base HEAD origin/main 2>/dev/null || git merge-base HEAD origin/master 2>/dev/null || git merge-base HEAD main 2>/dev/null || git merge-base HEAD master 2>/dev/null || echo HEAD~10',
      { cwd: repoPath }
    );

    // Get diff stats
    const { stdout: diffStat } = await execAsync(
      `git diff --shortstat ${mergeBase.trim()}`,
      { cwd: repoPath }
    );

    // Parse: "X files changed, Y insertions(+), Z deletions(-)"
    const stats = parseDiffStats(diffStat.trim());
    return stats;
  } catch (error) {
    console.error('[getDiffStats] Error:', error);
    return { additions: 0, deletions: 0, filesChanged: 0 };
  }
}

/**
 * Parse git diff --shortstat output
 */
function parseDiffStats(output: string): DiffStats {
  if (!output) {
    return { additions: 0, deletions: 0, filesChanged: 0 };
  }

  const filesMatch = output.match(/(\d+) files? changed/);
  const addMatch = output.match(/(\d+) insertions?\(\+\)/);
  const delMatch = output.match(/(\d+) deletions?\(-\)/);

  return {
    filesChanged: filesMatch ? parseInt(filesMatch[1], 10) : 0,
    additions: addMatch ? parseInt(addMatch[1], 10) : 0,
    deletions: delMatch ? parseInt(delMatch[1], 10) : 0,
  };
}
