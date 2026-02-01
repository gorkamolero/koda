import { z } from 'zod';
import { execSync } from 'node:child_process';
import * as fs from 'node:fs';
import { eq } from 'drizzle-orm';
import { getDb } from '../db/index.js';
import { worktrees, repos } from '../db/schema.js';

/**
 * Create PR Schema
 */
export const CreatePrSchema = z.object({
  worktreeId: z.string().uuid(),
  title: z.string().optional(),
  body: z.string().optional(),
  draft: z.boolean().optional().default(false),
});

/**
 * Get Checks Schema
 */
export const GetChecksSchema = z.object({
  worktreeId: z.string().uuid(),
});

export type CreatePrInput = z.input<typeof CreatePrSchema>;
export type GetChecksInput = z.input<typeof GetChecksSchema>;

/**
 * PR creation result
 */
export interface PrResult {
  url: string;
  number: number;
  state: 'open' | 'draft';
}

/**
 * Check status from GitHub Actions
 */
export interface GhCheck {
  id: string;
  name: string;
  status: 'pending' | 'running' | 'success' | 'failure' | 'skipped';
  description?: string;
  duration?: string;
  url?: string;
}

/**
 * Checks result
 */
export interface ChecksResult {
  checks: GhCheck[];
  prUrl?: string;
  commitSha?: string;
}

/**
 * Execute gh CLI command
 */
function ghCommand(cwd: string, args: string): string | null {
  try {
    return execSync(`gh ${args}`, {
      cwd,
      encoding: 'utf-8',
      stdio: ['pipe', 'pipe', 'pipe'],
    }).toString().trim();
  } catch (err) {
    console.error('gh command failed:', args, err);
    return null;
  }
}

/**
 * Check if gh CLI is available and authenticated
 */
function checkGhAuth(cwd: string): boolean {
  const result = ghCommand(cwd, 'auth status');
  return result !== null;
}

/**
 * Create a pull request for a worktree
 */
export async function createPr(
  input: CreatePrInput,
  db?: ReturnType<typeof getDb>
): Promise<PrResult> {
  const database = db ?? getDb();
  const isDraft = input.draft ?? false;

  // Get worktree
  const worktree = await database.query.worktrees.findFirst({
    where: eq(worktrees.id, input.worktreeId),
  });

  if (!worktree) {
    throw new Error(`Worktree not found: ${input.worktreeId}`);
  }

  const repoPath = worktree.worktreePath;
  if (!repoPath || !fs.existsSync(repoPath)) {
    throw new Error('Worktree path does not exist');
  }

  // Check gh auth
  if (!checkGhAuth(repoPath)) {
    throw new Error('GitHub CLI not authenticated. Run "gh auth login" in terminal.');
  }

  // Get repo for target branch
  const repo = await database.query.repos.findFirst({
    where: eq(repos.id, worktree.repoId),
  });

  const targetBranch = worktree.intendedTargetBranch ?? repo?.defaultBranch ?? 'main';

  // Ensure branch is pushed
  try {
    execSync(`git push -u origin ${worktree.branch}`, {
      cwd: repoPath,
      stdio: 'pipe',
    });
  } catch {
    // Branch might already be pushed, continue
  }

  // Build PR title - use provided or auto-generate from branch
  const title = input.title ?? formatBranchAsTitle(worktree.branch ?? '');

  // Build gh pr create command
  const args: string[] = [
    'pr', 'create',
    '--base', targetBranch,
    '--title', JSON.stringify(title),
  ];

  if (input.body) {
    args.push('--body', JSON.stringify(input.body));
  } else {
    args.push('--fill');
  }

  if (isDraft) {
    args.push('--draft');
  }

  const result = ghCommand(repoPath, args.join(' '));

  if (!result) {
    throw new Error('Failed to create pull request');
  }

  // Parse the PR URL from output (gh pr create outputs the URL)
  const urlMatch = result.match(/https:\/\/github\.com\/[^\s]+\/pull\/\d+/);
  const url = urlMatch ? urlMatch[0] : result;

  // Extract PR number from URL
  const numberMatch = url.match(/\/pull\/(\d+)/);
  const number = numberMatch ? parseInt(numberMatch[1], 10) : 0;

  return {
    url,
    number,
    state: isDraft ? 'draft' : 'open',
  };
}

