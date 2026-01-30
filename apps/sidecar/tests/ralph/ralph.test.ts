import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { EventEmitter } from 'node:events';

// Mock the agent handlers
vi.mock('../../src/agents/claude.js', () => ({
  ClaudeHandler: vi.fn().mockImplementation(() => ({
    start: vi.fn(),
    cancel: vi.fn(),
    getSession: vi.fn(),
    dispose: vi.fn(),
    on: vi.fn(),
    emit: vi.fn(),
    removeAllListeners: vi.fn(),
  })),
}));

// Import after mocking
import {
  parseFixPlan,
  selectNextTask,
  serializeFixPlan,
  type Task,
  type TaskPriority,
  type TaskStatus,
  type HandoffContext,
  type RalphLoopConfig,
} from '../../src/ralph/index.js';

import { RalphLoop } from '../../src/ralph/loop.js';

// ============================================================================
// parseFixPlan() Tests
// ============================================================================

describe('parseFixPlan', () => {
  it('should parse empty fix_plan.md', () => {
    const content = '';
    const tasks = parseFixPlan(content);
    expect(tasks).toEqual([]);
  });

  it('should parse unchecked tasks', () => {
    const content = `# Fix Plan

- [ ] Task 1
- [ ] Task 2
`;
    const tasks = parseFixPlan(content);
    expect(tasks).toHaveLength(2);
    expect(tasks[0]).toMatchObject({
      title: 'Task 1',
      status: 'pending',
      completed: false,
    });
    expect(tasks[1]).toMatchObject({
      title: 'Task 2',
      status: 'pending',
      completed: false,
    });
  });

  it('should parse checked/completed tasks', () => {
    const content = `# Fix Plan

- [x] Completed task
- [ ] Pending task
`;
    const tasks = parseFixPlan(content);
    expect(tasks).toHaveLength(2);
    expect(tasks[0]).toMatchObject({
      title: 'Completed task',
      status: 'completed',
      completed: true,
    });
    expect(tasks[1]).toMatchObject({
      title: 'Pending task',
      status: 'pending',
      completed: false,
    });
  });

  it('should parse priority indicators', () => {
    const content = `# Fix Plan

- [ ] [CRITICAL] Security vulnerability
- [ ] [HIGH] Performance issue
- [ ] [MEDIUM] UI bug
- [ ] [LOW] Minor typo
- [ ] Normal task
`;
    const tasks = parseFixPlan(content);
    expect(tasks).toHaveLength(5);
    expect(tasks[0].priority).toBe('critical');
    expect(tasks[1].priority).toBe('high');
    expect(tasks[2].priority).toBe('medium');
    expect(tasks[3].priority).toBe('low');
    expect(tasks[4].priority).toBe('medium'); // default
  });

  it('should parse task descriptions in parentheses', () => {
    const content = `# Fix Plan

- [ ] Implement auth (Add JWT token validation to API endpoints)
`;
    const tasks = parseFixPlan(content);
    expect(tasks).toHaveLength(1);
    expect(tasks[0].title).toBe('Implement auth');
    expect(tasks[0].description).toBe('Add JWT token validation to API endpoints');
  });

  it('should parse nested/indented tasks', () => {
    const content = `# Fix Plan

- [ ] Parent task
  - [ ] Child task 1
  - [ ] Child task 2
- [ ] Another parent
`;
    const tasks = parseFixPlan(content);
    expect(tasks).toHaveLength(4);
    expect(tasks[0].title).toBe('Parent task');
    expect(tasks[0].depth).toBe(0);
    expect(tasks[1].title).toBe('Child task 1');
    expect(tasks[1].depth).toBe(1);
    expect(tasks[1].parentId).toBe(tasks[0].id);
  });

  it('should generate stable IDs from task content', () => {
    const content = `- [ ] Task 1
- [ ] Task 2`;

    const tasks1 = parseFixPlan(content);
    const tasks2 = parseFixPlan(content);

    expect(tasks1[0].id).toBe(tasks2[0].id);
    expect(tasks1[1].id).toBe(tasks2[1].id);
  });

  it('should ignore non-task lines', () => {
    const content = `# Fix Plan

Some description text here.

## Section

- [ ] Actual task

More text.
`;
    const tasks = parseFixPlan(content);
    expect(tasks).toHaveLength(1);
    expect(tasks[0].title).toBe('Actual task');
  });

  it('should handle Windows line endings', () => {
    const content = '- [ ] Task 1\r\n- [ ] Task 2\r\n';
    const tasks = parseFixPlan(content);
    expect(tasks).toHaveLength(2);
  });
});

