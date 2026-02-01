import { z } from 'zod';
import { eq, and } from 'drizzle-orm';
import { randomUUID } from 'node:crypto';
import * as path from 'node:path';
import * as fs from 'node:fs';
import { execSync } from 'node:child_process';
import { getDb } from '../db/index.js';
import { worktrees, repos, type Worktree } from '../db/schema.js';

/**
 * Koda config schema (from .koda/config.json)
 */
export const KodaConfigSchema = z.object({
  setup: z.array(z.string()).optional(),
  teardown: z.array(z.string()).optional(),
  customPrompt: z.string().optional(),
  runScript: z.string().optional(),
  env: z.record(z.string()).optional(),
});

export type KodaConfig = z.infer<typeof KodaConfigSchema>;

/**
 * Worktree schemas
 */
export const CreateWorktreeSchema = z.object({
  repoId: z.string().min(1),
  branch: z.string().min(1),
  fromBranch: z.string().optional(), // Base branch to create from (defaults to repo's defaultBranch)
  workspaceId: z.string().uuid().optional(), // Optional workspace to add this worktree to
});

export const DeleteWorktreeSchema = z.object({
  worktreeId: z.string().uuid(),
  deleteBranch: z.boolean().optional().default(false),
  force: z.boolean().optional().default(false),
});

export const GetWorktreeSchema = z.object({
  worktreeId: z.string().uuid(),
});

export const ListWorktreesSchema = z.object({
  repoId: z.string().min(1),
  includeArchived: z.boolean().optional().default(false),
});

export const ListWorktreesByWorkspaceSchema = z.object({
  workspaceId: z.string().uuid(),
  includeArchived: z.boolean().optional().default(false),
});

export const AddWorktreeToWorkspaceSchema = z.object({
  worktreeId: z.string().uuid(),
  workspaceId: z.string().uuid(),
});

export const RemoveWorktreeFromWorkspaceSchema = z.object({
  worktreeId: z.string().uuid(),
  workspaceId: z.string().uuid(),
});

// Use z.input for handler function signatures (allows optional fields before defaults)
export type CreateWorktreeInput = z.input<typeof CreateWorktreeSchema>;
export type DeleteWorktreeInput = z.input<typeof DeleteWorktreeSchema>;
export type GetWorktreeInput = z.input<typeof GetWorktreeSchema>;
export type ListWorktreesInput = z.input<typeof ListWorktreesSchema>;
export type ListWorktreesByWorkspaceInput = z.input<typeof ListWorktreesByWorkspaceSchema>;
export type AddWorktreeToWorkspaceInput = z.input<typeof AddWorktreeToWorkspaceSchema>;
export type RemoveWorktreeFromWorkspaceInput = z.input<typeof RemoveWorktreeFromWorkspaceSchema>;

/**
 * Extended worktree type with setup error info
 */
export interface WorktreeResult extends Worktree {
  setupError?: string;
}

/**
 * Script execution result
 */
export interface ScriptResult {
  success: boolean;
  error?: string;
  errors?: string[];
  output?: string;
}

/**
 * Sanitize branch name for use as directory name
 * Replaces / with - and removes other problematic characters
 */
