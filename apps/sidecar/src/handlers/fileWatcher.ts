import { execSync } from 'node:child_process';
import { getDb } from '../db/index.js';
import { worktrees, activity } from '../db/schema.js';
import { eq } from 'drizzle-orm';
import { randomUUID } from 'node:crypto';

// Track files we've already created activity for
const seenFiles = new Map<string, Set<string>>(); // worktreeId -> Set of file paths

/**
 * Check for file changes in a worktree and create activity entries for new/modified files.
 * This is called periodically and when the activity feed is queried.
 */
export async function checkFileChanges(worktreeId: string): Promise<void> {
  const db = getDb();

  // Get worktree
  const worktree = await db.query.worktrees.findFirst({
    where: eq(worktrees.id, worktreeId),
  });

  if (!worktree || !worktree.worktreePath) {
    return;
  }

  const cwd = worktree.worktreePath;
  const workspaceId = worktree.workspaceIds ? 
    (JSON.parse(worktree.workspaceIds) as string[])[0] : null;

  if (!workspaceId) {
    return;
  }

  // Initialize seen files for this worktree
  if (!seenFiles.has(worktreeId)) {
    // On first check, record existing files so we don't create entries for them
    try {
      const initialStatus = execSync('git status --porcelain', {
        cwd,
        encoding: 'utf-8',
        stdio: ['pipe', 'pipe', 'pipe'],
      });
      
      const initialPaths = new Set<string>();
      for (const line of initialStatus.split('\n')) {
        if (line.trim()) {
          // Status format: "XY filename" or "XY old -> new" for renames
          const match = line.match(/^..\s+(.+?)(?:\s+->\s+.+)?$/);
          if (match) {
            initialPaths.add(match[1]);
          }
        }
      }
      seenFiles.set(worktreeId, initialPaths);
    } catch {
      seenFiles.set(worktreeId, new Set());
    }
    return; // Don't create entries on first scan
  }

  try {
    // Get current git status
    const status = execSync('git status --porcelain', {
      cwd,
      encoding: 'utf-8',
      stdio: ['pipe', 'pipe', 'pipe'],
    });

    const knownFiles = seenFiles.get(worktreeId)!;
    const newEntries: Array<{
      id: string;
      workspaceId: string;
      type: string;
      title: string;
      description: string | null;
      navigateTo: string | null;
      read: boolean;
    }> = [];

    for (const line of status.split('\n')) {
      if (!line.trim()) continue;

      // Parse status line
      const match = line.match(/^(..)?\s+(.+?)(?:\s+->\s+(.+))?$/);
      if (!match) continue;

      const [, statusCode, filename, renamedTo] = match;
      const displayName = renamedTo || filename;

      // Skip if we've already created an entry for this file
      if (knownFiles.has(displayName)) continue;

      // Determine change type
      let title = displayName;
      const code = statusCode?.trim() || '';
      
      if (code.includes('A') || code === '??') {
        title = `New file: ${displayName}`;
      } else if (code.includes('M')) {
        title = `Modified: ${displayName}`;
      } else if (code.includes('D')) {
        title = `Deleted: ${displayName}`;
      } else if (code.includes('R')) {
        title = `Renamed: ${filename} → ${renamedTo}`;
      } else {
        title = `Changed: ${displayName}`;
      }

      // Mark as seen
      knownFiles.add(displayName);

      // Create activity entry
      newEntries.push({
        id: randomUUID(),
        workspaceId,
        type: 'file_change',
        title,
        description: null,
        navigateTo: JSON.stringify({
          view: 'diff',
          params: { file: displayName },
        }),
        read: false,
      });
    }

    // Batch insert new entries
    if (newEntries.length > 0) {
      await db.insert(activity).values(newEntries);
    }
  } catch (err) {
    // Silently fail - file watching is best-effort
    console.error('File change detection failed:', err);
  }
}

/**
 * Start periodic file change checking for all active worktrees
 */
let pollingInterval: NodeJS.Timeout | null = null;

export function startFileWatching(): void {
  if (pollingInterval) return;

  pollingInterval = setInterval(async () => {
    try {
      const db = getDb();
      const activeWorktrees = await db.query.worktrees.findMany({
        where: eq(worktrees.state, 'active'),
      });

      for (const wt of activeWorktrees) {
        await checkFileChanges(wt.id);
      }
    } catch (err) {
      // Silently fail - file watching is best-effort
      // Don't crash the sidecar for file watching errors
      console.error('[FileWatcher] Error during polling:', err);
    }
  }, 3000); // Poll every 3 seconds
}

export function stopFileWatching(): void {
  if (pollingInterval) {
    clearInterval(pollingInterval);
    pollingInterval = null;
  }
}

/**
 * Clear seen files for a worktree (e.g., when it's deleted)
 */
export function clearWorktreeFileCache(worktreeId: string): void {
  seenFiles.delete(worktreeId);
}
