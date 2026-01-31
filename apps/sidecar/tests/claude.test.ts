import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { EventEmitter } from 'node:events';
import * as path from 'node:path';
import * as os from 'node:os';
import * as fs from 'node:fs';
import type { ChildProcess } from 'node:child_process';

// Mock child_process before importing the module
vi.mock('node:child_process', () => ({
  spawn: vi.fn(),
}));

// Import after mocking
import { spawn } from 'node:child_process';
import {
  ClaudeHandler,
  type ClaudeSessionOptions,
  type ClaudeStreamEvent,
  ClaudeStartParamsSchema,
  ClaudeResumeParamsSchema,
  ClaudeCancelParamsSchema,
} from '../src/agents/claude.js';

/**
 * Create a mock ChildProcess for testing
 */
function createMockProcess(): ChildProcess & {
  stdout: EventEmitter;
  stderr: EventEmitter;
  stdin: { write: ReturnType<typeof vi.fn>; end: ReturnType<typeof vi.fn> };
} {
  const mockProcess = new EventEmitter() as ChildProcess & {
    stdout: EventEmitter;
    stderr: EventEmitter;
    stdin: { write: ReturnType<typeof vi.fn>; end: ReturnType<typeof vi.fn> };
    pid: number;
    killed: boolean;
    kill: ReturnType<typeof vi.fn>;
  };
  mockProcess.stdout = new EventEmitter();
  mockProcess.stderr = new EventEmitter();
  mockProcess.stdin = {
    write: vi.fn(),
    end: vi.fn(),
  };
  mockProcess.pid = 12345;
  mockProcess.killed = false;
  mockProcess.kill = vi.fn(() => {
    mockProcess.killed = true;
    mockProcess.emit('close', 0, null);
    return true;
  });
  return mockProcess;
}

