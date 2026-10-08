/** Durable Codex sessions, with the same event stream over polling and notifications. */
import { z } from 'zod';
import { randomUUID } from 'node:crypto';
import { realpathSync } from 'node:fs';
import { and, asc, eq, sql } from 'drizzle-orm';
import { runCodexTurn, type CodexEvent, type CodexUsage, type CodexPermissionMode } from './codexTransport.js';
import { getApprovalBroker, SessionPermissionModeSchema, normalizePermissionMode } from './approvalBroker.js';
import { getDb } from '../db/index.js';
import { sessions, sessionMessages, worktrees } from '../db/schema.js';
import { getNotificationEmitter } from '../rpc/notifications.js';
import type { ClaudeStreamEvent } from './claude.js';

const DEFAULT_MODEL = 'default';
export const PermissionModeSchema = SessionPermissionModeSchema;
export const StartSessionSchema = z.object({
  worktreeId: z.string().uuid().optional(),
  workspaceId: z.string().uuid().optional(), // Legacy name for a worktree ID.
  workingDirectory: z.string().optional(),
  model: z.string().optional(),
  skipGitRepoCheck: z.boolean().optional(),
  permissionMode: PermissionModeSchema.optional(),
}).refine(input => !!(input.worktreeId || input.workspaceId), 'worktreeId is required');
export const SendMessageSchema = z.object({
  sessionId: z.string().uuid(), message: z.string().min(1), stream: z.boolean().optional(), model: z.string().min(1).optional(),
  authorName: z.string().optional(), authorMachineId: z.string().optional(),
});
export const ResumeSessionSchema = z.object({
  sessionId: z.string().uuid(), threadId: z.string().optional(),
  workspaceId: z.string().uuid().optional(), workingDirectory: z.string().optional(), model: z.string().optional(),
});
export const UpdateSettingsSchema = z.object({
  sessionId: z.string().uuid(), model: z.string().min(1).optional(), permissionMode: PermissionModeSchema.optional(),
}).refine(input => input.model !== undefined || input.permissionMode !== undefined, 'A model or permission mode is required');
export const CancelSessionSchema = z.object({ sessionId: z.string().uuid() });
export const GetSessionSchema = CancelSessionSchema;
export const ListSessionsSchema = z.object({ worktreeId: z.string().uuid() });
export const GetMessagesSchema = z.object({ sessionId: z.string().uuid(), fromIndex: z.number().int().nonnegative().optional() });
export type CodexStartInput = z.infer<typeof StartSessionSchema>;
export type CodexSendInput = z.infer<typeof SendMessageSchema>;
export type CodexResumeInput = z.infer<typeof ResumeSessionSchema>;
export type CodexCancelInput = z.infer<typeof CancelSessionSchema>;
export type CodexGetSessionInput = z.infer<typeof GetSessionSchema>;
export type SessionStatus = 'idle' | 'running' | 'cancelled';
export interface CodexSession {
  id: string; sessionId: string; worktreeId: string; workspaceId: string; workingDirectory: string;
  agentType: 'codex'; model: string; permissionMode: CodexPermissionMode; status: SessionStatus; threadId: string | null;
  createdAt: Date; updatedAt: Date;
}
export interface SendMessageResponse {
  sessionId: string; response: string; turnId: string; items: unknown[];
  usage?: { inputTokens: number; cachedInputTokens: number; outputTokens: number };
}
export interface CancelSessionResponse { success: boolean; sessionId: string }
export type StreamEvent = CodexEvent;
export interface StoredCodexMessage { id: string; index: number; timestamp: number; event: ClaudeStreamEvent }
interface InternalSession extends CodexSession { abortController?: AbortController }

export class CodexHandler {
  private sessions = new Map<string, InternalSession>();
  private turns = new Map<string, Promise<void>>();
  private stopping = false;

