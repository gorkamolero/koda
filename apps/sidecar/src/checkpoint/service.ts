/**
 * Git Checkpoint Service
 *
 * Implements undo functionality for agent changes by capturing and restoring
 * git state (HEAD, index, worktree) at each turn.
 *
 * Key operations:
 * - saveCheckpoint: Capture current git state
 * - restoreCheckpoint: Restore git state from a checkpoint
 * - diffCheckpoints: Show changes between two checkpoints
 */

import { execSync, execFileSync, type ExecSyncOptions } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { randomUUID } from 'node:crypto';
import { eq } from 'drizzle-orm';
import type { BetterSQLite3Database } from 'drizzle-orm/better-sqlite3';
import { gitCheckpoints, type GitCheckpoint } from '../db/schema.js';
import type * as schema from '../db/schema.js';

/**
 * Input for saving a checkpoint
 */
export interface SaveCheckpointInput {
  worktreeId: string;
  turnId: string;
  repoPath: string;
}

/**
 * File change information in a diff
 */
export interface FileDiff {
  path: string;
  status: 'added' | 'modified' | 'deleted' | 'renamed';
  diff?: string;
  additions?: number;
  deletions?: number;
}

/**
 * Summary statistics for a diff
 */
export interface DiffSummary {
  filesChanged: number;
  additions: number;
  deletions: number;
}

/**
 * Result of comparing two checkpoints
 */
export interface CheckpointDiff {
  files: FileDiff[];
  summary: DiffSummary;
}

type DbType = BetterSQLite3Database<typeof schema>;

/**
 * Execute a git command in the specified repository
 */
function git(repoPath: string, args: string): string {
  const options: ExecSyncOptions = {
    cwd: repoPath,
    encoding: 'utf-8',
    stdio: ['pipe', 'pipe', 'pipe'],
  };
  return execSync(`git ${args}`, options).toString().trim();
}

/**
 * Execute a git command that may fail gracefully
 */
function gitMayFail(repoPath: string, args: string): string | null {
  try {
    return git(repoPath, args);
  } catch {
    return null;
  }
}

/**
 * Save the current git state as a checkpoint
 *
 * Captures:
 * - HEAD commit SHA
 * - Index tree (staged changes)
 * - Worktree tree (all current files including unstaged)
 */
export function saveCheckpoint(
  db: DbType,
  input: SaveCheckpointInput
): GitCheckpoint {
  const { worktreeId, turnId, repoPath } = input;

  // Get current HEAD
  const headOid = git(repoPath, 'rev-parse HEAD');

  // Get the current index tree
  // This captures staged changes
  const indexTree = git(repoPath, 'write-tree');

  // Capture the entire worktree including unstaged changes
  // We do this by:
  // 1. Adding all files to a temporary index
  // 2. Writing that tree
  // 3. Restoring the original index
  const worktreeTree = captureWorktreeTree(repoPath);

  const checkpoint: GitCheckpoint = {
    id: randomUUID(),
    worktreeId,
    turnId,
    headOid,
    indexTree,
    worktreeTree,
    createdAt: new Date().toISOString(),
  };

  db.insert(gitCheckpoints).values(checkpoint).run();

  return checkpoint;
}

/**
 * Capture the worktree state as a tree object
 *
 * This includes both staged and unstaged changes by:
 * 1. Saving the current index
 * 2. Adding all files to the index
 * 3. Writing the tree
 * 4. Restoring the original index
 */
