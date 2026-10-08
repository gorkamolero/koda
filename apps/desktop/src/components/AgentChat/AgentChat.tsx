import { useEffect, useCallback, useRef, useState } from 'react'
import { useSetAtom, useAtomValue } from 'jotai'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import {
  currentWorkspaceIdAtom, messagesAtom, isStreamingAtom, selectedModelAtom,
  planModeAtom, exitPlanModeAtom, pendingPromptAtom,
} from '@/store/chat'
import { rpcRequest, onNotification } from '@/lib/tauri'
import { agentEventsToMessages, type AgentEvent } from '@/lib/agentMessages'
import type { CodingAgent, PermissionMode, RemoteWorktree, Session } from '@/lib/rpc'
import { MessageList } from './MessageList'
import { InputArea } from './InputArea'
import { PlanModeIndicator } from './PlanModeIndicator'
import { useNotifications } from '@/hooks/useNotifications'
import { ApprovalRequests } from './ApprovalRequests'
import { defaultModelAtom, defaultPermissionModeAtom } from '@/store/settings'

interface AgentChatProps {
  worktreeId: string
  sessionId?: string
  agentType?: CodingAgent
  workingDirectory?: string
  onSessionChange?: (sessionId: string, agentType: CodingAgent) => void
  /** Set when this conversation runs on a collaborator's machine. */
  remote?: RemoteWorktree
  /** Shared conversations label each message with its author. */
  collaborative?: boolean
}

const agentNames: Record<CodingAgent, string> = { codex: 'Codex', claude: 'Claude' }
const preferredModel = (agent: CodingAgent) => localStorage.getItem(`settings:${agent}Model`) || 'default'