  async startSession(input: CodexStartInput): Promise<CodexSession> {
    if (this.stopping) throw new Error('Codex handler is stopping');
    const worktreeId = input.worktreeId ?? input.workspaceId!;
    const worktree = getDb().select().from(worktrees).where(eq(worktrees.id, worktreeId)).get();
    if (!worktree?.worktreePath) throw new Error('Worktree not found');
    const workingDirectory = realpathSync(worktree.worktreePath);
    if (input.workingDirectory && realpathSync(input.workingDirectory) !== workingDirectory) {
      throw new Error('Working directory must match the selected worktree');
    }
    const model = input.model || DEFAULT_MODEL;
    const permissionMode = input.permissionMode ?? 'default';
    const id = randomUUID();
    const now = new Date();
    const session: InternalSession = {
      id, sessionId: id, worktreeId, workspaceId: worktreeId, workingDirectory,
      agentType: 'codex', model, permissionMode, status: 'idle', threadId: null, createdAt: now, updatedAt: now,
    };
    getDb().insert(sessions).values({
      id, worktreeId, agentType: 'codex', model, permissionMode, status: 'idle', codexThreadId: null,
      createdAt: now.toISOString(), updatedAt: now.toISOString(),
    }).run();
    getDb().update(worktrees).set({ activeSessionId: id }).where(eq(worktrees.id, worktreeId)).run();
    this.sessions.set(id, session);
    return this.publicSession(session);
  }

  private load(sessionId: string): InternalSession {
    if (this.stopping) throw new Error('Codex handler is stopping');
    const active = this.sessions.get(sessionId);
    if (active) return active;
    const row = getDb().select().from(sessions).where(and(eq(sessions.id, sessionId), eq(sessions.agentType, 'codex'))).get();
    if (!row?.worktreeId) throw new Error('Session not found');
    const worktree = getDb().select().from(worktrees).where(eq(worktrees.id, row.worktreeId)).get();
    if (!worktree?.worktreePath) throw new Error('Worktree not found');
    const workingDirectory = realpathSync(worktree.worktreePath);
    const model = row.model || DEFAULT_MODEL;
    // Historical/unknown modes never opt a session into bypass.
    const permissionMode = normalizePermissionMode(row.permissionMode);
    const session: InternalSession = {
      id: row.id, sessionId: row.id, worktreeId: row.worktreeId, workspaceId: row.worktreeId,
      workingDirectory, agentType: 'codex', model, permissionMode, status: 'idle', threadId: row.codexThreadId,
      createdAt: new Date(row.createdAt), updatedAt: new Date(row.updatedAt),
    };
    // A crashed or stopped process cannot still have an active turn.
    if (row.status === 'running') getDb().update(sessions).set({ status: 'idle' }).where(eq(sessions.id, row.id)).run();
    this.sessions.set(sessionId, session);
    return session;
  }

  async resumeSession(input: CodexResumeInput): Promise<CodexSession> {
    const session = this.load(input.sessionId);
    if (input.threadId && input.threadId !== session.threadId) throw new Error('Thread does not belong to this session');
    if (session.status === 'cancelled') this.status(session, 'idle');
    return this.publicSession(session);
  }
  async getSession(input: CodexGetSessionInput): Promise<CodexSession> { return this.publicSession(this.load(input.sessionId)); }
  async listSessions(input: z.infer<typeof ListSessionsSchema>): Promise<CodexSession[]> {
    const rows = getDb().select().from(sessions).where(and(eq(sessions.worktreeId, input.worktreeId), eq(sessions.agentType, 'codex'))).orderBy(asc(sessions.createdAt)).all();
    return rows.map(row => this.publicSession(this.load(row.id)));
  }
  getMessages(input: z.infer<typeof GetMessagesSchema>): StoredCodexMessage[] {
    this.load(input.sessionId);
    // rowid preserves emission order even when multiple events share a millisecond.
    const rows = getDb().select().from(sessionMessages).where(eq(sessionMessages.sessionId, input.sessionId)).orderBy(sql`rowid`).all();
    return rows.map((row, index) => ({ id: row.id, index, timestamp: Date.parse(row.createdAt), event: JSON.parse(row.fullMessageJson!) as ClaudeStreamEvent })).slice(input.fromIndex ?? 0);
  }
  async cancelSession(input: CodexCancelInput): Promise<CancelSessionResponse> {
    const session = this.load(input.sessionId);
    const finished = this.turns.get(session.id);
    getApprovalBroker().denySession(session.id, 'Codex turn cancelled');
    session.abortController?.abort();
    if (finished) await finished;
    else this.status(session, 'cancelled');
    return { success: true, sessionId: session.id };
  }

