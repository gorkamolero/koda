import { z } from 'zod';
import { eq } from 'drizzle-orm';
import { getDb } from '../db/index.js';
import { workspaces } from '../db/schema.js';
import { randomUUID } from 'node:crypto';

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

export type CreateWorkspaceInput = z.infer<typeof CreateWorkspaceSchema>;
export type GetWorkspaceInput = z.infer<typeof GetWorkspaceSchema>;
export type ListWorkspacesInput = z.infer<typeof ListWorkspacesSchema>;

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
