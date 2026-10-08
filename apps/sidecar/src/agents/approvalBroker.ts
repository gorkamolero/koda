/** Host-local tool approvals. These requests never enter the collaboration relay. */
import { randomUUID } from 'node:crypto';
import { z } from 'zod';
import { getNotificationEmitter } from '../rpc/notifications.js';

export const SessionPermissionModeSchema = z.enum(['default', 'bypassPermissions']);
export type SessionPermissionMode = z.infer<typeof SessionPermissionModeSchema>;
export function normalizePermissionMode(value: unknown): SessionPermissionMode {
  return value === 'bypassPermissions' ? 'bypassPermissions' : 'default';
}

export interface ApprovalRequest {
  id: string;
  sessionId: string;
  agentType: 'claude' | 'codex';
  toolName: string;
  input: Record<string, unknown>;
  reason?: string;
  toolUseId?: string;
  createdAt: string;
  expiresAt: string;
}
export interface ApprovalDecision { decision: 'allow' | 'deny'; reason?: string }
export type ApprovalInput = Omit<ApprovalRequest, 'id' | 'createdAt' | 'expiresAt'> & { signal?: AbortSignal };
interface PendingApproval {
  request: ApprovalRequest;
  resolve: (decision: ApprovalDecision) => void;
  timer?: ReturnType<typeof setTimeout>;
  signal?: AbortSignal;
  onAbort: () => void;
}

export const ApprovalListParamsSchema = z.object({ sessionId: z.string().uuid().optional() });
export const ApprovalRespondParamsSchema = z.object({
  sessionId: z.string().uuid(), approvalId: z.string().uuid(), decision: z.enum(['allow', 'deny']),
});

export class ApprovalBroker {
  private readonly pending = new Map<string, PendingApproval>();
  private readonly timeoutMs: number;
  private readonly notify: (sessionId: string) => void;
  private disposed = false;

  constructor(options: { timeoutMs?: number; notify?: (sessionId: string) => void } = {}) {
    this.timeoutMs = options.timeoutMs ?? 10 * 60_000;
    if (!Number.isFinite(this.timeoutMs) || this.timeoutMs <= 0) throw new Error('Approval timeout must be positive');
    this.notify = options.notify ?? (sessionId => getNotificationEmitter().emit('approvalChanged', { sessionId }));
  }

  request(input: ApprovalInput): Promise<ApprovalDecision> {
    if (this.disposed) return Promise.resolve({ decision: 'deny', reason: 'Approval service stopped' });
    if (input.signal?.aborted) return Promise.resolve({ decision: 'deny', reason: 'Tool request cancelled' });
    const now = Date.now();
    const { signal, ...details } = input;
    const request: ApprovalRequest = {
      ...structuredClone(details), id: randomUUID(),
      createdAt: new Date(now).toISOString(), expiresAt: new Date(now + this.timeoutMs).toISOString(),
    };
    return new Promise(resolve => {
      const entry: PendingApproval = {
        request, resolve, signal,
        onAbort: () => this.finish(request.id, { decision: 'deny', reason: 'Tool request cancelled' }),
      };
      this.pending.set(request.id, entry);
      signal?.addEventListener('abort', entry.onAbort, { once: true });
      entry.timer = setTimeout(() => this.finish(request.id, { decision: 'deny', reason: 'Approval request expired' }), this.timeoutMs);
      entry.timer.unref?.();
      this.changed(request.sessionId);
    });
  }

  list(sessionId?: string): ApprovalRequest[] {
    return [...this.pending.values()].filter(entry => !sessionId || entry.request.sessionId === sessionId)
      .map(entry => structuredClone(entry.request));
  }

  respond(input: z.infer<typeof ApprovalRespondParamsSchema>): { id: string; sessionId: string; decision: 'allow' | 'deny' } {
    const entry = this.pending.get(input.approvalId);
    if (!entry || entry.request.sessionId !== input.sessionId) throw new Error('Approval request is no longer pending for this session');
    // A busy event loop can delay the timer beyond its deadline. A late response
    // must still fail closed rather than extending the approval window.
    if (Date.now() >= Date.parse(entry.request.expiresAt)) {
      this.finish(input.approvalId, { decision: 'deny', reason: 'Approval request expired' });
      throw new Error('Approval request is no longer pending for this session');
    }
    this.finish(input.approvalId, { decision: input.decision, ...(input.decision === 'deny' ? { reason: 'Denied by user' } : {}) });
    return { id: input.approvalId, sessionId: input.sessionId, decision: input.decision };
  }

  denySession(sessionId: string, reason = 'Session stopped'): void {
    for (const [id, entry] of this.pending) {
      if (entry.request.sessionId === sessionId) this.finish(id, { decision: 'deny', reason });
    }
  }

  dispose(): void {
    this.disposed = true;
    for (const id of this.pending.keys()) this.finish(id, { decision: 'deny', reason: 'Approval service stopped' });
  }

  private finish(id: string, decision: ApprovalDecision): void {
    const entry = this.pending.get(id);
    if (!entry) return;
    this.pending.delete(id);
    clearTimeout(entry.timer);
    entry.signal?.removeEventListener('abort', entry.onAbort);
    entry.resolve(decision);
    this.changed(entry.request.sessionId);
  }

  private changed(sessionId: string): void {
    // A disconnected notification consumer must not strand a live SDK request.
    try { this.notify(sessionId); } catch { /* polling remains authoritative */ }
  }
}

let broker: ApprovalBroker | undefined;
export function getApprovalBroker(): ApprovalBroker { return broker ??= new ApprovalBroker(); }
export function approvalList(params: z.infer<typeof ApprovalListParamsSchema>) { return getApprovalBroker().list(params.sessionId); }
export function approvalRespond(params: z.infer<typeof ApprovalRespondParamsSchema>) { return getApprovalBroker().respond(params); }
