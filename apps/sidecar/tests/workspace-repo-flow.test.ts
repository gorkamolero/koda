/**
 * E2E Tests for Workspace → Repo → Worktree Flow
 *
 * Tests the complete flow from workspace creation through to chat functionality.
 * These tests use the actual handlers, not mocks.
 */
import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import Database from 'better-sqlite3';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import * as path from 'node:path';
import * as os from 'node:os';
import * as fs from 'node:fs';
import { eq, and } from 'drizzle-orm';
import { runMigrations } from '../src/db/migrate.js';
import * as schema from '../src/db/schema.js';
import {
  createStandaloneWorkspace,
  attachRepo,
  detachRepo,
  listWorkspaceRepos,
} from '../src/handlers/workspaceRepo.js';
import { listWorktreesByWorkspace } from '../src/handlers/worktree.js';
import { initDbWithMigrations, resetDb } from '../src/db/index.js';

describe('Workspace → Repo → Worktree Flow', () => {
  let dbPath: string;
  let testRepoPath: string;

  beforeAll(() => {
    // Create temporary database
    dbPath = path.join(os.tmpdir(), `koda-flow-test-${Date.now()}.db`);
    process.env.KODA_DB_PATH = dbPath;

    // Create a fake repo directory for testing
    testRepoPath = path.join(os.tmpdir(), `koda-test-repo-${Date.now()}`);
    fs.mkdirSync(testRepoPath, { recursive: true });
    fs.mkdirSync(path.join(testRepoPath, '.git'), { recursive: true });

    // Initialize database with migrations
    initDbWithMigrations(dbPath);
  });

  afterAll(() => {
    resetDb();
    delete process.env.KODA_DB_PATH;

    // Clean up
    if (fs.existsSync(dbPath)) {
      fs.unlinkSync(dbPath);
    }
    if (fs.existsSync(testRepoPath)) {
      fs.rmSync(testRepoPath, { recursive: true });
    }
  });

  describe('1. Workspace Creation', () => {
    it('should create a standalone workspace', async () => {
      const workspace = await createStandaloneWorkspace({
        name: 'Test Workspace',
        description: 'A test workspace',
      });

      expect(workspace).toBeDefined();
      expect(workspace.id).toBeDefined();
      expect(workspace.name).toBe('Test Workspace');
      expect(workspace.description).toBe('A test workspace');
    });

    it('should create workspace without description', async () => {
      const workspace = await createStandaloneWorkspace({
        name: 'Minimal Workspace',
      });

      expect(workspace).toBeDefined();
      expect(workspace.name).toBe('Minimal Workspace');
      expect(workspace.description).toBeNull();
    });

    it('should return workspace with valid UUID', async () => {
      const workspace = await createStandaloneWorkspace({
        name: 'UUID Test',
      });

      // UUID v4 format check
      const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
      expect(workspace.id).toMatch(uuidRegex);
    });
  });

  describe('2. Repo Attachment', () => {
    let workspaceId: string;
    let repoId: string;

    beforeAll(async () => {
      // Create workspace
      const workspace = await createStandaloneWorkspace({
        name: 'Repo Test Workspace',
      });
      workspaceId = workspace.id;

      // Create repo directly in DB
      const sqlite = new Database(dbPath);
      const db = drizzle(sqlite, { schema });

      const { randomUUID } = await import('node:crypto');
      repoId = randomUUID();

      db.insert(schema.repos).values({
        id: repoId,
        name: 'test-repo',
        rootPath: testRepoPath,
        remoteUrl: 'https://github.com/test/repo.git',
        defaultBranch: 'main',
      }).run();

      sqlite.close();
    });

    it('should attach repo to workspace', async () => {
      const result = await attachRepo({
        workspaceId,
        repoId,
      });

      expect(result).toBeDefined();
      expect(result.workspaceId).toBe(workspaceId);
      expect(result.repoId).toBe(repoId);
    });

    it('should auto-create main worktree when attaching repo', async () => {
      // The attachRepo above should have created a main worktree
      const worktrees = await listWorktreesByWorkspace({
        workspaceId,
      });

      expect(worktrees.length).toBeGreaterThan(0);

      const mainWorktree = worktrees.find(wt => wt.branch === 'main');
      expect(mainWorktree).toBeDefined();
      expect(mainWorktree?.repoId).toBe(repoId);
      expect(mainWorktree?.worktreePath).toBe(testRepoPath);
    });

    it('should include workspace in worktree workspaceIds', async () => {
      const worktrees = await listWorktreesByWorkspace({
        workspaceId,
      });

      const mainWorktree = worktrees.find(wt => wt.branch === 'main');
      expect(mainWorktree).toBeDefined();

      const workspaceIds = JSON.parse(mainWorktree!.workspaceIds || '[]');
      expect(workspaceIds).toContain(workspaceId);
    });

    it('should throw when attaching same repo twice', async () => {
      await expect(
        attachRepo({ workspaceId, repoId })
      ).rejects.toThrow('Repo is already attached to this workspace');
    });
  });

  describe('3. List Workspace Repos (with self-healing)', () => {
    let workspaceId: string;
    let repoId: string;

    beforeAll(async () => {
      // Create workspace
      const workspace = await createStandaloneWorkspace({
        name: 'Self-Healing Test',
      });
      workspaceId = workspace.id;

      // Create repo directly in DB
      const sqlite = new Database(dbPath);
      const db = drizzle(sqlite, { schema });

      const { randomUUID } = await import('node:crypto');
      repoId = randomUUID();

      db.insert(schema.repos).values({
        id: repoId,
        name: 'self-heal-repo',
        rootPath: testRepoPath,
        remoteUrl: 'https://github.com/test/selfheal.git',
        defaultBranch: 'develop',
      }).run();

      // Create workspace-repo link WITHOUT creating worktree
      // This simulates a repo attached before the fix
      db.insert(schema.workspaceRepos).values({
        id: randomUUID(),
        workspaceId,
        repoId,
      }).run();

      sqlite.close();
    });

    it('should auto-create missing main worktree on list', async () => {
      // First call should trigger self-healing
      const repos = await listWorkspaceRepos({ workspaceId });

      expect(repos.length).toBe(1);
      expect(repos[0].repoId).toBe(repoId);

      // Now check worktrees
      const worktrees = await listWorktreesByWorkspace({ workspaceId });
      const mainWorktree = worktrees.find(wt => wt.branch === 'develop');

      expect(mainWorktree).toBeDefined();
      expect(mainWorktree?.repoId).toBe(repoId);
    });
  });

  describe('4. Detach Repo', () => {
    let workspaceId: string;
    let repoId: string;

    beforeAll(async () => {
      // Create workspace
      const workspace = await createStandaloneWorkspace({
        name: 'Detach Test',
      });
      workspaceId = workspace.id;

      // Create repo
      const sqlite = new Database(dbPath);
      const db = drizzle(sqlite, { schema });

      const { randomUUID } = await import('node:crypto');
      repoId = randomUUID();

      db.insert(schema.repos).values({
        id: repoId,
        name: 'detach-repo',
        rootPath: testRepoPath,
        remoteUrl: 'https://github.com/test/detach.git',
        defaultBranch: 'main',
      }).run();

      sqlite.close();

      // Attach it
      await attachRepo({ workspaceId, repoId });
    });

    it('should detach repo from workspace', async () => {
      const result = await detachRepo({ workspaceId, repoId });
      expect(result.success).toBe(true);
    });

    it('should remove workspace from worktree workspaceIds', async () => {
      // After detach, worktrees should no longer show this workspace
      const worktrees = await listWorktreesByWorkspace({ workspaceId });

      // Should be empty or not contain the main worktree for this repo
      const repoWorktrees = worktrees.filter(wt => wt.repoId === repoId);
      expect(repoWorktrees.length).toBe(0);
    });

    it('should remove workspace-repo link', async () => {
      const repos = await listWorkspaceRepos({ workspaceId });
      const found = repos.find(r => r.repoId === repoId);
      expect(found).toBeUndefined();
    });

    it('should throw when detaching non-attached repo', async () => {
      await expect(
        detachRepo({ workspaceId, repoId })
      ).rejects.toThrow('Repo is not attached to this workspace');
    });
  });

  describe('5. Multi-Workspace Worktree Visibility', () => {
    let workspace1Id: string;
    let workspace2Id: string;
    let repoId: string;

    beforeAll(async () => {
      // Create two workspaces
      const ws1 = await createStandaloneWorkspace({ name: 'Multi WS 1' });
      const ws2 = await createStandaloneWorkspace({ name: 'Multi WS 2' });
      workspace1Id = ws1.id;
      workspace2Id = ws2.id;

      // Create repo
      const sqlite = new Database(dbPath);
      const db = drizzle(sqlite, { schema });

      const { randomUUID } = await import('node:crypto');
      repoId = randomUUID();

      db.insert(schema.repos).values({
        id: repoId,
        name: 'multi-ws-repo',
        rootPath: testRepoPath,
        remoteUrl: 'https://github.com/test/multi.git',
        defaultBranch: 'main',
      }).run();

      sqlite.close();
    });

    it('should attach same repo to multiple workspaces', async () => {
      await attachRepo({ workspaceId: workspace1Id, repoId });
      await attachRepo({ workspaceId: workspace2Id, repoId });

      const repos1 = await listWorkspaceRepos({ workspaceId: workspace1Id });
      const repos2 = await listWorkspaceRepos({ workspaceId: workspace2Id });

      expect(repos1.some(r => r.repoId === repoId)).toBe(true);
      expect(repos2.some(r => r.repoId === repoId)).toBe(true);
    });

    it('should show worktree in both workspaces', async () => {
      const wt1 = await listWorktreesByWorkspace({ workspaceId: workspace1Id });
      const wt2 = await listWorktreesByWorkspace({ workspaceId: workspace2Id });

      const main1 = wt1.find(wt => wt.repoId === repoId && wt.branch === 'main');
      const main2 = wt2.find(wt => wt.repoId === repoId && wt.branch === 'main');

      expect(main1).toBeDefined();
      expect(main2).toBeDefined();
      // Should be the same worktree
      expect(main1?.id).toBe(main2?.id);
    });

    it('should have both workspaces in worktree workspaceIds', async () => {
      const wt1 = await listWorktreesByWorkspace({ workspaceId: workspace1Id });
      const mainWorktree = wt1.find(wt => wt.repoId === repoId && wt.branch === 'main');

      const workspaceIds = JSON.parse(mainWorktree!.workspaceIds || '[]');
      expect(workspaceIds).toContain(workspace1Id);
      expect(workspaceIds).toContain(workspace2Id);
    });

    it('should only remove from one workspace on detach', async () => {
      await detachRepo({ workspaceId: workspace1Id, repoId });

      // Should still be visible in workspace2
      const wt2 = await listWorktreesByWorkspace({ workspaceId: workspace2Id });
      const main2 = wt2.find(wt => wt.repoId === repoId && wt.branch === 'main');
      expect(main2).toBeDefined();

      // Should NOT be visible in workspace1
      const wt1 = await listWorktreesByWorkspace({ workspaceId: workspace1Id });
      const main1 = wt1.find(wt => wt.repoId === repoId && wt.branch === 'main');
      expect(main1).toBeUndefined();
    });
  });
});