/**
 * Get CI/CD checks for a worktree
 */
export async function getChecks(
  input: GetChecksInput,
  db?: ReturnType<typeof getDb>
): Promise<ChecksResult> {
  const database = db ?? getDb();

  // Get worktree
  const worktree = await database.query.worktrees.findFirst({
    where: eq(worktrees.id, input.worktreeId),
  });

  if (!worktree) {
    throw new Error(`Worktree not found: ${input.worktreeId}`);
  }

  const repoPath = worktree.worktreePath;
  if (!repoPath || !fs.existsSync(repoPath)) {
    return { checks: [] };
  }

  // Check gh auth
  if (!checkGhAuth(repoPath)) {
    return { checks: [] };
  }

  // Get current commit SHA
  let commitSha: string | null = null;
  try {
    commitSha = execSync('git rev-parse HEAD', {
      cwd: repoPath,
      encoding: 'utf-8',
      stdio: ['pipe', 'pipe', 'pipe'],
    }).toString().trim();
  } catch {
    return { checks: [] };
  }

  // Try to get PR URL if one exists
  const prUrl = ghCommand(repoPath, 'pr view --json url --jq .url');

  // Get check runs for the current commit using gh
  const checksJson = ghCommand(
    repoPath,
    `api repos/{owner}/{repo}/commits/${commitSha}/check-runs --jq '.check_runs'`
  );

  if (!checksJson) {
    return { checks: [], commitSha, prUrl: prUrl ?? undefined };
  }

  try {
    const rawChecks = JSON.parse(checksJson) as Array<{
      id: number;
      name: string;
      status: string;
      conclusion: string | null;
      html_url: string;
      started_at: string;
      completed_at: string | null;
    }>;

    const checks: GhCheck[] = rawChecks.map((check) => ({
      id: String(check.id),
      name: check.name,
      status: mapCheckStatus(check.status, check.conclusion),
      url: check.html_url,
      duration: check.completed_at && check.started_at
        ? formatDuration(new Date(check.started_at), new Date(check.completed_at))
        : undefined,
    }));

    return {
      checks,
      prUrl: prUrl ?? undefined,
      commitSha,
    };
  } catch {
    return { checks: [], commitSha, prUrl: prUrl ?? undefined };
  }
}

/**
 * Map GitHub check status to our status type
 */
function mapCheckStatus(status: string, conclusion: string | null): GhCheck['status'] {
  if (status === 'queued') return 'pending';
  if (status === 'in_progress') return 'running';

  if (status === 'completed') {
    switch (conclusion) {
      case 'success':
        return 'success';
      case 'failure':
      case 'timed_out':
        return 'failure';
      case 'skipped':
      case 'cancelled':
        return 'skipped';
      default:
        return 'pending';
    }
  }

  return 'pending';
}

/**
 * Format branch name as PR title
 * e.g., "feature/add-user-auth" -> "Add user auth"
 */
function formatBranchAsTitle(branch: string): string {
  // Remove common prefixes
  const cleaned = branch
    .replace(/^(feature|fix|bugfix|hotfix|chore|refactor|docs|test)\//, '')
    .replace(/[-_]/g, ' ')
    .trim();

  // Capitalize first letter
  return cleaned.charAt(0).toUpperCase() + cleaned.slice(1);
}

/**
 * Format duration between two dates
 */
function formatDuration(start: Date, end: Date): string {
  const seconds = Math.floor((end.getTime() - start.getTime()) / 1000);

  if (seconds < 60) return `${seconds}s`;
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m`;
  return `${Math.floor(seconds / 3600)}h ${Math.floor((seconds % 3600) / 60)}m`;
}
