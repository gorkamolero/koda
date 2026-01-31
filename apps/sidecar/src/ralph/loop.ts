/**
 * Ralph Loop Orchestrator
 *
 * Implements the Ralph Wiggum pattern for fresh agent iterations.
 * Based on Geoffrey Huntley's technique: https://ghuntley.com/loop/
 *
 * The Core Pattern:
 * 1. Fresh agent sees fix_plan.md
 * 2. Agent picks most important task
 * 3. Agent completes ONE task
 * 4. Handoff to fresh agent with remaining tasks
 * 5. Repeat until done
 *
 * What carries over (handoff data):
 * - Git state (commit hash)
 * - Updated fix_plan.md
 * - Test results
 * - NOT conversation history
 */

import { EventEmitter } from 'node:events';
import * as fs from 'node:fs/promises';
import { spawn, type ChildProcess } from 'node:child_process';
import {
  parseFixPlan,
  selectNextTask,
  serializeFixPlan,
  updateTaskStatus,
  allTasksCompleted,
  getRemainingTasks,
} from './parser.js';
import type {
  Task,
  HandoffContext,
  RalphLoopConfig,
  RalphLoopStatus,
  RalphLoopStatistics,
  RalphLoopEvents,
  TaskExecutionResult,
} from './types.js';

// ============================================================================
// Constants
// ============================================================================

const DEFAULT_MAX_ITERATIONS = 100;
const DEFAULT_ITERATION_DELAY = 1000; // 1 second between iterations
const DEFAULT_COMMIT_MESSAGE_TEMPLATE = 'Ralph: complete task "{task}"';

// ============================================================================
// Event Type Definitions
// ============================================================================

export interface RalphLoopEventEmitter {
  on<K extends keyof RalphLoopEvents>(event: K, listener: (data: RalphLoopEvents[K]) => void): this;
  emit<K extends keyof RalphLoopEvents>(event: K, data: RalphLoopEvents[K]): boolean;
  removeAllListeners(event?: keyof RalphLoopEvents): this;
}

// ============================================================================
// RalphLoop Class
// ============================================================================

/**
 * Orchestrates the Ralph loop pattern for fresh agent iterations
 */
export class RalphLoop extends EventEmitter implements RalphLoopEventEmitter {
  private config: RalphLoopConfig;
  private status: RalphLoopStatus = 'idle';
  private currentIteration: number = 0;
  private currentTask: Task | null = null;
  private currentProcess: ChildProcess | null = null;
  private shouldStop: boolean = false;

  // Statistics
  private stats: RalphLoopStatistics = {
    iterationsCompleted: 0,
    tasksCompleted: 0,
    tasksFailed: 0,
    totalTasks: 0,
    totalDurationMs: 0,
    totalTokens: 0,
  };

  constructor(config: RalphLoopConfig) {
    super();
    this.config = {
      maxIterations: DEFAULT_MAX_ITERATIONS,
      iterationDelay: DEFAULT_ITERATION_DELAY,
      commitMessageTemplate: DEFAULT_COMMIT_MESSAGE_TEMPLATE,
      autoCommit: true,
      ...config,
    };
  }

  // ============================================================================
  // Public API
  // ============================================================================

  /**
   * Start the Ralph loop
   */
  async start(): Promise<void> {
    if (this.status === 'running') {
      throw new Error('Ralph loop is already running');
    }

    this.status = 'running';
    this.shouldStop = false;
    this.stats.startedAt = new Date();

    try {
      await this.runLoop();
    } catch (error) {
      this.status = 'error';
      this.emit('error', {
        error: error instanceof Error ? error.message : String(error),
        recoverable: false,
      });
    }
  }

  /**
   * Stop the Ralph loop gracefully
   */
  async stop(): Promise<void> {
    this.shouldStop = true;

    // Kill current process if running
    if (this.currentProcess && !this.currentProcess.killed) {
      this.currentProcess.kill('SIGTERM');
    }

    this.status = 'stopped';
    this.stats.endedAt = new Date();

    if (this.stats.startedAt) {
      this.stats.totalDurationMs = this.stats.endedAt.getTime() - this.stats.startedAt.getTime();
    }
  }

  /**
   * Pause the Ralph loop (can be resumed)
   */
  pause(): void {
    if (this.status === 'running') {
      this.status = 'paused';
    }
  }

  /**
   * Resume a paused Ralph loop
   */
  resume(): void {
    if (this.status === 'paused') {
      this.status = 'running';
      this.runLoop().catch((error) => {
        this.status = 'error';
        this.emit('error', {
          error: error instanceof Error ? error.message : String(error),
          recoverable: false,
        });
      });
    }
  }

