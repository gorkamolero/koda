/**
 * Fix Plan Parser
 *
 * Parses fix_plan.md markdown files into structured Task objects.
 * Handles checkboxes, priorities, descriptions, and nesting.
 */

import { createHash } from 'node:crypto';
import type { Task, TaskPriority, TaskStatus } from './types.js';

// ============================================================================
// Constants
// ============================================================================

/**
 * Priority keywords and their mappings
 */
const PRIORITY_PATTERNS: Record<string, TaskPriority> = {
  '[CRITICAL]': 'critical',
  '[HIGH]': 'high',
  '[MEDIUM]': 'medium',
  '[LOW]': 'low',
};

/**
 * Default priority for tasks without explicit priority
 */
const DEFAULT_PRIORITY: TaskPriority = 'medium';

/**
 * Regex to match task lines: - [ ] or - [x]
 */
const TASK_LINE_REGEX = /^(\s*)-\s*\[([ xX])\]\s*(.+)$/;

/**
 * Regex to extract priority from task title
 */
const PRIORITY_REGEX = /\[(CRITICAL|HIGH|MEDIUM|LOW)\]\s*/i;

/**
 * Regex to extract description in parentheses
 */
const DESCRIPTION_REGEX = /\s*\(([^)]+)\)\s*$/;

// ============================================================================
// Parser Functions
// ============================================================================

/**
 * Generate a stable ID for a task based on its content
 */
function generateTaskId(title: string, lineNumber: number): string {
  const content = `${title}:${lineNumber}`;
  return createHash('md5').update(content).digest('hex').substring(0, 8);
}

/**
 * Calculate indentation depth (number of spaces / 2)
 */
function calculateDepth(indentation: string): number {
  // Count spaces, divide by 2 (standard markdown indent)
  return Math.floor(indentation.length / 2);
}

/**
 * Extract priority from task title
 */
function extractPriority(title: string): { priority: TaskPriority; cleanTitle: string } {
  const match = title.match(PRIORITY_REGEX);
  if (match) {
    const priorityKey = `[${match[1].toUpperCase()}]`;
    const priority = PRIORITY_PATTERNS[priorityKey] || DEFAULT_PRIORITY;
    const cleanTitle = title.replace(PRIORITY_REGEX, '').trim();
    return { priority, cleanTitle };
  }
  return { priority: DEFAULT_PRIORITY, cleanTitle: title };
}

/**
 * Extract description from task title (text in parentheses)
 */
function extractDescription(title: string): { description?: string; cleanTitle: string } {
  const match = title.match(DESCRIPTION_REGEX);
  if (match) {
    const description = match[1].trim();
    const cleanTitle = title.replace(DESCRIPTION_REGEX, '').trim();
    return { description, cleanTitle };
  }
  return { cleanTitle: title };
}

/**
 * Parse a single task line into a Task object
 */
function parseTaskLine(
  line: string,
  lineNumber: number,
  parentStack: Array<{ id: string; depth: number }>
): Task | null {
  const match = line.match(TASK_LINE_REGEX);
  if (!match) {
    return null;
  }

  const [, indentation, checkbox, rawTitle] = match;
  const depth = calculateDepth(indentation);
  const isCompleted = checkbox.toLowerCase() === 'x';

  // Extract priority
  const { priority, cleanTitle: titleAfterPriority } = extractPriority(rawTitle.trim());

  // Extract description
  const { description, cleanTitle: finalTitle } = extractDescription(titleAfterPriority);

  // Generate stable ID
  const id = generateTaskId(finalTitle, lineNumber);

  // Determine parent ID based on depth
  let parentId: string | undefined;
  if (depth > 0 && parentStack.length > 0) {
    // Find the closest parent with lower depth
    for (let i = parentStack.length - 1; i >= 0; i--) {
      if (parentStack[i].depth < depth) {
        parentId = parentStack[i].id;
        break;
      }
    }
  }

  // Determine status
  const status: TaskStatus = isCompleted ? 'completed' : 'pending';

  return {
    id,
    title: finalTitle,
    description,
    priority,
    status,
    completed: isCompleted,
    depth,
    parentId,
    lineNumber,
  };
}

/**
 * Parse fix_plan.md content into an array of Task objects
 *
 * @param content - The raw markdown content of fix_plan.md
 * @returns Array of parsed Task objects
 */
