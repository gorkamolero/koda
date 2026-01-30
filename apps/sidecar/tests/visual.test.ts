/**
 * Visual Diff Engine Tests
 *
 * Tests for screenshot capture and visual diff comparison.
 * Following TDD - these tests are written FIRST.
 */

import { describe, it, expect, beforeAll, afterAll, vi, beforeEach, afterEach } from 'vitest';
import Database from 'better-sqlite3';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import * as path from 'node:path';
import * as os from 'node:os';
import * as fs from 'node:fs';
import { runMigrations } from '../src/db/migrate.js';
import * as schema from '../src/db/schema.js';
import { eq, and } from 'drizzle-orm';

// Mock Playwright before importing modules that use it
vi.mock('playwright', () => ({
  chromium: {
    launch: vi.fn().mockResolvedValue({
      newPage: vi.fn().mockResolvedValue({
        goto: vi.fn().mockResolvedValue(undefined),
        screenshot: vi.fn().mockResolvedValue(Buffer.from('fake-screenshot-data')),
        locator: vi.fn().mockReturnValue({
          screenshot: vi.fn().mockResolvedValue(Buffer.from('fake-element-screenshot')),
        }),
        close: vi.fn().mockResolvedValue(undefined),
        setViewportSize: vi.fn().mockResolvedValue(undefined),
      }),
      close: vi.fn().mockResolvedValue(undefined),
    }),
  },
}));

// Dynamic imports after mocking
let ScreenshotCapture: typeof import('../src/visual/capture.js').ScreenshotCapture;
let VisualDiff: typeof import('../src/visual/diff.js').VisualDiff;
let VisualDiffService: typeof import('../src/visual/service.js').VisualDiffService;