  /**
   * Get current loop status
   */
  getStatus(): RalphLoopStatus {
    return this.status;
  }

  /**
   * Get current statistics
   */
  getStatistics(): RalphLoopStatistics {
    return { ...this.stats };
  }

  /**
   * Get the current task being worked on
   */
  getCurrentTask(): Task | null {
    return this.currentTask;
  }

  // ============================================================================
  // Main Loop Logic
  // ============================================================================

  /**
   * Main loop execution
   */
  private async runLoop(): Promise<void> {
    while (!this.shouldStop && this.status === 'running') {
      // Check iteration limit
      if (this.config.maxIterations && this.currentIteration >= this.config.maxIterations) {
        this.status = 'stopped';
        this.emit('loop_completed', {
          reason: 'max_iterations',
          statistics: this.getStatistics(),
        });
        return;
      }

      // Read and parse fix_plan
      const fixPlanContent = await this.readFixPlan();
      const tasks = parseFixPlan(fixPlanContent);
      this.stats.totalTasks = tasks.length;

      // Check if all tasks are done
      if (allTasksCompleted(tasks)) {
        this.status = 'completed';
        this.stats.endedAt = new Date();
        if (this.stats.startedAt) {
          this.stats.totalDurationMs = this.stats.endedAt.getTime() - this.stats.startedAt.getTime();
        }
        this.emit('loop_completed', {
          reason: 'all_tasks_done',
          statistics: this.getStatistics(),
        });
        return;
      }

      // Select next task
      const nextTask = selectNextTask(tasks);
      if (!nextTask) {
        // No task available (all blocked or in progress)
        this.status = 'completed';
        this.emit('loop_completed', {
          reason: 'all_tasks_done',
          statistics: this.getStatistics(),
        });
        return;
      }

      this.currentIteration++;
      this.currentTask = nextTask;

      // Build handoff context
      const handoffContext = await this.buildHandoffContext('', []);

      // Emit iteration started
      this.emit('iteration_started', {
        iteration: this.currentIteration,
        task: nextTask,
        handoffContext,
      });

      // Emit agent spawned
      this.emit('agent_spawned', {
        taskId: nextTask.id,
        taskTitle: nextTask.title,
        agentType: this.config.agentType,
        iteration: this.currentIteration,
      });

      // Execute the task with a fresh agent
      const result = await this.executeTask(nextTask, handoffContext, tasks);

      // Handle result
      if (result.success) {
        this.stats.tasksCompleted++;

        // Mark task as completed
        await this.markTaskCompleted(tasks, nextTask);

        // Emit fix_plan updated
        this.emit('fix_plan_updated', {
          completedTask: nextTask,
          remainingTasks: getRemainingTasks(tasks),
        });

        // Emit handoff if there are more tasks
        const remaining = getRemainingTasks(tasks);
        if (remaining.length > 0) {
          const nextUp = selectNextTask(tasks);
          if (nextUp) {
            this.emit('agent_handoff', {
              fromTask: nextTask.title,
              toTask: nextUp.title,
              commitHash: result.commitHash || '',
              remainingTasks: remaining.length,
            });
          }
        }
      } else {
        this.stats.tasksFailed++;
        this.emit('error', {
          error: result.error || 'Task execution failed',
          task: nextTask,
          recoverable: true,
        });
      }

      // Emit iteration completed
      this.emit('iteration_completed', {
        iteration: this.currentIteration,
        task: nextTask,
        result,
        success: result.success,
      });

      this.stats.iterationsCompleted++;

      // Track token usage
      if (result.tokenUsage) {
        this.stats.totalTokens += result.tokenUsage.total;
      }

      // Delay between iterations
      if (!this.shouldStop && this.config.iterationDelay) {
        await this.delay(this.config.iterationDelay);
      }
    }
  }

  // ============================================================================
  // Task Execution
  // ============================================================================

  /**
   * Execute a single task with a fresh agent
   */
  private async executeTask(
    task: Task,
    handoffContext: HandoffContext,
    allTasks: Task[]
  ): Promise<TaskExecutionResult> {
    const startTime = Date.now();

    try {
      // Build the prompt for the agent
      const prompt = this.buildTaskPrompt(task, handoffContext, allTasks);

      // Spawn fresh agent based on type
      const result = await this.spawnFreshAgent(prompt);

      // Run tests if configured
      let testOutput: string | undefined;
      if (this.config.testCommand) {
        testOutput = await this.runTests();
      }

      // Auto-commit if configured
      let commitHash: string | undefined;
      if (this.config.autoCommit && result.success) {
        commitHash = await this.createCommit(task);
      } else {
        commitHash = await this.getCurrentCommitHash();
      }

      const durationMs = Date.now() - startTime;

      return {
        success: result.success,
        commitHash,
        testOutput,
        durationMs,
        tokenUsage: result.tokenUsage,
        error: result.error,
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
        durationMs: Date.now() - startTime,
      };
    }
  }

