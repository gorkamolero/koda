import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import type { ChildProcess } from 'node:child_process';
import { EventEmitter } from 'node:events';

// Mock child_process before importing the module under test
vi.mock('node:child_process', () => ({
  spawn: vi.fn(),
}));

// Import after mocking
import { spawn } from 'node:child_process';
import {
  createKimiSession,
  sendKimiMessage,
  getKimiSession,
  stopKimiSession,
  isKimiInstalled,
  KimiSessionStatus,
  type CreateKimiSessionInput,
  type SendKimiMessageInput,
  CreateKimiSessionSchema,
  SendKimiMessageSchema,
} from '../../src/agents/kimi.js';

/**
 * Helper to create a mock child process with EventEmitter capabilities
 */
function createMockProcess(): ChildProcess {
  const mockProcess = new EventEmitter() as ChildProcess;
  (mockProcess as ChildProcess & { stdout: EventEmitter }).stdout = new EventEmitter();
  (mockProcess as ChildProcess & { stderr: EventEmitter }).stderr = new EventEmitter();
  mockProcess.pid = 12345;
  mockProcess.kill = vi.fn().mockReturnValue(true);
  return mockProcess;
}

describe('Kimi Agent Handler', () => {
  const mockSpawn = vi.mocked(spawn);

  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('isKimiInstalled', () => {
    it('should return true when kimi binary is found', async () => {
      const mockProcess = createMockProcess();
      mockSpawn.mockReturnValue(mockProcess);

      const resultPromise = isKimiInstalled();

      // Simulate successful version check
      process.nextTick(() => {
        (mockProcess.stdout as EventEmitter).emit('data', 'kimi-cli 1.0.0\n');
        mockProcess.emit('close', 0);
      });

      const result = await resultPromise;
      expect(result).toBe(true);
      expect(mockSpawn).toHaveBeenCalledWith('kimi', ['--version'], expect.any(Object));
    });

    it('should return false when kimi binary is not found', async () => {
      const mockProcess = createMockProcess();
      mockSpawn.mockReturnValue(mockProcess);

      const resultPromise = isKimiInstalled();

      // Simulate spawn error (binary not found)
      process.nextTick(() => {
        mockProcess.emit('error', new Error('spawn kimi ENOENT'));
      });

      const result = await resultPromise;
      expect(result).toBe(false);
    });
  });

  describe('CreateKimiSessionSchema', () => {
    it('should validate valid input with all fields', () => {
      const input: CreateKimiSessionInput = {
        workspaceId: '123e4567-e89b-12d3-a456-426614174000',
        workDir: '/path/to/project',
        sessionId: 'my-session',
        model: 'moonshot-v1-8k',
      };

      const result = CreateKimiSessionSchema.safeParse(input);
      expect(result.success).toBe(true);
    });

    it('should validate input with only required fields', () => {
      const input = {
        workspaceId: '123e4567-e89b-12d3-a456-426614174000',
        workDir: '/path/to/project',
      };

      const result = CreateKimiSessionSchema.safeParse(input);
      expect(result.success).toBe(true);
    });

    it('should reject invalid workspaceId', () => {
      const input = {
        workspaceId: 'not-a-uuid',
        workDir: '/path/to/project',
      };

      const result = CreateKimiSessionSchema.safeParse(input);
      expect(result.success).toBe(false);
    });

    it('should reject empty workDir', () => {
      const input = {
        workspaceId: '123e4567-e89b-12d3-a456-426614174000',
        workDir: '',
      };

      const result = CreateKimiSessionSchema.safeParse(input);
      expect(result.success).toBe(false);
    });
  });

  describe('SendKimiMessageSchema', () => {
    it('should validate valid message input', () => {
      const input: SendKimiMessageInput = {
        sessionId: '123e4567-e89b-12d3-a456-426614174000',
        message: 'Hello, Kimi!',
      };

      const result = SendKimiMessageSchema.safeParse(input);
      expect(result.success).toBe(true);
    });

    it('should reject empty message', () => {
      const input = {
        sessionId: '123e4567-e89b-12d3-a456-426614174000',
        message: '',
      };

      const result = SendKimiMessageSchema.safeParse(input);
      expect(result.success).toBe(false);
    });

    it('should validate message with streaming option', () => {
      const input = {
        sessionId: '123e4567-e89b-12d3-a456-426614174000',
        message: 'Build a todo app',
        streaming: true,
      };

      const result = SendKimiMessageSchema.safeParse(input);
      expect(result.success).toBe(true);
    });
  });

  describe('createKimiSession', () => {
    it('should spawn kimi process with correct arguments', async () => {
      const mockProcess = createMockProcess();
      mockSpawn.mockReturnValue(mockProcess);

      const input: CreateKimiSessionInput = {
        workspaceId: '123e4567-e89b-12d3-a456-426614174000',
        workDir: '/path/to/project',
        sessionId: 'test-session',
      };

      const sessionPromise = createKimiSession(input);

      // Simulate successful startup
      process.nextTick(() => {
        (mockProcess.stdout as EventEmitter).emit('data', '{"type":"ready"}\n');
      });

      const session = await sessionPromise;

      expect(session).toHaveProperty('id');
      expect(session).toHaveProperty('workspaceId', input.workspaceId);
      expect(session).toHaveProperty('agentType', 'kimi');
      expect(session).toHaveProperty('status', KimiSessionStatus.RUNNING);

      expect(mockSpawn).toHaveBeenCalledWith(
        'kimi',
        expect.arrayContaining([
          '--print',
          '--output-format', 'stream-json',
          '--session', 'test-session',
          '--work-dir', '/path/to/project',
        ]),
        expect.objectContaining({
          cwd: '/path/to/project',
        })
      );
    });

    it('should include model flag when specified', async () => {
      const mockProcess = createMockProcess();
      mockSpawn.mockReturnValue(mockProcess);

      const input: CreateKimiSessionInput = {
        workspaceId: '123e4567-e89b-12d3-a456-426614174000',
        workDir: '/path/to/project',
        model: 'moonshot-v1-128k',
      };

      const sessionPromise = createKimiSession(input);

      process.nextTick(() => {
        (mockProcess.stdout as EventEmitter).emit('data', '{"type":"ready"}\n');
      });

      await sessionPromise;

      expect(mockSpawn).toHaveBeenCalledWith(
        'kimi',
        expect.arrayContaining(['--model', 'moonshot-v1-128k']),
        expect.any(Object)
      );
    });

    it('should throw error if kimi is not installed', async () => {
      const mockProcess = createMockProcess();
      mockSpawn.mockReturnValue(mockProcess);

      const input: CreateKimiSessionInput = {
        workspaceId: '123e4567-e89b-12d3-a456-426614174000',
        workDir: '/path/to/project',
      };

      const sessionPromise = createKimiSession(input);

      process.nextTick(() => {
        mockProcess.emit('error', new Error('spawn kimi ENOENT'));
      });

      await expect(sessionPromise).rejects.toThrow(/kimi.*not.*installed|ENOENT/i);
    });

    it('should enable auto-approval with yolo flag', async () => {
      const mockProcess = createMockProcess();
      mockSpawn.mockReturnValue(mockProcess);

      const input: CreateKimiSessionInput = {
        workspaceId: '123e4567-e89b-12d3-a456-426614174000',
        workDir: '/path/to/project',
        autoApprove: true,
      };

      const sessionPromise = createKimiSession(input);

      process.nextTick(() => {
        (mockProcess.stdout as EventEmitter).emit('data', '{"type":"ready"}\n');
      });

      await sessionPromise;

      expect(mockSpawn).toHaveBeenCalledWith(
        'kimi',
        expect.arrayContaining(['--yolo']),
        expect.any(Object)
      );
    });
  });

  describe('sendKimiMessage', () => {
    it('should send message to existing session', async () => {
      // First create a session
      const mockProcess = createMockProcess();
      mockSpawn.mockReturnValue(mockProcess);

      const createInput: CreateKimiSessionInput = {
        workspaceId: '123e4567-e89b-12d3-a456-426614174000',
        workDir: '/path/to/project',
      };

      const createPromise = createKimiSession(createInput);

      process.nextTick(() => {
        (mockProcess.stdout as EventEmitter).emit('data', '{"type":"ready"}\n');
      });

      const session = await createPromise;

      // Now send a message
      const messageInput: SendKimiMessageInput = {
        sessionId: session.id,
        message: 'Create a hello world function',
      };

      const messagePromise = sendKimiMessage(messageInput);

      // Simulate response chunks
      process.nextTick(() => {
        (mockProcess.stdout as EventEmitter).emit(
          'data',
          '{"type":"content","text":"Here is a hello world"}\n'
        );
        (mockProcess.stdout as EventEmitter).emit(
          'data',
          '{"type":"done","text":"function..."}\n'
        );
      });

      const response = await messagePromise;

      expect(response).toHaveProperty('content');
      expect(response).toHaveProperty('sessionId', session.id);
    });

    it('should throw error for non-existent session', async () => {
      const messageInput: SendKimiMessageInput = {
        sessionId: 'non-existent-session-id',
        message: 'Hello',
      };

      await expect(sendKimiMessage(messageInput)).rejects.toThrow(/session.*not.*found/i);
    });
  });

  describe('getKimiSession', () => {
    it('should return session status for existing session', async () => {
      const mockProcess = createMockProcess();
      mockSpawn.mockReturnValue(mockProcess);

      const createInput: CreateKimiSessionInput = {
        workspaceId: '123e4567-e89b-12d3-a456-426614174000',
        workDir: '/path/to/project',
      };

      const createPromise = createKimiSession(createInput);

      process.nextTick(() => {
        (mockProcess.stdout as EventEmitter).emit('data', '{"type":"ready"}\n');
      });

      const session = await createPromise;

      const status = await getKimiSession({ sessionId: session.id });

      expect(status).toHaveProperty('id', session.id);
      expect(status).toHaveProperty('status');
      expect(status).toHaveProperty('agentType', 'kimi');
    });

    it('should return null for non-existent session', async () => {
      const status = await getKimiSession({ sessionId: 'non-existent-id' });
      expect(status).toBeNull();
    });
  });

  describe('stopKimiSession', () => {
    it('should terminate the kimi process gracefully', async () => {
      const mockProcess = createMockProcess();
      mockSpawn.mockReturnValue(mockProcess);

      const createInput: CreateKimiSessionInput = {
        workspaceId: '123e4567-e89b-12d3-a456-426614174000',
        workDir: '/path/to/project',
      };

      const createPromise = createKimiSession(createInput);

      process.nextTick(() => {
        (mockProcess.stdout as EventEmitter).emit('data', '{"type":"ready"}\n');
      });

      const session = await createPromise;

      const stopPromise = stopKimiSession({ sessionId: session.id });

      // Simulate process exit after SIGTERM
      process.nextTick(() => {
        mockProcess.emit('close', 0);
      });

      const result = await stopPromise;

      expect(result).toHaveProperty('success', true);
      expect(mockProcess.kill).toHaveBeenCalledWith('SIGTERM');
    });

    it('should return false for non-existent session', async () => {
      const result = await stopKimiSession({ sessionId: 'non-existent-id' });
      expect(result).toHaveProperty('success', false);
    });
  });

  describe('Streaming messages', () => {
    it('should parse JSONL stream-json output correctly', async () => {
      const mockProcess = createMockProcess();
      mockSpawn.mockReturnValue(mockProcess);

      const createInput: CreateKimiSessionInput = {
        workspaceId: '123e4567-e89b-12d3-a456-426614174000',
        workDir: '/path/to/project',
      };

      const createPromise = createKimiSession(createInput);

      process.nextTick(() => {
        (mockProcess.stdout as EventEmitter).emit('data', '{"type":"ready"}\n');
      });

      const session = await createPromise;

      const messageInput: SendKimiMessageInput = {
        sessionId: session.id,
        message: 'Write a test',
        streaming: true,
      };

      const chunks: string[] = [];
      const messagePromise = sendKimiMessage(messageInput, (chunk) => {
        chunks.push(chunk);
      });

      // Simulate streaming JSONL output
      process.nextTick(() => {
        (mockProcess.stdout as EventEmitter).emit(
          'data',
          '{"type":"content","text":"First chunk"}\n'
        );
        (mockProcess.stdout as EventEmitter).emit(
          'data',
          '{"type":"content","text":"Second chunk"}\n'
        );
        (mockProcess.stdout as EventEmitter).emit(
          'data',
          '{"type":"done"}\n'
        );
      });

      await messagePromise;

      expect(chunks).toHaveLength(2);
      expect(chunks[0]).toBe('First chunk');
      expect(chunks[1]).toBe('Second chunk');
    });

    it('should handle partial JSONL lines correctly', async () => {
      const mockProcess = createMockProcess();
      mockSpawn.mockReturnValue(mockProcess);

      const createInput: CreateKimiSessionInput = {
        workspaceId: '123e4567-e89b-12d3-a456-426614174000',
        workDir: '/path/to/project',
      };

      const createPromise = createKimiSession(createInput);

      process.nextTick(() => {
        (mockProcess.stdout as EventEmitter).emit('data', '{"type":"ready"}\n');
      });

      const session = await createPromise;

      const chunks: string[] = [];
      const messagePromise = sendKimiMessage(
        { sessionId: session.id, message: 'Test', streaming: true },
        (chunk) => chunks.push(chunk)
      );

      // Simulate partial data chunks (split across TCP packets)
      process.nextTick(() => {
        (mockProcess.stdout as EventEmitter).emit('data', '{"type":"content","te');
        (mockProcess.stdout as EventEmitter).emit('data', 'xt":"Complete"}\n');
        (mockProcess.stdout as EventEmitter).emit('data', '{"type":"done"}\n');
      });

      await messagePromise;

      expect(chunks).toHaveLength(1);
      expect(chunks[0]).toBe('Complete');
    });
  });

  describe('Error handling', () => {
    it('should handle stderr output as errors', async () => {
      const mockProcess = createMockProcess();
      mockSpawn.mockReturnValue(mockProcess);

      const createInput: CreateKimiSessionInput = {
        workspaceId: '123e4567-e89b-12d3-a456-426614174000',
        workDir: '/path/to/project',
      };

      const createPromise = createKimiSession(createInput);

      // Simulate error output
      process.nextTick(() => {
        (mockProcess.stderr as EventEmitter).emit('data', 'Error: API key not found\n');
        mockProcess.emit('close', 1);
      });

      await expect(createPromise).rejects.toThrow(/API key/i);
    });

    it('should handle process crash', async () => {
      const mockProcess = createMockProcess();
      mockSpawn.mockReturnValue(mockProcess);

      const createInput: CreateKimiSessionInput = {
        workspaceId: '123e4567-e89b-12d3-a456-426614174000',
        workDir: '/path/to/project',
      };

      const createPromise = createKimiSession(createInput);

      process.nextTick(() => {
        (mockProcess.stdout as EventEmitter).emit('data', '{"type":"ready"}\n');
      });

      const session = await createPromise;

      // Now simulate crash during message
      const messagePromise = sendKimiMessage({
        sessionId: session.id,
        message: 'Crash test',
      });

      process.nextTick(() => {
        mockProcess.emit('close', 1, 'SIGKILL');
      });

      await expect(messagePromise).rejects.toThrow(/process.*exit|crash/i);
    });
  });
});
