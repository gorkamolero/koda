/**
 * OpenProse VM Integration Tests
 *
 * Tests for the basic OpenProse parser and VM executor.
 * Following TDD - these tests are written FIRST.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  ProseParser,
  ProseVM,
  type ProseProgram,
  type AgentDefinition,
  type SessionStatement,
  type ResumeStatement,
  type LetBinding,
  type ParallelBlock,
  type OutputStatement,
} from '../src/openprose/index.js';

// ============================================================================
// Parser Tests
// ============================================================================

describe('ProseParser', () => {
  let parser: ProseParser;

  beforeEach(() => {
    parser = new ProseParser();
  });

  describe('parseAgents', () => {
    it('should parse a basic agent definition', () => {
      const input = `
agent captain:
  model: opus
  prompt: """
    You are the build captain.
  """
      `;

      const program = parser.parse(input);

      expect(program.agents).toHaveLength(1);
      expect(program.agents[0]).toEqual({
        name: 'captain',
        model: 'opus',
        persist: false,
        prompt: 'You are the build captain.',
      });
    });

    it('should parse agent with persist flag', () => {
      const input = `
agent captain:
  model: opus
  persist: true
  prompt: """
    You are the captain.
  """
      `;

      const program = parser.parse(input);

      expect(program.agents[0].persist).toBe(true);
    });

    it('should parse multiple agents', () => {
      const input = `
agent captain:
  model: opus
  prompt: """Captain prompt"""

agent builder:
  model: sonnet
  prompt: """Builder prompt"""
      `;

      const program = parser.parse(input);

      expect(program.agents).toHaveLength(2);
      expect(program.agents[0].name).toBe('captain');
      expect(program.agents[1].name).toBe('builder');
    });
  });

  describe('parseStatements', () => {
    it('should parse a session statement', () => {
      const input = `
agent captain:
  model: opus
  prompt: """test"""

session: captain
  prompt: """
    Do something.
  """
      `;

      const program = parser.parse(input);

      expect(program.statements).toHaveLength(1);
      expect(program.statements[0].type).toBe('session');

      const session = program.statements[0] as SessionStatement;
      expect(session.agent).toBe('captain');
      expect(session.prompt).toBe('Do something.');
    });

    it('should parse a resume statement', () => {
      const input = `
agent captain:
  model: opus
  prompt: """test"""

resume: captain
  prompt: """Continue the work."""
      `;

      const program = parser.parse(input);

      expect(program.statements).toHaveLength(1);
      expect(program.statements[0].type).toBe('resume');

      const resume = program.statements[0] as ResumeStatement;
      expect(resume.agent).toBe('captain');
      expect(resume.prompt).toBe('Continue the work.');
    });

    it('should parse a let binding', () => {
      const input = `
agent captain:
  model: opus
  prompt: """test"""

let result = session: captain
  prompt: """Do work."""
      `;

      const program = parser.parse(input);

      expect(program.statements).toHaveLength(1);
      expect(program.statements[0].type).toBe('let');

      const letBinding = program.statements[0] as LetBinding;
      expect(letBinding.name).toBe('result');
      expect(letBinding.value.type).toBe('session');
    });

    it('should parse a let binding with resume', () => {
      const input = `
agent captain:
  model: opus
  prompt: """test"""

let phase1_plan = resume: captain
  prompt: """Confirm the plan."""
      `;

      const program = parser.parse(input);

      const letBinding = program.statements[0] as LetBinding;
      expect(letBinding.name).toBe('phase1_plan');
      expect(letBinding.value.type).toBe('resume');
    });
  });

  describe('parseParallelBlocks', () => {
    it('should parse a parallel block', () => {
      const input = `
agent builder:
  model: sonnet
  prompt: """test"""

parallel:
  task1 = session: builder
    prompt: """Task 1"""

  task2 = session: builder
    prompt: """Task 2"""
      `;

      const program = parser.parse(input);

      expect(program.statements).toHaveLength(1);
      expect(program.statements[0].type).toBe('parallel');

      const parallel = program.statements[0] as ParallelBlock;
      expect(parallel.bindings).toHaveLength(2);
      expect(parallel.bindings[0].name).toBe('task1');
      expect(parallel.bindings[1].name).toBe('task2');
    });
  });

  describe('parseContextReferences', () => {
    it('should parse context reference in session', () => {
      const input = `
agent builder:
  model: sonnet
  prompt: """test"""

let plan = session: builder
  prompt: """Make a plan."""

session: builder
  prompt: """Execute the plan."""
  context: plan
      `;

      const program = parser.parse(input);

      expect(program.statements).toHaveLength(2);
      const session = program.statements[1] as SessionStatement;
      expect(session.context).toEqual(['plan']);
    });

    it('should parse array context references', () => {
      const input = `
agent builder:
  model: sonnet
  prompt: """test"""

session: builder
  prompt: """Do work."""
  context: [task1, task2, task3]
      `;

      const program = parser.parse(input);

      const session = program.statements[0] as SessionStatement;
      expect(session.context).toEqual(['task1', 'task2', 'task3']);
    });
  });

  describe('parseOutputStatement', () => {
    it('should parse an output statement', () => {
      const input = `
agent captain:
  model: opus
  prompt: """test"""

output build_result = resume: captain
  prompt: """Final verification."""
      `;

      const program = parser.parse(input);

      expect(program.statements).toHaveLength(1);
      expect(program.statements[0].type).toBe('output');

      const output = program.statements[0] as OutputStatement;
      expect(output.name).toBe('build_result');
      expect(output.value.type).toBe('resume');
    });
  });

  describe('parseComments', () => {
    it('should ignore comment lines', () => {
      const input = `
# This is a comment
agent captain:
  model: opus
  # Another comment
  prompt: """test"""
      `;

      const program = parser.parse(input);

      expect(program.agents).toHaveLength(1);
      expect(program.agents[0].name).toBe('captain');
    });

    it('should ignore section divider comments', () => {
      const input = `
# ============================================================================
# PHASE 1
# ============================================================================

agent captain:
  model: opus
  prompt: """test"""
      `;

      const program = parser.parse(input);

      expect(program.agents).toHaveLength(1);
    });
  });

  describe('edge cases', () => {
    it('should handle empty input', () => {
      const program = parser.parse('');

      expect(program.agents).toHaveLength(0);
      expect(program.statements).toHaveLength(0);
    });

    it('should handle multi-line prompts with special characters', () => {
      const input = `
agent builder:
  model: sonnet
  prompt: """
    Install dependencies:
    - pnpm add typescript
    - pnpm add @types/node

    Run: cd src-sidecar && pnpm test
  """
      `;

      const program = parser.parse(input);

      expect(program.agents[0].prompt).toContain('pnpm add typescript');
      expect(program.agents[0].prompt).toContain('cd src-sidecar');
    });
  });
});

// ============================================================================
// VM Executor Tests
// ============================================================================

describe('ProseVM', () => {
  let vm: ProseVM;
  let mockAgentHandler: {
    start: ReturnType<typeof vi.fn>;
    resume: ReturnType<typeof vi.fn>;
    cancel: ReturnType<typeof vi.fn>;
  };

  beforeEach(() => {
    mockAgentHandler = {
      start: vi.fn().mockResolvedValue({ sessionId: 'test-session', status: 'completed' }),
      resume: vi.fn().mockResolvedValue({ sessionId: 'test-session', status: 'completed' }),
      cancel: vi.fn().mockResolvedValue({ success: true }),
    };

    vm = new ProseVM({
      agentHandlers: {
        claude: mockAgentHandler,
        codex: mockAgentHandler,
        kimi: mockAgentHandler,
      },
      workspaceId: 'test-workspace-id',
    });
  });

  describe('execution', () => {
    it('should execute a simple session statement', async () => {
      const program: ProseProgram = {
        agents: [
          { name: 'captain', model: 'opus', persist: false, prompt: 'You are the captain.' },
        ],
        statements: [
          {
            type: 'session',
            agent: 'captain',
            prompt: 'Do something.',
          },
        ],
      };

      await vm.execute(program);

      expect(mockAgentHandler.start).toHaveBeenCalledWith(
        expect.objectContaining({
          workspaceId: 'test-workspace-id',
          prompt: expect.stringContaining('Do something.'),
        })
      );
    });

    it('should execute a resume statement', async () => {
      const program: ProseProgram = {
        agents: [
          { name: 'captain', model: 'opus', persist: true, prompt: 'You are the captain.' },
        ],
        statements: [
          { type: 'session', agent: 'captain', prompt: 'Start.' },
          { type: 'resume', agent: 'captain', prompt: 'Continue.' },
        ],
      };

      await vm.execute(program);

      expect(mockAgentHandler.start).toHaveBeenCalled();
      expect(mockAgentHandler.resume).toHaveBeenCalled();
    });

    it('should track let bindings in state', async () => {
      const program: ProseProgram = {
        agents: [
          { name: 'builder', model: 'sonnet', persist: false, prompt: 'Builder.' },
        ],
        statements: [
          {
            type: 'let',
            name: 'result',
            value: {
              type: 'session',
              agent: 'builder',
              prompt: 'Build something.',
            },
          },
        ],
      };

      await vm.execute(program);

      const state = vm.getState();
      expect(state.bindings).toHaveProperty('result');
    });

    it('should execute parallel blocks concurrently', async () => {
      const startTimes: number[] = [];
      mockAgentHandler.start.mockImplementation(async () => {
        startTimes.push(Date.now());
        await new Promise((resolve) => setTimeout(resolve, 50));
        return { sessionId: 'test', status: 'completed' };
      });

      const program: ProseProgram = {
        agents: [
          { name: 'builder', model: 'sonnet', persist: false, prompt: 'Builder.' },
        ],
        statements: [
          {
            type: 'parallel',
            bindings: [
              {
                type: 'let',
                name: 'task1',
                value: { type: 'session', agent: 'builder', prompt: 'Task 1' },
              },
              {
                type: 'let',
                name: 'task2',
                value: { type: 'session', agent: 'builder', prompt: 'Task 2' },
              },
            ],
          },
        ],
      };

      const startTime = Date.now();
      await vm.execute(program);
      const duration = Date.now() - startTime;

      // If parallel, duration should be ~50ms, not ~100ms
      expect(duration).toBeLessThan(100);
      expect(startTimes).toHaveLength(2);
      // Both tasks should start at nearly the same time
      expect(Math.abs(startTimes[0] - startTimes[1])).toBeLessThan(20);
    });
  });

  describe('context injection', () => {
    it('should inject context from previous bindings', async () => {
      const program: ProseProgram = {
        agents: [
          { name: 'builder', model: 'sonnet', persist: false, prompt: 'Builder.' },
        ],
        statements: [
          {
            type: 'let',
            name: 'plan',
            value: { type: 'session', agent: 'builder', prompt: 'Make a plan.' },
          },
          {
            type: 'session',
            agent: 'builder',
            prompt: 'Execute.',
            context: ['plan'],
          },
        ],
      };

      await vm.execute(program);

      // The second call should include context reference
      expect(mockAgentHandler.start).toHaveBeenCalledTimes(2);
      const secondCall = mockAgentHandler.start.mock.calls[1][0];
      expect(secondCall.options?.systemPrompt).toContain('plan');
    });
  });

  describe('checkpointing', () => {
    it('should save checkpoint after each statement', async () => {
      const program: ProseProgram = {
        agents: [
          { name: 'builder', model: 'sonnet', persist: false, prompt: 'Builder.' },
        ],
        statements: [
          { type: 'session', agent: 'builder', prompt: 'Task 1' },
          { type: 'session', agent: 'builder', prompt: 'Task 2' },
        ],
      };

      await vm.execute(program);

      const state = vm.getState();
      expect(state.checkpoint).toBe(2); // After 2 statements
    });

    it('should resume from checkpoint', async () => {
      const program: ProseProgram = {
        agents: [
          { name: 'builder', model: 'sonnet', persist: false, prompt: 'Builder.' },
        ],
        statements: [
          { type: 'session', agent: 'builder', prompt: 'Task 1' },
          { type: 'session', agent: 'builder', prompt: 'Task 2' },
          { type: 'session', agent: 'builder', prompt: 'Task 3' },
        ],
      };

      // Execute up to checkpoint 1
      vm.setState({ checkpoint: 1, bindings: {}, agentSessions: {} });
      await vm.execute(program);

      // Should only execute from statement 2 onwards
      expect(mockAgentHandler.start).toHaveBeenCalledTimes(2); // Task 2 and Task 3
    });
  });

  describe('output statements', () => {
    it('should capture output statement results', async () => {
      mockAgentHandler.start.mockResolvedValue({
        sessionId: 'test',
        status: 'completed',
        result: 'Final output',
      });

      const program: ProseProgram = {
        agents: [
          { name: 'captain', model: 'opus', persist: false, prompt: 'Captain.' },
        ],
        statements: [
          {
            type: 'output',
            name: 'final_result',
            value: { type: 'session', agent: 'captain', prompt: 'Finalize.' },
          },
        ],
      };

      const result = await vm.execute(program);

      expect(result.outputs).toHaveProperty('final_result');
    });
  });

  describe('error handling', () => {
    it('should throw for undefined agent', async () => {
      const program: ProseProgram = {
        agents: [],
        statements: [
          { type: 'session', agent: 'nonexistent', prompt: 'Test' },
        ],
      };

      await expect(vm.execute(program)).rejects.toThrow(/agent.*nonexistent/i);
    });

    it('should handle agent execution failure', async () => {
      mockAgentHandler.start.mockRejectedValue(new Error('Agent failed'));

      const program: ProseProgram = {
        agents: [
          { name: 'builder', model: 'sonnet', persist: false, prompt: 'Builder.' },
        ],
        statements: [
          { type: 'session', agent: 'builder', prompt: 'Fail.' },
        ],
      };

      await expect(vm.execute(program)).rejects.toThrow('Agent failed');
    });
  });

  describe('model mapping', () => {
    it('should map model names to agent handlers', async () => {
      const claudeHandler = {
        start: vi.fn().mockResolvedValue({ sessionId: 'claude-session', status: 'completed' }),
        resume: vi.fn(),
        cancel: vi.fn(),
      };

      const codexHandler = {
        start: vi.fn().mockResolvedValue({ sessionId: 'codex-session', status: 'completed' }),
        resume: vi.fn(),
        cancel: vi.fn(),
      };

      const vmWithHandlers = new ProseVM({
        agentHandlers: {
          claude: claudeHandler,
          codex: codexHandler,
          kimi: mockAgentHandler,
        },
        workspaceId: 'test',
        modelMapping: {
          opus: 'claude',
          sonnet: 'claude',
          'gpt-5.2-codex': 'codex',
        },
      });

      const program: ProseProgram = {
        agents: [
          { name: 'captain', model: 'opus', persist: false, prompt: 'Captain.' },
          { name: 'coder', model: 'gpt-5.2-codex', persist: false, prompt: 'Coder.' },
        ],
        statements: [
          { type: 'session', agent: 'captain', prompt: 'Use Claude.' },
          { type: 'session', agent: 'coder', prompt: 'Use Codex.' },
        ],
      };

      await vmWithHandlers.execute(program);

      expect(claudeHandler.start).toHaveBeenCalled();
      expect(codexHandler.start).toHaveBeenCalled();
    });
  });
});

// ============================================================================
// Integration Test
// ============================================================================

describe('OpenProse Integration', () => {
  it('should parse and execute a minimal prose program', async () => {
    const proseSource = `
# Simple test program

agent builder:
  model: sonnet
  prompt: """
    You are a builder.
  """

session: builder
  prompt: """
    Say hello.
  """
    `;

    const parser = new ProseParser();
    const program = parser.parse(proseSource);

    const mockHandler = {
      start: vi.fn().mockResolvedValue({ sessionId: 'test', status: 'completed' }),
      resume: vi.fn(),
      cancel: vi.fn(),
    };

    const vm = new ProseVM({
      agentHandlers: { claude: mockHandler, codex: mockHandler, kimi: mockHandler },
      workspaceId: 'test-workspace',
      modelMapping: { sonnet: 'claude' },
    });

    await vm.execute(program);

    expect(mockHandler.start).toHaveBeenCalled();
  });
});