  /**
   * Spawn a fresh agent instance
   */
  private async spawnFreshAgent(prompt: string): Promise<{
    success: boolean;
    error?: string;
    tokenUsage?: { input: number; output: number; total: number };
  }> {
    return new Promise((resolve) => {
      const args = this.buildAgentArgs(prompt);
      const command = this.getAgentCommand();

      this.currentProcess = spawn(command, args, {
        cwd: this.config.workingDirectory,
        stdio: ['pipe', 'pipe', 'pipe'],
        env: {
          ...process.env,
          // Disable interactive prompts for fresh agent
          CI: 'true',
        },
      });

      let stdout = '';
      let stderr = '';
      let tokenUsage: { input: number; output: number; total: number } | undefined;

      this.currentProcess.stdout?.on('data', (data: Buffer) => {
        stdout += data.toString();
        // Try to parse token usage from Claude's stream-json output
        const lines = stdout.split('\n');
        for (const line of lines) {
          try {
            const parsed = JSON.parse(line);
            if (parsed.type === 'result' && parsed.usage) {
              tokenUsage = {
                input: parsed.usage.input_tokens || 0,
                output: parsed.usage.output_tokens || 0,
                total: (parsed.usage.input_tokens || 0) + (parsed.usage.output_tokens || 0),
              };
            }
          } catch {
            // Not JSON, ignore
          }
        }
      });

      this.currentProcess.stderr?.on('data', (data: Buffer) => {
        stderr += data.toString();
      });

      this.currentProcess.on('close', (code) => {
        this.currentProcess = null;

        if (this.shouldStop) {
          resolve({ success: false, error: 'Loop stopped' });
          return;
        }

        if (code === 0) {
          resolve({ success: true, tokenUsage });
        } else {
          resolve({
            success: false,
            error: stderr || `Agent exited with code ${code}`,
            tokenUsage,
          });
        }
      });

      this.currentProcess.on('error', (err) => {
        this.currentProcess = null;
        resolve({ success: false, error: err.message });
      });
    });
  }