describe('Visual Diff Engine', () => {
  let dbPath: string;
  let sqlite: Database.Database;
  let db: ReturnType<typeof drizzle<typeof schema>>;
  let snapshotDir: string;

  beforeAll(async () => {
    // Create temporary database for testing
    dbPath = path.join(os.tmpdir(), `koda-visual-test-${Date.now()}.db`);
    snapshotDir = path.join(os.tmpdir(), `koda-visual-snapshots-${Date.now()}`);
    fs.mkdirSync(snapshotDir, { recursive: true });

    // Run migrations
    runMigrations(dbPath);

    // Open database connection
    sqlite = new Database(dbPath);
    db = drizzle(sqlite, { schema });

    // Import modules after mocking
    const captureModule = await import('../src/visual/capture.js');
    const diffModule = await import('../src/visual/diff.js');
    const serviceModule = await import('../src/visual/service.js');

    ScreenshotCapture = captureModule.ScreenshotCapture;
    VisualDiff = diffModule.VisualDiff;
    VisualDiffService = serviceModule.VisualDiffService;
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

    // Clean up WAL files
    const walPath = `${dbPath}-wal`;
    const shmPath = `${dbPath}-shm`;
    if (fs.existsSync(walPath)) fs.unlinkSync(walPath);
    if (fs.existsSync(shmPath)) fs.unlinkSync(shmPath);

    // Clean up snapshot directory
    if (fs.existsSync(snapshotDir)) {
      fs.rmSync(snapshotDir, { recursive: true });
    }
  });

  describe('ScreenshotCapture', () => {
    let capture: InstanceType<typeof ScreenshotCapture>;

    beforeEach(() => {
      capture = new ScreenshotCapture({ outputDir: snapshotDir });
    });

    afterEach(async () => {
      await capture.close();
    });

    it('should capture full page screenshot', async () => {
      const result = await capture.captureScreenshot('http://localhost:3000');

      expect(result).toBeDefined();
      expect(result.imagePath).toBeTruthy();
      expect(result.url).toBe('http://localhost:3000');
      expect(result.timestamp).toBeDefined();
    });

    it('should capture element screenshot with selector', async () => {
      const result = await capture.captureScreenshot(
        'http://localhost:3000',
        '#main-content'
      );

      expect(result).toBeDefined();
      expect(result.imagePath).toBeTruthy();
      expect(result.selector).toBe('#main-content');
    });

    it('should handle viewport configuration', async () => {
      const customCapture = new ScreenshotCapture({
        outputDir: snapshotDir,
        viewport: { width: 1920, height: 1080 },
      });

      const result = await customCapture.captureScreenshot('http://localhost:3000');

      expect(result).toBeDefined();
      expect(result.viewport).toEqual({ width: 1920, height: 1080 });

      await customCapture.close();
    });

    it('should generate unique filenames for each screenshot', async () => {
      const result1 = await capture.captureScreenshot('http://localhost:3000');
      const result2 = await capture.captureScreenshot('http://localhost:3000');

      expect(result1.imagePath).not.toBe(result2.imagePath);
    });
  });

  describe('VisualDiff', () => {
    let differ: InstanceType<typeof VisualDiff>;

    beforeEach(() => {
      differ = new VisualDiff();
    });

    it('should detect identical images', async () => {
      const imageData = Buffer.from('identical-image-data');

      const result = await differ.compare(imageData, imageData);

      expect(result.identical).toBe(true);
      expect(result.diffPercentage).toBe(0);
    });

    it('should detect different images', async () => {
      const before = Buffer.from('before-image-data-original');
      const after = Buffer.from('after-image-data-modified');

      const result = await differ.compare(before, after);

      expect(result.identical).toBe(false);
      expect(result.diffPercentage).toBeGreaterThan(0);
    });

    it('should generate diff image highlighting changes', async () => {
      const before = Buffer.from('before-image-data-original');
      const after = Buffer.from('after-image-data-modified');

      const result = await differ.compare(before, after, {
        generateDiffImage: true,
        outputDir: snapshotDir,
      });

      expect(result.diffImagePath).toBeDefined();
    });

    it('should calculate bounding boxes for changed regions', async () => {
      const before = Buffer.from('before-image-data-original');
      const after = Buffer.from('after-image-data-modified');

      const result = await differ.compare(before, after, { calculateBounds: true });

      expect(result.changedRegions).toBeDefined();
      expect(Array.isArray(result.changedRegions)).toBe(true);
    });

    it('should respect threshold for diff sensitivity', async () => {
      const before = Buffer.from('almost-same-image-a');
      const after = Buffer.from('almost-same-image-b');

      const strictResult = await differ.compare(before, after, { threshold: 0.01 });
      const lenientResult = await differ.compare(before, after, { threshold: 0.5 });

      // With lenient threshold, small differences are ignored
      expect(lenientResult.diffPercentage).toBeLessThanOrEqual(strictResult.diffPercentage);
    });
  });

  describe('VisualDiffService', () => {
    let service: InstanceType<typeof VisualDiffService>;
    let testWorkspaceId: string;
    let testSessionId: string;

    beforeAll(() => {
      // Create test workspace and session
      testWorkspaceId = `ws-visual-${Date.now()}`;
      testSessionId = `session-visual-${Date.now()}`;
      const userId = `user-visual-${Date.now()}`;

      db.insert(schema.users).values({ id: userId, name: 'Visual Test User' }).run();
      db.insert(schema.workspaces).values({
        id: testWorkspaceId,
        ownerUserId: userId,
        directoryName: 'visual-service-test',
      }).run();
      db.insert(schema.sessions).values({
        id: testSessionId,
        workspaceId: testWorkspaceId,
        agentType: 'claude',
      }).run();
    });

    beforeEach(() => {
      service = new VisualDiffService({
        db,
        outputDir: snapshotDir,
      });
    });

    afterEach(async () => {
      await service.close();
    });

    it('should capture before state for agent turn', async () => {
      const turnId = `turn-${Date.now()}`;

      const result = await service.captureBeforeState({
        workspaceId: testWorkspaceId,
        sessionId: testSessionId,
        turnId,
        url: 'http://localhost:3000',
      });

      expect(result.id).toBeDefined();
      expect(result.snapshotType).toBe('before');
      expect(result.turnId).toBe(turnId);

      // Verify stored in database
      const stored = db
        .select()
        .from(schema.visualSnapshots)
        .where(
          and(
            eq(schema.visualSnapshots.turnId, turnId),
            eq(schema.visualSnapshots.snapshotType, 'before')
          )
        )
        .get();

      expect(stored).toBeDefined();
      expect(stored?.imagePath).toBeTruthy();
    });

    it('should capture after state for agent turn', async () => {
      const turnId = `turn-after-${Date.now()}`;

      // First capture before
      await service.captureBeforeState({
        workspaceId: testWorkspaceId,
        sessionId: testSessionId,
        turnId,
        url: 'http://localhost:3000',
      });

      // Then capture after
      const result = await service.captureAfterState({
        workspaceId: testWorkspaceId,
        sessionId: testSessionId,
        turnId,
        url: 'http://localhost:3000',
      });

      expect(result.id).toBeDefined();
      expect(result.snapshotType).toBe('after');
      expect(result.turnId).toBe(turnId);

      // Verify both states stored
      const snapshots = db
        .select()
        .from(schema.visualSnapshots)
        .where(eq(schema.visualSnapshots.turnId, turnId))
        .all();

      expect(snapshots).toHaveLength(2);
      expect(snapshots.some((s) => s.snapshotType === 'before')).toBe(true);
      expect(snapshots.some((s) => s.snapshotType === 'after')).toBe(true);
    });

    it('should compare before/after states for a turn', async () => {
      const turnId = `turn-compare-${Date.now()}`;

      // Capture both states
      await service.captureBeforeState({
        workspaceId: testWorkspaceId,
        sessionId: testSessionId,
        turnId,
        url: 'http://localhost:3000',
      });

      await service.captureAfterState({
        workspaceId: testWorkspaceId,
        sessionId: testSessionId,
        turnId,
        url: 'http://localhost:3000',
      });

      // Compare
      const comparison = await service.compareTurnSnapshots(turnId);

      expect(comparison).toBeDefined();
      expect(comparison.turnId).toBe(turnId);
      expect(comparison.beforeSnapshot).toBeDefined();
      expect(comparison.afterSnapshot).toBeDefined();
      expect(comparison.diffResult).toBeDefined();
    });

    it('should get snapshots for a session', async () => {
      const turnId = `turn-list-${Date.now()}`;

      await service.captureBeforeState({
        workspaceId: testWorkspaceId,
        sessionId: testSessionId,
        turnId,
        url: 'http://localhost:3000',
      });

      const snapshots = await service.getSessionSnapshots(testSessionId);

      expect(Array.isArray(snapshots)).toBe(true);
      expect(snapshots.length).toBeGreaterThan(0);
    });

    it('should support capturing with element selector', async () => {
      const turnId = `turn-selector-${Date.now()}`;

      const result = await service.captureBeforeState({
        workspaceId: testWorkspaceId,
        sessionId: testSessionId,
        turnId,
        url: 'http://localhost:3000',
        selector: '.app-container',
      });

      expect(result.id).toBeDefined();
    });

    it('should handle missing before snapshot when comparing', async () => {
      const turnId = `turn-no-before-${Date.now()}`;

      // Only capture after (no before)
      await service.captureAfterState({
        workspaceId: testWorkspaceId,
        sessionId: testSessionId,
        turnId,
        url: 'http://localhost:3000',
      });

      // Comparison should throw or return null
      await expect(service.compareTurnSnapshots(turnId)).rejects.toThrow(
        /Missing before snapshot/
      );
    });

    it('should handle missing after snapshot when comparing', async () => {
      const turnId = `turn-no-after-${Date.now()}`;

      // Only capture before (no after)
      await service.captureBeforeState({
        workspaceId: testWorkspaceId,
        sessionId: testSessionId,
        turnId,
        url: 'http://localhost:3000',
      });

      // Comparison should throw or return null
      await expect(service.compareTurnSnapshots(turnId)).rejects.toThrow(
        /Missing after snapshot/
      );
    });
  });

  describe('Database Integration', () => {
    it('should store visual snapshots with all required fields', () => {
      const workspaceId = `ws-db-${Date.now()}`;
      const sessionId = `session-db-${Date.now()}`;
      const userId = `user-db-${Date.now()}`;

      db.insert(schema.users).values({ id: userId, name: 'DB Test User' }).run();
      db.insert(schema.workspaces).values({
        id: workspaceId,
        ownerUserId: userId,
        directoryName: 'db-test',
      }).run();
      db.insert(schema.sessions).values({
        id: sessionId,
        workspaceId,
        agentType: 'claude',
      }).run();

      const snapshotId = `snap-${Date.now()}`;

      db.insert(schema.visualSnapshots).values({
        id: snapshotId,
        workspaceId,
        sessionId,
        turnId: 'turn-1',
        snapshotType: 'before',
        imagePath: '/path/to/snapshot.png',
        url: 'http://localhost:3000',
      }).run();

      const stored = db
        .select()
        .from(schema.visualSnapshots)
        .where(eq(schema.visualSnapshots.id, snapshotId))
        .get();

      expect(stored).toBeDefined();
      expect(stored?.workspaceId).toBe(workspaceId);
      expect(stored?.sessionId).toBe(sessionId);
      expect(stored?.turnId).toBe('turn-1');
      expect(stored?.snapshotType).toBe('before');
      expect(stored?.createdAt).toBeTruthy();
    });

    it('should query snapshots by turn_id', () => {
      const workspaceId = `ws-query-${Date.now()}`;
      const sessionId = `session-query-${Date.now()}`;
      const userId = `user-query-${Date.now()}`;
      const turnId = `turn-query-${Date.now()}`;

      db.insert(schema.users).values({ id: userId, name: 'Query Test User' }).run();
      db.insert(schema.workspaces).values({
        id: workspaceId,
        ownerUserId: userId,
        directoryName: 'query-test',
      }).run();
      db.insert(schema.sessions).values({
        id: sessionId,
        workspaceId,
        agentType: 'claude',
      }).run();

      // Insert before and after snapshots
      db.insert(schema.visualSnapshots).values([
        {
          id: `snap-before-${Date.now()}`,
          workspaceId,
          sessionId,
          turnId,
          snapshotType: 'before',
          imagePath: '/path/to/before.png',
          url: 'http://localhost:3000',
        },
        {
          id: `snap-after-${Date.now() + 1}`,
          workspaceId,
          sessionId,
          turnId,
          snapshotType: 'after',
          imagePath: '/path/to/after.png',
          url: 'http://localhost:3000',
        },
      ]).run();

      const snapshots = db
        .select()
        .from(schema.visualSnapshots)
        .where(eq(schema.visualSnapshots.turnId, turnId))
        .all();

      expect(snapshots).toHaveLength(2);

      const before = snapshots.find((s) => s.snapshotType === 'before');
      const after = snapshots.find((s) => s.snapshotType === 'after');

      expect(before).toBeDefined();
      expect(after).toBeDefined();
    });
  });
});
