/**
 * Ralph Loop Module
 *
 * Implements the Ralph Wiggum pattern for fresh agent iterations.
 * Based on Geoffrey Huntley's technique: https://ghuntley.com/loop/
 *
 * @module ralph
 */

// Re-export types
export type {
  Task,
  TaskPriority,
  TaskStatus,
  HandoffContext,
  RalphLoopConfig,
  RalphLoopStatus,
  RalphLoopStatistics,
  RalphLoopEvents,
  TaskExecutionResult,
  AgentType,
  AgentOptions,
} from './types.js';

// Re-export schemas
export {
  TaskSchema,
  HandoffContextSchema,
  RalphLoopConfigSchema,
} from './types.js';

// Re-export parser functions
export {
  parseFixPlan,
  serializeFixPlan,
  selectNextTask,
  updateTaskStatus,
  getRemainingTasks,
  allTasksCompleted,
} from './parser.js';

// Re-export loop class
export { RalphLoop } from './loop.js';