function captureWorktreeTree(repoPath: string): string {
  // Never stage or check out the user's real index. Restoring it with
  // checkout-index would overwrite the very unstaged edits being captured.
  const directory = mkdtempSync(join(tmpdir(), 'koda-checkpoint-'));
  const env = { ...process.env, GIT_INDEX_FILE: join(directory, 'index') };
  const run = (...args: string[]) => execFileSync('git', args, {
    cwd: repoPath, env, encoding: 'utf-8', stdio: ['pipe', 'pipe', 'pipe'],
  }).trim();
  try {
    run('read-tree', 'HEAD');
    run('add', '-A');
    return run('write-tree');
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
}

/**
 * Get a checkpoint by ID
 */
export function getCheckpoint(db: DbType, checkpointId: string): GitCheckpoint | undefined {
  const result = db
    .select()
    .from(gitCheckpoints)
    .where(eq(gitCheckpoints.id, checkpointId))
    .get();

  return result;
}

/**
 * Get all checkpoints for a worktree
 */
export function getCheckpointsByWorktree(db: DbType, worktreeId: string): GitCheckpoint[] {
  return db
    .select()
    .from(gitCheckpoints)
    .where(eq(gitCheckpoints.worktreeId, worktreeId))
    .all();
}

/**
 * Restore git state from a checkpoint
 *
 * This restores:
 * - HEAD to the checkpoint's commit
 * - Index to the checkpoint's staged state
 * - Worktree to the checkpoint's file state
 */
export function restoreCheckpoint(
  db: DbType,
  checkpointId: string,
  repoPath: string
): void {
  const checkpoint = getCheckpoint(db, checkpointId);

  if (!checkpoint) {
    throw new Error(`Checkpoint not found: ${checkpointId}`);
  }

  const { headOid, indexTree, worktreeTree } = checkpoint;

  if (!headOid || !indexTree || !worktreeTree) {
    throw new Error(`Invalid checkpoint data: ${checkpointId}`);
  }

  // 1. Reset HEAD to the checkpoint's commit
  git(repoPath, `reset --hard ${headOid}`);

  // 2. Restore the worktree from the worktree tree
  // This includes any uncommitted changes that were present
  git(repoPath, `read-tree ${worktreeTree}`);
  git(repoPath, 'checkout-index -a -f');

  // 3. Clean up any files that aren't in the checkpoint
  // checkout-index only writes files from the index; it doesn't delete
  // files that exist in the worktree but not in the tree
  // Ignored files (credentials, dependencies) are outside the checkpoint and
  // must survive restore. Only remove non-ignored files absent from its tree.
  git(repoPath, 'clean -fd');

  // 4. Restore the index to the checkpoint's staged state
  git(repoPath, `read-tree ${indexTree}`);
}

/**
 * Compare two checkpoints and return the differences
 *
 * Shows what changed between checkpoint1 and checkpoint2
 */
export function diffCheckpoints(
  db: DbType,
  checkpointId1: string,
  checkpointId2: string,
  repoPath: string
): CheckpointDiff {
  const checkpoint1 = getCheckpoint(db, checkpointId1);
  const checkpoint2 = getCheckpoint(db, checkpointId2);

  if (!checkpoint1) {
    throw new Error(`Checkpoint not found: ${checkpointId1}`);
  }
  if (!checkpoint2) {
    throw new Error(`Checkpoint not found: ${checkpointId2}`);
  }

  // Compare the worktree trees to see all changes
  // (including uncommitted changes)
  const tree1 = checkpoint1.worktreeTree || checkpoint1.headOid;
  const tree2 = checkpoint2.worktreeTree || checkpoint2.headOid;

  if (!tree1 || !tree2) {
    throw new Error('Invalid checkpoint data');
  }

  // If the trees are the same, no changes
  if (tree1 === tree2) {
    return {
      files: [],
      summary: {
        filesChanged: 0,
        additions: 0,
        deletions: 0,
      },
    };
  }

  // Get the diff between the two trees
  const diffOutput = gitMayFail(repoPath, `diff ${tree1} ${tree2} --stat --numstat`);
  const patchOutput = gitMayFail(repoPath, `diff ${tree1} ${tree2}`);

  return parseDiff(diffOutput || '', patchOutput || '');
}

/**
 * Parse git diff output into structured data
 */
function parseDiff(statOutput: string, patchOutput: string): CheckpointDiff {
  const files: FileDiff[] = [];
  let totalAdditions = 0;
  let totalDeletions = 0;

  // Parse --numstat output (format: additions\tdeletions\tfilename)
  const statLines = statOutput.split('\n').filter((line) => line.includes('\t'));

  for (const line of statLines) {
    const match = line.match(/^(\d+|-)\t(\d+|-)\t(.+)$/);
    if (match) {
      const additions = match[1] === '-' ? 0 : parseInt(match[1], 10);
      const deletions = match[2] === '-' ? 0 : parseInt(match[2], 10);
      const filePath = match[3];

      // Determine status based on additions/deletions
      let status: FileDiff['status'] = 'modified';
      if (additions > 0 && deletions === 0) {
        // Check if it's a new file by looking at the patch
        if (patchOutput.includes(`new file mode`) && patchOutput.includes(filePath)) {
          status = 'added';
        }
      } else if (additions === 0 && deletions > 0) {
        if (patchOutput.includes(`deleted file mode`) && patchOutput.includes(filePath)) {
          status = 'deleted';
        }
      }

      // Extract the diff for this specific file
      const fileDiff = extractFileDiff(patchOutput, filePath);

      files.push({
        path: filePath,
        status,
        diff: fileDiff,
        additions,
        deletions,
      });

      totalAdditions += additions;
      totalDeletions += deletions;
    }
  }

  return {
    files,
    summary: {
      filesChanged: files.length,
      additions: totalAdditions,
      deletions: totalDeletions,
    },
  };
}

/**
 * Extract the diff section for a specific file
 */
function extractFileDiff(patchOutput: string, filePath: string): string | undefined {
  // Look for the diff header for this file
  const escapedPath = filePath.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const diffPattern = new RegExp(
    `diff --git a/${escapedPath} b/${escapedPath}[\\s\\S]*?(?=diff --git|$)`,
    'g'
  );

  const match = patchOutput.match(diffPattern);
  return match?.[0];
}
