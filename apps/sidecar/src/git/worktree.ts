/**
 * Git Worktree Identity Configuration
 *
 * Configures git user.name and user.email per worktree.
 * Uses local git config to avoid polluting global settings.
 */

import { spawn } from 'node:child_process';
import * as fs from 'node:fs';
import * as path from 'node:path';

// ============================================================================
// Types
// ============================================================================

export interface WorktreeIdentity {
  id: string;
  username: string;
  email: string;
  provider: string;
}

export interface ConfiguredIdentity {
  name: string;
  email: string;
}

// ============================================================================
// Git Command Execution
// ============================================================================

/**
 * Execute a git command in a specific directory
 */
async function execGit(cwd: string, args: string[]): Promise<string> {
  return new Promise((resolve, reject) => {
    const proc = spawn('git', args, {
      cwd,
      stdio: ['pipe', 'pipe', 'pipe'],
    });

    let stdout = '';
    let stderr = '';

    proc.stdout?.on('data', (data: Buffer) => {
      stdout += data.toString();
    });

    proc.stderr?.on('data', (data: Buffer) => {
      stderr += data.toString();
    });

    proc.on('close', (code) => {
      if (code === 0) {
        resolve(stdout.trim());
      } else {
        reject(new Error(`git ${args.join(' ')} failed: ${stderr || stdout}`));
      }
    });

    proc.on('error', (err) => {
      reject(err);
    });
  });
}

// ============================================================================
// Worktree Validation
// ============================================================================

/**
 * Check if a directory is a git repository or worktree
 */
async function isGitDirectory(dirPath: string): Promise<boolean> {
  // Check for .git directory (regular repo) or .git file (worktree)
  const gitPath = path.join(dirPath, '.git');

  try {
    const stat = fs.statSync(gitPath);
    return stat.isDirectory() || stat.isFile();
  } catch {
    return false;
  }
}

// ============================================================================
// Public API
// ============================================================================

/**
 * Configure git identity for a worktree
 *
 * Sets local git config for user.name and user.email.
 * This only affects the specific worktree, not global config.
 *
 * @param worktreePath - Path to the git worktree/repository
 * @param identity - Identity to configure
 * @throws Error if the path is not a git directory
 */
export async function configureWorktreeIdentity(
  worktreePath: string,
  identity: WorktreeIdentity
): Promise<void> {
  // Validate git directory
  const isGit = await isGitDirectory(worktreePath);
  if (!isGit) {
    throw new Error(`Not a git directory: ${worktreePath}`);
  }

  // Set user.name (local config only)
  await execGit(worktreePath, ['config', '--local', 'user.name', identity.username]);

  // Set user.email (local config only)
  await execGit(worktreePath, ['config', '--local', 'user.email', identity.email]);
}

/**
 * Get the configured git identity for a worktree
 *
 * @param worktreePath - Path to the git worktree/repository
 * @returns Configured identity or throws if not a git directory
 */
export async function getWorktreeIdentity(worktreePath: string): Promise<ConfiguredIdentity> {
  const isGit = await isGitDirectory(worktreePath);
  if (!isGit) {
    throw new Error(`Not a git directory: ${worktreePath}`);
  }

  // Get local user.name (falls back to global if not set locally)
  const name = await execGit(worktreePath, ['config', '--local', 'user.name']).catch(() => '');

  // Get local user.email (falls back to global if not set locally)
  const email = await execGit(worktreePath, ['config', '--local', 'user.email']).catch(() => '');

  return { name, email };
}

/**
 * Clear git identity configuration from a worktree
 *
 * @param worktreePath - Path to the git worktree/repository
 */
export async function clearWorktreeIdentity(worktreePath: string): Promise<void> {
  const isGit = await isGitDirectory(worktreePath);
  if (!isGit) {
    throw new Error(`Not a git directory: ${worktreePath}`);
  }

  // Unset local user.name (ignore errors if not set)
  await execGit(worktreePath, ['config', '--local', '--unset', 'user.name']).catch(() => {});

  // Unset local user.email (ignore errors if not set)
  await execGit(worktreePath, ['config', '--local', '--unset', 'user.email']).catch(() => {});
}

/**
 * Configure git credential helper for a specific remote
 *
 * This sets up token-based authentication for git operations.
 *
 * @param worktreePath - Path to the git worktree/repository
 * @param token - Authentication token
 * @param provider - Git provider (github, gitlab, bitbucket)
 */
export async function configureCredentialHelper(
  worktreePath: string,
  token: string,
  provider: string
): Promise<void> {
  const isGit = await isGitDirectory(worktreePath);
  if (!isGit) {
    throw new Error(`Not a git directory: ${worktreePath}`);
  }

  // Get the hostname for the provider
  const hostnames: Record<string, string> = {
    github: 'github.com',
    gitlab: 'gitlab.com',
    bitbucket: 'bitbucket.org',
  };

  const hostname = hostnames[provider];
  if (!hostname) {
    throw new Error(`Unknown provider: ${provider}`);
  }

  // Configure credential helper to store the token
  // Using the store helper with a specific credential
  // This is a simplified approach - in production, consider using
  // git-credential-manager or a custom credential helper

  // Set the credential for the specific host
  const credentialConfig = `url.https://${token}@${hostname}/.insteadOf`;
  await execGit(worktreePath, [
    'config',
    '--local',
    credentialConfig,
    `https://${hostname}/`,
  ]);
}

/**
 * Remove credential configuration from a worktree
 *
 * @param worktreePath - Path to the git worktree/repository
 * @param provider - Git provider (github, gitlab, bitbucket)
 */
export async function clearCredentialHelper(
  worktreePath: string,
  provider: string
): Promise<void> {
  const isGit = await isGitDirectory(worktreePath);
  if (!isGit) {
    throw new Error(`Not a git directory: ${worktreePath}`);
  }

  const hostnames: Record<string, string> = {
    github: 'github.com',
    gitlab: 'gitlab.com',
    bitbucket: 'bitbucket.org',
  };

  const hostname = hostnames[provider];
  if (!hostname) {
    throw new Error(`Unknown provider: ${provider}`);
  }

  // Remove all insteadOf configs for this host
  // This is done by reading the config and removing matching entries
  try {
    const configOutput = await execGit(worktreePath, ['config', '--local', '--list']);
    const lines = configOutput.split('\n');

    for (const line of lines) {
      if (line.includes(`url.https://`) && line.includes(`@${hostname}`)) {
        // Extract the config key
        const key = line.split('=')[0];
        await execGit(worktreePath, ['config', '--local', '--unset', key]).catch(() => {});
      }
    }
  } catch {
    // No config to clear
  }
}
