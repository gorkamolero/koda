/**
 * OpenProse Type Definitions
 *
 * Types for the OpenProse DSL used to orchestrate multi-agent workflows.
 */

/**
 * Agent definition from the .prose file
 */
export interface AgentDefinition {
  name: string;
  model: string;
  persist: boolean;
  prompt: string;
}

/**
 * Base statement type
 */
export interface BaseStatement {
  type: string;
}

/**
 * Session statement - starts a new agent session
 */
export interface SessionStatement extends BaseStatement {
  type: 'session';
  agent: string;
  prompt: string;
  context?: string[];
}

/**
 * Resume statement - continues an existing agent session
 */
export interface ResumeStatement extends BaseStatement {
  type: 'resume';
  agent: string;
  prompt: string;
  context?: string[];
}

/**
 * Let binding - assigns a statement result to a variable
 */
export interface LetBinding extends BaseStatement {
  type: 'let';
  name: string;
  value: SessionStatement | ResumeStatement;
}

/**
 * Parallel block - executes multiple let bindings concurrently
 */
export interface ParallelBlock extends BaseStatement {
  type: 'parallel';
  bindings: LetBinding[];
}

/**
 * Output statement - captures final output of a program
 */
export interface OutputStatement extends BaseStatement {
  type: 'output';
  name: string;
  value: SessionStatement | ResumeStatement;
}

/**
 * Union of all statement types
 */
export type Statement =
  | SessionStatement
  | ResumeStatement
  | LetBinding
  | ParallelBlock
  | OutputStatement;

/**
 * Complete parsed prose program
 */
export interface ProseProgram {
  agents: AgentDefinition[];
  statements: Statement[];
}

/**
 * VM execution state
 */
export interface VMState {
  checkpoint: number;
  bindings: Record<string, unknown>;
  agentSessions: Record<string, string>; // agent name -> session ID
}

/**
 * VM execution result
 */
export interface VMResult {
  success: boolean;
  outputs: Record<string, unknown>;
  finalState: VMState;
}

/**
 * Agent handler interface that the VM uses to execute sessions
 */
export interface AgentHandler {
  start(params: AgentStartParams): Promise<AgentSessionResult>;
  resume(params: AgentResumeParams): Promise<AgentSessionResult>;
  cancel(params: AgentCancelParams): Promise<AgentCancelResult>;
}

export interface AgentStartParams {
  workspaceId: string;
  prompt: string;
  options?: {
    model?: string;
    systemPrompt?: string;
    workingDirectory?: string;
  };
}

export interface AgentResumeParams {
  sessionId: string;
  prompt?: string;
}

export interface AgentCancelParams {
  sessionId: string;
}

export interface AgentSessionResult {
  sessionId: string;
  status: string;
  result?: string;
}

export interface AgentCancelResult {
  success: boolean;
}

/**
 * VM configuration options
 */
export interface VMConfig {
  agentHandlers: Record<string, AgentHandler>;
  workspaceId: string;
  modelMapping?: Record<string, string>;
  workingDirectory?: string;
}
