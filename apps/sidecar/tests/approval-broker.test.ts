import { afterEach, describe, expect, it, vi } from 'vitest';
import { randomUUID } from 'node:crypto';
import { ApprovalBroker, normalizePermissionMode } from '../src/agents/approvalBroker.js';

const ask = (sessionId = randomUUID()) => ({ sessionId, agentType: 'claude' as const, toolName: 'Write', input: { file_path: '/example/file.txt', content: 'Hello' } });

describe('host-local approval broker', () => {
  afterEach(() => { vi.useRealTimers(); });

  it('keeps requests pending across list reads, requires the exact session, and resolves only once', async () => {
    const notify = vi.fn();
    const broker = new ApprovalBroker({ notify });
    const request = ask();
    const result = broker.request(request);
    const [pending] = broker.list(request.sessionId);
    expect(pending).toMatchObject(request);
    expect(Date.parse(pending.expiresAt) - Date.parse(pending.createdAt)).toBe(600_000);
    expect(broker.list(request.sessionId)).toEqual([pending]);
    expect(broker.list(randomUUID())).toEqual([]);
    expect(() => broker.respond({ sessionId: randomUUID(), approvalId: pending.id, decision: 'allow' })).toThrow('no longer pending');
    expect(broker.list()).toHaveLength(1);
    expect(broker.respond({ sessionId: request.sessionId, approvalId: pending.id, decision: 'allow' })).toEqual({ id: pending.id, sessionId: request.sessionId, decision: 'allow' });
    expect(await result).toEqual({ decision: 'allow' });
    expect(broker.list()).toEqual([]);
    expect(() => broker.respond({ sessionId: request.sessionId, approvalId: pending.id, decision: 'allow' })).toThrow('no longer pending');
    expect(notify.mock.calls).toEqual([[request.sessionId], [request.sessionId]]);
  });

  it('isolates parallel tool requests, even with the same tool-use ID', async () => {
    const broker = new ApprovalBroker({ notify: () => {} });
    const request = { ...ask(), toolUseId: 'same-provider-id' };
    const first = broker.request(request);
    const second = broker.request(request);
    const [a, b] = broker.list();
    expect(a.id).not.toBe(b.id);
    broker.respond({ sessionId: request.sessionId, approvalId: a.id, decision: 'deny' });
    expect(await first).toEqual({ decision: 'deny', reason: 'Denied by user' });
    expect(broker.list()).toHaveLength(1);
    broker.respond({ sessionId: request.sessionId, approvalId: b.id, decision: 'allow' });
    expect(await second).toEqual({ decision: 'allow' });
  });

  it('denies and removes the exact aborted tool request without cancelling another request', async () => {
    const broker = new ApprovalBroker({ notify: () => {} });
    const controller = new AbortController();
    const cancelled = broker.request({ ...ask(), signal: controller.signal });
    const other = broker.request(ask());
    controller.abort();
    expect(await cancelled).toMatchObject({ decision: 'deny', reason: 'Tool request cancelled' });
    expect(broker.list()).toHaveLength(1);
    expect(await broker.request({ ...ask(), signal: controller.signal })).toMatchObject({ decision: 'deny' });
    expect(broker.list()).toHaveLength(1);
    broker.dispose(); await other;
  });

  it('expires unanswered requests, clears their timers, and rejects stale replies', async () => {
    vi.useFakeTimers();
    const broker = new ApprovalBroker({ timeoutMs: 500, notify: () => {} });
    const result = broker.request(ask());
    const [pending] = broker.list();
    await vi.advanceTimersByTimeAsync(500);
    expect(await result).toEqual({ decision: 'deny', reason: 'Approval request expired' });
    expect(broker.list()).toEqual([]);
    expect(vi.getTimerCount()).toBe(0);
    expect(() => broker.respond({ sessionId: pending.sessionId, approvalId: pending.id, decision: 'allow' })).toThrow('no longer pending');
  });

  it('stops one session without affecting another and denies all pending work on dispose', async () => {
    vi.useFakeTimers();
    const broker = new ApprovalBroker({ notify: () => {} });
    const request = ask();
    const a = broker.request(request), b = broker.request(request), c = broker.request(ask());
    broker.denySession(request.sessionId, 'Cancelled');
    expect(await a).toEqual({ decision: 'deny', reason: 'Cancelled' });
    expect(await b).toEqual({ decision: 'deny', reason: 'Cancelled' });
    expect(broker.list()).toHaveLength(1);
    broker.dispose();
    expect(await c).toMatchObject({ decision: 'deny' });
    expect(broker.list()).toEqual([]);
    expect(vi.getTimerCount()).toBe(0);
    expect(await broker.request(ask())).toMatchObject({ decision: 'deny' });
    expect(broker.list()).toEqual([]);
  });

  it('rejects an overdue reply even when the expiry timer has not run yet', async () => {
    vi.useFakeTimers();
    const broker = new ApprovalBroker({ timeoutMs: 500, notify: () => {} });
    const result = broker.request(ask());
    const [pending] = broker.list();
    vi.setSystemTime(Date.parse(pending.expiresAt) + 1);
    expect(broker.list()).toHaveLength(1);
    expect(() => broker.respond({ sessionId: pending.sessionId, approvalId: pending.id, decision: 'allow' })).toThrow('no longer pending');
    expect(await result).toEqual({ decision: 'deny', reason: 'Approval request expired' });
    expect(broker.list()).toEqual([]);
    expect(vi.getTimerCount()).toBe(0);
  });

  it('takes detached input snapshots and tolerates disconnected notification consumers', async () => {
    const broker = new ApprovalBroker({ notify: () => { throw new Error('disconnected'); } });
    const input = ask();
    const result = broker.request(input);
    input.input.content = 'mutated';
    const [pending] = broker.list();
    expect(pending.input.content).toBe('Hello');
    pending.input.content = 'also mutated';
    expect(broker.list()[0].input.content).toBe('Hello');
    broker.respond({ sessionId: input.sessionId, approvalId: pending.id, decision: 'deny' });
    expect(await result).toMatchObject({ decision: 'deny' });
  });

  it('only recognizes the explicit current bypass mode, not legacy or missing modes', () => {
    for (const value of [null, undefined, '', 'default', 'auto-approve', 'auto', 'plan', 'acceptEdits']) {
      expect(normalizePermissionMode(value)).toBe('default');
    }
    expect(normalizePermissionMode('bypassPermissions')).toBe('bypassPermissions');
  });
});
