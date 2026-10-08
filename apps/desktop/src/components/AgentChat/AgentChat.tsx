import { useEffect, useCallback, useRef, useState } from 'react'
import { useSetAtom, useAtomValue } from 'jotai'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import {
  currentWorkspaceIdAtom, messagesAtom, isStreamingAtom, selectedModelAtom,
  planModeAtom, exitPlanModeAtom, pendingPromptAtom,
} from '@/store/chat'
import { rpcRequest, onNotification } from '@/lib/tauri'
import { agentEventsToMessages, type AgentEvent } from '@/lib/agentMessages'
import type { Session } from '@/lib/rpc'
import { MessageList } from './MessageList'
import { InputArea } from './InputArea'
import { PlanModeIndicator } from './PlanModeIndicator'
import { useNotifications } from '@/hooks/useNotifications'

interface AgentChatProps {
  worktreeId: string
  sessionId?: string
  workingDirectory?: string
  onSessionChange?: (sessionId: string) => void
}

/** Conversations are hydrated from the sidecar, including after an app restart. */
export function AgentChat({ worktreeId, sessionId, workingDirectory, onSessionChange }: AgentChatProps) {
  const queryClient = useQueryClient()
  const setCurrentWorkspaceId = useSetAtom(currentWorkspaceIdAtom)
  const setMessages = useSetAtom(messagesAtom)
  const setIsStreaming = useSetAtom(isStreamingAtom)
  const isStreaming = useAtomValue(isStreamingAtom)
  const setSelectedModel = useSetAtom(selectedModelAtom)
  const planMode = useAtomValue(planModeAtom)
  const exitPlanMode = useSetAtom(exitPlanModeAtom)
  const pendingPrompt = useAtomValue(pendingPromptAtom)
  const setPendingPrompt = useSetAtom(pendingPromptAtom)
  const { showToast } = useNotifications()
  const [error, setError] = useState<string | null>(null)
  const [checkpointId, setCheckpointId] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [model, setModel] = useState(() => localStorage.getItem('settings:codexModel') || 'default')
  const [customModel, setCustomModel] = useState(false)
  const { data: models = [] } = useQuery({
    queryKey: ['codex', 'models'],
    queryFn: () => rpcRequest<Array<{ id: string; model: string; displayName: string; isDefault: boolean }>>('codex.models'),
    staleTime: 60_000,
    retry: false,
  })
  const isCustomModel = customModel || (model !== 'default' && !models.some(option => option.model === model))
  const loadedModelSession = useRef<string | undefined>()
  const activeSessionRef = useRef(sessionId)
  const loadingRef = useRef(false)
  const sendingRef = useRef(false)
  const lastRevisionRef = useRef('')

  useEffect(() => {
    activeSessionRef.current = sessionId
    setCurrentWorkspaceId(`${worktreeId}:${sessionId ?? 'new'}`)
    setMessages([])
    setIsStreaming(false)
    setSelectedModel('codex')
    setError(null)
    return () => { setCurrentWorkspaceId(null) }
  }, [worktreeId, sessionId, setCurrentWorkspaceId, setMessages, setIsStreaming, setSelectedModel])

  const refresh = useCallback(async () => {
    const id = activeSessionRef.current
    if (!id || loadingRef.current) return
    loadingRef.current = true
    try {
      const [session, events] = await Promise.all([
        rpcRequest<Session>('codex.get', { sessionId: id }),
        rpcRequest<AgentEvent[]>('codex.getMessages', { sessionId: id }),
      ])
      // Never apply a response from a previously selected conversation.
      if (activeSessionRef.current !== id) return
      if (loadedModelSession.current !== id) {
        loadedModelSession.current = id
        setModel(session.model || 'default')
        setCustomModel(false)
      }
      setIsStreaming(session.status === 'running' || sendingRef.current)
      setError(null)
      const revision = `${id}:${events.length}:${session.status}`
      if (lastRevisionRef.current === revision) return
      lastRevisionRef.current = revision
      setMessages(agentEventsToMessages(events))
      if (session.status !== 'running') {
        void queryClient.invalidateQueries({ queryKey: ['sessions', worktreeId] })
        void queryClient.invalidateQueries({ queryKey: ['worktree-diff', worktreeId] })
        void queryClient.invalidateQueries({ queryKey: ['workspace-diff-stats', worktreeId] })
      }
    } catch (err) {
      if (activeSessionRef.current === id) setError(err instanceof Error ? err.message : 'Unable to load conversation')
    } finally {
      loadingRef.current = false
    }
  }, [queryClient, worktreeId, setMessages, setIsStreaming])

  useEffect(() => {
    let disposed = false
    let unlisten: (() => void) | undefined
    void refresh()
    // Recover missed notifications and reconnects from the durable event log.
    const timer = setInterval(() => void refresh(), 1000)
    void onNotification<{ sessionId: string }>('message', payload => {
      if (payload.sessionId === activeSessionRef.current) void refresh()
    }).then(stop => { if (disposed) stop(); else unlisten = stop })
    return () => { disposed = true; clearInterval(timer); unlisten?.() }
  }, [refresh, sessionId])

  const handleSendMessage = useCallback(async (content: string) => {
    if (sendingRef.current) return
    sendingRef.current = true
    setIsStreaming(true)
    setError(null)
    try {
      let id = activeSessionRef.current
      if (!id) {
        const created = await rpcRequest<{ id: string; sessionId: string }>('codex.start', { worktreeId, model: model.trim() || 'default' })
        id = created.sessionId ?? created.id
        activeSessionRef.current = id
        onSessionChange?.(id)
        void queryClient.invalidateQueries({ queryKey: ['sessions', worktreeId] })
      }
      await rpcRequest('codex.send', { sessionId: id, message: content, stream: true, model: model.trim() || 'default' })
      await refresh()
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unable to send message'
      setError(message)
      showToast({ type: 'error', title: 'Codex', message })
      setIsStreaming(false)
    } finally {
      sendingRef.current = false
      void refresh()
    }
  }, [worktreeId, model, onSessionChange, queryClient, refresh, setIsStreaming, showToast])

  useEffect(() => {
    if (pendingPrompt) {
      setPendingPrompt(null)
      void handleSendMessage(pendingPrompt)
    }
  }, [pendingPrompt, handleSendMessage, setPendingPrompt])

  const saveCheckpoint = async () => {
    if (!workingDirectory) return
    setSaving(true)
    try {
      const checkpoint = await rpcRequest<{ id: string }>('checkpoint.save', {
        worktreeId, repoPath: workingDirectory, turnId: `manual-${crypto.randomUUID()}`,
      })
      setCheckpointId(checkpoint.id)
      void queryClient.invalidateQueries({ queryKey: ['checkpoints', worktreeId] })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to save checkpoint')
    } finally { setSaving(false) }
  }

  return (
    <div data-testid="agent-chat-container" data-session-id={sessionId ?? ''} className="h-full flex flex-col">
      <PlanModeIndicator isActive={planMode.isActive} planTitle={planMode.planTitle} steps={planMode.steps} currentStepIndex={planMode.currentStepIndex} onExitPlanMode={exitPlanMode} />
      <div className="flex items-center gap-3 px-4 py-2 border-b border-dashed border-border-subtle text-xs text-text-muted">
        <span data-testid="active-agent">Codex</span>
        <label className="flex items-center gap-1">Model
          <select aria-label="Codex model" data-testid="codex-model-select" value={isCustomModel ? 'custom' : model} disabled={isStreaming} className="bg-surface-card border border-border-subtle p-1" onChange={event => {
            const custom = event.target.value === 'custom'
            setCustomModel(custom)
            if (!custom) { setModel(event.target.value); localStorage.setItem('settings:codexModel', event.target.value) }
          }}>
            <option value="default">Codex default</option>
            {models.map(option => <option key={option.id} value={option.model}>{option.displayName}{option.isDefault ? ' (default)' : ''}</option>)}
            <option value="custom">Custom model…</option>
          </select>
        </label>
        {isCustomModel && <input aria-label="Codex model ID" data-testid="codex-model-input" value={model === 'default' ? '' : model} disabled={isStreaming} placeholder="Model ID" className="w-40 bg-transparent border border-border-subtle p-1" onChange={event => { setModel(event.target.value); localStorage.setItem('settings:codexModel', event.target.value) }} />}
        <button data-testid="save-checkpoint" disabled={saving || isStreaming || !workingDirectory} onClick={() => void saveCheckpoint()} className="hover:text-text-primary disabled:opacity-40">
          {saving ? 'Saving…' : 'Save checkpoint'}
        </button>
        {checkpointId && <span data-testid="checkpoint-saved" data-checkpoint-id={checkpointId}>Checkpoint saved</span>}
      </div>
      {error && <div role="alert" className="px-4 py-2 text-xs text-status-error">{error}</div>}
      <div className="flex-1 overflow-hidden"><MessageList /></div>
      <InputArea onSendMessage={(message) => void handleSendMessage(message)} />
    </div>
  )
}