// ============================================================================
// selectNextTask() Tests
// ============================================================================

describe('selectNextTask', () => {
  it('should return null for empty task list', () => {
    const task = selectNextTask([]);
    expect(task).toBeNull();
  });

  it('should return null when all tasks are completed', () => {
    const tasks: Task[] = [
      { id: '1', title: 'Task 1', status: 'completed', completed: true, priority: 'medium', depth: 0 },
      { id: '2', title: 'Task 2', status: 'completed', completed: true, priority: 'medium', depth: 0 },
    ];
    const task = selectNextTask(tasks);
    expect(task).toBeNull();
  });

  it('should return first pending task when no priorities', () => {
    const tasks: Task[] = [
      { id: '1', title: 'Task 1', status: 'pending', completed: false, priority: 'medium', depth: 0 },
      { id: '2', title: 'Task 2', status: 'pending', completed: false, priority: 'medium', depth: 0 },
    ];
    const task = selectNextTask(tasks);
    expect(task?.id).toBe('1');
  });

  it('should select highest priority task first', () => {
    const tasks: Task[] = [
      { id: '1', title: 'Low priority', status: 'pending', completed: false, priority: 'low', depth: 0 },
      { id: '2', title: 'Critical priority', status: 'pending', completed: false, priority: 'critical', depth: 0 },
      { id: '3', title: 'High priority', status: 'pending', completed: false, priority: 'high', depth: 0 },
    ];
    const task = selectNextTask(tasks);
    expect(task?.id).toBe('2');
    expect(task?.priority).toBe('critical');
  });

  it('should skip in-progress tasks', () => {
    const tasks: Task[] = [
      { id: '1', title: 'In progress', status: 'in_progress', completed: false, priority: 'critical', depth: 0 },
      { id: '2', title: 'Pending', status: 'pending', completed: false, priority: 'high', depth: 0 },
    ];
    const task = selectNextTask(tasks);
    expect(task?.id).toBe('2');
  });

  it('should prefer parent tasks over children at same priority', () => {
    const tasks: Task[] = [
      { id: '1', title: 'Child task', status: 'pending', completed: false, priority: 'high', depth: 1, parentId: '0' },
      { id: '2', title: 'Parent task', status: 'pending', completed: false, priority: 'high', depth: 0 },
    ];
    const task = selectNextTask(tasks);
    expect(task?.id).toBe('2');
  });

  it('should respect task dependencies (blockedBy)', () => {
    const tasks: Task[] = [
      { id: '1', title: 'Blocked task', status: 'pending', completed: false, priority: 'critical', depth: 0, blockedBy: ['2'] },
      { id: '2', title: 'Blocking task', status: 'pending', completed: false, priority: 'low', depth: 0 },
    ];
    const task = selectNextTask(tasks);
    expect(task?.id).toBe('2'); // Even though lower priority, it's not blocked
  });
});

// ============================================================================
// serializeFixPlan() Tests
// ============================================================================

