/**
 * Session Recording Module
 *
 * Provides video-like playback of agent sessions.
 * Recordings store timing metadata and reference session messages
 * for efficient storage without data duplication.
 *
 * Key features:
 * - Start/stop recordings for any session
 * - Capture all messages with timing offsets
 * - Retrieve frames for playback with pagination
 * - Efficient storage via message references
 */

import { eq, desc, asc } from 'drizzle-orm';
import { type BetterSQLite3Database } from 'drizzle-orm/better-sqlite3';
import { sql } from 'drizzle-orm';
import * as schema from '../db/schema.js';
import { sessionRecordings, recordingFrames, sessionMessages } from '../db/schema.js';

// Type for the database instance
type Db = BetterSQLite3Database<typeof schema>;

// Generate a unique ID
function generateId(): string {
  return `${Date.now()}-${Math.random().toString(36).substring(2, 11)}`;
}

// ============================================================================
// Types
// ============================================================================

export interface Recording {
  id: string;
  sessionId: string | null;
  name: string | null;
  description: string | null;
  status: string | null;
  startedAt: string;
  endedAt: string | null;
  durationMs: number | null;
  frameCount: number | null;
}

export interface RecordingFrame {
  id: string;
  recordingId: string | null;
  messageId: string | null;
  frameType: string | null;
  offsetMs: number | null;
  sequenceNumber: number | null;
  createdAt: string;
  // Joined from session_messages
  content: string | null;
  role: string | null;
  fullMessageJson: string | null;
}

export interface StartRecordingInput {
  sessionId: string;
  name?: string;
  description?: string;
}

export interface GetFramesOptions {
  limit?: number;
  offset?: number;
}

// ============================================================================
// Recording Operations
// ============================================================================

/** SQLite datetime('now') values are UTC even though their text omits a zone. */
function parseTimestamp(value: string): number {
  return Date.parse(/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/.test(value) ? value.replace(' ', 'T') + 'Z' : value);
}

/**
 * Start a new recording for a session
 * Captures any existing messages as initial frames
 */
export function startRecording(db: Db, input: StartRecordingInput): Recording {
  const id = generateId();
  const startedAt = new Date().toISOString();

  // Create the recording
  db.insert(sessionRecordings)
    .values({
      id,
      sessionId: input.sessionId,
      name: input.name ?? null,
      description: input.description ?? null,
      status: 'recording',
      startedAt,
    })
    .run();

  // Capture existing messages as initial frames
  const existingMessages = db
    .select()
    .from(sessionMessages)
    .where(eq(sessionMessages.sessionId, input.sessionId))
    .orderBy(asc(sessionMessages.createdAt))
    .all();

  let sequenceNumber = 0;
  const recordingStart = new Date(startedAt).getTime();

  for (const message of existingMessages) {
    const messageTime = parseTimestamp(message.createdAt);
    const offsetMs = Math.max(0, messageTime - recordingStart);

    db.insert(recordingFrames)
      .values({
        id: generateId(),
        recordingId: id,
        messageId: message.id,
        frameType: 'message',
        offsetMs,
        sequenceNumber,
      })
      .run();

    sequenceNumber++;
  }

  // Update frame count
  db.update(sessionRecordings)
    .set({ frameCount: sequenceNumber })
    .where(eq(sessionRecordings.id, id))
    .run();

  return getRecording(db, id)!;
}

/**
 * Stop an active recording
 * Captures any new messages added since recording started
 */
