import { z } from 'zod'
import { execSync } from 'node:child_process'
import { getWorktree as dbGetWorktree } from './worktree.js'

// =============================================================================
// Schemas
// =============================================================================

export const GetWorkspaceDiffSchema = z.object({
  worktreeId: z.string(),
  stat: z.boolean().optional(),
  file: z.string().optional(),
})

export type GetWorkspaceDiffParams = z.infer<typeof GetWorkspaceDiffSchema>

export interface WorkspaceDiffResult {
  diff: string
  mergeBase?: string
  error?: string
}

// =============================================================================
// Handler
// =============================================================================

/**
 * Get workspace diff - all changes on current branch vs merge base
 *
 * This is what Claude sees when it calls GetWorkspaceDiff MCP tool.
 * Returns unified diff format for code review.
 */
export async function getWorkspaceDiff(
  params: GetWorkspaceDiffParams
): Promise<WorkspaceDiffResult> {
  const { worktreeId, stat, file } = params

  // Get worktree to find the repo path
  let worktree
  try {
    worktree = await dbGetWorktree({ worktreeId })
  } catch {
    return { diff: '', error: `Worktree not found: ${worktreeId}` }
  }

  const cwd = worktree.worktreePath
  if (!cwd) {
    return { diff: '', error: 'Worktree has no path' }
  }

  try {
    // Find the default branch (main or master)
    let defaultBranch = 'main'
    try {
      const remoteBranch = execSync('git rev-parse --abbrev-ref origin/HEAD', {
        cwd,
        encoding: 'utf-8',
        stdio: ['pipe', 'pipe', 'pipe'],
      }).trim()
      defaultBranch = remoteBranch.replace('origin/', '')
    } catch {
      // If origin/HEAD isn't set, try to detect main vs master
      try {
        execSync('git rev-parse --verify origin/main', { cwd, stdio: ['pipe', 'pipe', 'pipe'] })
        defaultBranch = 'main'
      } catch {
        try {
          execSync('git rev-parse --verify origin/master', { cwd, stdio: ['pipe', 'pipe', 'pipe'] })
          defaultBranch = 'master'
        } catch {
          // Fall back to 'main' if neither exists
          defaultBranch = 'main'
        }
      }
    }

    // Get merge base with default branch
    let mergeBase: string
    try {
      mergeBase = execSync(`git merge-base HEAD origin/${defaultBranch}`, {
        cwd,
        encoding: 'utf-8',
        stdio: ['pipe', 'pipe', 'pipe'],
      }).trim()
    } catch {
      // If no merge base, diff against empty tree (show all files)
      mergeBase = execSync('git hash-object -t tree /dev/null', {
        cwd,
        encoding: 'utf-8',
      }).trim()
    }

    // Build diff command
    // Include both staged and unstaged changes (working tree diff)
    const args = ['diff', mergeBase, 'HEAD']

    // Also include uncommitted changes
    const uncommittedArgs = ['diff', 'HEAD']

    if (stat) {
      args.push('--stat')
      uncommittedArgs.push('--stat')
    }

    if (file) {
      args.push('--', file)
      uncommittedArgs.push('--', file)
    }

    // Get committed changes since merge base
    const committedDiff = execSync(`git ${args.join(' ')}`, {
      cwd,
      encoding: 'utf-8',
      maxBuffer: 50 * 1024 * 1024, // 50MB buffer for large diffs
    })

    // Get uncommitted changes (working tree)
    const uncommittedDiff = execSync(`git ${uncommittedArgs.join(' ')}`, {
      cwd,
      encoding: 'utf-8',
      maxBuffer: 50 * 1024 * 1024,
    })

    // Combine both diffs
    // For --stat mode, the summary is at the end so we need to handle it differently
    let combinedDiff = committedDiff
    if (uncommittedDiff.trim()) {
      if (stat) {
        // For stat mode, both outputs have summary lines, show them both
        combinedDiff = `${committedDiff.trim()}\n\n--- Uncommitted changes ---\n${uncommittedDiff}`
      } else {
        // For full diff, concatenate
        combinedDiff = `${committedDiff}${uncommittedDiff}`
      }
    }

    return {
      diff: combinedDiff,
      mergeBase,
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    return { diff: '', error: `Failed to get diff: ${message}` }
  }
}