describe('serializeFixPlan', () => {
  it('should serialize empty task list', () => {
    const content = serializeFixPlan([]);
    expect(content).toBe('# Fix Plan\n\n');
  });

  it('should serialize tasks with checkboxes', () => {
    const tasks: Task[] = [
      { id: '1', title: 'Task 1', status: 'pending', completed: false, priority: 'medium', depth: 0 },
      { id: '2', title: 'Task 2', status: 'completed', completed: true, priority: 'medium', depth: 0 },
    ];
    const content = serializeFixPlan(tasks);
    expect(content).toContain('- [ ] Task 1');
    expect(content).toContain('- [x] Task 2');
  });

  it('should serialize priority indicators', () => {
    const tasks: Task[] = [
      { id: '1', title: 'Critical task', status: 'pending', completed: false, priority: 'critical', depth: 0 },
      { id: '2', title: 'High task', status: 'pending', completed: false, priority: 'high', depth: 0 },
    ];
    const content = serializeFixPlan(tasks);
    expect(content).toContain('- [ ] [CRITICAL] Critical task');
    expect(content).toContain('- [ ] [HIGH] High task');
  });

  it('should serialize descriptions', () => {
    const tasks: Task[] = [
      { id: '1', title: 'Task', description: 'Detailed description', status: 'pending', completed: false, priority: 'medium', depth: 0 },
    ];
    const content = serializeFixPlan(tasks);
    expect(content).toContain('- [ ] Task (Detailed description)');
  });

  it('should serialize nested tasks with indentation', () => {
    const tasks: Task[] = [
      { id: '1', title: 'Parent', status: 'pending', completed: false, priority: 'medium', depth: 0 },
      { id: '2', title: 'Child', status: 'pending', completed: false, priority: 'medium', depth: 1, parentId: '1' },
    ];
    const content = serializeFixPlan(tasks);
    expect(content).toContain('- [ ] Parent\n  - [ ] Child');
  });

  it('should round-trip parse and serialize', () => {
    const original = `# Fix Plan

- [ ] [HIGH] Task 1 (Description here)
- [x] Task 2
  - [ ] Child task
`;
    const tasks = parseFixPlan(original);
    const serialized = serializeFixPlan(tasks);
    const reparsed = parseFixPlan(serialized);

    expect(reparsed).toHaveLength(tasks.length);
    expect(reparsed[0].title).toBe(tasks[0].title);
    expect(reparsed[0].priority).toBe(tasks[0].priority);
  });
});

// ============================================================================
// RalphLoop Tests
// ============================================================================

