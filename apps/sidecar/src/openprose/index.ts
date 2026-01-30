/**
 * OpenProse VM Integration
 *
 * Basic OpenProse parser and VM for executing .prose files
 * through the agent handlers (Claude, Codex, Kimi).
 */

export { ProseParser } from './parser.js';
export { ProseVM } from './vm.js';

export type {
  ProseProgram,
  AgentDefinition,
  Statement,
  SessionStatement,
  ResumeStatement,
  LetBinding,
  ParallelBlock,
  OutputStatement,
  VMState,
  VMResult,
  VMConfig,
  AgentHandler,
  AgentStartParams,
  AgentResumeParams,
  AgentCancelParams,
  AgentSessionResult,
  AgentCancelResult,
} from './types.js';
