/**
 * Visual Diff Service
 *
 * High-level service for capturing and comparing visual snapshots
 * during agent turns. Integrates with the database for persistence.
 */

import { eq, and } from 'drizzle-orm';
import { randomUUID } from 'node:crypto';
import * as fs from 'node:fs';
import { ScreenshotCapture, CaptureOptions } from './capture.js';
import { VisualDiff, DiffResult } from './diff.js';
import * as schema from '../db/schema.js';

export interface ServiceOptions {
  /** Drizzle database instance */
  db: ReturnType<typeof import('drizzle-orm/better-sqlite3').drizzle<typeof schema>>;
  /** Directory to store snapshots */
  outputDir: string;
  /** Viewport dimensions */
  viewport?: { width: number; height: number };
}

export interface CaptureStateParams {
  worktreeId: string;
  sessionId: string;
  turnId: string;
  url: string;
  selector?: string;
}

export interface SnapshotRecord {
  id: string;
  worktreeId: string | null;
  sessionId: string | null;
  turnId: string | null;
  snapshotType: string | null;
  imagePath: string | null;
  url: string | null;
  createdAt: string;
}

export interface TurnComparison {
  turnId: string;
  beforeSnapshot: SnapshotRecord;
  afterSnapshot: SnapshotRecord;
  diffResult: DiffResult;
}

export class VisualDiffService {
  private db: ServiceOptions['db'];
  private outputDir: string;
  private capture: ScreenshotCapture;
  private differ: VisualDiff;

  constructor(options: ServiceOptions) {
    this.db = options.db;
    this.outputDir = options.outputDir;

    const captureOptions: CaptureOptions = {
      outputDir: options.outputDir,
      viewport: options.viewport,
    };

    this.capture = new ScreenshotCapture(captureOptions);
    this.differ = new VisualDiff();

    // Ensure output directory exists
    fs.mkdirSync(this.outputDir, { recursive: true });
  }

  /**
   * Capture the "before" state for an agent turn
   */
  async captureBeforeState(params: CaptureStateParams): Promise<SnapshotRecord> {
    return this.captureState(params, 'before');
  }

  /**
   * Capture the "after" state for an agent turn
   */
  async captureAfterState(params: CaptureStateParams): Promise<SnapshotRecord> {
    return this.captureState(params, 'after');
  }

  /**
   * Internal method to capture state with specified type
   */
  private async captureState(
    params: CaptureStateParams,
    snapshotType: 'before' | 'after'
  ): Promise<SnapshotRecord> {
    const { worktreeId, sessionId, turnId, url, selector } = params;

    // Capture screenshot
    const screenshot = await this.capture.captureScreenshot(url, selector);

    // Generate ID and store in database
    const id = randomUUID();

    this.db.insert(schema.visualSnapshots).values({
      id,
      worktreeId,
      sessionId,
      turnId,
      snapshotType,
      imagePath: screenshot.imagePath,
      url,
    }).run();

    // Retrieve the stored record
    const stored = this.db
      .select()
      .from(schema.visualSnapshots)
      .where(eq(schema.visualSnapshots.id, id))
      .get();

    if (!stored) {
      throw new Error('Failed to store visual snapshot');
    }

    return stored;
  }

  /**
   * Compare before/after snapshots for a turn
   */
  async compareTurnSnapshots(turnId: string): Promise<TurnComparison> {
    // Get before snapshot
    const beforeSnapshot = this.db
      .select()
      .from(schema.visualSnapshots)
      .where(
        and(
          eq(schema.visualSnapshots.turnId, turnId),
          eq(schema.visualSnapshots.snapshotType, 'before')
        )
      )
      .get();

    if (!beforeSnapshot) {
      throw new Error(`Missing before snapshot for turn ${turnId}`);
    }

    // Get after snapshot
    const afterSnapshot = this.db
      .select()
      .from(schema.visualSnapshots)
      .where(
        and(
          eq(schema.visualSnapshots.turnId, turnId),
          eq(schema.visualSnapshots.snapshotType, 'after')
        )
      )
      .get();

    if (!afterSnapshot) {
      throw new Error(`Missing after snapshot for turn ${turnId}`);
    }

    // Read image files
    if (!beforeSnapshot.imagePath || !afterSnapshot.imagePath) {
      throw new Error('Snapshot image paths are missing');
    }

    const beforeImage = fs.readFileSync(beforeSnapshot.imagePath);
    const afterImage = fs.readFileSync(afterSnapshot.imagePath);

    // Compare images
    const diffResult = await this.differ.compare(beforeImage, afterImage, {
      generateDiffImage: true,
      calculateBounds: true,
      outputDir: this.outputDir,
    });

    return {
      turnId,
      beforeSnapshot,
      afterSnapshot,
      diffResult,
    };
  }

  /**
   * Get all snapshots for a session
   */
  async getSessionSnapshots(sessionId: string): Promise<SnapshotRecord[]> {
    return this.db
      .select()
      .from(schema.visualSnapshots)
      .where(eq(schema.visualSnapshots.sessionId, sessionId))
      .all();
  }

  /**
   * Get snapshots for a specific turn
   */
  async getTurnSnapshots(turnId: string): Promise<SnapshotRecord[]> {
    return this.db
      .select()
      .from(schema.visualSnapshots)
      .where(eq(schema.visualSnapshots.turnId, turnId))
      .all();
  }

  /**
   * Delete snapshots for a turn
   */
  async deleteTurnSnapshots(turnId: string): Promise<void> {
    // Get snapshots to delete their files
    const snapshots = await this.getTurnSnapshots(turnId);

    // Delete image files
    for (const snapshot of snapshots) {
      if (snapshot.imagePath && fs.existsSync(snapshot.imagePath)) {
        fs.unlinkSync(snapshot.imagePath);
      }
    }

    // Delete from database
    this.db
      .delete(schema.visualSnapshots)
      .where(eq(schema.visualSnapshots.turnId, turnId))
      .run();
  }

  /**
   * Close resources
   */
  async close(): Promise<void> {
    await this.capture.close();
  }
}
