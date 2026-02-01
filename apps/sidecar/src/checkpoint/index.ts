/**
 * Git Checkpoint Module
 *
 * Provides undo functionality for agent changes by capturing and
 * restoring git state (HEAD, index, worktree) at each turn.
 */

import { z } from 'zod';
import { getDb } from '../db/index.js';
import {
  saveCheckpoint as saveCheckpointService,
  restoreCheckpoint as restoreCheckpointService,
  diffCheckpoints as diffCheckpointsService,
  getCheckpoint as getCheckpointService,
  getCheckpointsByWorktree as getCheckpointsByWorktreeService,
  type SaveCheckpointInput,
  type FileDiff,
  type DiffSummary,
  type CheckpointDiff,
} from './service.js';

// Re-export types
export type { SaveCheckpointInput, FileDiff, DiffSummary, CheckpointDiff };

// Re-export service functions for direct use
export {
  saveCheckpointService as saveCheckpoint,
  restoreCheckpointService as restoreCheckpoint,
  diffCheckpointsService as diffCheckpoints,
  getCheckpointService as getCheckpoint,
  getCheckpointsByWorktreeService as getCheckpointsByWorktree,
};

// ============================================================================
// RPC Schemas
// ============================================================================

export const SaveCheckpointSchema = z.object({
  worktreeId: z.string().uuid(),
  turnId: z.string(),
  repoPath: z.string(),
});

export const RestoreCheckpointSchema = z.object({
  checkpointId: z.string().uuid(),
  repoPath: z.string(),
});

export const DiffCheckpointsSchema = z.object({
  checkpointId1: z.string().uuid(),
  checkpointId2: z.string().uuid(),
  repoPath: z.string(),
});

export const GetCheckpointSchema = z.object({
  checkpointId: z.string().uuid(),
});

export const GetCheckpointsByWorktreeSchema = z.object({
  worktreeId: z.string().uuid(),
});

// ============================================================================
// RPC Handlers
// ============================================================================

export async function rpcSaveCheckpoint(input: z.infer<typeof SaveCheckpointSchema>) {
  const db = getDb();
  return saveCheckpointService(db, input);
}

export async function rpcRestoreCheckpoint(input: z.infer<typeof RestoreCheckpointSchema>) {
  const db = getDb();
  restoreCheckpointService(db, input.checkpointId, input.repoPath);
  return { success: true };
}

export async function rpcDiffCheckpoints(input: z.infer<typeof DiffCheckpointsSchema>) {
  const db = getDb();
  return diffCheckpointsService(db, input.checkpointId1, input.checkpointId2, input.repoPath);
}

export async function rpcGetCheckpoint(input: z.infer<typeof GetCheckpointSchema>) {
  const db = getDb();
  return getCheckpointService(db, input.checkpointId) ?? null;
}

export async function rpcGetCheckpointsByWorktree(input: z.infer<typeof GetCheckpointsByWorktreeSchema>) {
  const db = getDb();
  return getCheckpointsByWorktreeService(db, input.worktreeId);
}
