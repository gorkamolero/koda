import { ApprovalCard, Button } from '@koda/ui'
import { useEffect, useRef, useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { onNotification, rpcRequest } from '@/lib/tauri'
import type { ApprovalRequest } from '@/lib/rpc'

/** The agent's permission requests. A view-only collaborator sees them without the buttons enabled. */
export function ApprovalRequests({ sessionId, readOnly = false, hostName }: { sessionId: string; readOnly?: boolean; hostName?: string | null }) {
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
    const scopeState = scopeRef
    return () => { scopeState.current++; stop?.() }
  }, [sessionId, queryClient])

  const respond = async (request: ApprovalRequest, decision: 'allow' | 'deny') => {
    if (readOnly || request.sessionId !== sessionId || respondingRef.current.has(request.id)) return
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

  return <div data-testid="approval-requests" aria-live="polite" className="border-b border-border-subtle px-4 py-2 text-xs space-y-2">
    {isPending && <p className="text-text-muted">Checking for approval requests…</p>}
    {error && <div role="alert" className="text-status-error">Unable to load approval requests: {error.message} <Button variant="link" className="h-auto p-0 text-xs" onClick={() => void refetch()}>Retry</Button></div>}
    {responseError && <p role="alert" className="text-status-error">{responseError}</p>}
    {pending.map(request => {
      const item = request.input.item as { command?: string; changes?: Array<{ path?: string; kind?: string | { type?: string } }> } | undefined
      const network = request.input.networkApprovalContext as { host?: string; protocol?: string } | undefined
      const command = request.input.command ?? item?.command
      const filePath = request.input.file_path ?? request.input.path ?? request.input.cwd
      const busy = responding.has(request.id)
      return <ApprovalCard
        key={request.id}
        appearance="terminal"
        data-testid="approval-card"
        data-approval-id={request.id}
        aria-label={`Permission request: ${request.toolName}`}
        title={`Permission needed · ${request.toolName}`}
        reason={request.reason || 'The agent needs your approval to continue.'}
        state={readOnly ? 'read-only' : 'actionable'}
        hostName={hostName || undefined}
        busy={busy}
        command={typeof command === 'string' ? command : undefined}
        path={typeof filePath === 'string' ? filePath : undefined}
        network={network?.host ? `${network.protocol ? `${network.protocol}://` : ''}${network.host}` : undefined}
        files={Array.isArray(item?.changes) ? item.changes.map(change => ({ kind: typeof change.kind === 'string' ? change.kind : change.kind?.type || 'Change', path: change.path || 'Path not supplied' })) : undefined}
        details={JSON.stringify(request.input, null, 2)}
        onApprove={() => void respond(request, 'allow')}
        onDeny={() => void respond(request, 'deny')}
      />
    })}
  </div>
}