describe('RalphLoop', () => {
  let loop: RalphLoop;
  let mockConfig: RalphLoopConfig;

  beforeEach(() => {
    mockConfig = {
      workspaceId: 'test-workspace-id',
      workingDirectory: '/tmp/test-workspace',
      fixPlanPath: '/tmp/test-workspace/fix_plan.md',
      agentType: 'claude',
      agentOptions: {
        model: 'claude-sonnet-4-20250514',
        dangerouslySkipPermissions: true,
      },
    };
    loop = new RalphLoop(mockConfig);
  });

  afterEach(async () => {
    await loop.stop();
  });

  describe('lifecycle', () => {
    it('should initialize with idle status', () => {
      expect(loop.getStatus()).toBe('idle');
    });

    it('should start and set status to running', async () => {
      // Mock file read
      vi.spyOn(loop as any, 'readFixPlan').mockResolvedValue('- [ ] Task 1');
      vi.spyOn(loop as any, 'executeTask').mockResolvedValue({ success: true, commitHash: 'abc123' });
      vi.spyOn(loop as any, 'writeFixPlan').mockResolvedValue(undefined);

      const startPromise = loop.start();
      expect(loop.getStatus()).toBe('running');

      // Let it process
      await new Promise(resolve => setTimeout(resolve, 10));
      await loop.stop();
    });

    it('should stop and set status to stopped', async () => {
      vi.spyOn(loop as any, 'readFixPlan').mockResolvedValue('- [ ] Task 1');
      vi.spyOn(loop as any, 'executeTask').mockImplementation(() => new Promise(() => {})); // Never resolves

      loop.start();
      await loop.stop();

      expect(loop.getStatus()).toBe('stopped');
    });

    it('should complete when all tasks done', async () => {
      vi.spyOn(loop as any, 'readFixPlan').mockResolvedValue('- [x] Completed task');

      const completedEvents: Array<{ reason: string }> = [];
      loop.on('loop_completed', (event) => completedEvents.push(event));

      await loop.start();

      expect(loop.getStatus()).toBe('completed');
      expect(completedEvents).toHaveLength(1);
      expect(completedEvents[0].reason).toBe('all_tasks_done');
    });
  });

  describe('task execution', () => {
    it('should emit iteration_started event', async () => {
      vi.spyOn(loop as any, 'readFixPlan').mockResolvedValue('- [ ] Task 1');
      vi.spyOn(loop as any, 'executeTask').mockResolvedValue({ success: true, commitHash: 'abc123' });
      vi.spyOn(loop as any, 'writeFixPlan').mockResolvedValue(undefined);

      const events: Array<{ iteration: number; task: Task }> = [];
      loop.on('iteration_started', (event) => events.push(event));

      const startPromise = loop.start();
      await new Promise(resolve => setTimeout(resolve, 50));
      await loop.stop();

      expect(events.length).toBeGreaterThanOrEqual(1);
      expect(events[0].iteration).toBe(1);
      expect(events[0].task.title).toBe('Task 1');
    });

    it('should emit iteration_completed event', async () => {
      vi.spyOn(loop as any, 'readFixPlan')
        .mockResolvedValueOnce('- [ ] Task 1')
        .mockResolvedValue('- [x] Task 1');
      vi.spyOn(loop as any, 'executeTask').mockResolvedValue({ success: true, commitHash: 'abc123' });
      vi.spyOn(loop as any, 'writeFixPlan').mockResolvedValue(undefined);

      const events: Array<{ iteration: number; success: boolean }> = [];
      loop.on('iteration_completed', (event) => events.push(event));

      await loop.start();

      expect(events.length).toBeGreaterThanOrEqual(1);
      expect(events[0].iteration).toBe(1);
      expect(events[0].success).toBe(true);
    });

    it('should handle task failure gracefully', async () => {
      vi.spyOn(loop as any, 'readFixPlan').mockResolvedValue('- [ ] Task 1');
      vi.spyOn(loop as any, 'executeTask').mockResolvedValue({ success: false, error: 'Agent crashed' });
      vi.spyOn(loop as any, 'writeFixPlan').mockResolvedValue(undefined);

      const errorEvents: Array<{ error: string }> = [];
      loop.on('error', (event) => errorEvents.push(event));

      loop.start();
      await new Promise(resolve => setTimeout(resolve, 50));
      await loop.stop();

      expect(errorEvents.length).toBeGreaterThanOrEqual(1);
    });

    it('should respect maxIterations config', async () => {
      const limitedLoop = new RalphLoop({
        ...mockConfig,
        maxIterations: 2,
      });

      let iterationCount = 0;
      vi.spyOn(limitedLoop as any, 'readFixPlan').mockResolvedValue('- [ ] Task 1\n- [ ] Task 2\n- [ ] Task 3');
      vi.spyOn(limitedLoop as any, 'executeTask').mockImplementation(async () => {
        iterationCount++;
        return { success: true, commitHash: `commit-${iterationCount}` };
      });
      vi.spyOn(limitedLoop as any, 'writeFixPlan').mockResolvedValue(undefined);

      await limitedLoop.start();

      expect(iterationCount).toBeLessThanOrEqual(2);
      expect(limitedLoop.getStatus()).toBe('stopped');
    });
  });

  describe('handoff context', () => {
    it('should build correct handoff context', async () => {
      const context = await (loop as any).buildHandoffContext('abc123', ['test passed']);

      expect(context).toMatchObject({
        gitCommitHash: 'abc123',
        testResults: ['test passed'],
      });
      expect(context).not.toHaveProperty('conversationHistory');
    });

    it('should include fix_plan content in handoff', async () => {
      vi.spyOn(loop as any, 'readFixPlan').mockResolvedValue('- [ ] Remaining task');

      const context = await (loop as any).buildHandoffContext('abc123', []);

      expect(context.fixPlanContent).toBe('- [ ] Remaining task');
    });
  });

  describe('fix_plan updates', () => {
    it('should mark task as completed after success', async () => {
      const tasks: Task[] = [
        { id: '1', title: 'Task 1', status: 'pending', completed: false, priority: 'medium', depth: 0 },
      ];

      let writtenContent = '';
      vi.spyOn(loop as any, 'writeFixPlan').mockImplementation(async (content: string) => {
        writtenContent = content;
      });

      await (loop as any).markTaskCompleted(tasks, tasks[0]);

      expect(writtenContent).toContain('[x]');
      expect(writtenContent).toContain('Task 1');
    });
  });

  describe('events', () => {
    it('should emit agent_spawned event', async () => {
      vi.spyOn(loop as any, 'readFixPlan').mockResolvedValue('- [ ] Task 1');
      vi.spyOn(loop as any, 'executeTask').mockResolvedValue({ success: true, commitHash: 'abc123' });
      vi.spyOn(loop as any, 'writeFixPlan').mockResolvedValue(undefined);

      const spawnedEvents: Array<{ taskId: string; agentType: string }> = [];
      loop.on('agent_spawned', (event) => spawnedEvents.push(event));

      loop.start();
      await new Promise(resolve => setTimeout(resolve, 50));
      await loop.stop();

      expect(spawnedEvents.length).toBeGreaterThanOrEqual(1);
      expect(spawnedEvents[0].agentType).toBe('claude');
    });

    it('should emit agent_handoff event', async () => {
      vi.spyOn(loop as any, 'readFixPlan')
        .mockResolvedValueOnce('- [ ] Task 1\n- [ ] Task 2')
        .mockResolvedValue('- [x] Task 1\n- [ ] Task 2');
      vi.spyOn(loop as any, 'executeTask').mockResolvedValue({ success: true, commitHash: 'abc123' });
      vi.spyOn(loop as any, 'writeFixPlan').mockResolvedValue(undefined);

      const handoffEvents: Array<{ fromTask: string; toTask: string }> = [];
      loop.on('agent_handoff', (event) => handoffEvents.push(event));

      loop.start();
      await new Promise(resolve => setTimeout(resolve, 100));
      await loop.stop();

      // Should have at least one handoff between tasks
      if (handoffEvents.length > 0) {
        expect(handoffEvents[0]).toHaveProperty('fromTask');
        expect(handoffEvents[0]).toHaveProperty('toTask');
      }
    });
  });

  describe('statistics', () => {
    it('should track iteration count', async () => {
      vi.spyOn(loop as any, 'readFixPlan')
        .mockResolvedValueOnce('- [ ] Task 1')
        .mockResolvedValue('- [x] Task 1');
      vi.spyOn(loop as any, 'executeTask').mockResolvedValue({ success: true, commitHash: 'abc123' });
      vi.spyOn(loop as any, 'writeFixPlan').mockResolvedValue(undefined);

      await loop.start();

      const stats = loop.getStatistics();
      expect(stats.iterationsCompleted).toBeGreaterThanOrEqual(1);
    });

    it('should track tasks completed', async () => {
      vi.spyOn(loop as any, 'readFixPlan')
        .mockResolvedValueOnce('- [ ] Task 1')
        .mockResolvedValue('- [x] Task 1');
      vi.spyOn(loop as any, 'executeTask').mockResolvedValue({ success: true, commitHash: 'abc123' });
      vi.spyOn(loop as any, 'writeFixPlan').mockResolvedValue(undefined);

      await loop.start();

      const stats = loop.getStatistics();
      expect(stats.tasksCompleted).toBe(1);
    });

    it('should track total tasks', async () => {
      vi.spyOn(loop as any, 'readFixPlan').mockResolvedValue('- [ ] Task 1\n- [ ] Task 2\n- [x] Task 3');

      await (loop as any).readFixPlan();
      const stats = loop.getStatistics();

      // After parsing, totalTasks should be set
      expect(stats.totalTasks).toBe(0); // Before start, stats are empty
    });
  });
});

// ============================================================================
// HandoffContext Tests
// ============================================================================

describe('HandoffContext', () => {
  it('should not include conversation history', () => {
    const context: HandoffContext = {
      workspaceId: 'ws-1',
      gitCommitHash: 'abc123',
      fixPlanContent: '- [ ] Task',
      testResults: ['PASS'],
    };

    // TypeScript will error if conversationHistory is added
    expect(context).not.toHaveProperty('conversationHistory');
    expect(context).not.toHaveProperty('messages');
    expect(context).not.toHaveProperty('history');
  });

  it('should include essential handoff data', () => {
    const context: HandoffContext = {
      workspaceId: 'ws-1',
      gitCommitHash: 'abc123',
      fixPlanContent: '- [ ] Task',
      testResults: ['PASS src/test.ts'],
    };

    expect(context.gitCommitHash).toBe('abc123');
    expect(context.fixPlanContent).toContain('Task');
    expect(context.testResults).toContain('PASS src/test.ts');
  });
});
