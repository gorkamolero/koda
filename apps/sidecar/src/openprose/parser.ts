/**
 * OpenProse Parser
 *
 * Parses .prose files into a structured ProseProgram AST.
 * This is a basic implementation focusing on the core constructs.
 */

import type {
  ProseProgram,
  AgentDefinition,
  Statement,
  SessionStatement,
  ResumeStatement,
  LetBinding,
  ParallelBlock,
  OutputStatement,
} from './types.js';

export class ProseParser {
  private lines: string[] = [];
  private currentIndex = 0;

  /**
   * Parse a prose source string into a ProseProgram
   */
  parse(source: string): ProseProgram {
    this.lines = source.split('\n');
    this.currentIndex = 0;

    const agents: AgentDefinition[] = [];
    const statements: Statement[] = [];

    while (this.currentIndex < this.lines.length) {
      const line = this.currentLine();

      // Skip empty lines and comments
      if (this.isEmpty(line) || this.isComment(line)) {
        this.advance();
        continue;
      }

      // Parse agent definitions
      if (line.startsWith('agent ')) {
        agents.push(this.parseAgent());
        continue;
      }

      // Parse parallel blocks
      if (line.startsWith('parallel:')) {
        statements.push(this.parseParallel());
        continue;
      }

      // Parse output statements
      if (line.startsWith('output ')) {
        statements.push(this.parseOutput());
        continue;
      }

      // Parse let bindings
      if (line.startsWith('let ')) {
        statements.push(this.parseLet());
        continue;
      }

      // Parse session statements
      if (line.startsWith('session:')) {
        statements.push(this.parseSession());
        continue;
      }

      // Parse resume statements
      if (line.startsWith('resume:')) {
        statements.push(this.parseResume());
        continue;
      }

      // Unknown line - skip
      this.advance();
    }

    return { agents, statements };
  }

  private currentLine(): string {
    return this.lines[this.currentIndex] || '';
  }

  private advance(): void {
    this.currentIndex++;
  }

  private isEmpty(line: string): boolean {
    return line.trim() === '';
  }

  private isComment(line: string): boolean {
    return line.trim().startsWith('#');
  }

  private parseAgent(): AgentDefinition {
    // Parse "agent name:"
    const headerLine = this.currentLine();
    const match = headerLine.match(/^agent\s+(\w+):$/);
    if (!match) {
      throw new Error(`Invalid agent header: ${headerLine}`);
    }
    const name = match[1];
    this.advance();

    let model = '';
    let persist = false;
    let prompt = '';

    // Parse agent properties
    while (this.currentIndex < this.lines.length) {
      const line = this.currentLine();

      // Check if we've left the agent block
      if (!this.isEmpty(line) && !this.isComment(line) && !line.startsWith('  ')) {
        break;
      }

      const trimmed = line.trim();

      if (trimmed.startsWith('model:')) {
        model = trimmed.replace('model:', '').trim();
      } else if (trimmed.startsWith('persist:')) {
        persist = trimmed.replace('persist:', '').trim() === 'true';
      } else if (trimmed.startsWith('prompt:')) {
        prompt = this.parseMultilineString();
        continue; // parseMultilineString advances the index
      }

      this.advance();
    }

    return { name, model, persist, prompt };
  }

  private parseSession(): SessionStatement {
    // Parse "session: agent"
    const headerLine = this.currentLine();
    const match = headerLine.match(/^session:\s*(\w+)$/);
    if (!match) {
      throw new Error(`Invalid session header: ${headerLine}`);
    }
    const agent = match[1];
    this.advance();

    let prompt = '';
    let context: string[] | undefined;

    // Parse session properties
    while (this.currentIndex < this.lines.length) {
      const line = this.currentLine();

      // Check if we've left the session block
      if (!this.isEmpty(line) && !this.isComment(line) && !line.startsWith('  ')) {
        break;
      }

      const trimmed = line.trim();

      if (trimmed.startsWith('prompt:')) {
        prompt = this.parseMultilineString();
        continue;
      } else if (trimmed.startsWith('context:')) {
        context = this.parseContextReference(trimmed);
      }

      this.advance();
    }

    return { type: 'session', agent, prompt, context };
  }