  /**
   * Build the prompt for the agent
   */
  private buildTaskPrompt(task: Task, context: HandoffContext, allTasks: Task[]): string {
    const remainingTasks = getRemainingTasks(allTasks);

    const prompt = `# Ralph Loop - Task Execution

You are a fresh agent in the Ralph loop. Your job is to complete ONE task.

## Current Task
**${task.title}**
${task.description ? `\nDescription: ${task.description}` : ''}
Priority: ${task.priority.toUpperCase()}

## Remaining Tasks (${remainingTasks.length})
${remainingTasks.map((t) => `- [ ] ${t.title}`).join('\n')}

## Instructions
1. Complete ONLY the current task above
2. Make focused, incremental changes
3. Test your changes if applicable
4. Do NOT attempt to complete other tasks
5. When done, your work will be handed off to a fresh agent

## Git State
Last commit: ${context.gitCommitHash || 'none'}

${context.testResults.length > 0 ? `## Previous Test Results\n${context.testResults.join('\n')}` : ''}

Begin working on: "${task.title}"`;

    return prompt;
  }

  /**
   * Get the CLI command for the configured agent
   */
  private getAgentCommand(): string {
    switch (this.config.agentType) {
      case 'claude':
        return 'claude';
      case 'codex':
        return 'codex';
      case 'kimi':
        return 'kimi';
      default:
        return 'claude';
    }
  }

  /**
   * Build CLI arguments for the agent
   */
  private buildAgentArgs(prompt: string): string[] {
    const args: string[] = ['--print', '--output-format', 'stream-json'];

    // Add working directory
    args.push('--cwd', this.config.workingDirectory);

    // Add model if specified
    if (this.config.agentOptions?.model) {
      args.push('--model', this.config.agentOptions.model);
    }

    // Add max turns if specified
    if (this.config.agentOptions?.maxTurns) {
      args.push('--max-turns', String(this.config.agentOptions.maxTurns));
    }

    // Add skip permissions if specified
    if (this.config.agentOptions?.dangerouslySkipPermissions) {
      args.push('--dangerously-skip-permissions');
    }

    // Add system prompt if specified
    if (this.config.agentOptions?.systemPrompt) {
      args.push('--system-prompt', this.config.agentOptions.systemPrompt);
    }

    // Add the prompt as positional argument
    args.push(prompt);

    return args;
  }

  // ============================================================================
  // File Operations
  // ============================================================================

  /**
   * Read fix_plan.md content
   */
  private async readFixPlan(): Promise<string> {
    try {
      return await fs.readFile(this.config.fixPlanPath, 'utf-8');
    } catch {
      // Return empty if file doesn't exist
      return '';
    }
  }

  /**
   * Write fix_plan.md content
   */
  private async writeFixPlan(content: string): Promise<void> {
    await fs.writeFile(this.config.fixPlanPath, content, 'utf-8');
  }

  /**
   * Mark a task as completed and update fix_plan.md
   */
  private async markTaskCompleted(tasks: Task[], task: Task): Promise<void> {
    updateTaskStatus(tasks, task.id, 'completed', true);
    const content = serializeFixPlan(tasks);
    await this.writeFixPlan(content);
  }

  // ============================================================================
  // Git Operations
  // ============================================================================

  /**
   * Get current git commit hash
   */
  private async getCurrentCommitHash(): Promise<string> {
    return new Promise((resolve) => {
      const proc = spawn('git', ['rev-parse', 'HEAD'], {
        cwd: this.config.workingDirectory,
        stdio: ['pipe', 'pipe', 'pipe'],
      });

      let stdout = '';
      proc.stdout?.on('data', (data: Buffer) => {
        stdout += data.toString();
      });

      proc.on('close', (code) => {
        if (code === 0) {
          resolve(stdout.trim());
        } else {
          resolve('');
        }
      });

      proc.on('error', () => {
        resolve('');
      });
    });
  }

  /**
   * Create a git commit for the completed task
   */
  private async createCommit(task: Task): Promise<string> {
    // Stage all changes
    await this.runGitCommand(['add', '-A']);

    // Create commit
    const message = this.config.commitMessageTemplate?.replace('{task}', task.title) || `Complete: ${task.title}`;

    await this.runGitCommand(['commit', '-m', message]);

    // Return new commit hash
    return this.getCurrentCommitHash();
  }

  /**
   * Run a git command
   */
  private runGitCommand(args: string[]): Promise<void> {
    return new Promise((resolve, reject) => {
      const proc = spawn('git', args, {
        cwd: this.config.workingDirectory,
        stdio: ['pipe', 'pipe', 'pipe'],
      });

      proc.on('close', (code) => {
        if (code === 0) {
          resolve();
        } else {
          reject(new Error(`git ${args.join(' ')} failed with code ${code}`));
        }
      });

      proc.on('error', reject);
    });
  }

  // ============================================================================
  // Test Execution
  // ============================================================================

  /**
   * Run configured test command
   */
  private async runTests(): Promise<string> {
    if (!this.config.testCommand) {
      return '';
    }

    return new Promise((resolve) => {
      const proc = spawn('sh', ['-c', this.config.testCommand!], {
        cwd: this.config.workingDirectory,
        stdio: ['pipe', 'pipe', 'pipe'],
      });

      let output = '';
      proc.stdout?.on('data', (data: Buffer) => {
        output += data.toString();
      });
      proc.stderr?.on('data', (data: Buffer) => {
        output += data.toString();
      });

      proc.on('close', () => {
        resolve(output);
      });

      proc.on('error', () => {
        resolve('');
      });
    });
  }

  // ============================================================================
  // Handoff Context
  // ============================================================================

  /**
   * Build handoff context for the next iteration
   */
  private async buildHandoffContext(gitCommitHash: string, testResults: string[]): Promise<HandoffContext> {
    const fixPlanContent = await this.readFixPlan();

    let specContent: string | undefined;
    if (this.config.specPath) {
      try {
        specContent = await fs.readFile(this.config.specPath, 'utf-8');
      } catch {
        // Spec file doesn't exist
      }
    }

    const commitHash = gitCommitHash || (await this.getCurrentCommitHash());

    return {
      workspaceId: this.config.workspaceId,
      gitCommitHash: commitHash,
      fixPlanContent,
      testResults,
      specContent,
    };
  }

  // ============================================================================
  // Utilities
  // ============================================================================

  /**
   * Delay for specified milliseconds
   */
  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  // ============================================================================
  // Type-safe Event Emitter
  // ============================================================================

  override on<K extends keyof RalphLoopEvents>(event: K, listener: (data: RalphLoopEvents[K]) => void): this {
    return super.on(event, listener);
  }

  override emit<K extends keyof RalphLoopEvents>(event: K, data: RalphLoopEvents[K]): boolean {
    return super.emit(event, data);
  }
}
