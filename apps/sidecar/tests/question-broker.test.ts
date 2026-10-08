import { afterEach, describe, expect, it, vi } from 'vitest';
import { randomUUID } from 'node:crypto';
import { QuestionBroker, QuestionRespondParamsSchema, type QuestionInput } from '../src/agents/questionBroker.js';

const ask = (sessionId = randomUUID()): QuestionInput => ({ sessionId, agentType: 'claude', toolUseId: 'question-tool', questions: [
  { id: 'color', header: 'Color', question: 'Which color?', options: [{ label: 'Blue', description: 'Cool' }, { label: 'Red' }], multiSelect: false, allowOther: true },
  { id: 'features', header: 'Features', question: 'Which features?', options: [{ label: 'Search' }, { label: 'Export' }], multiSelect: true, allowOther: true },
] });
const answers = () => ({ color: { selected: ['Blue'] }, features: { selected: ['Search', 'Export'], text: 'Import' } });

describe('host-local structured question broker', () => {
  afterEach(() => vi.useRealTimers());

  it('recovers immutable pending forms, accepts exact session answers once, and only notifies session IDs', async () => {
    const notify = vi.fn();
    const broker = new QuestionBroker({ notify });
    const input = ask();
    const pending = broker.request(input);
    input.questions[0].options[0].label = 'Mutated';
    const [request] = broker.list(input.sessionId);
    request.questions[0].options[0].label = 'Changed again';
    expect(broker.list(input.sessionId)[0].questions[0].options[0].label).toBe('Blue');
    expect(broker.list(randomUUID())).toEqual([]);
    expect(() => broker.respond({ sessionId: randomUUID(), requestId: request.id, decision: 'submit', answers: answers() })).toThrow('no longer pending');
    const reply = { sessionId: input.sessionId, requestId: request.id, decision: 'submit' as const, answers: answers() };
    expect(broker.respond(reply)).toEqual({ id: request.id, sessionId: input.sessionId, decision: 'submit' });
    reply.answers.color.selected[0] = 'Changed';
    expect(await pending).toEqual({ decision: 'submit', answers: answers() });
    expect(broker.list()).toEqual([]);
    expect(() => broker.respond(reply)).toThrow('no longer pending');
    expect(notify.mock.calls).toEqual([[input.sessionId], [input.sessionId]]);
  });

  it('rejects unknown/missing IDs, unknown/duplicate options, empty answers, and invalid cardinality without consuming the form', async () => {
    const broker = new QuestionBroker({ notify: () => {} });
    const input = ask();
    const pending = broker.request(input);
    const [request] = broker.list();
    const invalid = [
      {}, { ...answers(), extra: { selected: ['Blue'] } },
      { ...answers(), color: { selected: ['Unknown'] } },
      { ...answers(), color: { selected: ['Blue', 'Blue'] } },
      { ...answers(), color: { selected: ['Blue', 'Red'] } },
      { ...answers(), color: { selected: ['Blue'], text: 'Other' } },
      { ...answers(), color: { selected: [] } },
      { ...answers(), color: { selected: [], text: '  ' } },
    ];
    for (const answer of invalid) {
      expect(() => broker.respond({ sessionId: input.sessionId, requestId: request.id, decision: 'submit', answers: answer })).toThrow();
      expect(broker.list()).toHaveLength(1);
    }
    broker.respond({ sessionId: input.sessionId, requestId: request.id, decision: 'cancel' });
    expect(await pending).toEqual({ decision: 'cancel', reason: 'Question cancelled by user', source: 'user' });
  });

  it('supports single Other and secret text-only forms, but refuses text when Other is disabled', async () => {
    const broker = new QuestionBroker({ notify: () => {} });
    const input = ask();
    input.questions = [input.questions[0], { id: 'secret', header: 'Code', question: 'Enter code', options: [], multiSelect: false, allowOther: true, isSecret: true }];
    const pending = broker.request(input);
    const [request] = broker.list();
    broker.respond({ sessionId: input.sessionId, requestId: request.id, decision: 'submit', answers: {
      color: { selected: [], text: 'Green' }, secret: { selected: [], text: 'test-only-answer' },
    } });
    expect(await pending).toMatchObject({ decision: 'submit', answers: { color: { text: 'Green' }, secret: { text: 'test-only-answer' } } });
    const closed = ask(); closed.questions[0].allowOther = false;
    const second = broker.request(closed);
    expect(() => broker.respond({ sessionId: closed.sessionId, requestId: broker.list()[0].id, decision: 'submit',
      answers: { ...answers(), color: { selected: [], text: 'Green' } } })).toThrow('custom answer');
    broker.dispose(); await second;
  });

  it('validates provider question IDs and options before adding a pending request', () => {
    const broker = new QuestionBroker({ notify: () => {} });
    for (const input of [
      { ...ask(), questions: [] },
      { ...ask(), questions: [ask().questions[0], ask().questions[0]] },
      { ...ask(), questions: [{ ...ask().questions[0], options: [{ label: 'Blue' }, { label: 'Blue' }] }] },
      { ...ask(), questions: [{ ...ask().questions[0], options: [], allowOther: false }] },
      ...['__proto__', 'prototype', 'constructor', 'toString', 'valueOf'].map(id => ({ ...ask(), questions: [{ ...ask().questions[0], id }] })),
    ]) expect(() => broker.request(input)).toThrow();
    expect(broker.list()).toEqual([]);
  });

  it('withdraws only the exact aborted request, leaving another same-session question pending', async () => {
    const broker = new QuestionBroker({ notify: () => {} });
    const input = ask(), controller = new AbortController();
    const first = broker.request(input, { signal: controller.signal }), second = broker.request(input);
    const [withdrawn] = broker.list();
    controller.abort();
    expect(await first).toEqual({ decision: 'cancel', reason: 'Question request withdrawn', source: 'withdrawn' });
    expect(broker.list()).toHaveLength(1);
    expect(() => broker.respond({ sessionId: input.sessionId, requestId: withdrawn.id, decision: 'submit', answers: answers() })).toThrow('no longer pending');
    expect(await broker.request(input, { signal: controller.signal })).toMatchObject({ decision: 'cancel' });
    expect(broker.list()).toHaveLength(1);
    broker.dispose(); await second;
  });

  it('expires requests and rejects an overdue response even before the timer fires', async () => {
    vi.useFakeTimers();
    const broker = new QuestionBroker({ timeoutMs: 500, notify: () => {} });
    const input = ask(), first = broker.request(input);
    await vi.advanceTimersByTimeAsync(500);
    expect(await first).toEqual({ decision: 'cancel', reason: 'Question request expired', source: 'expired' });
    const second = broker.request(input), [request] = broker.list();
    vi.setSystemTime(Date.parse(request.expiresAt));
    expect(() => broker.respond({ sessionId: input.sessionId, requestId: request.id, decision: 'submit', answers: answers() })).toThrow('no longer pending');
    expect(await second).toEqual({ decision: 'cancel', reason: 'Question request expired', source: 'expired' });
    expect(broker.list()).toEqual([]);
    expect(vi.getTimerCount()).toBe(0);
  });

  it('cancels one session and resolves every pending request on shutdown despite a disconnected notifier', async () => {
    vi.useFakeTimers();
    const broker = new QuestionBroker({ notify: () => { throw new Error('disconnected'); } });
    const input = ask(), first = broker.request(input), second = broker.request(input), other = broker.request(ask());
    broker.cancelSession(input.sessionId, 'Session cancelled');
    expect(await first).toMatchObject({ decision: 'cancel', reason: 'Session cancelled' });
    expect(await second).toMatchObject({ decision: 'cancel' });
    expect(broker.list()).toHaveLength(1);
    broker.dispose();
    expect(await other).toMatchObject({ decision: 'cancel', reason: 'Question service stopped' });
    expect(await broker.request(input)).toMatchObject({ decision: 'cancel', reason: 'Question service stopped' });
    expect(broker.list()).toEqual([]);
    expect(vi.getTimerCount()).toBe(0);
  });

  it('rejects malformed RPC decisions and injected fields', () => {
    const base = { sessionId: randomUUID(), requestId: randomUUID() };
    for (const value of [
      { ...base, decision: 'allow' }, { ...base, decision: 'submit' },
      { ...base, decision: 'cancel', answers: {} },
      { ...base, decision: 'submit', answers: answers(), permissionMode: 'bypassPermissions' },
    ]) expect(QuestionRespondParamsSchema.safeParse(value).success).toBe(false);
  });
});