  private parseResume(): ResumeStatement {
    // Parse "resume: agent"
    const headerLine = this.currentLine();
    const match = headerLine.match(/^resume:\s*(\w+)$/);
    if (!match) {
      throw new Error(`Invalid resume header: ${headerLine}`);
    }
    const agent = match[1];
    this.advance();

    let prompt = '';
    let context: string[] | undefined;

    // Parse resume properties
    while (this.currentIndex < this.lines.length) {
      const line = this.currentLine();

      if (!this.isEmpty(line) && !this.isComment(line) && !line.startsWith('  ')) {
        break;
      }

      const trimmed = line.trim();

      if (trimmed.startsWith('prompt:')) {
        prompt = this.parseMultilineString();
        continue;
      } else if (trimmed.startsWith('context:')) {
        context = this.parseContextReference(trimmed);
      }

      this.advance();
    }

    return { type: 'resume', agent, prompt, context };
  }

  private parseLet(): LetBinding {
    // Parse "let name = session/resume: agent"
    const headerLine = this.currentLine();
    const match = headerLine.match(/^let\s+(\w+)\s*=\s*(session|resume):\s*(\w+)$/);
    if (!match) {
      throw new Error(`Invalid let binding: ${headerLine}`);
    }

    const name = match[1];
    const statementType = match[2] as 'session' | 'resume';
    const agent = match[3];
    this.advance();

    let prompt = '';
    let context: string[] | undefined;

    // Parse inner properties
    while (this.currentIndex < this.lines.length) {
      const line = this.currentLine();

      if (!this.isEmpty(line) && !this.isComment(line) && !line.startsWith('  ')) {
        break;
      }

      const trimmed = line.trim();

      if (trimmed.startsWith('prompt:')) {
        prompt = this.parseMultilineString();
        continue;
      } else if (trimmed.startsWith('context:')) {
        context = this.parseContextReference(trimmed);
      }

      this.advance();
    }

    const value: SessionStatement | ResumeStatement =
      statementType === 'session'
        ? { type: 'session', agent, prompt, context }
        : { type: 'resume', agent, prompt, context };

    return { type: 'let', name, value };
  }

  private parseParallel(): ParallelBlock {
    // Skip "parallel:" line
    this.advance();

    const bindings: LetBinding[] = [];

    // Parse indented let bindings
    while (this.currentIndex < this.lines.length) {
      const line = this.currentLine();

      // Check if we've left the parallel block
      if (!this.isEmpty(line) && !this.isComment(line) && !line.startsWith('  ')) {
        break;
      }

      const trimmed = line.trim();

      if (trimmed.match(/^\w+\s*=\s*(session|resume):/)) {
        // Parse nested let-like binding (without "let" keyword in parallel)
        const binding = this.parseParallelBinding();
        bindings.push(binding);
        continue;
      }

      this.advance();
    }

    return { type: 'parallel', bindings };
  }