export function stopRecording(db: Db, recordingId: string): Recording | undefined {
  const recording = getRecording(db, recordingId);
  if (!recording) {
    return undefined;
  }

  const endedAt = new Date().toISOString();
  const startTime = parseTimestamp(recording.startedAt);
  const endTime = new Date(endedAt).getTime();
  const durationMs = endTime - startTime;

  // Get existing frame message IDs to avoid duplicates
  const existingFrames = db
    .select({ messageId: recordingFrames.messageId })
    .from(recordingFrames)
    .where(eq(recordingFrames.recordingId, recordingId))
    .all();

  const existingMessageIds = new Set(existingFrames.map((f) => f.messageId));

  // Get any new messages added since recording started
  const newMessages = db
    .select()
    .from(sessionMessages)
    .where(eq(sessionMessages.sessionId, recording.sessionId!))
    .orderBy(asc(sessionMessages.createdAt))
    .all()
    .filter((m) => !existingMessageIds.has(m.id));

  // Get current max sequence number
  const maxSeqResult = db
    .select({ maxSeq: sql<number>`MAX(sequence_number)` })
    .from(recordingFrames)
    .where(eq(recordingFrames.recordingId, recordingId))
    .get();

  let sequenceNumber = (maxSeqResult?.maxSeq ?? -1) + 1;

  // Add new messages as frames
  for (const message of newMessages) {
    const messageTime = parseTimestamp(message.createdAt);
    const offsetMs = Math.max(0, messageTime - startTime);

    db.insert(recordingFrames)
      .values({
        id: generateId(),
        recordingId,
        messageId: message.id,
        frameType: 'message',
        offsetMs,
        sequenceNumber,
      })
      .run();

    sequenceNumber++;
  }

  // Update recording with final state
  const frameCount = existingFrames.length + newMessages.length;

  db.update(sessionRecordings)
    .set({
      status: 'completed',
      endedAt,
      durationMs,
      frameCount,
    })
    .where(eq(sessionRecordings.id, recordingId))
    .run();

  return getRecording(db, recordingId);
}

/**
 * Get a recording by ID
 */
export function getRecording(db: Db, recordingId: string): Recording | undefined {
  const result = db
    .select()
    .from(sessionRecordings)
    .where(eq(sessionRecordings.id, recordingId))
    .get();

  if (!result) {
    return undefined;
  }

  return {
    id: result.id,
    sessionId: result.sessionId,
    name: result.name,
    description: result.description,
    status: result.status,
    startedAt: result.startedAt,
    endedAt: result.endedAt,
    durationMs: result.durationMs,
    frameCount: result.frameCount,
  };
}

/**
 * Get all frames for a recording with optional pagination
 * Includes joined message content for playback
 */
export function getRecordingFrames(
  db: Db,
  recordingId: string,
  options: GetFramesOptions = {}
): RecordingFrame[] {
  const { limit, offset } = options;

  let query = db
    .select({
      id: recordingFrames.id,
      recordingId: recordingFrames.recordingId,
      messageId: recordingFrames.messageId,
      frameType: recordingFrames.frameType,
      offsetMs: recordingFrames.offsetMs,
      sequenceNumber: recordingFrames.sequenceNumber,
      createdAt: recordingFrames.createdAt,
      content: sessionMessages.content,
      role: sessionMessages.role,
      fullMessageJson: sessionMessages.fullMessageJson,
    })
    .from(recordingFrames)
    .leftJoin(sessionMessages, eq(recordingFrames.messageId, sessionMessages.id))
    .where(eq(recordingFrames.recordingId, recordingId))
    .orderBy(asc(recordingFrames.sequenceNumber))
    .$dynamic();

  if (limit !== undefined) {
    query = query.limit(limit);
  }

  if (offset !== undefined) {
    query = query.offset(offset);
  }

  return query.all();
}

/**
 * Get all recordings for a session
 * Returns newest first
 */
export function getRecordingsBySession(db: Db, sessionId: string): Recording[] {
  const results = db
    .select()
    .from(sessionRecordings)
    .where(eq(sessionRecordings.sessionId, sessionId))
    .orderBy(desc(sessionRecordings.startedAt))
    .all();

  return results.map((r) => ({
    id: r.id,
    sessionId: r.sessionId,
    name: r.name,
    description: r.description,
    status: r.status,
    startedAt: r.startedAt,
    endedAt: r.endedAt,
    durationMs: r.durationMs,
    frameCount: r.frameCount,
  }));
}

/**
 * Delete a recording and all its frames
 */
export function deleteRecording(db: Db, recordingId: string): boolean {
  const recording = getRecording(db, recordingId);
  if (!recording) {
    return false;
  }

  // Delete frames first (foreign key constraint)
  db.delete(recordingFrames).where(eq(recordingFrames.recordingId, recordingId)).run();

  // Delete the recording
  db.delete(sessionRecordings).where(eq(sessionRecordings.id, recordingId)).run();

  return true;
}