/** Conversations are hydrated from the sidecar, including after an app restart. */
export function AgentChat({ worktreeId, sessionId, agentType = 'codex', workingDirectory, onSessionChange, remote, collaborative = false }: AgentChatProps) {
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
  const preferredAgent = useAtomValue(defaultModelAtom)
  const defaultPermissions = useAtomValue(defaultPermissionModeAtom)
  const defaultPermissionsRef = useRef(defaultPermissions)
  defaultPermissionsRef.current = defaultPermissions
  const draftPermissionOverrideRef = useRef<PermissionMode | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [checkpointId, setCheckpointId] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [draftAgent, setDraftAgent] = useState<CodingAgent>(() => preferredAgent === 'claude' ? 'claude' : 'codex')
  const agent = sessionId ? agentType : draftAgent
  const agentName = agentNames[agent]
  const [model, setModel] = useState(() => preferredModel(agent))
  const [customModel, setCustomModel] = useState(false)
  const [permissionMode, setPermissionMode] = useState<PermissionMode>(defaultPermissions)
  const [settingsSaving, setSettingsSaving] = useState(false)
  const [stopping, setStopping] = useState(false)
  const [operationError, setOperationError] = useState<string | null>(null)
  const savedSettingsRef = useRef({ model, permissionMode })
  const settingsRequestRef = useRef<object | null>(null)
  const stopRequestRef = useRef<object | null>(null)
  const { data: identity } = useQuery({
    queryKey: ['collaboration', 'identity'],
    queryFn: () => rpcRequest<{ enabled: boolean; machineId: string; name: string }>('collaboration.status'),
    enabled: collaborative && !remote,
    retry: false,
  })
  const hostName = remote?.hostName || 'the host'
  const canSend = !remote || remote.permission === 'control'
  // A shared workspace shows the host's catalog, since the host runs the agent.
  const { data: models = [], error: modelsError, isPending: modelsPending } = useQuery({
    queryKey: [agent, 'models', remote ? worktreeId : 'local'],
    queryFn: () => rpcRequest<Array<{ id: string; model: string; displayName: string; isDefault?: boolean }>>(`${agent}.models`, remote ? { worktreeId } : undefined),
    staleTime: 60_000,
    retry: false,
  })
  const isCustomModel = customModel || (model !== 'default' && !modelsPending && !models.some(option => option.model === model))
  const [loadedSession, setLoadedSession] = useState<string | null>(null)
  const loadedModelSession = useRef<string | undefined>()
  const activeSessionRef = useRef(sessionId)
  const activeAgentRef = useRef(agent)
  const loadingVersionRef = useRef<number | null>(null)
  const sendingRef = useRef<{ sessionId?: string; agent: CodingAgent; version: number } | null>(null)
  const mountedRef = useRef(false)
  const scopeVersionRef = useRef(0)
  const lastRevisionRef = useRef('')

  useEffect(() => {
    mountedRef.current = true
    return () => { mountedRef.current = false }
  }, [])

  useEffect(() => {
    scopeVersionRef.current++
    lastRevisionRef.current = ''
    activeSessionRef.current = sessionId
    activeAgentRef.current = agent
    loadedModelSession.current = undefined
    setLoadedSession(null)
    if (sessionId) draftPermissionOverrideRef.current = null
    const initialMode = sessionId ? 'default' : draftPermissionOverrideRef.current ?? defaultPermissionsRef.current
    setPermissionMode(initialMode)
    savedSettingsRef.current = { model: preferredModel(agent), permissionMode: initialMode }
    settingsRequestRef.current = null
    stopRequestRef.current = null
    setSettingsSaving(false)
    setStopping(false)
    setOperationError(null)
    if (!sessionId) { setModel(preferredModel(agent)); setCustomModel(false) }
    setCurrentWorkspaceId(`${worktreeId}:${sessionId ?? `new:${agent}`}`)
    setMessages([])
    setIsStreaming(false)
    setSelectedModel(agent)
    setError(null)
    return () => {
      scopeVersionRef.current++
      activeSessionRef.current = undefined
      setCurrentWorkspaceId(null)
    }
  }, [worktreeId, sessionId, agent, setCurrentWorkspaceId, setMessages, setIsStreaming, setSelectedModel])

  useEffect(() => {
    if (!sessionId && draftPermissionOverrideRef.current === null) {
      setPermissionMode(defaultPermissions)
      savedSettingsRef.current = { ...savedSettingsRef.current, permissionMode: defaultPermissions }
    }
  }, [defaultPermissions, sessionId])

  const refresh = useCallback(async () => {
    const id = activeSessionRef.current
    const version = scopeVersionRef.current
    if (!mountedRef.current || activeAgentRef.current !== agent || !id || loadingVersionRef.current === version) return
    loadingVersionRef.current = version
    try {
      const [session, events] = await Promise.all([
        rpcRequest<Session>(`${agent}.get`, { sessionId: id }),
        rpcRequest<AgentEvent[]>(`${agent}.getMessages`, { sessionId: id }),
      ])
      // Never apply a response from a previously selected conversation.
      if (!mountedRef.current || scopeVersionRef.current !== version || activeSessionRef.current !== id) return
      if (session.agentType && session.agentType !== agent) throw new Error(`This conversation belongs to ${session.agentType}, not ${agentName}`)
      if (loadedModelSession.current !== id) {
        loadedModelSession.current = id
        setModel(session.model || 'default')
        const savedMode = session.permissionMode === 'bypassPermissions' ? 'bypassPermissions' : 'default'
        setPermissionMode(savedMode)
        savedSettingsRef.current = { model: session.model || 'default', permissionMode: savedMode }
        setCustomModel(false)
      }
      setLoadedSession(id)
      setIsStreaming(session.status === 'running' || sendingRef.current?.sessionId === id)
      setError(null)
      const revision = `${id}:${events.length}:${session.status}`
      if (lastRevisionRef.current === revision) return
      lastRevisionRef.current = revision
      setMessages(agentEventsToMessages(events, agent))
      if (session.status !== 'running') {
        void queryClient.invalidateQueries({ queryKey: ['sessions', worktreeId] })
        void queryClient.invalidateQueries({ queryKey: ['worktree-diff', worktreeId] })
        void queryClient.invalidateQueries({ queryKey: ['workspace-diff-stats', worktreeId] })
      }
    } catch (err) {
      if (mountedRef.current && scopeVersionRef.current === version && activeSessionRef.current === id) setError(err instanceof Error ? err.message : 'Unable to load conversation')
    } finally {
      if (loadingVersionRef.current === version) loadingVersionRef.current = null
    }
  }, [queryClient, worktreeId, agent, agentName, setMessages, setIsStreaming])

  useEffect(() => {
    let disposed = false
    const unlisteners: Array<() => void> = []
    void refresh()
    // Recover missed notifications and reconnects from the durable event log.
    const timer = setInterval(() => void refresh(), 1000)
    for (const method of ['message', 'sessionStatus', 'approvalChanged']) {
      void onNotification<{ sessionId: string }>(method, payload => {
        if (payload.sessionId === activeSessionRef.current) void refresh()
      }).then(stop => { if (disposed) stop(); else unlisteners.push(stop) })
    }
    return () => { disposed = true; clearInterval(timer); for (const stop of unlisteners) stop() }
  }, [refresh, sessionId])

  const updateSettings = useCallback(async (update: { model?: string; permissionMode?: PermissionMode }) => {
    if (isStreaming || stopping || settingsRequestRef.current || (sessionId && loadedSession !== sessionId)) return
    const id = activeSessionRef.current
    const version = scopeVersionRef.current
    const previous = savedSettingsRef.current
    const next = { ...previous, ...update }
    if (update.model !== undefined) setModel(next.model)
    if (update.permissionMode !== undefined) setPermissionMode(next.permissionMode)
    setOperationError(null)
    if (!id) {
      savedSettingsRef.current = next
      if (update.permissionMode !== undefined) draftPermissionOverrideRef.current = next.permissionMode
      if (update.model !== undefined) localStorage.setItem(`settings:${agent}Model`, next.model)
      return
    }
    const request = {}
    settingsRequestRef.current = request
    setSettingsSaving(true)
    const isCurrent = () => mountedRef.current && scopeVersionRef.current === version && activeSessionRef.current === id && activeAgentRef.current === agent
    try {
      await rpcRequest(`${agent}.updateSettings`, { sessionId: id, ...update })
      if (isCurrent()) {
        savedSettingsRef.current = next
        if (update.model !== undefined) localStorage.setItem(`settings:${agent}Model`, next.model)
      }
      void queryClient.invalidateQueries({ queryKey: ['sessions', worktreeId] })
    } catch (caught) {
      if (isCurrent()) {
        setModel(previous.model)
        setPermissionMode(previous.permissionMode)
        setOperationError(caught instanceof Error ? caught.message : 'Unable to save chat settings')
      }
    } finally {
      if (settingsRequestRef.current === request) settingsRequestRef.current = null
      if (isCurrent()) setSettingsSaving(false)
    }
  }, [agent, isStreaming, stopping, sessionId, loadedSession, queryClient, worktreeId])

  const stopTurn = async () => {
    const id = activeSessionRef.current
    if (!id || stopRequestRef.current) return
    const version = scopeVersionRef.current
    const request = {}
    stopRequestRef.current = request
    setStopping(true)
    setOperationError(null)
    try {
      await rpcRequest(`${agent}.cancel`, { sessionId: id })
      void queryClient.invalidateQueries({ queryKey: ['approvals', id] })
      await refresh()
    } catch (caught) {
      if (mountedRef.current && scopeVersionRef.current === version) setOperationError(caught instanceof Error ? caught.message : 'Unable to stop this task')
    } finally {
      if (stopRequestRef.current === request) stopRequestRef.current = null
      if (mountedRef.current && scopeVersionRef.current === version) setStopping(false)
    }
  }

  const handleSendMessage = useCallback(async (content?: string) => {
    if (settingsRequestRef.current || stopping || (sessionId && loadedSession !== sessionId)) return
    if (sendingRef.current && sendingRef.current.sessionId === activeSessionRef.current && sendingRef.current.agent === agent) return
    const request = { sessionId: activeSessionRef.current, agent, version: scopeVersionRef.current }
    sendingRef.current = request
    setIsStreaming(true)
    setError(null)
    try {
      let id = activeSessionRef.current
      if (!id) {
        const created = await rpcRequest<{ id: string; sessionId: string }>(`${agent}.start`, { worktreeId, model: model.trim() || 'default', permissionMode })
        id = created.sessionId ?? created.id
        // Navigation does not cancel an already submitted task, but its result
        // must never select a conversation in the newly opened workspace.
        if (mountedRef.current && scopeVersionRef.current === request.version && activeAgentRef.current === agent && activeSessionRef.current === request.sessionId) {
          activeSessionRef.current = id
          onSessionChange?.(id, agent)
        }
        request.sessionId = id
        void queryClient.invalidateQueries({ queryKey: ['sessions', worktreeId] })
      }
      const author = collaborative && identity ? { authorName: identity.name, authorMachineId: identity.machineId } : {}
      if (content !== undefined) await rpcRequest(`${agent}.send`, { sessionId: id, message: content, stream: true, model: model.trim() || 'default', ...author })
      await refresh()
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unable to send message'
      showToast({ type: 'error', title: agentName, message })
      if (mountedRef.current && activeAgentRef.current === agent && activeSessionRef.current === request.sessionId) {
        setError(message)
        setIsStreaming(false)
      }
    } finally {
      if (sendingRef.current === request) sendingRef.current = null
      void refresh()
    }
  }, [worktreeId, sessionId, loadedSession, agent, agentName, model, permissionMode, stopping, onSessionChange, queryClient, refresh, setIsStreaming, showToast, collaborative, identity])

  useEffect(() => {
    if (pendingPrompt && !settingsSaving && !stopping && (!sessionId || loadedSession === sessionId)) {
      setPendingPrompt(null)
      void handleSendMessage(pendingPrompt)
    }
  }, [pendingPrompt, settingsSaving, stopping, sessionId, loadedSession, handleSendMessage, setPendingPrompt])

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
    <div data-testid="agent-chat-container" data-session-id={sessionId ?? ''} data-agent-type={agent} className="h-full flex flex-col">
      <PlanModeIndicator isActive={planMode.isActive} planTitle={planMode.planTitle} steps={planMode.steps} currentStepIndex={planMode.currentStepIndex} onExitPlanMode={exitPlanMode} />
      <div className="shrink-0 flex flex-wrap items-center gap-3 px-4 py-2 border-b border-dashed border-border-subtle text-xs text-text-muted">
        <span data-testid="active-agent">{agentName}</span>
        <label className="flex items-center gap-1">Agent
          <select aria-label="Agent" data-testid="agent-select" value={agent} disabled={Boolean(sessionId) || isStreaming || settingsSaving || Boolean(remote)} className="bg-surface-card border border-border-subtle p-1" onChange={event => setDraftAgent(event.target.value as CodingAgent)}>
            <option value="codex">Codex</option>
            <option value="claude">Claude</option>
          </select>
        </label>
        <label className="flex items-center gap-1">Model
          <select aria-label={`${agentName} model`} data-testid={`${agent}-model-select`} value={isCustomModel ? 'custom' : model} disabled={isStreaming || stopping || settingsSaving || modelsPending || Boolean(sessionId && loadedSession !== sessionId) || Boolean(remote)} className="bg-surface-card border border-border-subtle p-1" onChange={event => {
            const custom = event.target.value === 'custom'
            setCustomModel(custom)
            if (!custom) void updateSettings({ model: event.target.value })
          }}>
            <option value="default">{agentName} default</option>
            {models.filter(option => option.model !== 'default').map(option => <option key={option.id} value={option.model}>{option.displayName}{option.isDefault ? ' (default)' : ''}</option>)}
            <option value="custom">Custom model…</option>
          </select>
        </label>
        {isCustomModel && <input aria-label={`${agentName} model ID`} data-testid={`${agent}-model-input`} value={model === 'default' ? '' : model} disabled={isStreaming || stopping || settingsSaving || Boolean(sessionId && loadedSession !== sessionId) || Boolean(remote)} placeholder="Model ID" className="w-40 bg-transparent border border-border-subtle p-1" onChange={event => setModel(event.target.value)} onBlur={() => {
          const next = model.trim() || 'default'
          if (next !== savedSettingsRef.current.model) void updateSettings({ model: next })
        }} onKeyDown={event => { if (event.key === 'Enter') event.currentTarget.blur() }} />}
        {/* Permissions, stopping and checkpoints stay with the host of a shared workspace. */}
        {!remote && <label className="flex items-center gap-1">Permissions
          <select aria-label="Permissions" data-testid="permission-mode-select" value={permissionMode} disabled={isStreaming || stopping || settingsSaving || Boolean(sessionId && loadedSession !== sessionId)} onChange={event => void updateSettings({ permissionMode: event.target.value as PermissionMode })} className="bg-surface-card border border-border-subtle p-1">
            <option value="default">Ask when needed</option>
            <option value="bypassPermissions">Bypass permissions</option>
          </select>
        </label>}
        {settingsSaving && <span role="status">Saving settings…</span>}
        {!sessionId && !remote && <button data-testid="start-chat-button" disabled={isStreaming} onClick={() => void handleSendMessage()} className="hover:text-text-primary disabled:opacity-40">Start chat</button>}
        {sessionId && !remote && (isStreaming || stopping) && <button data-testid="stop-agent-button" disabled={stopping} onClick={() => void stopTurn()} className="border border-border-subtle px-2 py-1 text-status-error disabled:opacity-40">{stopping ? 'Stopping…' : 'Stop'}</button>}
        {!remote && <button data-testid="save-checkpoint" disabled={saving || isStreaming || !workingDirectory} onClick={() => void saveCheckpoint()} className="hover:text-text-primary disabled:opacity-40">
          {saving ? 'Saving…' : 'Save checkpoint'}
        </button>}
        {remote && <span data-testid="shared-session-host" className="ml-auto text-text-faint">running on {hostName}</span>}
        {checkpointId && <span data-testid="checkpoint-saved" data-checkpoint-id={checkpointId}>Checkpoint saved</span>}
      </div>
      {permissionMode === 'bypassPermissions' && <p data-testid="bypass-permissions-notice" className="shrink-0 px-4 py-2 text-xs text-text-accent">Tools can run outside this worktree without asking. This also applies to collaborators with control.</p>}
      {agent === 'claude' && permissionMode === 'default' && !remote && <p data-testid="claude-permission-rules-notice" className="shrink-0 px-4 py-2 text-xs text-text-muted">Your configured Claude rules and hooks also apply; a hook can resolve a request automatically.</p>}
      {modelsError && <div role="alert" data-testid="agent-model-error" className="px-4 py-2 text-xs text-status-error">{agentName} models: {modelsError.message}</div>}
      {error && <div role="alert" className="px-4 py-2 text-xs text-status-error">{error}</div>}
      {operationError && <div role="alert" className="px-4 py-2 text-xs text-status-error">{operationError}</div>}
      {sessionId && !remote && <ApprovalRequests key={sessionId} sessionId={sessionId} />}
      <div className="flex-1 overflow-hidden"><MessageList /></div>
      <InputArea
        disabled={settingsSaving || stopping || Boolean(sessionId && loadedSession !== sessionId) || !canSend || Boolean(remote && !sessionId)}
        placeholder={remote ? (canSend ? `message ${hostName}'s ${agentName} session...` : `view only · ${hostName} shared this session to watch`) : undefined}
        onSendMessage={(message) => void handleSendMessage(message)}
      />
    </div>
  )
}
