import { z } from 'zod';
import { eq } from 'drizzle-orm';
import { getDb } from '../db/index.js';
import { worktrees } from '../db/schema.js';
import { getPulseManager } from './manager.js';
import {
  StartPulseSchema,
  StopPulseSchema,
  GetPulseStatusSchema,
  type PulseInfo,
} from './types.js';

// Re-export types and schemas
export * from './types.js';
export { getPulseManager } from './manager.js';

// ============================================================================
// RPC Handlers
// ============================================================================

/**
 * Start pulse for a worktree
 */
export async function rpcStartPulse(
  input: z.infer<typeof StartPulseSchema>
): Promise<PulseInfo> {
  const db = getDb();
  const manager = getPulseManager();

  // Get worktree to find its path
  const worktree = db
    .select()
    .from(worktrees)
    .where(eq(worktrees.id, input.worktreeId))
    .get();

  if (!worktree) {
    throw new Error(`Worktree not found: ${input.worktreeId}`);
  }

  if (!worktree.worktreePath) {
    throw new Error(`Worktree has no path set: ${input.worktreeId}`);
  }

  return manager.start(input.worktreeId, worktree.worktreePath, input.repoRootPath);
}

/**
 * Stop pulse for a worktree
 */
export async function rpcStopPulse(
  input: z.infer<typeof StopPulseSchema>
): Promise<PulseInfo | null> {
  const manager = getPulseManager();
  return manager.stop(input.worktreeId);
}

/**
 * Get pulse status for a worktree
 */
export async function rpcGetPulseStatus(
  input: z.infer<typeof GetPulseStatusSchema>
): Promise<PulseInfo | null> {
  const manager = getPulseManager();
  return manager.getInfo(input.worktreeId);
}

/**
 * List all active pulses
 */
export async function rpcListActivePulses(): Promise<PulseInfo[]> {
  const manager = getPulseManager();
  return manager.listActive();
}

// Export schemas for registration
export { StartPulseSchema, StopPulseSchema, GetPulseStatusSchema };
