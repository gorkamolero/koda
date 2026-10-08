import { test, expect } from '@playwright/test'
import { readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { KodaInstance, createWorkspace, requireCodex, screenshot, send } from './harness'

test('Codex: repository → isolated worktree → live task → diff → checkpoint → process restart', async ({ browser }, testInfo) => {
  requireCodex()
  const instance = new KodaInstance('codex', testInfo)
  let context = await browser.newContext({ viewport: { width: 1440, height: 1000 } })
  try {
    instance.createRepo()
    await instance.start()
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
    const availableModels = await instance.rpc<Array<{ model: string; isDefault: boolean }>>('codex.models')
    expect(availableModels.length).toBeGreaterThan(0)
    const selectedModel = (availableModels.find(model => model.isDefault) ?? availableModels[0])!.model
    await page.getByTestId('codex-model-select').selectOption(selectedModel)
    await expect(page.getByTestId('codex-model-select')).toHaveValue(selectedModel)
    await send(page, 'First announce KODA_STREAM_STARTED in an assistant message. Then run a shell command that sleeps 4 seconds. Edit README.md to append the exact line "Codex changed this isolated worktree." and create proof.txt containing "KODA_PROOF_FILE". Do not commit. Finish with KODA_PROOF_DONE.')
    await expect(page.getByTestId('agent-chat-container')).toHaveAttribute('data-session-id', /.+/)
    const sessionId = await page.getByTestId('agent-chat-container').getAttribute('data-session-id')
    await expect(page.getByTestId('message-list')).toContainText('First announce KODA_STREAM_STARTED')
    await screenshot(page, testInfo, '03-codex-session-task')

    const assistant = page.locator('[data-message-role="assistant"]')
    // Must be visible while the actual backend turn is still running.
    await expect(assistant.filter({ hasText: 'KODA_STREAM_STARTED' }).first()).toBeVisible({ timeout: 120_000 })
    expect((await instance.rpc<{ status: string }>('codex.get', { sessionId })).status).toBe('running')
    await screenshot(page, testInfo, '04-live-agent-message')
    await expect(assistant.filter({ hasText: 'KODA_PROOF_DONE' }).last()).toHaveAttribute('data-message-status', 'complete', { timeout: 150_000 })
    expect(notifications.some(item => item.method === 'message' && item.type !== 'result')).toBe(true)

    expect(readFileSync(join(instance.repoPath, 'README.md'), 'utf8')).not.toContain('Codex changed')
    expect(readFileSync(join(workspace.worktreePath, 'README.md'), 'utf8')).toContain('Codex changed this isolated worktree.')
    expect(readFileSync(join(workspace.worktreePath, 'proof.txt'), 'utf8')).toContain('KODA_PROOF_FILE')
    await page.getByTestId('right-tab-changes').click()
    await expect(page.getByTestId('diff-file-readme-md')).toBeVisible()
    await expect(page.getByTestId('diff-file-proof-txt')).toBeVisible()
    await page.getByTestId('diff-file-readme-md').click()
    await expect(page.getByTestId('selected-file-diff')).toContainText('+Codex changed this isolated worktree.')
    await screenshot(page, testInfo, '05-changed-files-and-diff')

    await page.getByTestId('save-checkpoint').click()
    await expect(page.getByTestId('checkpoint-saved')).toBeVisible()
    const checkpointId = await page.getByTestId('checkpoint-saved').getAttribute('data-checkpoint-id')
    expect((await instance.rpc<{ model: string }>('codex.get', { sessionId })).model).toBe(selectedModel)
    const checkpoints = await instance.rpc<Array<{ id: string }>>('checkpoint.list', { worktreeId: workspace.worktreeId })
    expect(checkpoints.some(checkpoint => checkpoint.id === checkpointId)).toBe(true)
    await screenshot(page, testInfo, '06-checkpoint-saved')

    const originalThreadId = (await instance.rpc<{ threadId: string }>('codex.get', { sessionId })).threadId
    expect(originalThreadId).toBeTruthy()
    const oldPids = instance.pids
    const storage = await context.storageState()
    await context.close()
    await instance.stop()
    await instance.start()
    expect(instance.pids.every(pid => !oldPids.includes(pid))).toBe(true)
    context = await browser.newContext({ viewport: { width: 1440, height: 1000 }, storageState: storage })
    page = await context.newPage()
    await page.goto(instance.url)
    await page.getByRole('link').filter({ hasText: 'codex/proof-codex' }).click()
    await expect(page.getByTestId('agent-chat-container')).toHaveAttribute('data-session-id', sessionId!)
    await expect(page.locator('[data-message-role="assistant"]').filter({ hasText: 'KODA_PROOF_DONE' })).toBeVisible()
    await expect(page.getByTestId('codex-model-select')).toHaveValue(selectedModel)
    expect((await instance.rpc<{ threadId: string }>('codex.get', { sessionId })).threadId).toBe(originalThreadId)
    const restored = await instance.rpc<Array<{ id: string }>>('checkpoint.list', { worktreeId: workspace.worktreeId })
    expect(restored.some(checkpoint => checkpoint.id === checkpointId)).toBe(true)
    await screenshot(page, testInfo, '07-restarted-workspace-session')

    // Continue the persisted Codex thread after restart, rather than merely reading SQLite.
    const assistantCountBeforeResume = await page.locator('[data-message-role="assistant"]').count()
    await send(page, 'Without using tools, reply with the exact name of the new file you created in your previous turn.')
    await expect(page.locator('[data-message-role="assistant"]')).toHaveCount(assistantCountBeforeResume + 1, { timeout: 120_000 })
    await expect(page.locator('[data-message-role="assistant"]').last()).toContainText('proof.txt', { timeout: 120_000 })
    await expect(page.locator('[data-message-role="assistant"]').last()).toHaveAttribute('data-message-status', 'complete')
    await expect.poll(async () => (await instance.rpc<{ status: string }>('codex.get', { sessionId })).status).toBe('idle')
    expect((await instance.rpc<{ threadId: string }>('codex.get', { sessionId })).threadId).toBe(originalThreadId)
    await screenshot(page, testInfo, '08-resumed-codex-thread')
    const evidence = { selectedModel, originalThreadId, workspaceId: workspace.workspaceId, worktreeId: workspace.worktreeId, sessionId, checkpointId, oldPids, restartedPids: instance.pids, notifications, proof: 'Real Codex SDK, real git worktree, real HTTP/WebSocket sidecar, React UI, full frontend and sidecar process restart. Chromium is not the macOS Tauri webview.' }
    writeFileSync(testInfo.outputPath('evidence.json'), JSON.stringify(evidence, null, 2))
  } finally {
    await context.close()
    await instance.cleanup()
  }
})
