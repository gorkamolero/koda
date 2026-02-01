import { describe, it, expect, beforeAll, afterAll, beforeEach, afterEach } from 'vitest';
import Database from 'better-sqlite3';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import * as path from 'node:path';
import * as os from 'node:os';
import * as fs from 'node:fs';
import { execSync, spawn } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { runMigrations } from '../src/db/migrate.js';
import * as schema from '../src/db/schema.js';
import { eq } from 'drizzle-orm';
import {
  createWorktree,
  deleteWorktree,
  listWorktrees,
  getWorktree,
  readKodaConfig,
  runSetupScripts,
  runTeardownScripts,
  CreateWorktreeSchema,
  DeleteWorktreeSchema,
  GetWorktreeSchema,
} from '../src/handlers/worktree.js';

describe('Worktree Manager', () => {
  let dbPath: string;
  let sqlite: Database.Database;
  let db: ReturnType<typeof drizzle<typeof schema>>;
  let testRepoPath: string;
  let testRepoId: string;

  /**
   * Initialize a test git repository with some content
   */
  function initTestRepo(repoPath: string): void {
    fs.mkdirSync(repoPath, { recursive: true });
    execSync('git init', { cwd: repoPath });
    execSync('git config user.email "test@test.com"', { cwd: repoPath });
    execSync('git config user.name "Test User"', { cwd: repoPath });

    // Create initial commit on main branch
    fs.writeFileSync(path.join(repoPath, 'README.md'), '# Test Repo\n');
    execSync('git add .', { cwd: repoPath });
    execSync('git commit -m "Initial commit"', { cwd: repoPath });
  }

  beforeAll(() => {
    // Create temporary database for testing
    dbPath = path.join(os.tmpdir(), `koda-worktree-test-${Date.now()}.db`);
    runMigrations(dbPath);
    sqlite = new Database(dbPath);
    db = drizzle(sqlite, { schema });
  });

  afterAll(() => {
    if (sqlite) {
      sqlite.close();
    }
    if (fs.existsSync(dbPath)) {
      fs.unlinkSync(dbPath);
    }
  });

  beforeEach(() => {
    // Create temporary test repository
    testRepoPath = path.join(os.tmpdir(), `koda-test-repo-${Date.now()}-${randomUUID().slice(0, 8)}`);
    initTestRepo(testRepoPath);

    // Create user for foreign key constraints
    const userId = `user-${randomUUID()}`;
    db.insert(schema.users).values({
      id: userId,
      name: 'Test User',
      email: 'test@test.com',
    }).run();

    // Insert test repository into database
    testRepoId = `repo-${randomUUID()}`;
    db.insert(schema.repos).values({
      id: testRepoId,
      name: 'test-repo',
      rootPath: testRepoPath,
      defaultBranch: 'main',
    }).run();
  });

  afterEach(() => {
    // Clean up test repository and worktrees
    if (testRepoPath && fs.existsSync(testRepoPath)) {
      fs.rmSync(testRepoPath, { recursive: true, force: true });
    }
  });

  describe('Zod Schema Validation', () => {
    it('should validate CreateWorktreeSchema', () => {
      const validInput = { repoId: 'repo-123', branch: 'feature/test' };
      const result = CreateWorktreeSchema.safeParse(validInput);
      expect(result.success).toBe(true);
    });

    it('should reject CreateWorktreeSchema with missing repoId', () => {
      const invalidInput = { branch: 'feature/test' };
      const result = CreateWorktreeSchema.safeParse(invalidInput);
      expect(result.success).toBe(false);
    });

    it('should reject CreateWorktreeSchema with missing branch', () => {
      const invalidInput = { repoId: 'repo-123' };
      const result = CreateWorktreeSchema.safeParse(invalidInput);
      expect(result.success).toBe(false);
    });

    it('should validate DeleteWorktreeSchema', () => {
      const validInput = { worktreeId: randomUUID() };
      const result = DeleteWorktreeSchema.safeParse(validInput);
      expect(result.success).toBe(true);
    });

    it('should reject DeleteWorktreeSchema with invalid UUID', () => {
      const invalidInput = { worktreeId: 'not-a-uuid' };
      const result = DeleteWorktreeSchema.safeParse(invalidInput);
      expect(result.success).toBe(false);
    });

    it('should validate GetWorktreeSchema', () => {
      const validInput = { worktreeId: randomUUID() };
      const result = GetWorktreeSchema.safeParse(validInput);
      expect(result.success).toBe(true);
    });
  });

  describe('createWorktree', () => {
    it('should create a git worktree and workspace record', async () => {
      const branch = 'feature/test-worktree';

      const workspace = await createWorktree({ repoId: testRepoId, branch }, db);

      // Verify workspace was created in database
      expect(workspace.id).toBeDefined();
      expect(workspace.branch).toBe(branch);
      expect(workspace.repoId).toBe(testRepoId);

      // Verify worktree directory was created
      const worktreePath = path.join(testRepoPath, '.worktrees', 'feature-test-worktree');
      expect(fs.existsSync(worktreePath)).toBe(true);

      // Verify it's a valid git worktree (has .git file)
      const gitPath = path.join(worktreePath, '.git');
      expect(fs.existsSync(gitPath)).toBe(true);

      // Verify branch was created
      const branches = execSync('git branch', { cwd: testRepoPath }).toString();
      expect(branches).toContain('feature/test-worktree');
    });

    it('should use existing branch if it already exists', async () => {
      // Create branch first
      execSync('git checkout -b existing-branch', { cwd: testRepoPath });
      execSync('git checkout main', { cwd: testRepoPath });

      const workspace = await createWorktree({ repoId: testRepoId, branch: 'existing-branch' }, db);

      expect(workspace.branch).toBe('existing-branch');
      const worktreePath = path.join(testRepoPath, '.worktrees', 'existing-branch');
      expect(fs.existsSync(worktreePath)).toBe(true);
    });

    it('should sanitize branch name for directory', async () => {
      const branch = 'feature/complex/branch-name_with.dots';

      const worktree = await createWorktree({ repoId: testRepoId, branch }, db);

      // Worktree path should use sanitized branch name
      expect(worktree.worktreePath).toContain('feature-complex-branch-name_with.dots');

      const expectedPath = path.join(testRepoPath, '.worktrees', 'feature-complex-branch-name_with.dots');
      expect(fs.existsSync(expectedPath)).toBe(true);
    });

    it('should throw error if repo does not exist', async () => {
      await expect(createWorktree({ repoId: 'nonexistent-repo', branch: 'test' }, db)).rejects.toThrow(
        'Repository not found'
      );
    });

    it('should set workspace state to active', async () => {
      const workspace = await createWorktree({ repoId: testRepoId, branch: 'active-test' }, db);

      expect(workspace.state).toBe('active');
    });

    it('should store worktree path', async () => {
      const worktree = await createWorktree({ repoId: testRepoId, branch: 'path-test' }, db);

      expect(worktree.worktreePath).toContain('path-test');
    });
  });

  describe('deleteWorktree', () => {
    it('should remove git worktree and soft delete workspace', async () => {
      // Create a worktree first
      const workspace = await createWorktree({ repoId: testRepoId, branch: 'to-delete' }, db);
      const worktreePath = path.join(testRepoPath, '.worktrees', 'to-delete');
      expect(fs.existsSync(worktreePath)).toBe(true);

      // Delete the worktree
      const result = await deleteWorktree({ worktreeId: workspace.id }, db);

      // Verify soft delete (state changed to archived)
      expect(result.state).toBe('archived');

      // Verify worktree directory was removed
      expect(fs.existsSync(worktreePath)).toBe(false);
    });

    it('should delete branch along with worktree when deleteRemoteBranch is true', async () => {
      const workspace = await createWorktree({ repoId: testRepoId, branch: 'delete-with-branch' }, db);

      await deleteWorktree({ worktreeId: workspace.id, deleteBranch: true }, db);

      const branches = execSync('git branch', { cwd: testRepoPath }).toString();
      expect(branches).not.toContain('delete-with-branch');
    });

    it('should throw error if workspace does not exist', async () => {
      await expect(deleteWorktree({ worktreeId: randomUUID() }, db)).rejects.toThrow('Worktree not found');
    });

    it('should handle already archived workspace gracefully', async () => {
      const workspace = await createWorktree({ repoId: testRepoId, branch: 'archived-test' }, db);

      // Delete once
      await deleteWorktree({ worktreeId: workspace.id }, db);

      // Delete again - should not throw
      const result = await deleteWorktree({ worktreeId: workspace.id }, db);
      expect(result.state).toBe('archived');
    });
  });

  describe('getWorktree', () => {
    it('should return worktree with repository info', async () => {
      const workspace = await createWorktree({ repoId: testRepoId, branch: 'get-test' }, db);

      const result = await getWorktree({ worktreeId: workspace.id }, db);

      expect(result.id).toBe(workspace.id);
      expect(result.branch).toBe('get-test');
      expect(result.repoId).toBe(testRepoId);
    });

    it('should throw error if workspace does not exist', async () => {
      await expect(getWorktree({ worktreeId: randomUUID() }, db)).rejects.toThrow('Worktree not found');
    });
  });

  describe('listWorktrees', () => {
    it('should list all active worktrees for a repository', async () => {
      await createWorktree({ repoId: testRepoId, branch: 'list-1' }, db);
      await createWorktree({ repoId: testRepoId, branch: 'list-2' }, db);
      await createWorktree({ repoId: testRepoId, branch: 'list-3' }, db);

      const worktrees = await listWorktrees({ repoId: testRepoId }, db);

      expect(worktrees.length).toBeGreaterThanOrEqual(3);
      expect(worktrees.some((w) => w.branch === 'list-1')).toBe(true);
      expect(worktrees.some((w) => w.branch === 'list-2')).toBe(true);
      expect(worktrees.some((w) => w.branch === 'list-3')).toBe(true);
    });

    it('should not include archived worktrees by default', async () => {
      const workspace = await createWorktree({ repoId: testRepoId, branch: 'to-archive' }, db);
      await deleteWorktree({ worktreeId: workspace.id }, db);

      const worktrees = await listWorktrees({ repoId: testRepoId }, db);

      expect(worktrees.some((w) => w.branch === 'to-archive')).toBe(false);
    });

    it('should include archived worktrees when includeArchived is true', async () => {
      const workspace = await createWorktree({ repoId: testRepoId, branch: 'include-archived' }, db);
      await deleteWorktree({ worktreeId: workspace.id }, db);

      const worktrees = await listWorktrees({ repoId: testRepoId, includeArchived: true }, db);

      expect(worktrees.some((w) => w.branch === 'include-archived')).toBe(true);
    });
  });

  describe('.koda/config.json', () => {
    it('should read koda config from repository', async () => {
      // Create .koda/config.json
      const kodaDir = path.join(testRepoPath, '.koda');
      fs.mkdirSync(kodaDir, { recursive: true });
      fs.writeFileSync(
        path.join(kodaDir, 'config.json'),
        JSON.stringify({
          setup: ['pnpm install'],
          teardown: ['rm -rf node_modules'],
          customPrompt: 'This is a test project',
        })
      );

      const config = await readKodaConfig(testRepoPath);

      expect(config).toBeDefined();
      expect(config?.setup).toEqual(['pnpm install']);
      expect(config?.teardown).toEqual(['rm -rf node_modules']);
      expect(config?.customPrompt).toBe('This is a test project');
    });

    it('should return null if .koda/config.json does not exist', async () => {
      const config = await readKodaConfig(testRepoPath);

      expect(config).toBeNull();
    });

    it('should return null for invalid JSON', async () => {
      const kodaDir = path.join(testRepoPath, '.koda');
      fs.mkdirSync(kodaDir, { recursive: true });
      fs.writeFileSync(path.join(kodaDir, 'config.json'), '{ invalid json }');

      const config = await readKodaConfig(testRepoPath);

      expect(config).toBeNull();
    });
  });

  describe('Setup/Teardown Scripts', () => {
    it('should run setup scripts on worktree creation', async () => {
      // Create .koda/config.json with setup script
      const kodaDir = path.join(testRepoPath, '.koda');
      fs.mkdirSync(kodaDir, { recursive: true });
      fs.writeFileSync(
        path.join(kodaDir, 'config.json'),
        JSON.stringify({
          setup: ['touch setup-marker.txt'],
        })
      );

      const workspace = await createWorktree({ repoId: testRepoId, branch: 'setup-test' }, db);

      // Verify setup script ran in worktree directory
      const worktreePath = path.join(testRepoPath, '.worktrees', 'setup-test');
      expect(fs.existsSync(path.join(worktreePath, 'setup-marker.txt'))).toBe(true);
    });

    it('should run teardown scripts on worktree deletion', async () => {
      // Create .koda/config.json with teardown script that creates a marker in the main repo
      const kodaDir = path.join(testRepoPath, '.koda');
      fs.mkdirSync(kodaDir, { recursive: true });
      fs.writeFileSync(
        path.join(kodaDir, 'config.json'),
        JSON.stringify({
          teardown: [`touch ${testRepoPath}/teardown-marker.txt`],
        })
      );

      const workspace = await createWorktree({ repoId: testRepoId, branch: 'teardown-test' }, db);
      await deleteWorktree({ worktreeId: workspace.id }, db);

      // Verify teardown script ran (marker created in main repo since worktree is deleted)
      expect(fs.existsSync(path.join(testRepoPath, 'teardown-marker.txt'))).toBe(true);
    });

    it('should handle setup script failure gracefully', async () => {
      const kodaDir = path.join(testRepoPath, '.koda');
      fs.mkdirSync(kodaDir, { recursive: true });
      fs.writeFileSync(
        path.join(kodaDir, 'config.json'),
        JSON.stringify({
          setup: ['exit 1'], // Failing command
        })
      );

      // Should still create worktree but return error in result
      const workspace = await createWorktree({ repoId: testRepoId, branch: 'setup-fail-test' }, db);

      expect(workspace.id).toBeDefined();
      expect(workspace.setupError).toBeDefined();
    });

    it('should run multiple setup scripts in order', async () => {
      const kodaDir = path.join(testRepoPath, '.koda');
      fs.mkdirSync(kodaDir, { recursive: true });
      fs.writeFileSync(
        path.join(kodaDir, 'config.json'),
        JSON.stringify({
          setup: ['echo "first" > order.txt', 'echo "second" >> order.txt'],
        })
      );

      const workspace = await createWorktree({ repoId: testRepoId, branch: 'multi-setup' }, db);

      const worktreePath = path.join(testRepoPath, '.worktrees', 'multi-setup');
      const content = fs.readFileSync(path.join(worktreePath, 'order.txt'), 'utf-8');
      expect(content.trim()).toBe('first\nsecond');
    });

    it('should pass environment variables to scripts', async () => {
      const kodaDir = path.join(testRepoPath, '.koda');
      fs.mkdirSync(kodaDir, { recursive: true });
      fs.writeFileSync(
        path.join(kodaDir, 'config.json'),
        JSON.stringify({
          setup: ['echo "$KODA_WORKTREE_ID" > worktree-id.txt'],
        })
      );

      const worktree = await createWorktree({ repoId: testRepoId, branch: 'env-test' }, db);

      const worktreePath = path.join(testRepoPath, '.worktrees', 'env-test');
      const content = fs.readFileSync(path.join(worktreePath, 'worktree-id.txt'), 'utf-8').trim();
      expect(content).toBe(worktree.id);
    });
  });

  describe('runSetupScripts', () => {
    it('should execute scripts in the given directory', async () => {
      const scripts = ['touch setup-1.txt', 'touch setup-2.txt'];

      const result = await runSetupScripts(scripts, testRepoPath, {});

      expect(result.success).toBe(true);
      expect(fs.existsSync(path.join(testRepoPath, 'setup-1.txt'))).toBe(true);
      expect(fs.existsSync(path.join(testRepoPath, 'setup-2.txt'))).toBe(true);
    });

    it('should return error if any script fails', async () => {
      const scripts = ['touch success.txt', 'exit 1', 'touch never-reached.txt'];

      const result = await runSetupScripts(scripts, testRepoPath, {});

      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
      expect(fs.existsSync(path.join(testRepoPath, 'success.txt'))).toBe(true);
      expect(fs.existsSync(path.join(testRepoPath, 'never-reached.txt'))).toBe(false);
    });

    it('should pass environment variables', async () => {
      const scripts = ['echo "$MY_VAR" > var.txt'];

      await runSetupScripts(scripts, testRepoPath, { MY_VAR: 'hello' });

      const content = fs.readFileSync(path.join(testRepoPath, 'var.txt'), 'utf-8').trim();
      expect(content).toBe('hello');
    });
  });

  describe('runTeardownScripts', () => {
    it('should execute teardown scripts', async () => {
      const scripts = ['touch teardown-marker.txt'];

      const result = await runTeardownScripts(scripts, testRepoPath, {});

      expect(result.success).toBe(true);
      expect(fs.existsSync(path.join(testRepoPath, 'teardown-marker.txt'))).toBe(true);
    });

    it('should continue on failure by default', async () => {
      const scripts = ['exit 1', 'touch after-fail.txt'];

      const result = await runTeardownScripts(scripts, testRepoPath, {});

      // Teardown should continue even after failure
      expect(result.success).toBe(false);
      expect(result.errors?.length).toBeGreaterThan(0);
      expect(fs.existsSync(path.join(testRepoPath, 'after-fail.txt'))).toBe(true);
    });
  });

  describe('Edge Cases', () => {
    it('should handle worktree path conflicts', async () => {
      // Create first worktree
      await createWorktree({ repoId: testRepoId, branch: 'conflict' }, db);

      // Trying to create same branch should fail
      await expect(createWorktree({ repoId: testRepoId, branch: 'conflict' }, db)).rejects.toThrow();
    });

    it('should handle repository with no commits', async () => {
      // Create empty repo (no commits)
      const emptyRepoPath = path.join(os.tmpdir(), `koda-empty-repo-${Date.now()}`);
      fs.mkdirSync(emptyRepoPath, { recursive: true });
      execSync('git init', { cwd: emptyRepoPath });
      execSync('git config user.email "test@test.com"', { cwd: emptyRepoPath });
      execSync('git config user.name "Test User"', { cwd: emptyRepoPath });

      const emptyRepoId = `repo-empty-${randomUUID()}`;
      db.insert(schema.repos).values({
        id: emptyRepoId,
        name: 'empty-repo',
        rootPath: emptyRepoPath,
        defaultBranch: 'main',
      }).run();

      // Should fail because no commits exist
      await expect(createWorktree({ repoId: emptyRepoId, branch: 'test' }, db)).rejects.toThrow();

      // Cleanup
      fs.rmSync(emptyRepoPath, { recursive: true, force: true });
    });

    it('should handle special characters in branch names', async () => {
      const branch = 'feature/TICKET-123_description';

      const worktree = await createWorktree({ repoId: testRepoId, branch }, db);

      expect(worktree.branch).toBe(branch);
      expect(worktree.worktreePath).toContain('feature-TICKET-123_description');
    });
  });
});
