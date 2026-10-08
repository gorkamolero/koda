/** Host-local structured input. Neither questions nor answers enter the relay. */
import { randomUUID } from 'node:crypto';
import { z } from 'zod';
import { getNotificationEmitter } from '../rpc/notifications.js';

const reservedQuestionIds = new Set(['__proto__', 'prototype', ...Object.getOwnPropertyNames(Object.prototype)]);
export const QuestionSchema = z.object({
  id: z.string().min(1).max(200).refine(id => !reservedQuestionIds.has(id), 'Reserved question ID'),
  header: z.string().max(200), question: z.string().min(1).max(20_000),
  options: z.array(z.object({ label: z.string().min(1).max(2_000), description: z.string().max(20_000).optional() })).max(100),
  multiSelect: z.boolean(), allowOther: z.boolean(), isSecret: z.boolean().optional(),
}).superRefine((question, context) => {
  if (new Set(question.options.map(option => option.label)).size !== question.options.length) {
    context.addIssue({ code: 'custom', message: 'Question option labels must be unique' });
  }
  if (!question.options.length && !question.allowOther) context.addIssue({ code: 'custom', message: 'Question must accept an answer' });
});
export type Question = z.infer<typeof QuestionSchema>;
const QuestionsSchema = z.array(QuestionSchema).min(1).max(20).superRefine((questions, context) => {
  if (new Set(questions.map(question => question.id)).size !== questions.length) {
    context.addIssue({ code: 'custom', message: 'Question IDs must be unique' });
  }
});
export interface QuestionRequest {
  id: string; sessionId: string; agentType: 'claude' | 'codex'; toolUseId?: string;
  questions: Question[]; createdAt: string; expiresAt: string;
}
export const QuestionAnswerSchema = z.object({
  selected: z.array(z.string().min(1).max(2_000)).max(100), text: z.string().max(50_000).optional(),
}).strict();
export type QuestionAnswer = z.infer<typeof QuestionAnswerSchema>;
export type QuestionAnswers = Record<string, QuestionAnswer>;
export type QuestionCancelSource = 'user' | 'expired' | 'withdrawn' | 'session' | 'disposed';
export type QuestionDecision = { decision: 'submit'; answers: QuestionAnswers } | { decision: 'cancel'; reason: string; source: QuestionCancelSource };
export type QuestionInput = Omit<QuestionRequest, 'id' | 'createdAt' | 'expiresAt'>;
export const QuestionListParamsSchema = z.object({ sessionId: z.string().uuid().optional() }).strict();
export const QuestionRespondParamsSchema = z.discriminatedUnion('decision', [
  z.object({ sessionId: z.string().uuid(), requestId: z.string().uuid(), decision: z.literal('submit'),
    answers: z.record(z.string().min(1).max(200), QuestionAnswerSchema) }).strict(),
  z.object({ sessionId: z.string().uuid(), requestId: z.string().uuid(), decision: z.literal('cancel') }).strict(),
]);
interface PendingQuestion {
  request: QuestionRequest; resolve: (decision: QuestionDecision) => void;
  timer?: ReturnType<typeof setTimeout>; signal?: AbortSignal; onAbort: () => void;
}

export class QuestionBroker {
  private readonly pending = new Map<string, PendingQuestion>();
  private readonly timeoutMs: number;
  private readonly notify: (sessionId: string) => void;
  private disposed = false;

  constructor(options: { timeoutMs?: number; notify?: (sessionId: string) => void } = {}) {
    this.timeoutMs = options.timeoutMs ?? 10 * 60_000;
    if (!Number.isFinite(this.timeoutMs) || this.timeoutMs <= 0) throw new Error('Question timeout must be positive');
    this.notify = options.notify ?? (sessionId => getNotificationEmitter().emit('questionChanged', { sessionId }));
  }

