import { useEffect, useRef, useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { onNotification, rpcRequest } from '@/lib/tauri'
import type { ApprovalRequest } from '@/lib/rpc'

/** Local host controls only. Shared workspace viewers never mount this component. */
export function ApprovalRequests({ sessionId }: { sessionId: string }) {
  const queryClient = useQueryClient()
  const scopeRef = useRef(0)
  const respondingRef = useRef(new Set<string>())
  const [responding, setResponding] = useState<Set<string>>(new Set())
  const [responseError, setResponseError] = useState<string | null>(null)
  const queryKey = ['approvals', sessionId]
  const { data: requests = [], isPending, error, refetch } = useQuery({
    queryKey,
    queryFn: () => rpcRequest<ApprovalRequest[]>('approval.list', { sessionId }),
    refetchInterval: 1000,
    retry: false,
  })

  useEffect(() => {
    const scope = ++scopeRef.current
    respondingRef.current = new Set()
    setResponding(new Set())
    setResponseError(null)
    let stop: (() => void) | undefined
    void onNotification<{ sessionId: string }>('approvalChanged', payload => {
      if (scopeRef.current === scope && payload.sessionId === sessionId) {
        void queryClient.invalidateQueries({ queryKey: ['approvals', sessionId] })
      }
    }).then(unlisten => { if (scopeRef.current !== scope) unlisten(); else stop = unlisten })
    return () => { scopeRef.current++; stop?.() }
  }, [sessionId, queryClient])

  const respond = async (request: ApprovalRequest, decision: 'allow' | 'deny') => {
    if (request.sessionId !== sessionId || respondingRef.current.has(request.id)) return
    const scope = scopeRef.current
    respondingRef.current.add(request.id)
    setResponding(new Set(respondingRef.current))
    setResponseError(null)
    try {
      await rpcRequest('approval.respond', { sessionId, approvalId: request.id, decision })
      // Update only the originating chat, even if the user navigated meanwhile.
      queryClient.setQueryData<ApprovalRequest[]>(['approvals', sessionId], current => current?.filter(item => item.id !== request.id) ?? [])
      await queryClient.invalidateQueries({ queryKey: ['approvals', sessionId] })
    } catch (caught) {
      if (scopeRef.current === scope) setResponseError(caught instanceof Error ? caught.message : 'Unable to answer this request')
      void queryClient.invalidateQueries({ queryKey: ['approvals', sessionId] })
    } finally {
      if (scopeRef.current === scope) {
        respondingRef.current.delete(request.id)
        setResponding(new Set(respondingRef.current))
      }
    }
  }

  const pending = requests.filter(request => request.sessionId === sessionId)
  if (!isPending && !error && !responseError && pending.length === 0) return null

  return <div data-testid="approval-requests" aria-live="polite" className="shrink-0 max-h-[40%] overflow-y-auto border-b border-border-subtle px-4 py-2 text-xs space-y-2">
    {isPending && <p className="text-text-muted">Checking for approval requests…</p>}
    {error && <div role="alert" className="text-status-error">Unable to load approval requests: {error.message} <button onClick={() => void refetch()} className="underline">Retry</button></div>}
    {responseError && <p role="alert" className="text-status-error">{responseError}</p>}
    {pending.map(request => {
      const item = request.input.item as { command?: string; changes?: Array<{ path?: string; kind?: string | { type?: string } }> } | undefined
      const network = request.input.networkApprovalContext as { host?: string; protocol?: string } | undefined
      const command = request.input.command ?? item?.command
      const filePath = request.input.file_path ?? request.input.path ?? request.input.cwd
      const busy = responding.has(request.id)
      return <section key={request.id} data-testid="approval-card" data-approval-id={request.id} aria-label={`Permission request: ${request.toolName}`} className="border border-text-accent/40 bg-surface-card p-3 space-y-2">
        <div className="font-medium text-text-primary">Permission needed · {request.toolName}</div>
        <p className="text-text-muted">{request.reason || 'The agent needs your approval to continue.'}</p>
        {typeof command === 'string' && <div><span className="text-text-muted">Command</span><pre data-testid="approval-command" className="mt-1 whitespace-pre-wrap break-all max-h-24 overflow-y-auto">{command}</pre></div>}
        {typeof filePath === 'string' && <p className="break-all"><span className="text-text-muted">Path: </span><span data-testid="approval-path">{filePath}</span></p>}
        {network?.host && <p data-testid="approval-network" className="break-all">Network: {network.protocol ? `${network.protocol}://` : ''}{network.host}</p>}
        {Array.isArray(item?.changes) && <ul data-testid="approval-files" className="space-y-1 break-all">{item.changes.map((change, index) => <li key={index}>{typeof change.kind === 'string' ? change.kind : change.kind?.type || 'Change'}: {change.path || 'Path not supplied'}</li>)}</ul>}
        <details><summary className="cursor-pointer text-text-muted">Request details</summary><pre data-testid="approval-input" className="mt-1 whitespace-pre-wrap break-all max-h-32 overflow-y-auto">{JSON.stringify(request.input, null, 2)}</pre></details>
        <div className="flex flex-wrap gap-2">
          <button data-testid="approval-allow" disabled={busy} onClick={() => void respond(request, 'allow')} className="border border-border-subtle px-3 py-1 hover:text-text-accent disabled:opacity-50">{busy ? 'Sending…' : 'Approve once'}</button>
          <button data-testid="approval-deny" disabled={busy} onClick={() => void respond(request, 'deny')} className="border border-border-subtle px-3 py-1 hover:text-status-error disabled:opacity-50">Deny</button>
        </div>
      </section>
    })}
  </div>
}