export function parseFixPlan(content: string): Task[] {
  if (!content || content.trim() === '') {
    return [];
  }

  // Normalize line endings
  const normalizedContent = content.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
  const lines = normalizedContent.split('\n');

  const tasks: Task[] = [];
  const parentStack: Array<{ id: string; depth: number }> = [];

  for (let i = 0; i < lines.length; i++) {
    const lineNumber = i + 1;
    const task = parseTaskLine(lines[i], lineNumber, parentStack);

    if (task) {
      tasks.push(task);

      // Update parent stack for nesting
      // Remove all entries at same or greater depth
      while (parentStack.length > 0 && parentStack[parentStack.length - 1].depth >= task.depth) {
        parentStack.pop();
      }
      // Add this task as potential parent
      parentStack.push({ id: task.id, depth: task.depth });
    }
  }

  return tasks;
}

/**
 * Serialize an array of Task objects back to markdown format
 *
 * @param tasks - Array of Task objects
 * @param header - Optional header text (defaults to "# Fix Plan")
 * @returns Markdown string
 */
export function serializeFixPlan(tasks: Task[], header: string = '# Fix Plan'): string {
  if (tasks.length === 0) {
    return `${header}\n\n`;
  }

  const lines: string[] = [header, ''];

  for (const task of tasks) {
    // Build indentation
    const indent = '  '.repeat(task.depth);

    // Build checkbox
    const checkbox = task.completed ? '[x]' : '[ ]';

    // Build priority (skip if medium/default)
    let priorityStr = '';
    if (task.priority !== 'medium') {
      priorityStr = `[${task.priority.toUpperCase()}] `;
    }

    // Build description
    const descriptionStr = task.description ? ` (${task.description})` : '';

    // Combine
    const line = `${indent}- ${checkbox} ${priorityStr}${task.title}${descriptionStr}`;
    lines.push(line);
  }

  lines.push(''); // Trailing newline
  return lines.join('\n');
}

/**
 * Select the next task to work on based on priority and dependencies
 *
 * Selection criteria (in order):
 * 1. Task must be pending (not completed, in_progress, failed, or skipped)
 * 2. Task must not be blocked by uncompleted tasks
 * 3. Higher priority tasks are selected first
 * 4. Parent tasks are preferred over children at same priority
 * 5. Earlier tasks (lower line number) are preferred at same priority/depth
 *
 * @param tasks - Array of Task objects
 * @returns The next task to work on, or null if all done
 */
export function selectNextTask(tasks: Task[]): Task | null {
  if (tasks.length === 0) {
    return null;
  }

  // Filter to only pending tasks
  const pendingTasks = tasks.filter((task) => task.status === 'pending' && !task.completed);

  if (pendingTasks.length === 0) {
    return null;
  }

  // Build set of completed task IDs for dependency checking
  const completedIds = new Set(tasks.filter((t) => t.completed || t.status === 'completed').map((t) => t.id));

  // Filter out blocked tasks
  const unblockedTasks = pendingTasks.filter((task) => {
    if (!task.blockedBy || task.blockedBy.length === 0) {
      return true;
    }
    // Check if all blocking tasks are completed
    return task.blockedBy.every((blockerId) => completedIds.has(blockerId));
  });

  if (unblockedTasks.length === 0) {
    // All pending tasks are blocked - this might indicate a circular dependency
    // Fall back to first pending task
    return pendingTasks[0];
  }

  // Priority order (higher = more important)
  const priorityOrder: Record<TaskPriority, number> = {
    critical: 4,
    high: 3,
    medium: 2,
    low: 1,
  };

  // Sort by priority (desc), then depth (asc, prefer parents), then line number (asc)
  unblockedTasks.sort((a, b) => {
    // Compare priority (higher first)
    const priorityDiff = priorityOrder[b.priority] - priorityOrder[a.priority];
    if (priorityDiff !== 0) return priorityDiff;

    // Compare depth (lower first, prefer parents)
    const depthDiff = a.depth - b.depth;
    if (depthDiff !== 0) return depthDiff;

    // Compare line number (lower first)
    return (a.lineNumber || 0) - (b.lineNumber || 0);
  });

  return unblockedTasks[0];
}

/**
 * Update a task's status in the task list
 *
 * @param tasks - Array of Task objects (will be mutated)
 * @param taskId - ID of the task to update
 * @param status - New status
 * @param completed - New completed state
 * @returns The updated task, or null if not found
 */
export function updateTaskStatus(
  tasks: Task[],
  taskId: string,
  status: TaskStatus,
  completed: boolean
): Task | null {
  const task = tasks.find((t) => t.id === taskId);
  if (!task) {
    return null;
  }

  task.status = status;
  task.completed = completed;
  return task;
}

/**
 * Get remaining (pending) tasks
 */
export function getRemainingTasks(tasks: Task[]): Task[] {
  return tasks.filter((t) => !t.completed && t.status === 'pending');
}

/**
 * Check if all tasks are completed
 */
export function allTasksCompleted(tasks: Task[]): boolean {
  return tasks.length > 0 && tasks.every((t) => t.completed || t.status === 'completed');
}