  request(input: QuestionInput, options: { signal?: AbortSignal } = {}): Promise<QuestionDecision> {
    if (this.disposed) return Promise.resolve({ decision: 'cancel', reason: 'Question service stopped', source: 'disposed' });
    if (options.signal?.aborted) return Promise.resolve({ decision: 'cancel', reason: 'Question request withdrawn', source: 'withdrawn' });
    const questions = QuestionsSchema.parse(input.questions);
    const now = Date.now();
    const request: QuestionRequest = {
      id: randomUUID(), sessionId: input.sessionId, agentType: input.agentType,
      ...(input.toolUseId ? { toolUseId: input.toolUseId } : {}), questions,
      createdAt: new Date(now).toISOString(), expiresAt: new Date(now + this.timeoutMs).toISOString(),
    };
    return new Promise(resolve => {
      const entry: PendingQuestion = { request, resolve, signal: options.signal,
        onAbort: () => this.finish(request.id, { decision: 'cancel', reason: 'Question request withdrawn', source: 'withdrawn' }) };
      this.pending.set(request.id, entry);
      entry.signal?.addEventListener('abort', entry.onAbort, { once: true });
      entry.timer = setTimeout(() => this.finish(request.id, { decision: 'cancel', reason: 'Question request expired', source: 'expired' }), this.timeoutMs);
      entry.timer.unref?.();
      if (entry.signal?.aborted) { entry.onAbort(); return; }
      this.changed(request.sessionId);
    });
  }

  list(sessionId?: string): QuestionRequest[] {
    for (const [id, entry] of this.pending) {
      if (Date.now() >= Date.parse(entry.request.expiresAt)) this.finish(id, { decision: 'cancel', reason: 'Question request expired', source: 'expired' });
    }
    return [...this.pending.values()].filter(entry => !sessionId || entry.request.sessionId === sessionId)
      .map(entry => structuredClone(entry.request));
  }

  respond(value: z.infer<typeof QuestionRespondParamsSchema>): { id: string; sessionId: string; decision: 'submit' | 'cancel' } {
    const input = QuestionRespondParamsSchema.parse(value);
    const entry = this.pending.get(input.requestId);
    if (!entry || entry.request.sessionId !== input.sessionId) throw new Error('Question request is no longer pending for this session');
    if (Date.now() >= Date.parse(entry.request.expiresAt)) {
      this.finish(input.requestId, { decision: 'cancel', reason: 'Question request expired', source: 'expired' });
      throw new Error('Question request is no longer pending for this session');
    }
    if (input.decision === 'cancel') this.finish(input.requestId, { decision: 'cancel', reason: 'Question cancelled by user', source: 'user' });
    else {
      const expected = new Set(entry.request.questions.map(question => question.id));
      if (Object.keys(input.answers).length !== expected.size || Object.keys(input.answers).some(id => !expected.has(id))) {
        throw new Error('Answer every question using its exact ID');
      }
      for (const question of entry.request.questions) {
        const answer = input.answers[question.id];
        if (!answer || !Object.hasOwn(input.answers, question.id)) throw new Error('Answer every question using its exact ID');
        const labels = new Set(question.options.map(option => option.label));
        if (new Set(answer.selected).size !== answer.selected.length || answer.selected.some(label => !labels.has(label))) {
          throw new Error('Select only the question options, without duplicates');
        }
        if (answer.text !== undefined && (!question.allowOther || !answer.text.trim())) throw new Error('This question does not accept an empty or custom answer');
        const count = answer.selected.length + (answer.text !== undefined ? 1 : 0);
        if (!count || (!question.multiSelect && count !== 1)) throw new Error('Choose the required number of answers');
      }
      this.finish(input.requestId, { decision: 'submit', answers: structuredClone(input.answers) });
    }
    return { id: input.requestId, sessionId: input.sessionId, decision: input.decision };
  }

  cancelSession(sessionId: string, reason = 'Session stopped'): void {
    for (const [id, entry] of this.pending) if (entry.request.sessionId === sessionId) this.finish(id, { decision: 'cancel', reason, source: 'session' });
  }
  dispose(): void {
    this.disposed = true;
    for (const id of this.pending.keys()) this.finish(id, { decision: 'cancel', reason: 'Question service stopped', source: 'disposed' });
  }
  private finish(id: string, decision: QuestionDecision): void {
    const entry = this.pending.get(id);
    if (!entry) return;
    this.pending.delete(id);
    clearTimeout(entry.timer);
    entry.signal?.removeEventListener('abort', entry.onAbort);
    entry.resolve(decision);
    this.changed(entry.request.sessionId);
  }
  private changed(sessionId: string): void {
    try { this.notify(sessionId); } catch { /* Reload/polling remains authoritative. */ }
  }
}
let broker: QuestionBroker | undefined;
export function getQuestionBroker(): QuestionBroker { return broker ??= new QuestionBroker(); }
export function questionList(params: z.infer<typeof QuestionListParamsSchema>) { return getQuestionBroker().list(params.sessionId); }
export function questionRespond(params: z.infer<typeof QuestionRespondParamsSchema>) { return getQuestionBroker().respond(params); }
