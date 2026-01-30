import { z } from 'zod';
import { eq } from 'drizzle-orm';
import { randomUUID } from 'node:crypto';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { execSync } from 'node:child_process';
import { getDb } from '../db/index.js';
import { repos } from '../db/schema.js';

/**
 * Repo schemas
 */
export const CreateRepoSchema = z.object({
  rootPath: z.string().min(1),
  name: z.string().optional(),
  remoteUrl: z.string().optional(),
  defaultBranch: z.string().optional(),
});

export const GetRepoSchema = z.object({
  id: z.string().uuid(),
});

export const ListReposSchema = z.object({
  limit: z.number().int().positive().optional().default(100),
  offset: z.number().int().nonnegative().optional().default(0),
});

export const DeleteRepoSchema = z.object({
  id: z.string().uuid(),
});

export type CreateRepoInput = z.infer<typeof CreateRepoSchema>;
export type GetRepoInput = z.infer<typeof GetRepoSchema>;
export type ListReposInput = z.infer<typeof ListReposSchema>;
export type DeleteRepoInput = z.infer<typeof DeleteRepoSchema>;

/**
 * Detect git repository info from path
 */
function detectRepoInfo(rootPath: string): {
  name: string;
  remoteUrl?: string;
  defaultBranch: string;
} {
  const name = path.basename(rootPath);
  let remoteUrl: string | undefined;
  let defaultBranch = 'main';

  try {
    // Get remote URL
    remoteUrl = execSync('git config --get remote.origin.url', {
      cwd: rootPath,
      encoding: 'utf-8',
      stdio: ['pipe', 'pipe', 'pipe'],
    }).trim();
  } catch {
    // No remote configured
  }

  try {
    // Get default branch
    const branch = execSync('git symbolic-ref --short HEAD', {
      cwd: rootPath,
      encoding: 'utf-8',
      stdio: ['pipe', 'pipe', 'pipe'],
    }).trim();
    if (branch) {
      defaultBranch = branch;
    }
  } catch {
    // Use default
  }

  return { name, remoteUrl, defaultBranch };
}

/**
 * Register a git repository
 */
export async function createRepo(input: CreateRepoInput) {
  const db = getDb();

  // Validate path exists and is a git repo
  if (!fs.existsSync(input.rootPath)) {
    throw new Error(`Path does not exist: ${input.rootPath}`);
  }

  const gitDir = path.join(input.rootPath, '.git');
  if (!fs.existsSync(gitDir)) {
    throw new Error(`Not a git repository: ${input.rootPath}`);
  }

  // Detect repo info
  const detected = detectRepoInfo(input.rootPath);

  // Check if repo already registered
  const existing = await db.query.repos.findFirst({
    where: eq(repos.rootPath, input.rootPath),
  });

  if (existing) {
    return existing;
  }

  const repo = {
    id: randomUUID(),
    rootPath: input.rootPath,
    name: input.name ?? detected.name,
    remoteUrl: input.remoteUrl ?? detected.remoteUrl,
    defaultBranch: input.defaultBranch ?? detected.defaultBranch,
  };

  await db.insert(repos).values(repo);

  return repo;
}

/**
 * Get repo by ID
 */
export async function getRepo(input: GetRepoInput) {
  const db = getDb();
  const repo = await db.query.repos.findFirst({
    where: eq(repos.id, input.id),
  });

  if (!repo) {
    throw new Error(`Repo not found: ${input.id}`);
  }

  return repo;
}

/**
 * List all repos
 */
export async function listRepos(input?: ListReposInput) {
  const db = getDb();
  const results = await db.query.repos.findMany({
    limit: input?.limit ?? 100,
    offset: input?.offset ?? 0,
  });

  return results;
}

/**
 * Delete a repo (soft delete - just removes from DB)
 */
export async function deleteRepo(input: DeleteRepoInput) {
  const db = getDb();

  await db.delete(repos).where(eq(repos.id, input.id));

  return { success: true };
}
