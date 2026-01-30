/**
 * Codex Agent Handler Tests
 *
 * Following TDD - tests written FIRST before implementation.
 * Tests cover:
 * - Session management (start, resume, cancel)
 * - Message streaming
 * - Thread management
 * - Error handling
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  CodexHandler,
  type CodexStartInput,
  type CodexSendInput,
  type CodexResumeInput,
  type CodexCancelInput,
  StartSessionSchema,
  SendMessageSchema,
  ResumeSessionSchema,
  CancelSessionSchema,
  GetSessionSchema,
} from '../src/agents/codex.js';

// Mock the Codex SDK
vi.mock('@openai/codex-sdk', () => {
  const mockThread = {
    run: vi.fn(),
    runStreamed: vi.fn(),
    id: 'mock-thread-id-123',
  };

  const mockCodex = {
    startThread: vi.fn(() => mockThread),
    resumeThread: vi.fn(() => mockThread),
  };

  return {
    Codex: vi.fn(() => mockCodex),
  };
});

describe('Codex Handler', () => {
  let handler: CodexHandler;

  beforeEach(() => {
    handler = new CodexHandler();
    vi.clearAllMocks();
  });

  afterEach(() => {
    // Clean up any active sessions
    handler.cleanup();
  });

  describe('Schema Validation', () => {
    it('should validate start session input', () => {
      const validInput = {
        workspaceId: '123e4567-e89b-12d3-a456-426614174000',
        workingDirectory: '/path/to/project',
        model: 'gpt-5.2-codex',
      };

      const result = StartSessionSchema.safeParse(validInput);
      expect(result.success).toBe(true);
    });

    it('should accept input without model (default applied by handler)', () => {
      const inputWithoutModel = {
        workspaceId: '123e4567-e89b-12d3-a456-426614174000',
        workingDirectory: '/path/to/project',
      };

      const result = StartSessionSchema.safeParse(inputWithoutModel);
      expect(result.success).toBe(true);
      if (result.success) {
        // Model is optional in schema, default is applied by handler
        expect(result.data.model).toBeUndefined();
      }
    });

    it('should reject invalid workspace ID', () => {
      const invalidInput = {
        workspaceId: 'not-a-uuid',
        workingDirectory: '/path/to/project',
      };

      const result = StartSessionSchema.safeParse(invalidInput);
      expect(result.success).toBe(false);
    });

    it('should validate send message input', () => {
      const validInput = {
        sessionId: '123e4567-e89b-12d3-a456-426614174000',
        message: 'Fix the bug in auth.ts',
      };

      const result = SendMessageSchema.safeParse(validInput);
      expect(result.success).toBe(true);
      if (result.success) {
        // Stream is optional in schema, default is applied by handler
        expect(result.data.stream).toBeUndefined();
      }
    });

    it('should validate resume session input', () => {
      const validInput = {
        sessionId: '123e4567-e89b-12d3-a456-426614174000',
        threadId: 'thread_abc123',
        workspaceId: '123e4567-e89b-12d3-a456-426614174001',
        workingDirectory: '/path/to/project',
      };

      const result = ResumeSessionSchema.safeParse(validInput);
      expect(result.success).toBe(true);
    });

    it('should validate cancel session input', () => {
      const validInput: CodexCancelInput = {
        sessionId: '123e4567-e89b-12d3-a456-426614174000',
      };

      const result = CancelSessionSchema.safeParse(validInput);
      expect(result.success).toBe(true);
    });

    it('should validate get session input', () => {
      const validInput = {
        sessionId: '123e4567-e89b-12d3-a456-426614174000',
      };

      const result = GetSessionSchema.safeParse(validInput);
      expect(result.success).toBe(true);
    });
  });

  describe('Session Management', () => {
    describe('startSession', () => {
      it('should create a new session with default model', async () => {
        const input: CodexStartInput = {
          workspaceId: '123e4567-e89b-12d3-a456-426614174000',
          workingDirectory: '/path/to/project',
          model: 'gpt-5.2-codex',
        };

        const session = await handler.startSession(input);

        expect(session).toBeDefined();
        expect(session.id).toBeDefined();
        expect(session.workspaceId).toBe(input.workspaceId);
        expect(session.status).toBe('idle');
        expect(session.agentType).toBe('codex');
        expect(session.model).toBe('gpt-5.2-codex');
        // Thread ID comes from mock
        expect(session.threadId).toBe('mock-thread-id-123');
      });

      it('should create a session with custom model', async () => {
        const input: CodexStartInput = {
          workspaceId: '123e4567-e89b-12d3-a456-426614174000',
          workingDirectory: '/path/to/project',
          model: 'gpt-5-codex',
        };

        const session = await handler.startSession(input);

        expect(session.model).toBe('gpt-5-codex');
      });

      it('should track the session internally', async () => {
        const input: CodexStartInput = {
          workspaceId: '123e4567-e89b-12d3-a456-426614174000',
          workingDirectory: '/path/to/project',
          model: 'gpt-5.2-codex',
        };

        const session = await handler.startSession(input);
        const retrieved = await handler.getSession({ sessionId: session.id });

        expect(retrieved).toEqual(session);
      });
    });

    describe('resumeSession', () => {
      it('should resume an existing thread', async () => {
        // First create a session
        const startInput: CodexStartInput = {
          workspaceId: '123e4567-e89b-12d3-a456-426614174000',
          workingDirectory: '/path/to/project',
          model: 'gpt-5.2-codex',
        };
        const originalSession = await handler.startSession(startInput);

        // Simulate session being lost (e.g., process restart)
        handler.cleanup();

        // Resume with the thread ID
        const resumeInput: CodexResumeInput = {
          sessionId: originalSession.id,
          threadId: originalSession.threadId!,
          workspaceId: originalSession.workspaceId,
          workingDirectory: '/path/to/project',
          model: 'gpt-5.2-codex',
        };

        const resumedSession = await handler.resumeSession(resumeInput);

        expect(resumedSession.id).toBe(originalSession.id);
        expect(resumedSession.threadId).toBe(originalSession.threadId);
        expect(resumedSession.status).toBe('idle');
      });

      it('should throw error for invalid thread ID', async () => {
        const resumeInput: CodexResumeInput = {
          sessionId: '123e4567-e89b-12d3-a456-426614174000',
          threadId: 'invalid-thread-id',
          workspaceId: '123e4567-e89b-12d3-a456-426614174001',
          workingDirectory: '/path/to/project',
          model: 'gpt-5.2-codex',
        };

        // Mock resumeThread to throw
        const { Codex } = await import('@openai/codex-sdk');
        const mockCodex = new Codex();
        vi.mocked(mockCodex.resumeThread).mockImplementation(() => {
          throw new Error('Thread not found');
        });

        await expect(handler.resumeSession(resumeInput)).rejects.toThrow();
      });
    });

    describe('cancelSession', () => {
      it('should cancel an active session', async () => {
        const startInput: CodexStartInput = {
          workspaceId: '123e4567-e89b-12d3-a456-426614174000',
          workingDirectory: '/path/to/project',
          model: 'gpt-5.2-codex',
        };
        const session = await handler.startSession(startInput);

        const result = await handler.cancelSession({ sessionId: session.id });

        expect(result.success).toBe(true);
        expect(result.sessionId).toBe(session.id);

        // Session should be marked as cancelled
        const cancelled = await handler.getSession({ sessionId: session.id });
        expect(cancelled.status).toBe('cancelled');
      });

      it('should throw error for non-existent session', async () => {
        const cancelInput: CodexCancelInput = {
          sessionId: '123e4567-e89b-12d3-a456-426614174000',
        };

        await expect(handler.cancelSession(cancelInput)).rejects.toThrow(
          'Session not found'
        );
      });
    });

    describe('getSession', () => {
      it('should return session details', async () => {
        const startInput: CodexStartInput = {
          workspaceId: '123e4567-e89b-12d3-a456-426614174000',
          workingDirectory: '/path/to/project',
          model: 'gpt-5.2-codex',
        };
        const session = await handler.startSession(startInput);

        const retrieved = await handler.getSession({ sessionId: session.id });

        expect(retrieved.id).toBe(session.id);
        expect(retrieved.workspaceId).toBe(session.workspaceId);
        expect(retrieved.threadId).toBe(session.threadId);
        expect(retrieved.status).toBe(session.status);
        expect(retrieved.model).toBe(session.model);
      });

      it('should throw error for non-existent session', async () => {
        await expect(
          handler.getSession({
            sessionId: '123e4567-e89b-12d3-a456-426614174000',
          })
        ).rejects.toThrow('Session not found');
      });
    });
  });

  describe('Message Handling', () => {
    it('should send a message and get response', async () => {
      // Start a session first
      const startInput: CodexStartInput = {
        workspaceId: '123e4567-e89b-12d3-a456-426614174000',
        workingDirectory: '/path/to/project',
        model: 'gpt-5.2-codex',
      };
      const session = await handler.startSession(startInput);

      // Mock the run method response
      const { Codex } = await import('@openai/codex-sdk');
      const mockCodex = new Codex();
      const mockThread = mockCodex.startThread();
      vi.mocked(mockThread.run).mockResolvedValue({
        finalResponse: 'I fixed the bug in auth.ts',
        items: [
          {
            id: 'item-1',
            type: 'agent_message',
            text: 'I fixed the bug in auth.ts',
          },
        ],
        usage: {
          input_tokens: 100,
          cached_input_tokens: 50,
          output_tokens: 200,
        },
      });

      const sendInput: CodexSendInput = {
        sessionId: session.id,
        message: 'Fix the bug in auth.ts',
        stream: false,
      };

      const response = await handler.sendMessage(sendInput);

      expect(response.sessionId).toBe(session.id);
      expect(response.response).toBe('I fixed the bug in auth.ts');
      expect(response.turnId).toBeDefined();
      expect(response.usage).toEqual({
        inputTokens: 100,
        cachedInputTokens: 50,
        outputTokens: 200,
      });
    });

    it('should update session status during message processing', async () => {
      const startInput: CodexStartInput = {
        workspaceId: '123e4567-e89b-12d3-a456-426614174000',
        workingDirectory: '/path/to/project',
        model: 'gpt-5.2-codex',
      };
      const session = await handler.startSession(startInput);

      // Mock a slow response
      const { Codex } = await import('@openai/codex-sdk');
      const mockCodex = new Codex();
      const mockThread = mockCodex.startThread();
      vi.mocked(mockThread.run).mockImplementation(async () => {
        // Simulate processing time
        await new Promise((resolve) => setTimeout(resolve, 10));
        return {
          finalResponse: 'Done',
          items: [],
          usage: null,
        };
      });

      const sendPromise = handler.sendMessage({
        sessionId: session.id,
        message: 'Do something',
        stream: false,
      });

      // Check status is running (may need small delay for async update)
      await new Promise((resolve) => setTimeout(resolve, 5));
      const running = await handler.getSession({ sessionId: session.id });
      expect(running.status).toBe('running');

      await sendPromise;

      // After completion, status should be idle
      const idle = await handler.getSession({ sessionId: session.id });
      expect(idle.status).toBe('idle');
    });

    it('should throw error when sending to non-existent session', async () => {
      const sendInput: CodexSendInput = {
        sessionId: '123e4567-e89b-12d3-a456-426614174000',
        message: 'Hello',
        stream: false,
      };

      await expect(handler.sendMessage(sendInput)).rejects.toThrow(
        'Session not found'
      );
    });

    it('should throw error when sending to cancelled session', async () => {
      const startInput: CodexStartInput = {
        workspaceId: '123e4567-e89b-12d3-a456-426614174000',
        workingDirectory: '/path/to/project',
        model: 'gpt-5.2-codex',
      };
      const session = await handler.startSession(startInput);
      await handler.cancelSession({ sessionId: session.id });

      const sendInput: CodexSendInput = {
        sessionId: session.id,
        message: 'Hello',
        stream: false,
      };

      await expect(handler.sendMessage(sendInput)).rejects.toThrow(
        'Session is cancelled'
      );
    });
  });

  describe('Streaming', () => {
    it('should stream message responses', async () => {
      const startInput: CodexStartInput = {
        workspaceId: '123e4567-e89b-12d3-a456-426614174000',
        workingDirectory: '/path/to/project',
        model: 'gpt-5.2-codex',
      };
      const session = await handler.startSession(startInput);

      // Mock runStreamed to return a StreamedTurn with events async generator
      const { Codex } = await import('@openai/codex-sdk');
      const mockCodex = new Codex();
      const mockThread = mockCodex.startThread();

      async function* mockGenerator() {
        yield { type: 'thread.started', thread_id: 'thread-123' };
        yield { type: 'item.completed', item: { id: '1', type: 'agent_message', text: 'Part 1' } };
        yield { type: 'item.completed', item: { id: '2', type: 'agent_message', text: 'Part 2' } };
        yield { type: 'turn.completed', usage: { input_tokens: 100, cached_input_tokens: 50, output_tokens: 200 } };
      }

      vi.mocked(mockThread.runStreamed).mockResolvedValue({
        events: mockGenerator(),
      });

      const sendInput: CodexSendInput = {
        sessionId: session.id,
        message: 'Stream a response',
        stream: true,
      };

      const events: unknown[] = [];
      for await (const event of handler.sendMessageStreamed(sendInput)) {
        events.push(event);
      }

      expect(events.length).toBe(4);
      expect(events.some((e: unknown) => (e as { type: string }).type === 'thread.started')).toBe(true);
      expect(events.some((e: unknown) => (e as { type: string }).type === 'item.completed')).toBe(true);
      expect(events.some((e: unknown) => (e as { type: string }).type === 'turn.completed')).toBe(true);
    });
  });

  describe('Error Handling', () => {
    it('should handle SDK initialization errors', async () => {
      // Mock Codex constructor to throw
      const { Codex } = await import('@openai/codex-sdk');
      const originalImpl = vi.mocked(Codex).getMockImplementation();

      vi.mocked(Codex).mockImplementation(() => {
        throw new Error('Failed to initialize Codex SDK');
      });

      const newHandler = new CodexHandler();
      const startInput: CodexStartInput = {
        workspaceId: '123e4567-e89b-12d3-a456-426614174000',
        workingDirectory: '/path/to/project',
        model: 'gpt-5.2-codex',
      };

      await expect(newHandler.startSession(startInput)).rejects.toThrow(
        'Failed to initialize Codex SDK'
      );

      // Restore the original mock implementation
      if (originalImpl) {
        vi.mocked(Codex).mockImplementation(originalImpl);
      } else {
        vi.mocked(Codex).mockRestore();
      }
    });

    it('should handle API errors gracefully', async () => {
      // Get the mock instances from the module-level mock
      const { Codex } = await import('@openai/codex-sdk');
      const mockCodex = new Codex();
      const mockThread = mockCodex.startThread();

      // First start a session (this uses the normal mock)
      const startInput: CodexStartInput = {
        workspaceId: '123e4567-e89b-12d3-a456-426614174000',
        workingDirectory: '/path/to/project',
        model: 'gpt-5.2-codex',
      };
      const session = await handler.startSession(startInput);

      // Now mock run to throw an API error
      vi.mocked(mockThread.run).mockRejectedValueOnce(
        new Error('API rate limit exceeded')
      );

      const sendInput: CodexSendInput = {
        sessionId: session.id,
        message: 'Hello',
        stream: false,
      };

      await expect(handler.sendMessage(sendInput)).rejects.toThrow(
        'API rate limit exceeded'
      );

      // Session should remain in idle state after error
      const afterError = await handler.getSession({ sessionId: session.id });
      expect(afterError.status).toBe('idle');
    });
  });

  describe('Thread Management', () => {
    it('should persist thread ID across messages', async () => {
      // Get the mock instances from the module-level mock first
      const { Codex } = await import('@openai/codex-sdk');
      const mockCodex = new Codex();
      const mockThread = mockCodex.startThread();

      // Mock run response for multiple calls
      vi.mocked(mockThread.run).mockResolvedValue({
        finalResponse: 'Done',
        items: [],
        usage: null,
      });

      const startInput: CodexStartInput = {
        workspaceId: '123e4567-e89b-12d3-a456-426614174000',
        workingDirectory: '/path/to/project',
        model: 'gpt-5.2-codex',
      };
      const session = await handler.startSession(startInput);
      const originalThreadId = session.threadId;

      // Send multiple messages
      await handler.sendMessage({
        sessionId: session.id,
        message: 'First message',
        stream: false,
      });

      await handler.sendMessage({
        sessionId: session.id,
        message: 'Second message',
        stream: false,
      });

      // Thread ID should remain the same
      const afterMessages = await handler.getSession({ sessionId: session.id });
      expect(afterMessages.threadId).toBe(originalThreadId);
    });
  });
});
