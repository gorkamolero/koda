import { z } from 'zod';
import { eq, and, desc, sql } from 'drizzle-orm';
import { getDb } from '../db/index.js';
import { activity, worktrees } from '../db/schema.js';
import { randomUUID } from 'node:crypto';
import { checkFileChanges } from './fileWatcher.js';

/**
 * Activity schemas
 */
export const CreateActivitySchema = z.object({
  workspaceId: z.string(),
  type: z.enum(['file_change', 'agent_complete', 'agent_error', 'checkpoint']),
  title: z.string(),
  description: z.string().optional(),
  navigateTo: z.object({
    view: z.string(),
    params: z.record(z.string(), z.string()).optional(),
  }).optional(),
});

export const ListActivitySchema = z.object({
  workspaceId: z.string(),
  limit: z.number().int().positive().optional().default(50),
  unreadOnly: z.boolean().optional().default(false),
});

export const MarkReadSchema = z.object({
  workspaceId: z.string(),
  ids: z.array(z.string()).optional(),
});

export const UnreadCountSchema = z.object({
  workspaceId: z.string(),
});

export type CreateActivityInput = z.infer<typeof CreateActivitySchema>;
export type ListActivityInput = z.infer<typeof ListActivitySchema>;
export type MarkReadInput = z.infer<typeof MarkReadSchema>;
export type UnreadCountInput = z.infer<typeof UnreadCountSchema>;

/**
 * Create a new activity entry
 */
export async function createActivity(input: CreateActivityInput) {
  const db = getDb();

  const entry = {
    id: randomUUID(),
    workspaceId: input.workspaceId,
    type: input.type,
    title: input.title,
    description: input.description ?? null,
    navigateTo: input.navigateTo ? JSON.stringify(input.navigateTo) : null,
    read: false,
  };

  await db.insert(activity).values(entry);

  return { id: entry.id };
}

/**
 * List activity entries for a workspace
 */
export async function listActivity(input: ListActivityInput) {
  const db = getDb();

  // For worktree IDs, we need to find the actual workspace ID
  // Worktrees store workspace_ids as a JSON array
  let workspaceId = input.workspaceId;

  // Check if this is a worktree ID
  const worktree = await db.query.worktrees.findFirst({
    where: eq(worktrees.id, input.workspaceId),
  });

  if (worktree && worktree.workspaceIds) {
    // Check for file changes before listing
    await checkFileChanges(input.workspaceId);
    
    try {
      const wsIds = JSON.parse(worktree.workspaceIds) as string[];
      if (wsIds.length > 0) {
        workspaceId = wsIds[0];
      }
    } catch {
      // Keep original ID
    }
  }

  const conditions = [eq(activity.workspaceId, workspaceId)];
  
  if (input.unreadOnly) {
    conditions.push(eq(activity.read, false));
  }

  const results = await db
    .select()
    .from(activity)
    .where(and(...conditions))
    .orderBy(desc(activity.createdAt))
    .limit(input.limit ?? 50);

  return results.map(row => ({
    ...row,
    navigateTo: row.navigateTo ? JSON.parse(row.navigateTo) : null,
  }));
}

/**
 * Mark activities as read
 */
export async function markRead(input: MarkReadInput) {
  const db = getDb();

  // Resolve workspace ID from worktree if needed
  let workspaceId = input.workspaceId;
  const worktree = await db.query.worktrees.findFirst({
    where: eq(worktrees.id, input.workspaceId),
  });

  if (worktree && worktree.workspaceIds) {
    try {
      const wsIds = JSON.parse(worktree.workspaceIds) as string[];
      if (wsIds.length > 0) {
        workspaceId = wsIds[0];
      }
    } catch {
      // Keep original ID
    }
  }

  if (input.ids && input.ids.length > 0) {
    // Mark specific IDs as read
    let updated = 0;
    for (const id of input.ids) {
      const result = await db
        .update(activity)
        .set({ read: true })
        .where(and(eq(activity.id, id), eq(activity.workspaceId, workspaceId)));
      updated += result.changes ?? 0;
    }
    return { updated };
  } else {
    // Mark all as read for this workspace
    const result = await db
      .update(activity)
      .set({ read: true })
      .where(eq(activity.workspaceId, workspaceId));
    return { updated: result.changes ?? 0 };
  }
}

/**
 * Get unread count for a workspace
 */
export async function unreadCount(input: UnreadCountInput) {
  const db = getDb();

  // Resolve workspace ID from worktree if needed
  let workspaceId = input.workspaceId;
  const worktree = await db.query.worktrees.findFirst({
    where: eq(worktrees.id, input.workspaceId),
  });

  if (worktree && worktree.workspaceIds) {
    // Check for file changes before counting
    await checkFileChanges(input.workspaceId);
    
    try {
      const wsIds = JSON.parse(worktree.workspaceIds) as string[];
      if (wsIds.length > 0) {
        workspaceId = wsIds[0];
      }
    } catch {
      // Keep original ID
    }
  }

  const result = await db
    .select({ count: sql<number>`count(*)` })
    .from(activity)
    .where(and(eq(activity.workspaceId, workspaceId), eq(activity.read, false)));

  return { count: result[0]?.count ?? 0 };
}

/**
 * Get all workspaces with their agent status
 * Used by the Agent Overview panel
 */
export async function getWorkspacesWithStatus() {
  const db = getDb();

  // Get all workspaces
  const allWorkspaces = await db.query.workspaces.findMany();

  // Get all worktrees
  const allWorktrees = await db.query.worktrees.findMany();

  // Get all sessions to determine agent status
  const allSessions = await db.query.sessions.findMany();

  // Build workspace status map
  const workspaceData = allWorkspaces.map(ws => {
    // Find worktrees for this workspace
    const wsWorktrees = allWorktrees.filter(wt => {
      if (!wt.workspaceIds) return false;
      try {
        const ids = JSON.parse(wt.workspaceIds) as string[];
        return ids.includes(ws.id);
      } catch {
        return false;
      }
    });

    // Find sessions for these worktrees
    const worktreeIds = wsWorktrees.map(wt => wt.id);
    const wsSessions = allSessions.filter(s => s.worktreeId && worktreeIds.includes(s.worktreeId));

    // Determine status based on sessions
    let status: 'idle' | 'thinking' | 'writing' | 'error' = 'idle';
    
    // Check for any running sessions
    const runningSession = wsSessions.find(s => s.status === 'running');
    if (runningSession) {
      status = 'thinking'; // Could be more granular based on session activity
    }

    // Check for any error sessions (most recent)
    const errorSession = wsSessions.find(s => s.status === 'error');
    if (errorSession) {
      status = 'error';
    }

    return {
      id: ws.id,
      name: ws.name,
      status,
      worktreeCount: wsWorktrees.length,
      activeSessionCount: wsSessions.filter(s => s.status === 'running').length,
    };
  });

  return workspaceData;
}

// Allow null, undefined, void, or empty object (RPC sends null when params is undefined)
export const GetWorkspacesWithStatusSchema = z.union([
  z.undefined(),
  z.null(),
  z.void(),
  z.object({}).strict(),
]);
