import { describe, it, expect, beforeAll, afterAll, beforeEach, afterEach } from 'vitest';
import Database from 'better-sqlite3';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import * as path from 'node:path';
import * as os from 'node:os';
import * as fs from 'node:fs';
import { execSync } from 'node:child_process';
import { runMigrations } from '../src/db/migrate.js';
import * as schema from '../src/db/schema.js';
import {
  saveCheckpoint,
  restoreCheckpoint,
  diffCheckpoints,
  getCheckpoint,
  getCheckpointsByWorktree,
  type SaveCheckpointInput,
} from '../src/checkpoint/service.js';

describe('Git Checkpoint System', () => {
  let dbPath: string;
  let sqlite: Database.Database;
  let db: ReturnType<typeof drizzle<typeof schema>>;
  let testWorktreeId: string;
  let testRepoId: string;
  let testRepoPath: string;

  /**
   * Create a temporary git repository for testing
   */
  function createTestRepo(): string {
    const repoPath = path.join(os.tmpdir(), `koda-checkpoint-test-repo-${Date.now()}`);
    fs.mkdirSync(repoPath, { recursive: true });

    // Initialize git repo
    execSync('git init', { cwd: repoPath, stdio: 'pipe' });
    execSync('git config user.email "test@test.com"', { cwd: repoPath, stdio: 'pipe' });
    execSync('git config user.name "Test User"', { cwd: repoPath, stdio: 'pipe' });

    // Create initial commit
    fs.writeFileSync(path.join(repoPath, 'README.md'), '# Test Repo\n');
    execSync('git add .', { cwd: repoPath, stdio: 'pipe' });
    execSync('git commit -m "Initial commit"', { cwd: repoPath, stdio: 'pipe' });

    return repoPath;
  }

  /**
   * Clean up a test repository
   */
  function cleanupTestRepo(repoPath: string): void {
    if (fs.existsSync(repoPath)) {
      fs.rmSync(repoPath, { recursive: true, force: true });
    }
  }

  beforeAll(() => {
    // Create temporary database for testing
    dbPath = path.join(os.tmpdir(), `koda-checkpoint-test-${Date.now()}.db`);

    // Run migrations
    runMigrations(dbPath);

    // Open database connection
    sqlite = new Database(dbPath);
    db = drizzle(sqlite, { schema });

    // Create test repo
    testRepoPath = createTestRepo();

    // Set up test repo and worktree (new schema)
    testRepoId = `repo-checkpoint-test-${Date.now()}`;
    testWorktreeId = `wt-checkpoint-test-${Date.now()}`;

    db.insert(schema.repos).values({
      id: testRepoId,
      name: 'checkpoint-test-repo',
      remoteUrl: 'https://github.com/test/checkpoint-repo.git',
      rootPath: testRepoPath,
    }).run();
    db.insert(schema.worktrees)
      .values({
        id: testWorktreeId,
        repoId: testRepoId,
        branch: 'main',
        worktreePath: testRepoPath,
      })
      .run();
  });

  afterAll(() => {
    // Close database
    if (sqlite) {
      sqlite.close();
    }

    // Clean up database file
    if (fs.existsSync(dbPath)) {
      fs.unlinkSync(dbPath);
    }
    // Also clean up WAL files if they exist
    const walPath = `${dbPath}-wal`;
    const shmPath = `${dbPath}-shm`;
    if (fs.existsSync(walPath)) fs.unlinkSync(walPath);
    if (fs.existsSync(shmPath)) fs.unlinkSync(shmPath);

    // Clean up test repo
    cleanupTestRepo(testRepoPath);
  });

  describe('saveCheckpoint', () => {
    let localRepoPath: string;

    beforeEach(() => {
      // Create a fresh repo for each test
      localRepoPath = createTestRepo();
    });

    afterEach(() => {
      cleanupTestRepo(localRepoPath);
    });

    it('should save a checkpoint with HEAD, index, and worktree state', () => {
      const input: SaveCheckpointInput = {
        worktreeId: testWorktreeId,
        turnId: 'turn-1',
        repoPath: localRepoPath,
      };

      const checkpoint = saveCheckpoint(db, input);

      expect(checkpoint).toBeDefined();
      expect(checkpoint.id).toBeDefined();
      expect(checkpoint.worktreeId).toBe(testWorktreeId);
      expect(checkpoint.turnId).toBe('turn-1');
      expect(checkpoint.headOid).toBeDefined();
      expect(checkpoint.headOid).toMatch(/^[0-9a-f]{40}$/); // Valid git SHA
      expect(checkpoint.indexTree).toBeDefined();
      expect(checkpoint.worktreeTree).toBeDefined();
    });

    it('should capture staged changes in the index tree', () => {
      // Make a change and stage it (but don't commit)
      const testFile = path.join(localRepoPath, 'staged.txt');
      fs.writeFileSync(testFile, 'staged content\n');
      execSync('git add staged.txt', { cwd: localRepoPath, stdio: 'pipe' });

      const checkpoint = saveCheckpoint(db, {
        worktreeId: testWorktreeId,
        turnId: 'turn-staged',
        repoPath: localRepoPath,
      });

      // Index tree should differ from HEAD tree since we have staged changes
      expect(checkpoint.indexTree).toBeDefined();
      expect(checkpoint.indexTree).toMatch(/^[0-9a-f]{40}$/);
    });

    it('should capture unstaged changes in the worktree tree', () => {
      // Make an unstaged change
      const testFile = path.join(localRepoPath, 'unstaged.txt');
      fs.writeFileSync(testFile, 'unstaged content\n');

      const checkpoint = saveCheckpoint(db, {
        worktreeId: testWorktreeId,
        turnId: 'turn-unstaged',
        repoPath: localRepoPath,
      });

      // Worktree tree should capture the unstaged file
      expect(checkpoint.worktreeTree).toBeDefined();
      expect(checkpoint.worktreeTree).toMatch(/^[0-9a-f]{40}$/);
    });

    it('should create unique checkpoints for different turns', () => {
      const checkpoint1 = saveCheckpoint(db, {
        worktreeId: testWorktreeId,
        turnId: 'turn-a',
        repoPath: localRepoPath,
      });

      // Make a change
      fs.writeFileSync(path.join(localRepoPath, 'file1.txt'), 'content 1\n');
      execSync('git add .', { cwd: localRepoPath, stdio: 'pipe' });
      execSync('git commit -m "Add file1"', { cwd: localRepoPath, stdio: 'pipe' });

      const checkpoint2 = saveCheckpoint(db, {
        worktreeId: testWorktreeId,
        turnId: 'turn-b',
        repoPath: localRepoPath,
      });

      expect(checkpoint1.id).not.toBe(checkpoint2.id);
      expect(checkpoint1.headOid).not.toBe(checkpoint2.headOid);
    });
  });

  describe('getCheckpoint', () => {
    let localRepoPath: string;

    beforeEach(() => {
      localRepoPath = createTestRepo();
    });

    afterEach(() => {
      cleanupTestRepo(localRepoPath);
    });

    it('should retrieve an existing checkpoint by id', () => {
      const created = saveCheckpoint(db, {
        worktreeId: testWorktreeId,
        turnId: 'turn-get-test',
        repoPath: localRepoPath,
      });

      const retrieved = getCheckpoint(db, created.id);

      expect(retrieved).toBeDefined();
      expect(retrieved?.id).toBe(created.id);
      expect(retrieved?.headOid).toBe(created.headOid);
    });

    it('should return undefined for non-existent checkpoint', () => {
      const retrieved = getCheckpoint(db, 'non-existent-checkpoint');

      expect(retrieved).toBeUndefined();
    });
  });

  describe('getCheckpointsByWorktree', () => {
    let localRepoPath: string;

    beforeEach(() => {
      localRepoPath = createTestRepo();
    });

    afterEach(() => {
      cleanupTestRepo(localRepoPath);
    });

    it('should retrieve all checkpoints for a worktree', () => {
      // Create multiple checkpoints
      saveCheckpoint(db, {
        worktreeId: testWorktreeId,
        turnId: 'turn-list-1',
        repoPath: localRepoPath,
      });

      fs.writeFileSync(path.join(localRepoPath, 'file.txt'), 'content\n');
      execSync('git add .', { cwd: localRepoPath, stdio: 'pipe' });
      execSync('git commit -m "Change"', { cwd: localRepoPath, stdio: 'pipe' });

      saveCheckpoint(db, {
        worktreeId: testWorktreeId,
        turnId: 'turn-list-2',
        repoPath: localRepoPath,
      });

      const checkpoints = getCheckpointsByWorktree(db, testWorktreeId);

      expect(checkpoints.length).toBeGreaterThanOrEqual(2);
      expect(checkpoints.some((c) => c.turnId === 'turn-list-1')).toBe(true);
      expect(checkpoints.some((c) => c.turnId === 'turn-list-2')).toBe(true);
    });
  });

  describe('restoreCheckpoint', () => {
    let localRepoPath: string;

    beforeEach(() => {
      localRepoPath = createTestRepo();
    });

    afterEach(() => {
      cleanupTestRepo(localRepoPath);
    });

    it('should restore HEAD to the checkpoint state', () => {
      // Save checkpoint at initial state
      const checkpoint = saveCheckpoint(db, {
        worktreeId: testWorktreeId,
        turnId: 'turn-restore-head',
        repoPath: localRepoPath,
      });

      const originalHead = checkpoint.headOid;

      // Make changes and commit
      fs.writeFileSync(path.join(localRepoPath, 'new-file.txt'), 'new content\n');
      execSync('git add .', { cwd: localRepoPath, stdio: 'pipe' });
      execSync('git commit -m "New commit"', { cwd: localRepoPath, stdio: 'pipe' });

      // Verify HEAD changed
      const newHead = execSync('git rev-parse HEAD', { cwd: localRepoPath, encoding: 'utf-8' }).trim();
      expect(newHead).not.toBe(originalHead);

      // Restore checkpoint
      restoreCheckpoint(db, checkpoint.id, localRepoPath);

      // Verify HEAD is restored
      const restoredHead = execSync('git rev-parse HEAD', { cwd: localRepoPath, encoding: 'utf-8' }).trim();
      expect(restoredHead).toBe(originalHead);
    });

    it('should restore the worktree to the checkpoint state', () => {
      // Create a file and save checkpoint
      const testFile = path.join(localRepoPath, 'test-file.txt');
      fs.writeFileSync(testFile, 'original content\n');

      const checkpoint = saveCheckpoint(db, {
        worktreeId: testWorktreeId,
        turnId: 'turn-restore-worktree',
        repoPath: localRepoPath,
      });

      // Modify the file
      fs.writeFileSync(testFile, 'modified content\n');

      // Restore checkpoint
      restoreCheckpoint(db, checkpoint.id, localRepoPath);

      // Verify file content is restored
      const restoredContent = fs.readFileSync(testFile, 'utf-8');
      expect(restoredContent).toBe('original content\n');
    });

    it('should restore staged changes from the index', () => {
      // Create and stage a file (but don't commit)
      const stagedFile = path.join(localRepoPath, 'staged-restore.txt');
      fs.writeFileSync(stagedFile, 'staged content\n');
      execSync('git add staged-restore.txt', { cwd: localRepoPath, stdio: 'pipe' });

      const checkpoint = saveCheckpoint(db, {
        worktreeId: testWorktreeId,
        turnId: 'turn-restore-index',
        repoPath: localRepoPath,
      });

      // Unstage and remove the file
      execSync('git reset HEAD staged-restore.txt', { cwd: localRepoPath, stdio: 'pipe' });
      fs.unlinkSync(stagedFile);

      // Restore checkpoint
      restoreCheckpoint(db, checkpoint.id, localRepoPath);

      // Verify the file is restored and staged
      expect(fs.existsSync(stagedFile)).toBe(true);
      const status = execSync('git status --porcelain', { cwd: localRepoPath, encoding: 'utf-8' });
      expect(status).toContain('A  staged-restore.txt');
    });

    it('should throw an error for non-existent checkpoint', () => {
      expect(() => {
        restoreCheckpoint(db, 'non-existent', localRepoPath);
      }).toThrow();
    });
  });

  describe('diffCheckpoints', () => {
    let localRepoPath: string;

    beforeEach(() => {
      localRepoPath = createTestRepo();
    });

    afterEach(() => {
      cleanupTestRepo(localRepoPath);
    });

    it('should return empty diff for identical checkpoints', () => {
      const checkpoint = saveCheckpoint(db, {
        worktreeId: testWorktreeId,
        turnId: 'turn-diff-same',
        repoPath: localRepoPath,
      });

      const diff = diffCheckpoints(db, checkpoint.id, checkpoint.id, localRepoPath);

      expect(diff.files).toHaveLength(0);
      expect(diff.summary.additions).toBe(0);
      expect(diff.summary.deletions).toBe(0);
    });

    it('should show files added between checkpoints', () => {
      const checkpoint1 = saveCheckpoint(db, {
        worktreeId: testWorktreeId,
        turnId: 'turn-diff-add-before',
        repoPath: localRepoPath,
      });

      // Add a new file and commit
      fs.writeFileSync(path.join(localRepoPath, 'added-file.txt'), 'new file content\n');
      execSync('git add .', { cwd: localRepoPath, stdio: 'pipe' });
      execSync('git commit -m "Add file"', { cwd: localRepoPath, stdio: 'pipe' });

      const checkpoint2 = saveCheckpoint(db, {
        worktreeId: testWorktreeId,
        turnId: 'turn-diff-add-after',
        repoPath: localRepoPath,
      });

      const diff = diffCheckpoints(db, checkpoint1.id, checkpoint2.id, localRepoPath);

      expect(diff.files.some((f) => f.path === 'added-file.txt')).toBe(true);
      const addedFile = diff.files.find((f) => f.path === 'added-file.txt');
      expect(addedFile?.status).toBe('added');
    });

    it('should show files modified between checkpoints', () => {
      // Modify README.md and commit
      fs.writeFileSync(path.join(localRepoPath, 'README.md'), '# Modified Test Repo\n');
      execSync('git add .', { cwd: localRepoPath, stdio: 'pipe' });
      execSync('git commit -m "Modify README"', { cwd: localRepoPath, stdio: 'pipe' });

      const checkpoint1 = saveCheckpoint(db, {
        worktreeId: testWorktreeId,
        turnId: 'turn-diff-mod-before',
        repoPath: localRepoPath,
      });

      // Modify again
      fs.writeFileSync(path.join(localRepoPath, 'README.md'), '# Further Modified Test Repo\nMore content\n');
      execSync('git add .', { cwd: localRepoPath, stdio: 'pipe' });
      execSync('git commit -m "Further modify README"', { cwd: localRepoPath, stdio: 'pipe' });

      const checkpoint2 = saveCheckpoint(db, {
        worktreeId: testWorktreeId,
        turnId: 'turn-diff-mod-after',
        repoPath: localRepoPath,
      });

      const diff = diffCheckpoints(db, checkpoint1.id, checkpoint2.id, localRepoPath);

      expect(diff.files.some((f) => f.path === 'README.md')).toBe(true);
      const modifiedFile = diff.files.find((f) => f.path === 'README.md');
      expect(modifiedFile?.status).toBe('modified');
    });

    it('should show files deleted between checkpoints', () => {
      // Create a file to be deleted
      fs.writeFileSync(path.join(localRepoPath, 'to-delete.txt'), 'will be deleted\n');
      execSync('git add .', { cwd: localRepoPath, stdio: 'pipe' });
      execSync('git commit -m "Add file to delete"', { cwd: localRepoPath, stdio: 'pipe' });

      const checkpoint1 = saveCheckpoint(db, {
        worktreeId: testWorktreeId,
        turnId: 'turn-diff-del-before',
        repoPath: localRepoPath,
      });

      // Delete the file
      fs.unlinkSync(path.join(localRepoPath, 'to-delete.txt'));
      execSync('git add .', { cwd: localRepoPath, stdio: 'pipe' });
      execSync('git commit -m "Delete file"', { cwd: localRepoPath, stdio: 'pipe' });

      const checkpoint2 = saveCheckpoint(db, {
        worktreeId: testWorktreeId,
        turnId: 'turn-diff-del-after',
        repoPath: localRepoPath,
      });

      const diff = diffCheckpoints(db, checkpoint1.id, checkpoint2.id, localRepoPath);

      expect(diff.files.some((f) => f.path === 'to-delete.txt')).toBe(true);
      const deletedFile = diff.files.find((f) => f.path === 'to-delete.txt');
      expect(deletedFile?.status).toBe('deleted');
    });

    it('should include diff content for modified files', () => {
      fs.writeFileSync(path.join(localRepoPath, 'content.txt'), 'line 1\nline 2\n');
      execSync('git add .', { cwd: localRepoPath, stdio: 'pipe' });
      execSync('git commit -m "Add content"', { cwd: localRepoPath, stdio: 'pipe' });

      const checkpoint1 = saveCheckpoint(db, {
        worktreeId: testWorktreeId,
        turnId: 'turn-diff-content-before',
        repoPath: localRepoPath,
      });

      fs.writeFileSync(path.join(localRepoPath, 'content.txt'), 'line 1\nline 2 modified\nline 3\n');
      execSync('git add .', { cwd: localRepoPath, stdio: 'pipe' });
      execSync('git commit -m "Modify content"', { cwd: localRepoPath, stdio: 'pipe' });

      const checkpoint2 = saveCheckpoint(db, {
        worktreeId: testWorktreeId,
        turnId: 'turn-diff-content-after',
        repoPath: localRepoPath,
      });

      const diff = diffCheckpoints(db, checkpoint1.id, checkpoint2.id, localRepoPath);

      const contentFile = diff.files.find((f) => f.path === 'content.txt');
      expect(contentFile?.diff).toBeDefined();
      expect(contentFile?.diff).toContain('-line 2');
      expect(contentFile?.diff).toContain('+line 2 modified');
    });

    it('should provide summary statistics', () => {
      const checkpoint1 = saveCheckpoint(db, {
        worktreeId: testWorktreeId,
        turnId: 'turn-diff-stats-before',
        repoPath: localRepoPath,
      });

      // Add multiple files with known line counts
      fs.writeFileSync(path.join(localRepoPath, 'file1.txt'), 'line1\nline2\nline3\n');
      fs.writeFileSync(path.join(localRepoPath, 'file2.txt'), 'a\nb\n');
      execSync('git add .', { cwd: localRepoPath, stdio: 'pipe' });
      execSync('git commit -m "Add files"', { cwd: localRepoPath, stdio: 'pipe' });

      const checkpoint2 = saveCheckpoint(db, {
        worktreeId: testWorktreeId,
        turnId: 'turn-diff-stats-after',
        repoPath: localRepoPath,
      });

      const diff = diffCheckpoints(db, checkpoint1.id, checkpoint2.id, localRepoPath);

      expect(diff.summary).toBeDefined();
      expect(diff.summary.filesChanged).toBe(2);
      expect(diff.summary.additions).toBe(5); // 3 + 2 lines
      expect(diff.summary.deletions).toBe(0);
    });

    it('should throw an error for non-existent checkpoint', () => {
      const checkpoint = saveCheckpoint(db, {
        worktreeId: testWorktreeId,
        turnId: 'turn-diff-error',
        repoPath: localRepoPath,
      });

      expect(() => {
        diffCheckpoints(db, 'non-existent', checkpoint.id, localRepoPath);
      }).toThrow();

      expect(() => {
        diffCheckpoints(db, checkpoint.id, 'non-existent', localRepoPath);
      }).toThrow();
    });
  });
});
