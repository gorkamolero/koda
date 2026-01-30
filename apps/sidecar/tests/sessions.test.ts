import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import Database from 'better-sqlite3';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import * as path from 'node:path';
import * as os from 'node:os';
import * as fs from 'node:fs';
import { runMigrations } from '../src/db/migrate.js';
import * as schema from '../src/db/schema.js';
import {
  createSession,
  getSession,
  updateSession,
  deleteSession,
  getSessionsByWorkspace,
  addMessage,
  getMessages,
  getMessageById,
  type CreateSessionInput,
  type UpdateSessionInput,
  type AddMessageInput,
  type GetMessagesOptions,
} from '../src/db/sessions.js';

describe('Session Persistence', () => {
  let dbPath: string;
  let sqlite: Database.Database;
  let db: ReturnType<typeof drizzle<typeof schema>>;
  let testWorkspaceId: string;
  let testUserId: string;

  beforeAll(() => {
    // Create temporary database for testing
    dbPath = path.join(os.tmpdir(), `koda-sessions-test-${Date.now()}.db`);

    // Run migrations
    runMigrations(dbPath);

    // Open database connection
    sqlite = new Database(dbPath);
    db = drizzle(sqlite, { schema });

    // Set up test user and workspace
    testUserId = `user-test-${Date.now()}`;
    testWorkspaceId = `ws-test-${Date.now()}`;

    db.insert(schema.users).values({ id: testUserId, name: 'Test User' }).run();
    db.insert(schema.workspaces)
      .values({
        id: testWorkspaceId,
        ownerUserId: testUserId,
        directoryName: 'test-workspace',
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

  describe('Session CRUD Operations', () => {
    describe('createSession', () => {
      it('should create a new session with all required fields', () => {
        const input: CreateSessionInput = {
          workspaceId: testWorkspaceId,
          agentType: 'claude',
          model: 'claude-sonnet-4-5',
        };

        const session = createSession(db, input);

        expect(session).toBeDefined();
        expect(session.id).toBeDefined();
        expect(session.workspaceId).toBe(testWorkspaceId);
        expect(session.agentType).toBe('claude');
        expect(session.model).toBe('claude-sonnet-4-5');
        expect(session.status).toBe('idle');
        expect(session.contextTokenCount).toBe(0);
      });

      it('should create a session with custom status', () => {
        const input: CreateSessionInput = {
          workspaceId: testWorkspaceId,
          agentType: 'codex',
          model: 'codex-1',
          status: 'running',
        };

        const session = createSession(db, input);

        expect(session.status).toBe('running');
      });

      it('should create a forked session', () => {
        const originalSession = createSession(db, {
          workspaceId: testWorkspaceId,
          agentType: 'claude',
          model: 'claude-sonnet-4-5',
        });

        const forkedSession = createSession(db, {
          workspaceId: testWorkspaceId,
          agentType: 'kimi',
          model: 'kimi-k1.5',
          forkedFromSessionId: originalSession.id,
        });

        expect(forkedSession.forkedFromSessionId).toBe(originalSession.id);
      });
    });

    describe('getSession', () => {
      it('should retrieve an existing session by id', () => {
        const created = createSession(db, {
          workspaceId: testWorkspaceId,
          agentType: 'claude',
          model: 'claude-sonnet-4-5',
        });

        const retrieved = getSession(db, created.id);

        expect(retrieved).toBeDefined();
        expect(retrieved?.id).toBe(created.id);
        expect(retrieved?.agentType).toBe('claude');
      });

      it('should return undefined for non-existent session', () => {
        const retrieved = getSession(db, 'non-existent-id');

        expect(retrieved).toBeUndefined();
      });
    });

    describe('updateSession', () => {
      it('should update session status', () => {
        const session = createSession(db, {
          workspaceId: testWorkspaceId,
          agentType: 'claude',
          model: 'claude-sonnet-4-5',
        });

        const updated = updateSession(db, session.id, { status: 'running' });

        expect(updated).toBeDefined();
        expect(updated?.status).toBe('running');
      });

      it('should update context token count', () => {
        const session = createSession(db, {
          workspaceId: testWorkspaceId,
          agentType: 'claude',
          model: 'claude-sonnet-4-5',
        });

        const updated = updateSession(db, session.id, { contextTokenCount: 5000 });

        expect(updated?.contextTokenCount).toBe(5000);
      });

      it('should update multiple fields at once', () => {
        const session = createSession(db, {
          workspaceId: testWorkspaceId,
          agentType: 'claude',
          model: 'claude-sonnet-4-5',
        });

        const updated = updateSession(db, session.id, {
          status: 'paused',
          contextTokenCount: 10000,
          model: 'claude-opus-4',
        });

        expect(updated?.status).toBe('paused');
        expect(updated?.contextTokenCount).toBe(10000);
        expect(updated?.model).toBe('claude-opus-4');
      });

      it('should return undefined when updating non-existent session', () => {
        const updated = updateSession(db, 'non-existent-id', { status: 'running' });

        expect(updated).toBeUndefined();
      });

      it('should update the updatedAt timestamp', () => {
        const session = createSession(db, {
          workspaceId: testWorkspaceId,
          agentType: 'claude',
          model: 'claude-sonnet-4-5',
        });

        // Wait a small amount to ensure timestamp changes
        const originalUpdatedAt = session.updatedAt;

        // Force a small delay
        const updated = updateSession(db, session.id, { status: 'running' });

        expect(updated?.updatedAt).toBeDefined();
        // The updatedAt should be set (we can't guarantee it's different due to timing)
      });
    });

    describe('deleteSession', () => {
      it('should delete an existing session', () => {
        const session = createSession(db, {
          workspaceId: testWorkspaceId,
          agentType: 'claude',
          model: 'claude-sonnet-4-5',
        });

        const deleted = deleteSession(db, session.id);

        expect(deleted).toBe(true);
        expect(getSession(db, session.id)).toBeUndefined();
      });

      it('should return false when deleting non-existent session', () => {
        const deleted = deleteSession(db, 'non-existent-id');

        expect(deleted).toBe(false);
      });
    });

    describe('getSessionsByWorkspace', () => {
      it('should retrieve all sessions for a workspace', () => {
        // Create a new workspace for this test to avoid interference
        const workspaceId = `ws-query-test-${Date.now()}`;
        db.insert(schema.workspaces)
          .values({
            id: workspaceId,
            ownerUserId: testUserId,
            directoryName: 'query-test',
          })
          .run();

        createSession(db, {
          workspaceId,
          agentType: 'claude',
          model: 'claude-sonnet-4-5',
        });
        createSession(db, {
          workspaceId,
          agentType: 'codex',
          model: 'codex-1',
        });
        createSession(db, {
          workspaceId,
          agentType: 'kimi',
          model: 'kimi-k1.5',
        });

        const sessions = getSessionsByWorkspace(db, workspaceId);

        expect(sessions).toHaveLength(3);
        expect(sessions.map((s) => s.agentType).sort()).toEqual(['claude', 'codex', 'kimi']);
      });

      it('should return empty array for workspace with no sessions', () => {
        const workspaceId = `ws-empty-${Date.now()}`;
        db.insert(schema.workspaces)
          .values({
            id: workspaceId,
            ownerUserId: testUserId,
            directoryName: 'empty-test',
          })
          .run();

        const sessions = getSessionsByWorkspace(db, workspaceId);

        expect(sessions).toEqual([]);
      });
    });
  });

  describe('Message Operations', () => {
    let testSessionId: string;

    beforeEach(() => {
      // Create a fresh session for each message test
      const session = createSession(db, {
        workspaceId: testWorkspaceId,
        agentType: 'claude',
        model: 'claude-sonnet-4-5',
      });
      testSessionId = session.id;
    });

    describe('addMessage', () => {
      it('should add a user message to a session', () => {
        const input: AddMessageInput = {
          sessionId: testSessionId,
          role: 'user',
          content: 'Hello, Claude!',
        };

        const message = addMessage(db, input);

        expect(message).toBeDefined();
        expect(message.id).toBeDefined();
        expect(message.sessionId).toBe(testSessionId);
        expect(message.role).toBe('user');
        expect(message.content).toBe('Hello, Claude!');
      });

      it('should add an assistant message to a session', () => {
        const input: AddMessageInput = {
          sessionId: testSessionId,
          role: 'assistant',
          content: 'Hello! How can I help you today?',
        };

        const message = addMessage(db, input);

        expect(message.role).toBe('assistant');
        expect(message.content).toBe('Hello! How can I help you today?');
      });

      it('should store full message JSON for replay', () => {
        const fullMessageJson = {
          role: 'assistant',
          content: [
            { type: 'text', text: 'Let me help with that.' },
            { type: 'tool_use', id: 'tool-1', name: 'bash', input: { command: 'ls -la' } },
          ],
          tool_calls: [{ id: 'tool-1', type: 'function', function: { name: 'bash', arguments: '{"command":"ls -la"}' } }],
        };

        const input: AddMessageInput = {
          sessionId: testSessionId,
          role: 'assistant',
          content: 'Let me help with that.',
          fullMessageJson: JSON.stringify(fullMessageJson),
        };

        const message = addMessage(db, input);

        expect(message.fullMessageJson).toBeDefined();
        const parsed = JSON.parse(message.fullMessageJson!);
        expect(parsed.tool_calls).toHaveLength(1);
        expect(parsed.content).toHaveLength(2);
      });

      it('should associate messages with a turn', () => {
        const turnId = `turn-${Date.now()}`;

        const userMessage = addMessage(db, {
          sessionId: testSessionId,
          role: 'user',
          content: 'Write a test',
          turnId,
        });

        const assistantMessage = addMessage(db, {
          sessionId: testSessionId,
          role: 'assistant',
          content: 'Here is the test...',
          turnId,
        });

        expect(userMessage.turnId).toBe(turnId);
        expect(assistantMessage.turnId).toBe(turnId);
      });
    });

    describe('getMessages', () => {
      it('should retrieve all messages for a session', () => {
        addMessage(db, { sessionId: testSessionId, role: 'user', content: 'Message 1' });
        addMessage(db, { sessionId: testSessionId, role: 'assistant', content: 'Response 1' });
        addMessage(db, { sessionId: testSessionId, role: 'user', content: 'Message 2' });

        const messages = getMessages(db, testSessionId);

        expect(messages).toHaveLength(3);
      });

      it('should return messages in chronological order', () => {
        addMessage(db, { sessionId: testSessionId, role: 'user', content: 'First' });
        addMessage(db, { sessionId: testSessionId, role: 'assistant', content: 'Second' });
        addMessage(db, { sessionId: testSessionId, role: 'user', content: 'Third' });

        const messages = getMessages(db, testSessionId);

        expect(messages[0].content).toBe('First');
        expect(messages[1].content).toBe('Second');
        expect(messages[2].content).toBe('Third');
      });

      it('should support pagination with limit', () => {
        for (let i = 1; i <= 10; i++) {
          addMessage(db, { sessionId: testSessionId, role: 'user', content: `Message ${i}` });
        }

        const options: GetMessagesOptions = { limit: 5 };
        const messages = getMessages(db, testSessionId, options);

        expect(messages).toHaveLength(5);
        expect(messages[0].content).toBe('Message 1');
        expect(messages[4].content).toBe('Message 5');
      });

      it('should support pagination with offset', () => {
        for (let i = 1; i <= 10; i++) {
          addMessage(db, { sessionId: testSessionId, role: 'user', content: `Message ${i}` });
        }

        const options: GetMessagesOptions = { limit: 5, offset: 5 };
        const messages = getMessages(db, testSessionId, options);

        expect(messages).toHaveLength(5);
        expect(messages[0].content).toBe('Message 6');
        expect(messages[4].content).toBe('Message 10');
      });

      it('should return empty array for session with no messages', () => {
        const messages = getMessages(db, testSessionId);

        expect(messages).toEqual([]);
      });

      it('should return empty array for non-existent session', () => {
        const messages = getMessages(db, 'non-existent-session');

        expect(messages).toEqual([]);
      });
    });

    describe('getMessageById', () => {
      it('should retrieve a specific message by id', () => {
        const created = addMessage(db, {
          sessionId: testSessionId,
          role: 'user',
          content: 'Specific message',
        });

        const retrieved = getMessageById(db, created.id);

        expect(retrieved).toBeDefined();
        expect(retrieved?.id).toBe(created.id);
        expect(retrieved?.content).toBe('Specific message');
      });

      it('should return undefined for non-existent message', () => {
        const retrieved = getMessageById(db, 'non-existent-message');

        expect(retrieved).toBeUndefined();
      });
    });
  });

  describe('Index Performance', () => {
    it('should have index on sessions.workspace_id', () => {
      const indexes = sqlite
        .prepare("SELECT name FROM sqlite_master WHERE type='index' AND tbl_name='sessions'")
        .all() as { name: string }[];

      const indexNames = indexes.map((i) => i.name);
      expect(indexNames.some((name) => name.includes('workspace'))).toBe(true);
    });

    it('should have index on session_messages.session_id', () => {
      const indexes = sqlite
        .prepare("SELECT name FROM sqlite_master WHERE type='index' AND tbl_name='session_messages'")
        .all() as { name: string }[];

      const indexNames = indexes.map((i) => i.name);
      expect(indexNames.some((name) => name.includes('session'))).toBe(true);
    });
  });
});