  private parseParallelBinding(): LetBinding {
    // Parse "name = session/resume: agent" (within parallel block)
    const headerLine = this.currentLine().trim();
    const match = headerLine.match(/^(\w+)\s*=\s*(session|resume):\s*(\w+)$/);
    if (!match) {
      throw new Error(`Invalid parallel binding: ${headerLine}`);
    }

    const name = match[1];
    const statementType = match[2] as 'session' | 'resume';
    const agent = match[3];
    this.advance();

    let prompt = '';
    let context: string[] | undefined;

    // Parse inner properties (with extra indentation)
    while (this.currentIndex < this.lines.length) {
      const line = this.currentLine();

      // Check if we've left this binding (less than 4 spaces or new binding)
      if (!this.isEmpty(line) && !this.isComment(line)) {
        const indentMatch = line.match(/^(\s*)/);
        const indent = indentMatch ? indentMatch[1].length : 0;
        if (indent < 4) break;

        // Check if it's a new parallel binding
        if (line.trim().match(/^\w+\s*=\s*(session|resume):/)) {
          break;
        }
      }

      const trimmed = line.trim();

      if (trimmed.startsWith('prompt:')) {
        prompt = this.parseMultilineString();
        continue;
      } else if (trimmed.startsWith('context:')) {
        context = this.parseContextReference(trimmed);
      }

      this.advance();
    }

    const value: SessionStatement | ResumeStatement =
      statementType === 'session'
        ? { type: 'session', agent, prompt, context }
        : { type: 'resume', agent, prompt, context };

    return { type: 'let', name, value };
  }

  private parseOutput(): OutputStatement {
    // Parse "output name = session/resume: agent"
    const headerLine = this.currentLine();
    const match = headerLine.match(/^output\s+(\w+)\s*=\s*(session|resume):\s*(\w+)$/);
    if (!match) {
      throw new Error(`Invalid output statement: ${headerLine}`);
    }

    const name = match[1];
    const statementType = match[2] as 'session' | 'resume';
    const agent = match[3];
    this.advance();

    let prompt = '';
    let context: string[] | undefined;

    // Parse inner properties
    while (this.currentIndex < this.lines.length) {
      const line = this.currentLine();

      if (!this.isEmpty(line) && !this.isComment(line) && !line.startsWith('  ')) {
        break;
      }

      const trimmed = line.trim();

      if (trimmed.startsWith('prompt:')) {
        prompt = this.parseMultilineString();
        continue;
      } else if (trimmed.startsWith('context:')) {
        context = this.parseContextReference(trimmed);
      }

      this.advance();
    }

    const value: SessionStatement | ResumeStatement =
      statementType === 'session'
        ? { type: 'session', agent, prompt, context }
        : { type: 'resume', agent, prompt, context };

    return { type: 'output', name, value };
  }

  private parseMultilineString(): string {
    // Look for """ delimiter
    const startLine = this.currentLine();

    // Check for inline string: prompt: """text"""
    const inlineMatch = startLine.match(/prompt:\s*"""(.*)"""$/);
    if (inlineMatch) {
      this.advance();
      return inlineMatch[1].trim();
    }

    // Check for start of multiline: prompt: """
    if (!startLine.includes('"""')) {
      this.advance();
      return '';
    }

    this.advance();
    const lines: string[] = [];

    // Collect lines until closing """
    while (this.currentIndex < this.lines.length) {
      const line = this.currentLine();

      if (line.trim() === '"""') {
        this.advance();
        break;
      }

      lines.push(line);
      this.advance();
    }

    // Remove common leading whitespace and join
    return this.dedent(lines.join('\n')).trim();
  }

  private parseContextReference(line: string): string[] {
    // Parse "context: name" or "context: [name1, name2]"
    const value = line.replace('context:', '').trim();

    // Array format
    if (value.startsWith('[') && value.endsWith(']')) {
      const inner = value.slice(1, -1);
      return inner.split(',').map((s) => s.trim());
    }

    // Single reference
    return [value];
  }

  private dedent(text: string): string {
    const lines = text.split('\n');
    if (lines.length === 0) return text;

    // Find minimum indentation (excluding empty lines)
    let minIndent = Infinity;
    for (const line of lines) {
      if (line.trim() === '') continue;
      const match = line.match(/^(\s*)/);
      if (match) {
        minIndent = Math.min(minIndent, match[1].length);
      }
    }

    if (minIndent === Infinity || minIndent === 0) return text;

    // Remove that many spaces from each line
    return lines.map((line) => line.slice(minIndent)).join('\n');
  }
}
