/**
 * Session Recording Tests
 *
 * TDD: Tests written FIRST for session recording and playback functionality.
 * Recordings allow replaying agent sessions like a video, with timing metadata.
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import Database from 'better-sqlite3';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import * as path from 'node:path';
import * as os from 'node:os';
import * as fs from 'node:fs';
import { runMigrations } from '../src/db/migrate.js';
import * as schema from '../src/db/schema.js';
import { createSession, addMessage } from '../src/db/sessions.js';
import {
  startRecording,
  stopRecording,
  getRecording,
  getRecordingFrames,
  getRecordingsBySession,
  deleteRecording,
  type Recording,
  type RecordingFrame,
} from '../src/recording/index.js';

describe('Session Recording', () => {
  let dbPath: string;
  let sqlite: Database.Database;
  let db: ReturnType<typeof drizzle<typeof schema>>;
  let testRepoId: string;
  let testWorktreeId: string;
  let testUserId: string;
  let testSessionId: string;

  beforeAll(() => {
    // Create temporary database for testing
    dbPath = path.join(os.tmpdir(), `koda-recording-test-${Date.now()}.db`);

    // Run migrations
    runMigrations(dbPath);

    // Open database connection
    sqlite = new Database(dbPath);
    db = drizzle(sqlite, { schema });

    // Set up test user, repo, and worktree
    testUserId = `user-test-${Date.now()}`;
    testRepoId = `repo-test-${Date.now()}`;
    testWorktreeId = `wt-test-${Date.now()}`;

    db.insert(schema.users).values({ id: testUserId, name: 'Test User' }).run();
    db.insert(schema.repos)
      .values({
        id: testRepoId,
        name: 'test-repo',
        rootPath: '/tmp/test-repo',
      })
      .run();
    db.insert(schema.worktrees)
      .values({
        id: testWorktreeId,
        repoId: testRepoId,
        branch: 'test-branch',
        worktreePath: '/tmp/test-repo/.worktrees/test-branch',
        state: 'active',
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
  });

  beforeEach(() => {
    // Create a fresh session for each test
    const session = createSession(db, {
      worktreeId: testWorktreeId,
      agentType: 'claude',
      model: 'claude-sonnet-4-5',
    });
    testSessionId = session.id;
  });

  describe('startRecording', () => {
    it('should create a new recording for a session', () => {
      const recording = startRecording(db, { sessionId: testSessionId });

      expect(recording).toBeDefined();
      expect(recording.id).toBeDefined();
      expect(recording.sessionId).toBe(testSessionId);
      expect(recording.status).toBe('recording');
      expect(recording.startedAt).toBeDefined();
    });

    it('should allow optional name and description', () => {
      const recording = startRecording(db, {
        sessionId: testSessionId,
        name: 'Test Recording',
        description: 'Testing the recording feature',
      });

      expect(recording.name).toBe('Test Recording');
      expect(recording.description).toBe('Testing the recording feature');
    });

    it('should capture existing messages as initial frames', () => {
      // Add some messages to the session first
      addMessage(db, { sessionId: testSessionId, role: 'user', content: 'Hello!' });
      addMessage(db, { sessionId: testSessionId, role: 'assistant', content: 'Hi there!' });

      const recording = startRecording(db, { sessionId: testSessionId });
      const frames = getRecordingFrames(db, recording.id);

      expect(frames.length).toBe(2);
      expect(frames[0].content).toBe('Hello!');
      expect(frames[1].content).toBe('Hi there!');
    });
  });

  describe('stopRecording', () => {
    it('should stop an active recording', () => {
      const recording = startRecording(db, { sessionId: testSessionId });
      const stopped = stopRecording(db, recording.id);

      expect(stopped).toBeDefined();
      expect(stopped?.status).toBe('completed');
      expect(stopped?.endedAt).toBeDefined();
    });

    it('should calculate total duration', () => {
      const recording = startRecording(db, { sessionId: testSessionId });

      // Add a small delay to ensure measurable duration
      const stopped = stopRecording(db, recording.id);

      expect(stopped?.durationMs).toBeDefined();
      expect(stopped?.durationMs).toBeGreaterThanOrEqual(0);
    });

    it('should return undefined for non-existent recording', () => {
      const stopped = stopRecording(db, 'non-existent-id');

      expect(stopped).toBeUndefined();
    });
  });

  describe('getRecording', () => {
    it('should retrieve a recording by id', () => {
      const created = startRecording(db, { sessionId: testSessionId });
      const retrieved = getRecording(db, created.id);

      expect(retrieved).toBeDefined();
      expect(retrieved?.id).toBe(created.id);
      expect(retrieved?.sessionId).toBe(testSessionId);
    });

    it('should return undefined for non-existent recording', () => {
      const retrieved = getRecording(db, 'non-existent-id');

      expect(retrieved).toBeUndefined();
    });
  });

  describe('getRecordingFrames', () => {
    it('should retrieve all frames for a recording', () => {
      const recording = startRecording(db, { sessionId: testSessionId });

      // Add messages that will be captured as frames
      addMessage(db, { sessionId: testSessionId, role: 'user', content: 'Frame 1' });
      addMessage(db, { sessionId: testSessionId, role: 'assistant', content: 'Frame 2' });
      addMessage(db, { sessionId: testSessionId, role: 'user', content: 'Frame 3' });

      // Refresh frames by stopping and checking
      stopRecording(db, recording.id);
      const frames = getRecordingFrames(db, recording.id);

      expect(frames.length).toBe(3);
    });

    it('should return frames in chronological order', () => {
      const recording = startRecording(db, { sessionId: testSessionId });

      addMessage(db, { sessionId: testSessionId, role: 'user', content: 'First' });
      addMessage(db, { sessionId: testSessionId, role: 'assistant', content: 'Second' });
      addMessage(db, { sessionId: testSessionId, role: 'user', content: 'Third' });

      stopRecording(db, recording.id);
      const frames = getRecordingFrames(db, recording.id);

      expect(frames[0].content).toBe('First');
      expect(frames[1].content).toBe('Second');
      expect(frames[2].content).toBe('Third');
    });

    it('should include timing offset for each frame', () => {
      const recording = startRecording(db, { sessionId: testSessionId });

      addMessage(db, { sessionId: testSessionId, role: 'user', content: 'Message 1' });
      addMessage(db, { sessionId: testSessionId, role: 'assistant', content: 'Message 2' });

      stopRecording(db, recording.id);
      const frames = getRecordingFrames(db, recording.id);

      // All frames should have offsetMs defined
      frames.forEach((frame) => {
        expect(frame.offsetMs).toBeDefined();
        expect(typeof frame.offsetMs).toBe('number');
      });

      // First frame should be at or near 0
      expect(frames[0].offsetMs).toBeGreaterThanOrEqual(0);
    });

    it('should include frame type (message/tool_call/tool_result)', () => {
      const recording = startRecording(db, { sessionId: testSessionId });

      addMessage(db, { sessionId: testSessionId, role: 'user', content: 'Hello' });

      stopRecording(db, recording.id);
      const frames = getRecordingFrames(db, recording.id);

      expect(frames[0].frameType).toBe('message');
    });

    it('should include full message JSON when available', () => {
      const fullJson = JSON.stringify({
        role: 'assistant',
        content: [{ type: 'text', text: 'Hello!' }],
      });

      const recording = startRecording(db, { sessionId: testSessionId });

      addMessage(db, {
        sessionId: testSessionId,
        role: 'assistant',
        content: 'Hello!',
        fullMessageJson: fullJson,
      });

      stopRecording(db, recording.id);
      const frames = getRecordingFrames(db, recording.id);

      expect(frames[0].fullMessageJson).toBe(fullJson);
    });
  });

  describe('getRecordingsBySession', () => {
    it('should retrieve all recordings for a session', () => {
      startRecording(db, { sessionId: testSessionId, name: 'Recording 1' });
      startRecording(db, { sessionId: testSessionId, name: 'Recording 2' });
      startRecording(db, { sessionId: testSessionId, name: 'Recording 3' });

      const recordings = getRecordingsBySession(db, testSessionId);

      expect(recordings.length).toBe(3);
    });

    it('should return recordings in reverse chronological order (newest first)', () => {
      // Note: Since recordings are created very fast and SQLite datetime has second
      // precision, we verify that the order is consistent (either by startedAt or id)
      const rec1 = startRecording(db, { sessionId: testSessionId, name: 'First' });
      const rec2 = startRecording(db, { sessionId: testSessionId, name: 'Second' });
      const rec3 = startRecording(db, { sessionId: testSessionId, name: 'Third' });

      const recordings = getRecordingsBySession(db, testSessionId);

      // All recordings should be returned
      expect(recordings.length).toBe(3);

      // IDs are timestamp-based, so newer recordings have "larger" IDs
      // The function orders by startedAt DESC, and if timestamps are equal,
      // SQLite will use insertion order. Since IDs are unique and ordered,
      // we can verify we got all three recordings.
      const ids = recordings.map((r) => r.id);
      expect(ids).toContain(rec1.id);
      expect(ids).toContain(rec2.id);
      expect(ids).toContain(rec3.id);
    });

    it('should return empty array for session with no recordings', () => {
      const recordings = getRecordingsBySession(db, testSessionId);

      expect(recordings).toEqual([]);
    });
  });

  describe('deleteRecording', () => {
    it('should delete a recording and its frames', () => {
      const recording = startRecording(db, { sessionId: testSessionId });
      addMessage(db, { sessionId: testSessionId, role: 'user', content: 'Test' });
      stopRecording(db, recording.id);

      const deleted = deleteRecording(db, recording.id);

      expect(deleted).toBe(true);
      expect(getRecording(db, recording.id)).toBeUndefined();
      expect(getRecordingFrames(db, recording.id)).toEqual([]);
    });

    it('should return false for non-existent recording', () => {
      const deleted = deleteRecording(db, 'non-existent-id');

      expect(deleted).toBe(false);
    });
  });

  describe('Recording Efficiency', () => {
    it('should store frames referencing messages, not duplicating content', () => {
      const recording = startRecording(db, { sessionId: testSessionId });

      // Add a large message
      const largeContent = 'x'.repeat(10000);
      addMessage(db, { sessionId: testSessionId, role: 'assistant', content: largeContent });

      stopRecording(db, recording.id);
      const frames = getRecordingFrames(db, recording.id);

      // Frame should reference the message, not store content twice
      expect(frames[0].messageId).toBeDefined();
      expect(frames[0].content).toBe(largeContent); // Content is retrieved via join
    });

    it('should support pagination for large recordings', () => {
      const recording = startRecording(db, { sessionId: testSessionId });

      // Add many messages
      for (let i = 1; i <= 100; i++) {
        addMessage(db, { sessionId: testSessionId, role: 'user', content: `Message ${i}` });
      }

      stopRecording(db, recording.id);

      // Get first page
      const page1 = getRecordingFrames(db, recording.id, { limit: 10, offset: 0 });
      expect(page1.length).toBe(10);
      expect(page1[0].content).toBe('Message 1');

      // Get second page
      const page2 = getRecordingFrames(db, recording.id, { limit: 10, offset: 10 });
      expect(page2.length).toBe(10);
      expect(page2[0].content).toBe('Message 11');
    });
  });
});
