/**
 * Ralph Loop Types
 *
 * Type definitions for the Ralph Wiggum loop orchestration system.
 * Based on Geoffrey Huntley's technique for fresh agent iterations.
 *
 * @see https://ghuntley.com/loop/
 */

import { z } from 'zod';

// ============================================================================
// Task Types
// ============================================================================

/**
 * Priority levels for tasks
 * Order matters: higher priority = more important
 */
export type TaskPriority = 'critical' | 'high' | 'medium' | 'low';

/**
 * Task execution status
 */
export type TaskStatus = 'pending' | 'in_progress' | 'completed' | 'failed' | 'skipped';

/**
 * A single task from fix_plan.md
 */
export interface Task {
  /** Unique identifier (hash of title + position) */
  id: string;

  /** Task title extracted from markdown */
  title: string;

  /** Optional description in parentheses */
  description?: string;

  /** Task priority level */
  priority: TaskPriority;

  /** Current execution status */
  status: TaskStatus;

  /** Whether the checkbox is checked */
  completed: boolean;

  /** Nesting depth (0 = root level) */
  depth: number;

  /** Parent task ID for nested tasks */
  parentId?: string;

  /** Task IDs that must be completed before this one */
  blockedBy?: string[];

  /** Original line number in fix_plan.md */
  lineNumber?: number;
}

/**
 * Zod schema for task validation
 */
export const TaskSchema = z.object({
  id: z.string(),
  title: z.string(),
  description: z.string().optional(),
  priority: z.enum(['critical', 'high', 'medium', 'low']),
  status: z.enum(['pending', 'in_progress', 'completed', 'failed', 'skipped']),
  completed: z.boolean(),
  depth: z.number().int().min(0),
  parentId: z.string().optional(),
  blockedBy: z.array(z.string()).optional(),
  lineNumber: z.number().int().positive().optional(),
});

// ============================================================================
// Handoff Context
// ============================================================================

/**
 * Context passed between agent iterations.
 * This is what carries over - NOT conversation history.
 */
export interface HandoffContext {
  /** Workspace identifier */
  workspaceId: string;

  /** Current git commit hash */
  gitCommitHash: string;

  /** Current fix_plan.md content */
  fixPlanContent: string;

  /** Test results from last run */
  testResults: string[];

  /** Optional spec/requirements content */
  specContent?: string;

  /** Optional error message from previous iteration */
  previousError?: string;
}

/**
 * Zod schema for handoff context validation
 */
export const HandoffContextSchema = z.object({
  workspaceId: z.string(),
  gitCommitHash: z.string(),
  fixPlanContent: z.string(),
  testResults: z.array(z.string()),
  specContent: z.string().optional(),
  previousError: z.string().optional(),
});

// ============================================================================
// Ralph Loop Configuration
// ============================================================================

/**
 * Supported agent types for the Ralph loop
 */
export type AgentType = 'claude' | 'codex' | 'kimi';

/**
 * Agent-specific options
 */
export interface AgentOptions {
  /** Model to use (e.g., 'claude-sonnet-4-20250514') */
  model?: string;

  /** Maximum turns per iteration */
  maxTurns?: number;

  /** System prompt override */
  systemPrompt?: string;

  /** Skip permission prompts (for automated runs) */
  dangerouslySkipPermissions?: boolean;

  /** Allowed tools (for Claude) */
  allowedTools?: string[];
}

/**
 * Configuration for the Ralph loop
 */
export interface RalphLoopConfig {
  /** Workspace ID from database */
  workspaceId: string;

  /** Working directory path */
  workingDirectory: string;

  /** Path to fix_plan.md */
  fixPlanPath: string;

  /** Agent type to use */
  agentType: AgentType;

  /** Agent-specific options */
  agentOptions?: AgentOptions;

  /** Maximum iterations before stopping (safety limit) */
  maxIterations?: number;

  /** Delay between iterations in milliseconds */
  iterationDelay?: number;

  /** Path to spec file (optional) */
  specPath?: string;

  /** Command to run tests after each iteration */
  testCommand?: string;

  /** Whether to auto-commit after each successful iteration */
  autoCommit?: boolean;

  /** Commit message template (use {task} placeholder) */
  commitMessageTemplate?: string;
}

/**
 * Zod schema for config validation
 */
export const RalphLoopConfigSchema = z.object({
  workspaceId: z.string(),
  workingDirectory: z.string(),
  fixPlanPath: z.string(),
  agentType: z.enum(['claude', 'codex', 'kimi']),
  agentOptions: z.object({
    model: z.string().optional(),
    maxTurns: z.number().int().positive().optional(),
    systemPrompt: z.string().optional(),
    dangerouslySkipPermissions: z.boolean().optional(),
    allowedTools: z.array(z.string()).optional(),
  }).optional(),
  maxIterations: z.number().int().positive().optional(),
  iterationDelay: z.number().int().min(0).optional(),
  specPath: z.string().optional(),
  testCommand: z.string().optional(),
  autoCommit: z.boolean().optional(),
  commitMessageTemplate: z.string().optional(),
});

// ============================================================================
// Loop Status and Results
// ============================================================================

/**
 * Current status of the Ralph loop
 */
export type RalphLoopStatus = 'idle' | 'running' | 'paused' | 'stopped' | 'completed' | 'error';

/**
 * Result of a single task execution
 */
export interface TaskExecutionResult {
  /** Whether the task completed successfully */
  success: boolean;

  /** Git commit hash after task completion */
  commitHash?: string;

  /** Error message if failed */
  error?: string;

  /** Test output if tests were run */
  testOutput?: string;

  /** Duration in milliseconds */
  durationMs?: number;

  /** Token usage for the iteration */
  tokenUsage?: {
    input: number;
    output: number;
    total: number;
  };
}

/**
 * Statistics for the Ralph loop
 */
export interface RalphLoopStatistics {
  /** Total iterations completed */
  iterationsCompleted: number;

  /** Number of tasks completed */
  tasksCompleted: number;

  /** Number of task failures */
  tasksFailed: number;

  /** Total tasks in fix_plan */
  totalTasks: number;

  /** Total time spent (ms) */
  totalDurationMs: number;

  /** Total tokens used */
  totalTokens: number;

  /** Start timestamp */
  startedAt?: Date;

  /** End timestamp */
  endedAt?: Date;
}

// ============================================================================
// Events
// ============================================================================

/**
 * Event types emitted by the Ralph loop
 */
export interface RalphLoopEvents {
  /** Emitted when a new iteration starts */
  iteration_started: {
    iteration: number;
    task: Task;
    handoffContext: HandoffContext;
  };

  /** Emitted when an iteration completes */
  iteration_completed: {
    iteration: number;
    task: Task;
    result: TaskExecutionResult;
    success: boolean;
  };

  /** Emitted when a fresh agent is spawned */
  agent_spawned: {
    taskId: string;
    taskTitle: string;
    agentType: AgentType;
    iteration: number;
  };

  /** Emitted when handing off to a new agent */
  agent_handoff: {
    fromTask: string;
    toTask: string;
    commitHash: string;
    remainingTasks: number;
  };

  /** Emitted when the loop completes */
  loop_completed: {
    reason: 'all_tasks_done' | 'max_iterations' | 'stopped' | 'error';
    statistics: RalphLoopStatistics;
  };

  /** Emitted on error */
  error: {
    error: string;
    task?: Task;
    recoverable: boolean;
  };

  /** Emitted when fix_plan is updated */
  fix_plan_updated: {
    completedTask: Task;
    remainingTasks: Task[];
  };
}
