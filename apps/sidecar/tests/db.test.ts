import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import Database from 'better-sqlite3';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import * as path from 'node:path';
import * as os from 'node:os';
import * as fs from 'node:fs';
import { runMigrations } from '../src/db/migrate.js';
import * as schema from '../src/db/schema.js';
import { eq } from 'drizzle-orm';

describe('Database Schema', () => {
  let dbPath: string;
  let sqlite: Database.Database;
  let db: ReturnType<typeof drizzle<typeof schema>>;

  beforeAll(() => {
    // Create temporary database for testing
    dbPath = path.join(os.tmpdir(), `koda-test-${Date.now()}.db`);

    // Run migrations
    runMigrations(dbPath);

    // Open database connection
    sqlite = new Database(dbPath);
    db = drizzle(sqlite, { schema });
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
  });

  describe('Migration', () => {
    it('should create all required tables', () => {
      const tables = sqlite
        .prepare(
          "SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' AND name != '__drizzle_migrations'"
        )
        .all() as { name: string }[];

      const tableNames = tables.map((t) => t.name).sort();

      expect(tableNames).toEqual([
        'attachments',
        'diff_comments',
        'git_checkpoints',
        'git_identities',
        'recording_frames',
        'repos',
        'session_messages',
        'session_recordings',
        'sessions',
        'settings',
        'users',
        'visual_snapshots',
        'workspace_shares',
        'workspaces',
      ]);
    });

    it('should create users table with correct columns', () => {
      const columns = sqlite.pragma(`table_info(users)`);
      const columnNames = columns.map((c: any) => c.name);

      expect(columnNames).toContain('id');
      expect(columnNames).toContain('email');
      expect(columnNames).toContain('name');
      expect(columnNames).toContain('avatar_url');
      expect(columnNames).toContain('created_at');
    });

    it('should create workspaces table with correct columns', () => {
      const columns = sqlite.pragma(`table_info(workspaces)`);
      const columnNames = columns.map((c: any) => c.name);

      expect(columnNames).toContain('id');
      expect(columnNames).toContain('repository_id');
      expect(columnNames).toContain('owner_user_id');
      expect(columnNames).toContain('directory_name');
      expect(columnNames).toContain('branch');
      expect(columnNames).toContain('workspace_type');
      expect(columnNames).toContain('state');
      expect(columnNames).toContain('spec_content');
      expect(columnNames).toContain('fix_plan_content');
      expect(columnNames).toContain('ralph_enabled');
      expect(columnNames).toContain('created_at');
      expect(columnNames).toContain('updated_at');
    });

    it('should create sessions table with forking support', () => {
      const columns = sqlite.pragma(`table_info(sessions)`);
      const columnNames = columns.map((c: any) => c.name);

      expect(columnNames).toContain('id');
      expect(columnNames).toContain('workspace_id');
      expect(columnNames).toContain('agent_type');
      expect(columnNames).toContain('model');
      expect(columnNames).toContain('status');
      expect(columnNames).toContain('context_token_count');
      expect(columnNames).toContain('forked_from_session_id');
    });

    it('should create git_identities table for multi-account support', () => {
      const columns = sqlite.pragma(`table_info(git_identities)`);
      const columnNames = columns.map((c: any) => c.name);

      expect(columnNames).toContain('id');
      expect(columnNames).toContain('user_id');
      expect(columnNames).toContain('provider');
      expect(columnNames).toContain('username');
      expect(columnNames).toContain('email');
      expect(columnNames).toContain('token_encrypted');
      expect(columnNames).toContain('is_default');
    });

    it('should create workspace_shares table for collaboration', () => {
      const columns = sqlite.pragma(`table_info(workspace_shares)`);
      const columnNames = columns.map((c: any) => c.name);

      expect(columnNames).toContain('id');
      expect(columnNames).toContain('workspace_id');
      expect(columnNames).toContain('shared_with_user_id');
      expect(columnNames).toContain('permission');
    });

    it('should create visual_snapshots table', () => {
      const columns = sqlite.pragma(`table_info(visual_snapshots)`);
      const columnNames = columns.map((c: any) => c.name);

      expect(columnNames).toContain('id');
      expect(columnNames).toContain('workspace_id');
      expect(columnNames).toContain('session_id');
      expect(columnNames).toContain('turn_id');
      expect(columnNames).toContain('snapshot_type');
      expect(columnNames).toContain('image_path');
      expect(columnNames).toContain('url');
    });

    it('should create git_checkpoints table', () => {
      const columns = sqlite.pragma(`table_info(git_checkpoints)`);
      const columnNames = columns.map((c: any) => c.name);

      expect(columnNames).toContain('id');
      expect(columnNames).toContain('workspace_id');
      expect(columnNames).toContain('turn_id');
      expect(columnNames).toContain('head_oid');
      expect(columnNames).toContain('index_tree');
      expect(columnNames).toContain('worktree_tree');
    });

    it('should create diff_comments table for PR-style reviews', () => {
      const columns = sqlite.pragma(`table_info(diff_comments)`);
      const columnNames = columns.map((c: any) => c.name);

      expect(columnNames).toContain('id');
      expect(columnNames).toContain('workspace_id');
      expect(columnNames).toContain('user_id');
      expect(columnNames).toContain('file_path');
      expect(columnNames).toContain('line_number');
      expect(columnNames).toContain('body');
      expect(columnNames).toContain('resolved');
    });
  });

  describe('Foreign Key Constraints', () => {
    it('should have foreign keys on workspaces table', () => {
      const fks = sqlite.pragma(`foreign_key_list(workspaces)`);

      expect(fks.length).toBeGreaterThan(0);
      expect(fks.some((fk: any) => fk.table === 'repos')).toBe(true);
      expect(fks.some((fk: any) => fk.table === 'users')).toBe(true);
    });

    it('should have foreign keys on sessions table', () => {
      const fks = sqlite.pragma(`foreign_key_list(sessions)`);

      expect(fks.length).toBeGreaterThan(0);
      expect(fks.some((fk: any) => fk.table === 'workspaces')).toBe(true);
      // Note: Self-reference for forking is not enforced at DB level to avoid circular dependency issues
    });

    it('should have foreign keys on workspace_shares table', () => {
      const fks = sqlite.pragma(`foreign_key_list(workspace_shares)`);

      expect(fks.length).toBe(2);
      expect(fks.some((fk: any) => fk.table === 'workspaces')).toBe(true);
      expect(fks.some((fk: any) => fk.table === 'users')).toBe(true);
    });
  });

  describe('CRUD Operations', () => {
    it('should insert and retrieve a user', () => {
      const newUser: schema.NewUser = {
        id: 'user-1',
        email: 'test@example.com',
        name: 'Test User',
        avatarUrl: 'https://example.com/avatar.png',
      };

      db.insert(schema.users).values(newUser).run();

      const users = db.select().from(schema.users).where(eq(schema.users.id, 'user-1')).all();

      expect(users).toHaveLength(1);
      expect(users[0].email).toBe('test@example.com');
      expect(users[0].name).toBe('Test User');
    });

    it('should insert git identity with user reference', () => {
      const userId = 'user-2';

      db.insert(schema.users).values({
        id: userId,
        email: 'dev@example.com',
        name: 'Developer',
      }).run();

      const newIdentity: schema.NewGitIdentity = {
        id: 'git-1',
        userId: userId,
        provider: 'github',
        username: 'devuser',
        email: 'dev@github.com',
        tokenEncrypted: 'encrypted_token',
        isDefault: true,
      };

      db.insert(schema.gitIdentities).values(newIdentity).run();

      const identities = db
        .select()
        .from(schema.gitIdentities)
        .where(eq(schema.gitIdentities.id, 'git-1'))
        .all();

      expect(identities).toHaveLength(1);
      expect(identities[0].provider).toBe('github');
      expect(identities[0].isDefault).toBe(true);
    });

    it('should create workspace with all collaboration fields', () => {
      const userId = 'user-3';
      const repoId = 'repo-1';

      db.insert(schema.users).values({
        id: userId,
        email: 'owner@example.com',
        name: 'Workspace Owner',
      }).run();

      db.insert(schema.repos).values({
        id: repoId,
        name: 'test-repo',
        remoteUrl: 'https://github.com/test/repo.git',
        rootPath: '/path/to/repo',
      }).run();

      const newWorkspace: schema.NewWorkspace = {
        id: 'ws-1',
        repositoryId: repoId,
        ownerUserId: userId,
        directoryName: 'feature-branch',
        branch: 'feature/new-feature',
        workspaceType: 'spec-driven',
        state: 'active',
        specContent: '# Feature Spec\n\nBuild a new feature...',
        fixPlanContent: '- [ ] Task 1\n- [ ] Task 2',
        ralphEnabled: true,
      };

      db.insert(schema.workspaces).values(newWorkspace).run();

      const workspaces = db
        .select()
        .from(schema.workspaces)
        .where(eq(schema.workspaces.id, 'ws-1'))
        .all();

      expect(workspaces).toHaveLength(1);
      expect(workspaces[0].workspaceType).toBe('spec-driven');
      expect(workspaces[0].ralphEnabled).toBe(true);
      expect(workspaces[0].specContent).toContain('Feature Spec');
    });

    it('should support conversation forking', () => {
      const workspaceId = 'ws-2';
      const userId = 'user-4';

      db.insert(schema.users).values({
        id: userId,
        name: 'Forking User',
      }).run();

      db.insert(schema.workspaces).values({
        id: workspaceId,
        ownerUserId: userId,
        directoryName: 'fork-test',
      }).run();

      // Create original session
      db.insert(schema.sessions).values({
        id: 'session-1',
        workspaceId,
        agentType: 'claude',
        model: 'claude-sonnet-4-5',
        status: 'idle',
      }).run();

      // Create forked session
      db.insert(schema.sessions).values({
        id: 'session-2',
        workspaceId,
        agentType: 'kimi',
        model: 'kimi-k1.5',
        status: 'idle',
        forkedFromSessionId: 'session-1',
      }).run();

      const forkedSession = db
        .select()
        .from(schema.sessions)
        .where(eq(schema.sessions.id, 'session-2'))
        .all();

      expect(forkedSession).toHaveLength(1);
      expect(forkedSession[0].forkedFromSessionId).toBe('session-1');
      expect(forkedSession[0].agentType).toBe('kimi');
    });

    it('should support workspace sharing with permissions', () => {
      const ownerId = 'user-5';
      const sharedWithId = 'user-6';
      const workspaceId = 'ws-3';

      db.insert(schema.users).values([
        { id: ownerId, name: 'Owner' },
        { id: sharedWithId, name: 'Collaborator' },
      ]).run();

      db.insert(schema.workspaces).values({
        id: workspaceId,
        ownerUserId: ownerId,
        directoryName: 'shared-workspace',
      }).run();

      db.insert(schema.workspaceShares).values({
        id: 'share-1',
        workspaceId,
        sharedWithUserId: sharedWithId,
        permission: 'control',
      }).run();

      const shares = db
        .select()
        .from(schema.workspaceShares)
        .where(eq(schema.workspaceShares.workspaceId, workspaceId))
        .all();

      expect(shares).toHaveLength(1);
      expect(shares[0].permission).toBe('control');
    });

    it('should create visual snapshots for before/after UI', () => {
      const workspaceId = 'ws-4';
      const sessionId = 'session-3';
      const userId = 'user-7';

      db.insert(schema.users).values({ id: userId, name: 'User' }).run();
      db.insert(schema.workspaces).values({
        id: workspaceId,
        ownerUserId: userId,
        directoryName: 'visual-test',
      }).run();
      db.insert(schema.sessions).values({
        id: sessionId,
        workspaceId,
        agentType: 'claude',
      }).run();

      db.insert(schema.visualSnapshots).values([
        {
          id: 'snap-1',
          workspaceId,
          sessionId,
          turnId: 'turn-1',
          snapshotType: 'before',
          imagePath: '/snapshots/before.png',
          url: 'http://localhost:3000',
        },
        {
          id: 'snap-2',
          workspaceId,
          sessionId,
          turnId: 'turn-1',
          snapshotType: 'after',
          imagePath: '/snapshots/after.png',
          url: 'http://localhost:3000',
        },
      ]).run();

      const snapshots = db
        .select()
        .from(schema.visualSnapshots)
        .where(eq(schema.visualSnapshots.turnId, 'turn-1'))
        .all();

      expect(snapshots).toHaveLength(2);
      expect(snapshots.some((s) => s.snapshotType === 'before')).toBe(true);
      expect(snapshots.some((s) => s.snapshotType === 'after')).toBe(true);
    });

    it('should create git checkpoints for time-travel', () => {
      const workspaceId = 'ws-5';
      const userId = 'user-8';

      db.insert(schema.users).values({ id: userId, name: 'User' }).run();
      db.insert(schema.workspaces).values({
        id: workspaceId,
        ownerUserId: userId,
        directoryName: 'checkpoint-test',
      }).run();

      db.insert(schema.gitCheckpoints).values({
        id: 'checkpoint-1',
        workspaceId,
        turnId: 'turn-1',
        headOid: 'abc123',
        indexTree: 'def456',
        worktreeTree: 'ghi789',
      }).run();

      const checkpoints = db
        .select()
        .from(schema.gitCheckpoints)
        .where(eq(schema.gitCheckpoints.workspaceId, workspaceId))
        .all();

      expect(checkpoints).toHaveLength(1);
      expect(checkpoints[0].headOid).toBe('abc123');
    });

    it('should create diff comments for PR-style reviews', () => {
      const workspaceId = 'ws-6';
      const userId = 'user-9';

      db.insert(schema.users).values({ id: userId, name: 'Reviewer' }).run();
      db.insert(schema.workspaces).values({
        id: workspaceId,
        ownerUserId: userId,
        directoryName: 'review-test',
      }).run();

      db.insert(schema.diffComments).values({
        id: 'comment-1',
        workspaceId,
        userId,
        filePath: 'src/app.ts',
        lineNumber: 42,
        body: 'This needs refactoring',
        resolved: false,
      }).run();

      const comments = db
        .select()
        .from(schema.diffComments)
        .where(eq(schema.diffComments.workspaceId, workspaceId))
        .all();

      expect(comments).toHaveLength(1);
      expect(comments[0].filePath).toBe('src/app.ts');
      expect(comments[0].lineNumber).toBe(42);
      expect(comments[0].resolved).toBe(false);
    });
  });

  describe('Default Values', () => {
    it('should set default workspace type to standard', () => {
      const userId = 'user-10';

      db.insert(schema.users).values({ id: userId, name: 'User' }).run();
      db.insert(schema.workspaces).values({
        id: 'ws-default',
        ownerUserId: userId,
        directoryName: 'default-test',
      }).run();

      const workspace = db
        .select()
        .from(schema.workspaces)
        .where(eq(schema.workspaces.id, 'ws-default'))
        .get();

      expect(workspace?.workspaceType).toBe('standard');
      expect(workspace?.state).toBe('active');
      expect(workspace?.ralphEnabled).toBe(false);
    });

    it('should set default session status to idle', () => {
      const userId = 'user-11';
      const workspaceId = 'ws-11';

      db.insert(schema.users).values({ id: userId, name: 'User' }).run();
      db.insert(schema.workspaces).values({
        id: workspaceId,
        ownerUserId: userId,
        directoryName: 'session-test',
      }).run();
      db.insert(schema.sessions).values({
        id: 'session-default',
        workspaceId,
        agentType: 'claude',
      }).run();

      const session = db
        .select()
        .from(schema.sessions)
        .where(eq(schema.sessions.id, 'session-default'))
        .get();

      expect(session?.status).toBe('idle');
      expect(session?.contextTokenCount).toBe(0);
    });

    it('should set default permission to view for workspace shares', () => {
      const ownerId = 'user-12';
      const sharedWithId = 'user-13';
      const workspaceId = 'ws-12';

      db.insert(schema.users).values([
        { id: ownerId, name: 'Owner' },
        { id: sharedWithId, name: 'Viewer' },
      ]).run();
      db.insert(schema.workspaces).values({
        id: workspaceId,
        ownerUserId: ownerId,
        directoryName: 'share-test',
      }).run();
      db.insert(schema.workspaceShares).values({
        id: 'share-default',
        workspaceId,
        sharedWithUserId: sharedWithId,
      }).run();

      const share = db
        .select()
        .from(schema.workspaceShares)
        .where(eq(schema.workspaceShares.id, 'share-default'))
        .get();

      expect(share?.permission).toBe('view');
    });
  });
});