  async updateSettings(input: z.infer<typeof UpdateSettingsSchema>): Promise<CodexSession> {
    const session = this.load(input.sessionId);
    if (session.status === 'running' || session.abortController) throw new Error('Cannot change settings during a running turn');
    if (input.model) session.model = input.model;
    if (input.permissionMode) session.permissionMode = input.permissionMode;
    session.updatedAt = new Date();
    getDb().update(sessions).set({ model: session.model, permissionMode: session.permissionMode, updatedAt: session.updatedAt.toISOString() }).where(eq(sessions.id, session.id)).run();
    return this.publicSession(session);
  }

  private status(session: InternalSession, status: SessionStatus): void {
    session.status = status;
    session.updatedAt = new Date();
    getDb().update(sessions).set({ status, codexThreadId: session.threadId, updatedAt: session.updatedAt.toISOString() }).where(eq(sessions.id, session.id)).run();
    getNotificationEmitter().emitSessionStatus(session.id, status);
  }
  private emit(session: InternalSession, turnId: string, event: ClaudeStreamEvent): void {
    const id = randomUUID();
    const timestamp = Date.now();
    const enriched = { ...event, eventId: id, turnId } as ClaudeStreamEvent;
    const content = event.type === 'text_delta' ? String(event.text ?? '') : event.type === 'user' ? String((event.message as { content?: unknown }).content ?? '') : '';
    getDb().insert(sessionMessages).values({
      id, sessionId: session.id, role: event.type === 'user' ? 'user' : 'assistant', content,
      fullMessageJson: JSON.stringify(enriched), turnId, createdAt: new Date(timestamp).toISOString(), sentAt: new Date(timestamp).toISOString(),
    }).run();
    getNotificationEmitter().emitMessage(session.id, enriched);
  }

  async *sendMessageStreamed(input: CodexSendInput, turnId = randomUUID()): AsyncGenerator<StreamEvent> {
    const session = this.load(input.sessionId);
    if (session.status === 'running') throw new Error('Session is already running');
    if (session.abortController) throw new Error('Previous turn is still stopping');
    if (input.model && input.model !== session.model) {
      session.model = input.model;
      getDb().update(sessions).set({ model: session.model }).where(eq(sessions.id, session.id)).run();
    }
    session.abortController = new AbortController();
    this.status(session, 'running');
    this.emit(session, turnId, { type: 'user', message: { type: 'text', content: input.message }, authorName: input.authorName, authorMachineId: input.authorMachineId });
    getDb().update(sessions).set({ title: input.message.slice(0, 80), lastUserMessageAt: new Date().toISOString() }).where(eq(sessions.id, session.id)).run();
    const textByItem = new Map<string, string>();
    let completed = false;
    let finish!: () => void;
    const finished = new Promise<void>(resolve => { finish = resolve; });
    this.turns.set(session.id, finished);
    try {
      const stream = runCodexTurn({
        threadId: session.threadId, workingDirectory: session.workingDirectory, model: session.model,
        permissionMode: session.permissionMode, message: input.message, signal: session.abortController.signal,
        approve: request => getApprovalBroker().request({ ...request, sessionId: session.id, agentType: 'codex' }),
      });
      for await (const event of stream) {
        if (event.type === 'thread.started') {
          session.threadId = event.thread_id;
          getDb().update(sessions).set({ codexThreadId: event.thread_id }).where(eq(sessions.id, session.id)).run();
        } else if (event.type === 'item.started' || event.type === 'item.updated' || event.type === 'item.completed') {
          const item = event.item;
          if (item.type === 'agent_message' && typeof item.text === 'string') {
            const previous = textByItem.get(item.id) ?? '';
            if (item.text !== previous) {
              const prefix = !previous && textByItem.size > 0 ? '\n\n' : '';
              this.emit(session, turnId, { type: 'text_delta', text: prefix + (item.text.startsWith(previous) ? item.text.slice(previous.length) : item.text) });
              textByItem.set(item.id, item.text);
            }
          } else if (event.type === 'item.started') {
            this.emit(session, turnId, { type: 'tool_use', tool: item.type, input: item, id: item.id });
          } else if (event.type === 'item.completed') {
            this.emit(session, turnId, { type: 'tool_result', tool: item.type, output: item, id: item.id, tool_use_id: item.id });
          }
        } else if (event.type === 'turn.completed') {
          completed = true;
          const usage = event.usage;
          if (usage) getDb().update(sessions).set({ contextTokenCount: usage.input_tokens + usage.output_tokens }).where(eq(sessions.id, session.id)).run();
          this.emit(session, turnId, { type: 'result', result: [...textByItem.values()].join('\n\n'), usage });
        } else if (event.type === 'turn.failed') {
          throw new Error(event.error.message);
        }
        yield event;
      }
      if (!completed && !session.abortController.signal.aborted) throw new Error('Codex stream ended before the turn completed');
    } catch (error) {
      if (!session.abortController.signal.aborted) {
        const message = error instanceof Error ? error.message : String(error);
        this.emit(session, turnId, { type: 'error', error: message });
        getNotificationEmitter().emitQueryError(session.id, message);
      }
      throw error;
    } finally {
      try {
        getApprovalBroker().denySession(session.id, 'Codex turn ended');
        const cancelled = session.abortController.signal.aborted;
        if (cancelled && !completed) this.emit(session, turnId, { type: 'result', result: 'Cancelled', cancelled: true });
        session.abortController = undefined;
        this.status(session, cancelled ? 'cancelled' : 'idle');
      } finally {
        this.turns.delete(session.id);
        finish();
      }
    }
  }

