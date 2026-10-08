import { useEffect, useId, useRef, useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { onNotification, rpcRequest } from '@/lib/tauri'
import type { AgentQuestion, QuestionAnswer, QuestionRequest } from '@/lib/rpc'

type DraftAnswer = { selected: string[]; other: boolean; text: string }
const emptyAnswer = (): DraftAnswer => ({ selected: [], other: false, text: '' })

function complete(question: AgentQuestion, answer: DraftAnswer) {
  const written = question.options.length === 0 || answer.other
  if (written && !answer.text.trim()) return false
  if (!question.multiSelect && answer.selected.length > 1) return false
  return answer.selected.length > 0 || (written && question.allowOther && Boolean(answer.text.trim()))
}

function QuestionFields({ question, answer, disabled, onChange }: { question: AgentQuestion; answer: DraftAnswer; disabled: boolean; onChange: (answer: DraftAnswer) => void }) {
  const id = useId()
  const hasOptions = question.options.length > 0
  const select = (label: string, checked: boolean) => {
    onChange(question.multiSelect
      ? { ...answer, selected: checked ? [...answer.selected, label] : answer.selected.filter(value => value !== label) }
      : { selected: [label], other: false, text: '' })
  }
  const textLabel = hasOptions ? `Other answer for ${question.header}` : question.question
  return <fieldset disabled={disabled} className="space-y-2 min-w-0" aria-describedby={`${id}-question`}>
    <legend className="font-medium text-text-primary">{question.header}</legend>
    <p id={`${id}-question`}>{question.question}</p>
    {hasOptions && <p className="text-text-muted">{question.multiSelect ? 'Choose one or more.' : 'Choose one.'}</p>}
    {question.options.map((option, index) => <label key={option.label} className="flex items-start gap-2 cursor-pointer">
      <input type={question.multiSelect ? 'checkbox' : 'radio'} name={id} value={option.label} checked={answer.selected.includes(option.label)} onChange={event => select(option.label, event.target.checked)} aria-describedby={option.description ? `${id}-option-${index}` : undefined} className="mt-0.5 shrink-0" />
      <span className="min-w-0 break-words"><span>{option.label}</span>{option.description && <span id={`${id}-option-${index}`} className="block text-text-muted">{option.description}</span>}</span>
    </label>)}
    {hasOptions && question.allowOther && <label className="flex items-center gap-2 cursor-pointer">
      <input type={question.multiSelect ? 'checkbox' : 'radio'} name={id} checked={answer.other} onChange={event => onChange({ selected: question.multiSelect ? answer.selected : [], other: event.target.checked, text: event.target.checked ? answer.text : '' })} />
      <span>Other</span>
    </label>}
    {question.allowOther && (!hasOptions || answer.other) && <label className="block space-y-1">
      <span>{textLabel}</span>
      {question.isSecret
        ? <input type="password" autoComplete="off" value={answer.text} onChange={event => onChange({ ...answer, text: event.target.value })} className="block w-full bg-transparent border border-border-subtle p-2" />
        : <textarea autoComplete="off" value={answer.text} rows={2} onChange={event => onChange({ ...answer, text: event.target.value })} className="block w-full resize-y bg-transparent border border-border-subtle p-2" />}
    </label>}
  </fieldset>
}

function QuestionForm({ request }: { request: QuestionRequest }) {
  const queryClient = useQueryClient()
  // Drafts live only in this mounted form; they are never persisted or shared.
  const [draft, setDraft] = useState(() => new Map<string, DraftAnswer>())
  const [busy, setBusy] = useState(false)
  const busyRef = useRef(false)
  const mountedRef = useRef(false)
  const [error, setError] = useState<string | null>(null)
  useEffect(() => { mountedRef.current = true; return () => { mountedRef.current = false } }, [])
  const ready = request.questions.length > 0 && request.questions.every(question => complete(question, draft.get(question.id) ?? emptyAnswer()))

  const respond = async (decision: 'submit' | 'cancel') => {
    if (busyRef.current || (decision === 'submit' && !ready)) return
    busyRef.current = true
    setBusy(true)
    setError(null)
    const answers: Record<string, QuestionAnswer> = Object.create(null)
    if (decision === 'submit') for (const question of request.questions) {
      const answer = draft.get(question.id)!
      answers[question.id] = { selected: answer.selected, ...((question.options.length === 0 || answer.other) ? { text: answer.text } : {}) }
    }
    const queryKey = ['questions', request.sessionId]
    try {
      await rpcRequest('question.respond', { sessionId: request.sessionId, requestId: request.id, decision, ...(decision === 'submit' ? { answers } : {}) })
      queryClient.setQueryData<QuestionRequest[]>(queryKey, current => current?.filter(item => item.id !== request.id) ?? [])
      await queryClient.invalidateQueries({ queryKey })
    } catch (caught) {
      if (mountedRef.current) setError(caught instanceof Error ? caught.message : 'Unable to send your answer')
      void queryClient.invalidateQueries({ queryKey })
    } finally {
      if (mountedRef.current) { busyRef.current = false; setBusy(false) }
    }
  }

  return <form data-testid="question-card" data-request-id={request.id} aria-label="Agent question" autoComplete="off" onSubmit={event => { event.preventDefault(); void respond('submit') }} className="border border-text-accent/40 bg-surface-card p-3 space-y-4">
    <div className="font-medium text-text-primary">Your answer is needed</div>
    {request.questions.map(question => <QuestionFields key={question.id} question={question} answer={draft.get(question.id) ?? emptyAnswer()} disabled={busy} onChange={answer => setDraft(current => new Map(current).set(question.id, answer))} />)}
    {!ready && <p className="text-text-muted">Answer every question to continue.</p>}
    {error && <p role="alert" className="text-status-error">{error}</p>}
    <div className="flex flex-wrap gap-2">
      <button type="submit" data-testid="question-submit" disabled={busy || !ready} className="border border-border-subtle px-3 py-1 hover:text-text-accent disabled:opacity-50">{busy ? 'Sending…' : 'Submit answers'}</button>
      <button type="button" data-testid="question-cancel" disabled={busy} onClick={() => void respond('cancel')} className="border border-border-subtle px-3 py-1 hover:text-status-error disabled:opacity-50">Cancel and stop</button>
    </div>
  </form>
}

function SessionQuestions({ sessionId }: { sessionId: string }) {
  const queryClient = useQueryClient()
  const { data: requests = [], isPending, error, refetch } = useQuery({
    queryKey: ['questions', sessionId],
    queryFn: () => rpcRequest<QuestionRequest[]>('question.list', { sessionId }),
    refetchInterval: 1000,
    retry: false,
  })
  useEffect(() => {
    let active = true
    let stop: (() => void) | undefined
    void onNotification<{ sessionId: string }>('questionChanged', payload => {
      if (active && payload.sessionId === sessionId) void queryClient.invalidateQueries({ queryKey: ['questions', sessionId] })
    }).then(unlisten => { if (active) stop = unlisten; else unlisten() })
    return () => { active = false; stop?.() }
  }, [sessionId, queryClient])
  const pending = requests.filter(request => request.sessionId === sessionId)
  if (!isPending && !error && !pending.length) return null
  return <div data-testid="question-requests" aria-live="polite" className="border-b border-border-subtle px-4 py-2 text-xs space-y-2">
    {isPending && <p className="text-text-muted">Checking for questions…</p>}
    {error && <div role="alert" className="text-status-error">Unable to load questions: {error.message} <button onClick={() => void refetch()} className="underline">Retry</button></div>}
    {pending.map(request => <QuestionForm key={request.id} request={request} />)}
  </div>
}

/** Only local AgentChat mounts this control, never a shared workspace guest. */
export function QuestionRequests({ sessionId }: { sessionId: string }) {
  return <SessionQuestions key={sessionId} sessionId={sessionId} />
}
