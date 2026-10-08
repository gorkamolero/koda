import { test, expect } from '@playwright/test'
import { readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { KodaInstance, createWorkspace, requireClaude, screenshot, send } from './harness'

test('Claude: select agent/model → live task → diff → checkpoint → process restart → resumed session', async ({ browser }, testInfo) => {
  const instance = new KodaInstance('claude', testInfo)
  let context = await browser.newContext({ viewport: { width: 1440, height: 1000 } })
  try {
    instance.createRepo()
    await instance.start()
    await requireClaude(instance)
    let page = await context.newPage()
    const notifications: Array<{ method: string; type?: string; receivedAt: number }> = []
    page.on('websocket', socket => socket.on('framereceived', frame => {
      try {
        const value = JSON.parse(String(frame.payload))
        notifications.push({ method: value.method, type: value.params?.event?.type, receivedAt: Date.now() })
      } catch { /* non-JSON is not evidence */ }
    }))
    const workspace = await createWorkspace(page, instance, testInfo)
    await expect(page.getByTestId('active-agent')).toHaveText('Codex')
    await page.getByTestId('agent-select').selectOption('claude')
    await expect(page.getByTestId('active-agent')).toHaveText('Claude')
    await page.getByTestId('permission-mode-select').selectOption('bypassPermissions')
    const availableModels = await instance.rpc<Array<{ model: string; isDefault?: boolean }>>('claude.models')
    expect(availableModels.length).toBeGreaterThan(0)
    const explicitModels = availableModels.filter(model => model.model !== 'default')
    expect(explicitModels.length).toBeGreaterThan(0)
    const selectedModel = (explicitModels.find(model => model.model === 'sonnet') ?? explicitModels.find(model => model.isDefault) ?? explicitModels[0])!.model
    await page.getByTestId('claude-model-select').selectOption(selectedModel)
    await expect(page.getByTestId('claude-model-select')).toHaveValue(selectedModel)
    await screenshot(page, testInfo, '03-claude-agent-and-model')
    await send(page, 'First announce KODA_CLAUDE_STREAM_STARTED in an assistant message. Then run a shell command that sleeps 5 seconds. Edit README.md to append the exact line "Claude changed this isolated worktree." and create claude-proof.txt containing "KODA_CLAUDE_PROOF_FILE". Do not commit. Finish with KODA_CLAUDE_PROOF_DONE.')
    await expect(page.getByTestId('agent-chat-container')).toHaveAttribute('data-session-id', /.+/)
    const sessionId = await page.getByTestId('agent-chat-container').getAttribute('data-session-id')
    instance.trackClaudeSession(sessionId!, workspace.worktreePath)
    await expect(page.getByTestId('agent-select')).toBeDisabled()
    await expect(page.getByTestId('message-list')).toContainText('First announce KODA_CLAUDE_STREAM_STARTED')

    const assistant = page.locator('[data-message-role="assistant"]')
    await expect(assistant.filter({ hasText: 'KODA_CLAUDE_STREAM_STARTED' }).first()).toBeVisible({ timeout: 120_000 })
    expect((await instance.rpc<{ status: string }>('claude.get', { sessionId })).status).toBe('running')
    await screenshot(page, testInfo, '04-live-claude-message')
    await expect(assistant.filter({ hasText: 'KODA_CLAUDE_PROOF_DONE' }).last()).toHaveAttribute('data-message-status', 'complete', { timeout: 150_000 })
    expect(notifications.some(item => item.method === 'message' && item.type !== 'result')).toBe(true)

    expect(readFileSync(join(instance.repoPath, 'README.md'), 'utf8')).not.toContain('Claude changed')
    expect(readFileSync(join(workspace.worktreePath, 'README.md'), 'utf8')).toContain('Claude changed this isolated worktree.')
    expect(readFileSync(join(workspace.worktreePath, 'claude-proof.txt'), 'utf8')).toContain('KODA_CLAUDE_PROOF_FILE')
    await page.getByTestId('right-tab-changes').click()
    await expect(page.getByTestId('diff-file-readme-md')).toBeVisible()
    await expect(page.getByTestId('diff-file-claude-proof-txt')).toBeVisible()
    await page.getByTestId('diff-file-readme-md').click()
    await expect(page.getByTestId('selected-file-diff')).toContainText('+Claude changed this isolated worktree.')
    await screenshot(page, testInfo, '05-claude-changed-files-and-diff')

    await page.getByTestId('save-checkpoint').click()
    await expect(page.getByTestId('checkpoint-saved')).toBeVisible()
    const checkpointId = await page.getByTestId('checkpoint-saved').getAttribute('data-checkpoint-id')
    const original = await instance.rpc<{ agentType: string; model: string; threadId: string; permissionMode: string }>('claude.get', { sessionId })
    expect(original.agentType).toBe('claude')
    expect(original.model).toBe(selectedModel)
    expect(original.permissionMode).toBe('bypassPermissions')
    expect(original.threadId).toBeTruthy()
    expect((await instance.rpc<Array<{ id: string }>>('checkpoint.list', { worktreeId: workspace.worktreeId })).some(checkpoint => checkpoint.id === checkpointId)).toBe(true)
    await screenshot(page, testInfo, '06-claude-checkpoint-saved')

    // Selecting a new chat does not replace the existing engine or transcript.
    await page.getByTestId('new-chat-button').click()
    await expect(page.getByTestId('agent-chat-container')).toHaveAttribute('data-session-id', '')
    await expect(page.getByTestId('agent-select')).toHaveValue('codex')
    await expect(page.getByTestId('agent-select')).toBeEnabled()
    await page.getByTestId(`tab-session-${sessionId}`).click()
    await expect(page.getByTestId('agent-select')).toHaveValue('claude')
    await expect(page.locator('[data-message-role="assistant"]').filter({ hasText: 'KODA_CLAUDE_PROOF_DONE' })).toBeVisible()

    const oldPids = instance.pids
    const storage = await context.storageState()
    await context.close()
    await instance.stop()
    await instance.start()
    expect(instance.pids.every(pid => !oldPids.includes(pid))).toBe(true)
    context = await browser.newContext({ viewport: { width: 1440, height: 1000 }, storageState: storage })
    page = await context.newPage()
    await page.goto(instance.url)
    await page.getByRole('link').filter({ hasText: 'codex/proof-claude' }).click()
    await expect(page.getByTestId('agent-chat-container')).toHaveAttribute('data-session-id', sessionId!)
    await expect(page.getByTestId('active-agent')).toHaveText('Claude')
    await expect(page.getByTestId('agent-select')).toBeDisabled()
    await expect(page.locator('[data-message-role="assistant"]').filter({ hasText: 'KODA_CLAUDE_PROOF_DONE' })).toBeVisible()
    await expect(page.getByTestId('claude-model-select')).toHaveValue(selectedModel)
    await expect(page.getByTestId('permission-mode-select')).toHaveValue('bypassPermissions')
    expect((await instance.rpc<{ threadId: string }>('claude.get', { sessionId })).threadId).toBe(original.threadId)
    expect((await instance.rpc<Array<{ id: string }>>('checkpoint.list', { worktreeId: workspace.worktreeId })).some(checkpoint => checkpoint.id === checkpointId)).toBe(true)
    await screenshot(page, testInfo, '07-restarted-claude-workspace-session')

    // Exercise actual Claude resume, not merely a reconstructed SQLite transcript.
    const assistantCountBeforeResume = await page.locator('[data-message-role="assistant"]').count()
    await send(page, 'Without using tools, reply with the exact name of the new file you created in your previous turn.')
    await expect(page.locator('[data-message-role="assistant"]')).toHaveCount(assistantCountBeforeResume + 1, { timeout: 120_000 })
    await expect(page.locator('[data-message-role="assistant"]').last()).toContainText('claude-proof.txt', { timeout: 120_000 })
    await expect(page.locator('[data-message-role="assistant"]').last()).toHaveAttribute('data-message-status', 'complete')
    await expect.poll(async () => (await instance.rpc<{ status: string }>('claude.get', { sessionId })).status).toBe('idle')
    expect((await instance.rpc<{ threadId: string }>('claude.get', { sessionId })).threadId).toBe(original.threadId)
    await screenshot(page, testInfo, '08-resumed-claude-session')
    writeFileSync(testInfo.outputPath('evidence.json'), JSON.stringify({
      selectedModel, permissionMode: original.permissionMode, originalThreadId: original.threadId, workspaceId: workspace.workspaceId, worktreeId: workspace.worktreeId,
      sessionId, checkpointId, oldPids, restartedPids: instance.pids, notifications,
      proof: 'Real Claude Agent SDK with installed Claude CLI authentication, real git worktree, HTTP/WebSocket sidecar, React UI, full frontend and sidecar process restart. Chromium is not the macOS Tauri webview.',
    }, null, 2))
  } finally {
    await context.close()
    await instance.cleanup()
  }
})