  async sendMessage(input: CodexSendInput, turnId = randomUUID()): Promise<SendMessageResponse> {
    const items: unknown[] = [];
    let response = '';
    let usage: CodexUsage | undefined;
    for await (const event of this.sendMessageStreamed(input, turnId)) {
      if (event.type === 'item.completed') {
        items.push(event.item);
        if (event.item.type === 'agent_message' && typeof event.item.text === 'string') response += (response ? '\n\n' : '') + event.item.text;
      }
      if (event.type === 'turn.completed') usage = event.usage;
    }
    return { sessionId: input.sessionId, response, turnId, items, usage: usage ? { inputTokens: usage.input_tokens, cachedInputTokens: usage.cached_input_tokens, outputTokens: usage.output_tokens } : undefined };
  }

  startTurn(input: CodexSendInput): { sessionId: string; status: 'running'; turnId: string } {
    const session = this.load(input.sessionId);
    if (session.status === 'running' || session.abortController) throw new Error('Session is already running');
    const turnId = randomUUID();
    // sendMessage enters the generator synchronously up to its first SDK await,
    // reserving the session before another relay or local message can race it.
    void this.sendMessage(input, turnId).catch(() => { /* failure is persisted and emitted above */ });
    return { sessionId: session.id, status: 'running', turnId };
  }
  async cleanup(): Promise<void> {
    this.stopping = true;
    for (const session of this.sessions.values()) {
      getApprovalBroker().denySession(session.id, 'Codex handler stopped');
      session.abortController?.abort();
    }
    await Promise.allSettled([...this.turns.values()]);
    this.sessions.clear();
  }
  private publicSession(session: InternalSession): CodexSession {
    const { abortController: _abort, ...result } = session;
    return result;
  }
}
let handlerInstance: CodexHandler | null = null;
export function getCodexHandler(): CodexHandler { return handlerInstance ??= new CodexHandler(); }
export async function startCodexSession(input: CodexStartInput) { return getCodexHandler().startSession(input); }
export async function resumeCodexSession(input: CodexResumeInput) { return getCodexHandler().resumeSession(input); }
export async function cancelCodexSession(input: CodexCancelInput) { return getCodexHandler().cancelSession(input); }
export async function getCodexSession(input: CodexGetSessionInput) { return getCodexHandler().getSession(input); }
export async function listCodexSessions(input: z.infer<typeof ListSessionsSchema>) { return getCodexHandler().listSessions(input); }
export async function getCodexMessages(input: z.infer<typeof GetMessagesSchema>) { return getCodexHandler().getMessages(input); }
export async function sendCodexMessage(input: CodexSendInput) { return input.stream ? getCodexHandler().startTurn(input) : getCodexHandler().sendMessage(input); }

export async function updateCodexSettings(input: z.infer<typeof UpdateSettingsSchema>) { return getCodexHandler().updateSettings(input); }
