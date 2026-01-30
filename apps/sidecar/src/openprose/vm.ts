/**
 * OpenProse Virtual Machine
 *
 * Executes parsed ProseProgram by delegating to agent handlers.
 * Supports checkpointing for resume capability.
 */

import type {
  ProseProgram,
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
  AgentDefinition,
} from './types.js';

export class ProseVM {
  private config: VMConfig;
  private state: VMState;
  private agents: Map<string, AgentDefinition> = new Map();

  constructor(config: VMConfig) {
    this.config = config;
    this.state = {
      checkpoint: 0,
      bindings: {},
      agentSessions: {},
    };
  }

  /**
   * Get current VM state
   */
  getState(): VMState {
    return { ...this.state };
  }

  /**
   * Set VM state (for resuming from checkpoint)
   */
  setState(state: Partial<VMState>): void {
    this.state = { ...this.state, ...state };
  }

  /**
   * Execute a prose program
   */
  async execute(program: ProseProgram): Promise<VMResult> {
    // Build agent lookup map
    this.agents.clear();
    for (const agent of program.agents) {
      this.agents.set(agent.name, agent);
    }

    const outputs: Record<string, unknown> = {};

    // Execute statements starting from checkpoint
    for (let i = this.state.checkpoint; i < program.statements.length; i++) {
      const statement = program.statements[i];
      const result = await this.executeStatement(statement);

      // Track outputs
      if (statement.type === 'output') {
        outputs[(statement as OutputStatement).name] = result;
      }

      // Update checkpoint
      this.state.checkpoint = i + 1;
    }

    return {
      success: true,
      outputs,
      finalState: this.getState(),
    };
  }

  /**
   * Execute a single statement
   */
  private async executeStatement(statement: Statement): Promise<unknown> {
    switch (statement.type) {
      case 'session':
        return this.executeSession(statement);
      case 'resume':
        return this.executeResume(statement);
      case 'let':
        return this.executeLet(statement);
      case 'parallel':
        return this.executeParallel(statement);
      case 'output':
        return this.executeOutput(statement);
      default:
        throw new Error(`Unknown statement type: ${(statement as Statement).type}`);
    }
  }

  /**
   * Execute a session statement
   */
  private async executeSession(statement: SessionStatement): Promise<unknown> {
    const agent = this.agents.get(statement.agent);
    if (!agent) {
      throw new Error(`Agent not found: ${statement.agent}`);
    }

    const handler = this.getHandler(agent.model);
    const systemPrompt = this.buildSystemPrompt(agent, statement.context);

    const result = await handler.start({
      workspaceId: this.config.workspaceId,
      prompt: statement.prompt,
      options: {
        model: agent.model,
        systemPrompt,
        workingDirectory: this.config.workingDirectory,
      },
    });

    // Store session ID for persistent agents
    if (agent.persist) {
      this.state.agentSessions[agent.name] = result.sessionId;
    }

    return result;
  }

  /**
   * Execute a resume statement
   */
  private async executeResume(statement: ResumeStatement): Promise<unknown> {
    const agent = this.agents.get(statement.agent);
    if (!agent) {
      throw new Error(`Agent not found: ${statement.agent}`);
    }

    const sessionId = this.state.agentSessions[agent.name];
    if (!sessionId) {
      // No existing session - start a new one instead
      return this.executeSession({
        type: 'session',
        agent: statement.agent,
        prompt: statement.prompt,
        context: statement.context,
      });
    }

    const handler = this.getHandler(agent.model);

    return handler.resume({
      sessionId,
      prompt: statement.prompt,
    });
  }

  /**
   * Execute a let binding
   */
  private async executeLet(statement: LetBinding): Promise<unknown> {
    const result = await this.executeStatement(statement.value);
    this.state.bindings[statement.name] = result;
    return result;
  }

  /**
   * Execute a parallel block
   */
  private async executeParallel(statement: ParallelBlock): Promise<unknown[]> {
    const promises = statement.bindings.map((binding) => this.executeLet(binding));
    return Promise.all(promises);
  }

  /**
   * Execute an output statement
   */
  private async executeOutput(statement: OutputStatement): Promise<unknown> {
    const result = await this.executeStatement(statement.value);
    this.state.bindings[statement.name] = result;
    return result;
  }

  /**
   * Get the agent handler for a model
   */
  private getHandler(model: string): AgentHandler {
    // Use model mapping if available
    const handlerKey = this.config.modelMapping?.[model] || this.getDefaultHandler(model);

    const handler = this.config.agentHandlers[handlerKey];
    if (!handler) {
      throw new Error(`No handler found for model: ${model} (mapped to: ${handlerKey})`);
    }

    return handler;
  }

  /**
   * Get default handler based on model name
   */
  private getDefaultHandler(model: string): string {
    const modelLower = model.toLowerCase();

    if (modelLower.includes('opus') || modelLower.includes('sonnet') || modelLower.includes('haiku')) {
      return 'claude';
    }

    if (modelLower.includes('gpt') || modelLower.includes('codex')) {
      return 'codex';
    }

    if (modelLower.includes('kimi') || modelLower.includes('moonshot')) {
      return 'kimi';
    }

    // Default to claude
    return 'claude';
  }

  /**
   * Build system prompt with agent base prompt and context
   */
  private buildSystemPrompt(agent: AgentDefinition, context?: string[]): string {
    const parts: string[] = [agent.prompt];

    if (context && context.length > 0) {
      parts.push('\n\n## Context from previous steps:\n');

      for (const ref of context) {
        const binding = this.state.bindings[ref];
        if (binding) {
          parts.push(`\n### ${ref}:\n${JSON.stringify(binding, null, 2)}`);
        }
      }
    }

    return parts.join('');
  }
}
