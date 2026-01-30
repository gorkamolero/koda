/**
 * Session Persistence Module
 *
 * CRUD operations for sessions and messages.
 * Supports full message JSON storage for replay,
 * pagination, and workspace-based queries.
 */

import { eq, desc, asc } from 'drizzle-orm';
import { type BetterSQLite3Database } from 'drizzle-orm/better-sqlite3';
import { sql } from 'drizzle-orm';
import * as schema from './schema.js';
import { sessions, sessionMessages, type Session, type SessionMessage } from './schema.js';

// Type for the database instance
type Db = BetterSQLite3Database<typeof schema>;

// Generate a unique ID
function generateId(): string {
  return `${Date.now()}-${Math.random().toString(36).substring(2, 11)}`;
}

// ============================================================================
// Session Types
// ============================================================================

export interface CreateSessionInput {
  workspaceId: string;
  agentType: string;
  model: string;
  status?: 'idle' | 'running' | 'paused';
  forkedFromSessionId?: string;
}

export interface UpdateSessionInput {
  status?: 'idle' | 'running' | 'paused';
  model?: string;
  contextTokenCount?: number;
}

// ============================================================================
// Session CRUD Operations
// ============================================================================

/**
 * Create a new session
 */
export function createSession(db: Db, input: CreateSessionInput): Session {
  const id = generateId();

  db.insert(sessions)
    .values({
      id,
      workspaceId: input.workspaceId,
      agentType: input.agentType,
      model: input.model,
      status: input.status ?? 'idle',
      contextTokenCount: 0,
      forkedFromSessionId: input.forkedFromSessionId,
    })
    .run();

  return getSession(db, id)!;
}

/**
 * Get a session by ID
 */
export function getSession(db: Db, sessionId: string): Session | undefined {
  return db.select().from(sessions).where(eq(sessions.id, sessionId)).get();
}

/**
 * Update a session
 */
export function updateSession(
  db: Db,
  sessionId: string,
  input: UpdateSessionInput
): Session | undefined {
  const existing = getSession(db, sessionId);
  if (!existing) {
    return undefined;
  }

  const updateData: Record<string, unknown> = {
    updatedAt: sql`(datetime('now'))`,
  };

  if (input.status !== undefined) {
    updateData.status = input.status;
  }
  if (input.model !== undefined) {
    updateData.model = input.model;
  }
  if (input.contextTokenCount !== undefined) {
    updateData.contextTokenCount = input.contextTokenCount;
  }

  db.update(sessions).set(updateData).where(eq(sessions.id, sessionId)).run();

  return getSession(db, sessionId);
}

/**
 * Delete a session
 */
export function deleteSession(db: Db, sessionId: string): boolean {
  const existing = getSession(db, sessionId);
  if (!existing) {
    return false;
  }

  // Delete associated messages first
  db.delete(sessionMessages).where(eq(sessionMessages.sessionId, sessionId)).run();

  // Delete the session
  db.delete(sessions).where(eq(sessions.id, sessionId)).run();

  return true;
}

/**
 * Get all sessions for a workspace
 */
export function getSessionsByWorkspace(db: Db, workspaceId: string): Session[] {
  return db
    .select()
    .from(sessions)
    .where(eq(sessions.workspaceId, workspaceId))
    .orderBy(desc(sessions.createdAt))
    .all();
}

// ============================================================================
// Message Types
// ============================================================================

export interface AddMessageInput {
  sessionId: string;
  role: 'user' | 'assistant';
  content: string;
  fullMessageJson?: string;
  turnId?: string;
}

export interface GetMessagesOptions {
  limit?: number;
  offset?: number;
}

// ============================================================================
// Message Operations
// ============================================================================

/**
 * Add a message to a session
 */
export function addMessage(db: Db, input: AddMessageInput): SessionMessage {
  const id = generateId();

  db.insert(sessionMessages)
    .values({
      id,
      sessionId: input.sessionId,
      role: input.role,
      content: input.content,
      fullMessageJson: input.fullMessageJson,
      turnId: input.turnId,
    })
    .run();

  return getMessageById(db, id)!;
}

/**
 * Get messages for a session with optional pagination
 */
export function getMessages(
  db: Db,
  sessionId: string,
  options: GetMessagesOptions = {}
): SessionMessage[] {
  const { limit, offset } = options;

  let query = db
    .select()
    .from(sessionMessages)
    .where(eq(sessionMessages.sessionId, sessionId))
    .orderBy(asc(sessionMessages.createdAt))
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
 * Get a specific message by ID
 */
export function getMessageById(db: Db, messageId: string): SessionMessage | undefined {
  return db.select().from(sessionMessages).where(eq(sessionMessages.id, messageId)).get();
}