function sanitizeBranchName(branch: string): string {
  return branch.replace(/\//g, '-').replace(/[^a-zA-Z0-9._-]/g, '');
}

/**
 * Read .koda/config.json from a repository
 */
export async function readKodaConfig(repoPath: string): Promise<KodaConfig | null> {
  const configPath = path.join(repoPath, '.koda', 'config.json');

  if (!fs.existsSync(configPath)) {
    return null;
  }

  try {
    const content = fs.readFileSync(configPath, 'utf-8');
    const parsed = JSON.parse(content);
    const result = KodaConfigSchema.safeParse(parsed);

    if (result.success) {
      return result.data;
    }

    console.warn('Invalid .koda/config.json schema:', result.error);
    return null;
  } catch (err) {
    console.warn('Failed to read .koda/config.json:', err);
    return null;
  }
}

/**
 * Run setup scripts in a directory
 */
export async function runSetupScripts(
  scripts: string[],
  cwd: string,
  env: Record<string, string>
): Promise<ScriptResult> {
  const fullEnv = { ...process.env, ...env };

  for (const script of scripts) {
    try {
      execSync(script, {
        cwd,
        env: fullEnv,
        shell: '/bin/bash',
        stdio: 'pipe',
      });
    } catch (err) {
      const error = err instanceof Error ? err.message : String(err);
      return { success: false, error };
    }
  }

  return { success: true };
}

/**
 * Run teardown scripts in a directory
 * Continues on failure by default (best-effort cleanup)
 */
export async function runTeardownScripts(
  scripts: string[],
  cwd: string,
  env: Record<string, string>
): Promise<ScriptResult> {
  const fullEnv = { ...process.env, ...env };
  const errors: string[] = [];

  for (const script of scripts) {
    try {
      execSync(script, {
        cwd,
        env: fullEnv,
        shell: '/bin/bash',
        stdio: 'pipe',
      });
    } catch (err) {
      const error = err instanceof Error ? err.message : String(err);
      errors.push(error);
      // Continue execution for teardown (best-effort cleanup)
    }
  }

  if (errors.length > 0) {
    return { success: false, errors };
  }

  return { success: true };
}

/**
 * Create a git worktree and worktree record
 */
export async function createWorktree(
  input: CreateWorktreeInput,
  db?: ReturnType<typeof getDb>
): Promise<WorktreeResult> {
  const database = db ?? getDb();

  // Get repository
  const repo = await database.query.repos.findFirst({
    where: eq(repos.id, input.repoId),
  });

  if (!repo) {
    throw new Error(`Repository not found: ${input.repoId}`);
  }

  if (!repo.rootPath || !fs.existsSync(repo.rootPath)) {
    throw new Error(`Repository path does not exist: ${repo.rootPath}`);
  }

  const repoPath = repo.rootPath;
  const directoryName = sanitizeBranchName(input.branch);
  const worktreesDir = path.join(repoPath, '.worktrees');
  const worktreePath = path.join(worktreesDir, directoryName);

  // Ensure .worktrees directory exists
  fs.mkdirSync(worktreesDir, { recursive: true });

  // Check if worktree already exists
  if (fs.existsSync(worktreePath)) {
    throw new Error(`Worktree already exists at: ${worktreePath}`);
  }

  // Check if repository has any commits
  try {
    execSync('git rev-parse HEAD', { cwd: repoPath, stdio: 'pipe' });
  } catch {
    throw new Error('Repository has no commits. Cannot create worktree.');
  }

  // Check if branch already exists
  let branchExists = false;
  try {
    execSync(`git rev-parse --verify ${input.branch}`, { cwd: repoPath, stdio: 'pipe' });
    branchExists = true;
  } catch {
    branchExists = false;
  }

  // Create the worktree
  try {
    if (branchExists) {
      // Use existing branch
      execSync(`git worktree add "${worktreePath}" "${input.branch}"`, {
        cwd: repoPath,
        stdio: 'pipe',
      });
    } else {
      // Create new branch from base
      const baseBranch = input.fromBranch ?? repo.defaultBranch ?? 'main';
      execSync(`git worktree add -b "${input.branch}" "${worktreePath}" "${baseBranch}"`, {
        cwd: repoPath,
        stdio: 'pipe',
      });
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    throw new Error(`Failed to create worktree: ${message}`);
  }

  // Create worktree record
  const worktreeId = randomUUID();
  const workspaceIds = input.workspaceId ? [input.workspaceId] : [];

  const worktree: WorktreeResult = {
    id: worktreeId,
    repoId: input.repoId,
    branch: input.branch,
    worktreePath,
    workspaceIds: JSON.stringify(workspaceIds),
    worktreeType: 'standard',
    state: 'active',
    specContent: null,
    fixPlanContent: null,
    ralphEnabled: false,
    // Conductor-style defaults
    derivedStatus: 'in-progress',
    manualStatus: null,
    pinnedAt: null,
    notes: null,
    linkedWorktreeIds: null,
    unread: 0,
    activeSessionId: null,
    bigTerminalMode: false,
    intendedTargetBranch: null,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  await database.insert(worktrees).values({
    id: worktree.id,
    repoId: worktree.repoId,
    branch: worktree.branch,
    worktreePath: worktree.worktreePath,
    workspaceIds: worktree.workspaceIds,
    worktreeType: worktree.worktreeType,
    state: worktree.state,
  });

  // Read and run setup scripts
  const config = await readKodaConfig(repoPath);
  if (config?.setup && config.setup.length > 0) {
    const setupEnv: Record<string, string> = {
      KODA_WORKTREE_ID: worktreeId,
      KODA_BRANCH: input.branch,
      KODA_REPO_PATH: repoPath,
      KODA_WORKTREE_PATH: worktreePath,
      ...(config.env ?? {}),
    };

    const result = await runSetupScripts(config.setup, worktreePath, setupEnv);
    if (!result.success) {
      worktree.setupError = result.error;
    }
  }

  return worktree;
}

/**
 * Delete a git worktree and soft delete worktree record
 */
export async function deleteWorktree(
  input: DeleteWorktreeInput,
  db?: ReturnType<typeof getDb>
): Promise<Worktree> {
  const database = db ?? getDb();
  // Apply defaults for optional fields
  const deleteBranch = input.deleteBranch ?? false;
  const force = input.force ?? false;

  // Get worktree
  const worktree = await database.query.worktrees.findFirst({
    where: eq(worktrees.id, input.worktreeId),
  });

  if (!worktree) {
    throw new Error(`Worktree not found: ${input.worktreeId}`);
  }

  // If already archived, just return
  if (worktree.state === 'archived') {
    return worktree;
  }

  // Get repository
  const repo = await database.query.repos.findFirst({
    where: eq(repos.id, worktree.repoId),
  });

  if (!repo?.rootPath) {
    // Repository not found or has no path - just mark as archived
    await database
      .update(worktrees)
      .set({ state: 'archived', updatedAt: new Date().toISOString() })
      .where(eq(worktrees.id, input.worktreeId));

    return { ...worktree, state: 'archived' };
  }

  const repoPath = repo.rootPath;
  const worktreePath = worktree.worktreePath ?? path.join(repoPath, '.worktrees', sanitizeBranchName(worktree.branch ?? ''));

  // Read and run teardown scripts BEFORE removing worktree
  const config = await readKodaConfig(repoPath);
  if (config?.teardown && config.teardown.length > 0) {
    const teardownEnv: Record<string, string> = {
      KODA_WORKTREE_ID: worktree.id,
      KODA_BRANCH: worktree.branch ?? '',
      KODA_REPO_PATH: repoPath,
      KODA_WORKTREE_PATH: worktreePath,
      ...(config.env ?? {}),
    };

    // Run teardown scripts - use repo path if worktree doesn't exist
    const cwd = fs.existsSync(worktreePath) ? worktreePath : repoPath;
    await runTeardownScripts(config.teardown, cwd, teardownEnv);
  }

  // Remove the git worktree
  if (fs.existsSync(worktreePath)) {
    try {
      const forceFlag = force ? ' --force' : '';
      execSync(`git worktree remove "${worktreePath}"${forceFlag}`, {
        cwd: repoPath,
        stdio: 'pipe',
      });
    } catch {
      // If standard remove fails, try force remove
      try {
        execSync(`git worktree remove "${worktreePath}" --force`, {
          cwd: repoPath,
          stdio: 'pipe',
        });
      } catch {
        // Last resort: manual cleanup
        fs.rmSync(worktreePath, { recursive: true, force: true });
        execSync('git worktree prune', { cwd: repoPath, stdio: 'pipe' });
      }
    }
  }

  // Delete branch if requested
  if (deleteBranch && worktree.branch) {
    try {
      execSync(`git branch -D "${worktree.branch}"`, {
        cwd: repoPath,
        stdio: 'pipe',
      });
    } catch {
      // Branch might already be deleted or protected - ignore
    }
  }

  // Soft delete worktree (set state to archived)
  await database
    .update(worktrees)
    .set({ state: 'archived', updatedAt: new Date().toISOString() })
    .where(eq(worktrees.id, input.worktreeId));

  return { ...worktree, state: 'archived' };
}

/**
 * Get a worktree by ID
 */
export async function getWorktree(
  input: GetWorktreeInput,
  db?: ReturnType<typeof getDb>
): Promise<Worktree> {
  const database = db ?? getDb();

  const worktree = await database.query.worktrees.findFirst({
    where: eq(worktrees.id, input.worktreeId),
  });

  if (!worktree) {
    throw new Error(`Worktree not found: ${input.worktreeId}`);
  }

  return worktree;
}

/**
 * List worktrees for a repository
 */
export async function listWorktrees(
  input: ListWorktreesInput,
  db?: ReturnType<typeof getDb>
): Promise<Worktree[]> {
  const database = db ?? getDb();
  // Apply default for optional field
  const includeArchived = input.includeArchived ?? false;

  if (includeArchived) {
    return database.query.worktrees.findMany({
      where: eq(worktrees.repoId, input.repoId),
    });
  }

  return database.query.worktrees.findMany({
    where: and(
      eq(worktrees.repoId, input.repoId),
      eq(worktrees.state, 'active')
    ),
  });
}

/**
 * List worktrees for a workspace
 */
export async function listWorktreesByWorkspace(
  input: ListWorktreesByWorkspaceInput,
  db?: ReturnType<typeof getDb>
): Promise<Worktree[]> {
  const database = db ?? getDb();
  const includeArchived = input.includeArchived ?? false;

  // Get all worktrees and filter by workspace_ids JSON array
  const allWorktrees = await database.query.worktrees.findMany();

  return allWorktrees.filter(wt => {
    // Filter by archived state if needed
    if (!includeArchived && wt.state === 'archived') {
      return false;
    }

    // Check if workspace is in the workspaceIds array
    if (!wt.workspaceIds) return false;
    try {
      const ids = JSON.parse(wt.workspaceIds) as string[];
      return ids.includes(input.workspaceId);
    } catch {
      return false;
    }
  });
}

/**
 * Add a worktree to a workspace
 */
export async function addWorktreeToWorkspace(
  input: AddWorktreeToWorkspaceInput,
  db?: ReturnType<typeof getDb>
): Promise<Worktree> {
  const database = db ?? getDb();

  const worktree = await database.query.worktrees.findFirst({
    where: eq(worktrees.id, input.worktreeId),
  });

  if (!worktree) {
    throw new Error(`Worktree not found: ${input.worktreeId}`);
  }

  // Parse current workspace_ids
  let workspaceIds: string[] = [];
  if (worktree.workspaceIds) {
    try {
      workspaceIds = JSON.parse(worktree.workspaceIds) as string[];
    } catch {
      workspaceIds = [];
    }
  }

  // Add workspace if not already present
  if (!workspaceIds.includes(input.workspaceId)) {
    workspaceIds.push(input.workspaceId);
    await database
      .update(worktrees)
      .set({
        workspaceIds: JSON.stringify(workspaceIds),
        updatedAt: new Date().toISOString(),
      })
      .where(eq(worktrees.id, input.worktreeId));
  }

  return { ...worktree, workspaceIds: JSON.stringify(workspaceIds) };
}

/**
 * Remove a worktree from a workspace
 */
export async function removeWorktreeFromWorkspace(
  input: RemoveWorktreeFromWorkspaceInput,
  db?: ReturnType<typeof getDb>
): Promise<Worktree> {
  const database = db ?? getDb();

  const worktree = await database.query.worktrees.findFirst({
    where: eq(worktrees.id, input.worktreeId),
  });

  if (!worktree) {
    throw new Error(`Worktree not found: ${input.worktreeId}`);
  }

  // Parse current workspace_ids
  let workspaceIds: string[] = [];
  if (worktree.workspaceIds) {
    try {
      workspaceIds = JSON.parse(worktree.workspaceIds) as string[];
    } catch {
      workspaceIds = [];
    }
  }

  // Remove workspace
  const newIds = workspaceIds.filter(id => id !== input.workspaceId);
  await database
    .update(worktrees)
    .set({
      workspaceIds: JSON.stringify(newIds),
      updatedAt: new Date().toISOString(),
    })
    .where(eq(worktrees.id, input.worktreeId));

  return { ...worktree, workspaceIds: JSON.stringify(newIds) };
}