describe('ClaudeHandler', () => {
  let handler: ClaudeHandler;
  let mockProcess: ReturnType<typeof createMockProcess>;

  beforeEach(() => {
    vi.clearAllMocks();
    handler = new ClaudeHandler();
    mockProcess = createMockProcess();
    vi.mocked(spawn).mockReturnValue(mockProcess as unknown as ChildProcess);
  });

  afterEach(async () => {
    // Clean up any active sessions
    await handler.dispose();
  });

  describe('Schema validation', () => {
    it('should validate start params with workspaceId and prompt', () => {
      const validParams = {
        workspaceId: '123e4567-e89b-12d3-a456-426614174000',
        prompt: 'Hello, Claude!',
      };
      const result = ClaudeStartParamsSchema.safeParse(validParams);
      expect(result.success).toBe(true);
    });

    it('should validate start params with all options', () => {
      const validParams = {
        workspaceId: '123e4567-e89b-12d3-a456-426614174000',
        prompt: 'Hello, Claude!',
        options: {
          model: 'claude-sonnet-4-20250514',
          maxTokens: 4096,
          allowedTools: ['Read', 'Write', 'Bash'],
          systemPrompt: 'You are a helpful assistant',
          workingDirectory: '/path/to/project',
          dangerouslySkipPermissions: false,
        },
      };
      const result = ClaudeStartParamsSchema.safeParse(validParams);
      expect(result.success).toBe(true);
    });

    it('should reject start params without workspaceId', () => {
      const invalidParams = {
        prompt: 'Hello, Claude!',
      };
      const result = ClaudeStartParamsSchema.safeParse(invalidParams);
      expect(result.success).toBe(false);
    });

    it('should reject start params without prompt', () => {
      const invalidParams = {
        workspaceId: '123e4567-e89b-12d3-a456-426614174000',
      };
      const result = ClaudeStartParamsSchema.safeParse(invalidParams);
      expect(result.success).toBe(false);
    });

    it('should validate resume params with sessionId', () => {
      const validParams = {
        sessionId: '123e4567-e89b-12d3-a456-426614174000',
      };
      const result = ClaudeResumeParamsSchema.safeParse(validParams);
      expect(result.success).toBe(true);
    });

    it('should validate resume params with optional prompt', () => {
      const validParams = {
        sessionId: '123e4567-e89b-12d3-a456-426614174000',
        prompt: 'Continue with the task',
      };
      const result = ClaudeResumeParamsSchema.safeParse(validParams);
      expect(result.success).toBe(true);
    });

    it('should validate cancel params with sessionId', () => {
      const validParams = {
        sessionId: '123e4567-e89b-12d3-a456-426614174000',
      };
      const result = ClaudeCancelParamsSchema.safeParse(validParams);
      expect(result.success).toBe(true);
    });
  });

  describe('start()', () => {
    it('should start a new Claude session', async () => {
      const result = await handler.start({
        workspaceId: '123e4567-e89b-12d3-a456-426614174000',
        prompt: 'Hello, Claude!',
      });

      expect(result).toHaveProperty('sessionId');
      expect(result).toHaveProperty('status', 'running');
      expect(spawn).toHaveBeenCalled();
    });

    it('should pass working directory to Claude CLI', async () => {
      await handler.start({
        workspaceId: '123e4567-e89b-12d3-a456-426614174000',
        prompt: 'Hello!',
        options: {
          workingDirectory: '/my/project',
        },
      });

      expect(spawn).toHaveBeenCalledWith(
        expect.any(String),
        expect.arrayContaining(['--cwd', '/my/project']),
        expect.any(Object)
      );
    });

    it('should pass model option to Claude CLI', async () => {
      await handler.start({
        workspaceId: '123e4567-e89b-12d3-a456-426614174000',
        prompt: 'Hello!',
        options: {
          model: 'claude-sonnet-4-20250514',
        },
      });

      expect(spawn).toHaveBeenCalledWith(
        expect.any(String),
        expect.arrayContaining(['--model', 'claude-sonnet-4-20250514']),
        expect.any(Object)
      );
    });

    it('should pass allowed tools to Claude CLI', async () => {
      await handler.start({
        workspaceId: '123e4567-e89b-12d3-a456-426614174000',
        prompt: 'Hello!',
        options: {
          allowedTools: ['Read', 'Write'],
        },
      });

      expect(spawn).toHaveBeenCalledWith(
        expect.any(String),
        expect.arrayContaining(['--allowedTools', 'Read,Write']),
        expect.any(Object)
      );
    });

    it('should use bidirectional stream-json mode', async () => {
      await handler.start({
        workspaceId: '123e4567-e89b-12d3-a456-426614174000',
        prompt: 'Hello!',
      });

      expect(spawn).toHaveBeenCalledWith(
        expect.any(String),
        expect.arrayContaining([
          '--output-format', 'stream-json',
          '--input-format', 'stream-json',
        ]),
        expect.any(Object)
      );
    });

    it('should emit events from Claude stream', async () => {
      const events: ClaudeStreamEvent[] = [];
      handler.on('message', (event) => events.push(event));

      await handler.start({
        workspaceId: '123e4567-e89b-12d3-a456-426614174000',
        prompt: 'Hello!',
      });

      // Simulate Claude outputting a message event
      const messageEvent = {
        type: 'assistant',
        message: {
          type: 'text',
          text: 'Hello! How can I help?',
        },
      };
      mockProcess.stdout.emit('data', JSON.stringify(messageEvent) + '\n');

      // Allow async event processing
      await new Promise((resolve) => setTimeout(resolve, 10));

      expect(events.length).toBeGreaterThan(0);
      expect(events[0]).toEqual(messageEvent);
    });

    it('should track context token usage', async () => {
      const contextEvents: Array<{ inputTokens: number; outputTokens: number }> = [];
      handler.on('context_used', (event) => contextEvents.push(event));

      await handler.start({
        workspaceId: '123e4567-e89b-12d3-a456-426614174000',
        prompt: 'Hello!',
      });

      // Simulate Claude outputting a result event with token usage
      const resultEvent = {
        type: 'result',
        result: 'completed',
        cost_usd: 0.05,
        duration_ms: 5000,
        duration_api_ms: 4500,
        num_turns: 3,
        session_id: 'abc123',
        total_cost_usd: 0.05,
        usage: {
          input_tokens: 1500,
          output_tokens: 500,
          cache_creation_input_tokens: 0,
          cache_read_input_tokens: 200,
        },
      };
      mockProcess.stdout.emit('data', JSON.stringify(resultEvent) + '\n');

      await new Promise((resolve) => setTimeout(resolve, 10));

      expect(contextEvents.length).toBe(1);
      expect(contextEvents[0].inputTokens).toBe(1500);
      expect(contextEvents[0].outputTokens).toBe(500);
    });
  });

  describe('resume()', () => {
    it('should resume an existing session', async () => {
      // First start a session
      const startResult = await handler.start({
        workspaceId: '123e4567-e89b-12d3-a456-426614174000',
        prompt: 'Hello!',
      });

      // Simulate session completion
      mockProcess.emit('close', 0, null);
      await new Promise((resolve) => setTimeout(resolve, 10));

      // Create new mock for resume
      const resumeMockProcess = createMockProcess();
      vi.mocked(spawn).mockReturnValue(resumeMockProcess as unknown as ChildProcess);

      // Resume the session
      const resumeResult = await handler.resume({
        sessionId: startResult.sessionId,
        prompt: 'Continue please',
      });

      expect(resumeResult).toHaveProperty('sessionId', startResult.sessionId);
      expect(resumeResult).toHaveProperty('status', 'running');

      // Should pass --resume flag with session ID
      expect(spawn).toHaveBeenCalledWith(
        expect.any(String),
        expect.arrayContaining(['--resume', startResult.sessionId]),
        expect.any(Object)
      );
    });

    it('should throw error for unknown session', async () => {
      await expect(
        handler.resume({
          sessionId: 'unknown-session-id',
        })
      ).rejects.toThrow('Session not found');
    });
  });

  describe('cancel()', () => {
    it('should cancel a running session', async () => {
      // Start a session
      const startResult = await handler.start({
        workspaceId: '123e4567-e89b-12d3-a456-426614174000',
        prompt: 'Hello!',
      });

      // Cancel the session
      const cancelResult = await handler.cancel({
        sessionId: startResult.sessionId,
      });

      expect(cancelResult).toHaveProperty('success', true);
      expect(mockProcess.kill).toHaveBeenCalledWith('SIGTERM');
    });

    it('should throw error when canceling unknown session', async () => {
      await expect(
        handler.cancel({
          sessionId: 'unknown-session-id',
        })
      ).rejects.toThrow('Session not found');
    });

    it('should emit session_ended event on cancel', async () => {
      const endedEvents: Array<{ sessionId: string; reason: string }> = [];
      handler.on('session_ended', (event) => endedEvents.push(event));

      const startResult = await handler.start({
        workspaceId: '123e4567-e89b-12d3-a456-426614174000',
        prompt: 'Hello!',
      });

      await handler.cancel({ sessionId: startResult.sessionId });

      // Wait for event emission
      await new Promise((resolve) => setTimeout(resolve, 10));

      expect(endedEvents.length).toBe(1);
      expect(endedEvents[0].sessionId).toBe(startResult.sessionId);
      expect(endedEvents[0].reason).toBe('cancelled');
    });
  });

  describe('getSession()', () => {
    it('should return session info for active session', async () => {
      const startResult = await handler.start({
        workspaceId: '123e4567-e89b-12d3-a456-426614174000',
        prompt: 'Hello!',
      });

      const session = handler.getSession(startResult.sessionId);

      expect(session).not.toBeNull();
      expect(session?.id).toBe(startResult.sessionId);
      expect(session?.workspaceId).toBe('123e4567-e89b-12d3-a456-426614174000');
      expect(session?.status).toBe('running');
    });

    it('should return null for unknown session', () => {
      const session = handler.getSession('unknown-session-id');
      expect(session).toBeNull();
    });

    it('should track token counts', async () => {
      const startResult = await handler.start({
        workspaceId: '123e4567-e89b-12d3-a456-426614174000',
        prompt: 'Hello!',
      });

      // Simulate token usage event
      const resultEvent = {
        type: 'result',
        result: 'completed',
        usage: {
          input_tokens: 1500,
          output_tokens: 500,
          cache_creation_input_tokens: 100,
          cache_read_input_tokens: 200,
        },
      };
      mockProcess.stdout.emit('data', JSON.stringify(resultEvent) + '\n');
      await new Promise((resolve) => setTimeout(resolve, 10));

      const session = handler.getSession(startResult.sessionId);
      expect(session?.contextTokenCount).toBe(2000); // input + output
    });
  });

  describe('Claude settings integration', () => {
    it('should read user Claude settings', async () => {
      // ClaudeHandler should have a method to get Claude settings
      const settings = await handler.getClaudeSettings();

      // Should return settings object (or null if file doesn't exist)
      expect(settings === null || typeof settings === 'object').toBe(true);
    });

    it('should handle missing settings file gracefully', async () => {
      // Mock fs.readFile to simulate missing file
      const originalEnv = process.env.CLAUDE_HOME;
      process.env.CLAUDE_HOME = '/nonexistent/path';

      const settings = await handler.getClaudeSettings();
      expect(settings).toBeNull();

      process.env.CLAUDE_HOME = originalEnv;
    });
  });

  describe('Stream parsing', () => {
    it('should parse multiple JSON objects in a single chunk', async () => {
      const events: ClaudeStreamEvent[] = [];
      handler.on('message', (event) => events.push(event));

      await handler.start({
        workspaceId: '123e4567-e89b-12d3-a456-426614174000',
        prompt: 'Hello!',
      });

      // Send multiple events in one chunk
      const chunk =
        '{"type":"assistant","message":{"type":"text","text":"Hello"}}\n' +
        '{"type":"assistant","message":{"type":"text","text":"World"}}\n';

      mockProcess.stdout.emit('data', chunk);
      await new Promise((resolve) => setTimeout(resolve, 10));

      expect(events.length).toBe(2);
    });

    it('should handle partial JSON across chunks', async () => {
      const events: ClaudeStreamEvent[] = [];
      handler.on('message', (event) => events.push(event));

      await handler.start({
        workspaceId: '123e4567-e89b-12d3-a456-426614174000',
        prompt: 'Hello!',
      });

      // Send partial JSON
      mockProcess.stdout.emit('data', '{"type":"assistant","messa');
      mockProcess.stdout.emit('data', 'ge":{"type":"text","text":"Hello"}}\n');

      await new Promise((resolve) => setTimeout(resolve, 10));

      expect(events.length).toBe(1);
      expect(events[0]).toEqual({
        type: 'assistant',
        message: { type: 'text', text: 'Hello' },
      });
    });

    it('should handle tool use events', async () => {
      const toolEvents: ClaudeStreamEvent[] = [];
      handler.on('tool_use', (event) => toolEvents.push(event));

      await handler.start({
        workspaceId: '123e4567-e89b-12d3-a456-426614174000',
        prompt: 'Hello!',
      });

      const toolEvent = {
        type: 'tool_use',
        tool: 'Read',
        input: { file_path: '/path/to/file.ts' },
      };
      mockProcess.stdout.emit('data', JSON.stringify(toolEvent) + '\n');

      await new Promise((resolve) => setTimeout(resolve, 10));

      expect(toolEvents.length).toBe(1);
      expect(toolEvents[0]).toEqual(toolEvent);
    });

    it('should handle tool result events', async () => {
      const resultEvents: ClaudeStreamEvent[] = [];
      handler.on('tool_result', (event) => resultEvents.push(event));

      await handler.start({
        workspaceId: '123e4567-e89b-12d3-a456-426614174000',
        prompt: 'Hello!',
      });

      const toolResultEvent = {
        type: 'tool_result',
        tool: 'Read',
        output: 'file contents here...',
      };
      mockProcess.stdout.emit('data', JSON.stringify(toolResultEvent) + '\n');

      await new Promise((resolve) => setTimeout(resolve, 10));

      expect(resultEvents.length).toBe(1);
    });

    it('should log stderr output without emitting error events', async () => {
      // stderr is logged but not emitted as error since it often contains debug info
      const consoleSpy = vi.spyOn(console, 'log');

      await handler.start({
        workspaceId: '123e4567-e89b-12d3-a456-426614174000',
        prompt: 'Hello!',
      });

      mockProcess.stderr.emit('data', 'Error: Something went wrong\n');

      await new Promise((resolve) => setTimeout(resolve, 10));

      // Verify stderr was logged
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('stderr')
      );
      consoleSpy.mockRestore();
    });
  });

  describe('Session lifecycle', () => {
    it('should update status to completed when process exits with code 0', async () => {
      const startResult = await handler.start({
        workspaceId: '123e4567-e89b-12d3-a456-426614174000',
        prompt: 'Hello!',
      });

      mockProcess.emit('close', 0, null);
      await new Promise((resolve) => setTimeout(resolve, 10));

      const session = handler.getSession(startResult.sessionId);
      expect(session?.status).toBe('completed');
    });

    it('should update status to error when process exits with non-zero code', async () => {
      const startResult = await handler.start({
        workspaceId: '123e4567-e89b-12d3-a456-426614174000',
        prompt: 'Hello!',
      });

      mockProcess.emit('close', 1, null);
      await new Promise((resolve) => setTimeout(resolve, 10));

      const session = handler.getSession(startResult.sessionId);
      expect(session?.status).toBe('error');
    });

    it('should emit session_ended event when process exits', async () => {
      const endedEvents: Array<{ sessionId: string; reason: string }> = [];
      handler.on('session_ended', (event) => endedEvents.push(event));

      const startResult = await handler.start({
        workspaceId: '123e4567-e89b-12d3-a456-426614174000',
        prompt: 'Hello!',
      });

      mockProcess.emit('close', 0, null);
      await new Promise((resolve) => setTimeout(resolve, 10));

      expect(endedEvents.length).toBe(1);
      expect(endedEvents[0].sessionId).toBe(startResult.sessionId);
      expect(endedEvents[0].reason).toBe('completed');
    });
  });

  describe('dispose()', () => {
    it('should cancel all active sessions on dispose', async () => {
      // Start multiple sessions
      const mockProcess1 = createMockProcess();
      const mockProcess2 = createMockProcess();

      vi.mocked(spawn)
        .mockReturnValueOnce(mockProcess1 as unknown as ChildProcess)
        .mockReturnValueOnce(mockProcess2 as unknown as ChildProcess);

      await handler.start({
        workspaceId: '123e4567-e89b-12d3-a456-426614174000',
        prompt: 'Session 1',
      });

      await handler.start({
        workspaceId: '123e4567-e89b-12d3-a456-426614174001',
        prompt: 'Session 2',
      });

      await handler.dispose();

      expect(mockProcess1.kill).toHaveBeenCalled();
      expect(mockProcess2.kill).toHaveBeenCalled();
    });
  });
});
