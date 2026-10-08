import { test, expect, type Page } from '@playwright/test'
import { randomUUID } from 'node:crypto'
import { existsSync, writeFileSync } from 'node:fs'
import { join as joinPath } from 'node:path'
import { KodaInstance, createWorkspace, outsideFixture, pairScreenshot, requireClaude, requireCodex, requireLiveblocks, send, writePrompt } from './harness'

async function share(page: Page, permission: 'control' | 'view') {
  await page.getByTestId('share-workspace').click()
  await page.getByTestId(`share-permission-${permission}`).click()
  await page.getByTestId('create-invitation').click()
  await expect(page.getByTestId('share-invitation')).toBeVisible({ timeout: 40_000 })
  const invitation = await page.getByTestId('share-invitation').inputValue()
  await page.getByRole('dialog', { name: 'Share workspace', exact: true }).getByRole('button', { name: '[ESC] CLOSE', exact: true }).click()
  return invitation
}

/** The collaborator joins from their own sidebar and lands in the normal workspace view. */
async function join(page: Page, invitation: string, permission: 'control' | 'view') {
  await page.getByTestId('join-workspace').click()
  await page.getByTestId('join-invitation').fill(invitation)
  await page.getByTestId('join-confirm').click()
  await expect(page.getByTestId('shared-workspace-badge')).toHaveAttribute('data-permission', permission, { timeout: 40_000 })
  await expect(page.getByTestId('agent-chat-container')).toBeVisible()
}

const assistant = (page: Page, text: string) => page.locator('[data-message-role="assistant"]').filter({ hasText: text })

for (const agent of ['codex', 'claude'] as const) {
test(`Liveblocks ${agent}: two separate instances, live streaming/presence, control relay, enforced view access`, async ({ browser }, testInfo) => {
  if (agent === 'codex') requireCodex()
  requireLiveblocks()
  const host = new KodaInstance('A', testInfo)
  const guest = new KodaInstance('B', testInfo)
  const contextA = await browser.newContext({ viewport: { width: 1440, height: 1000 } })
  const contextB = await browser.newContext({ viewport: { width: 1440, height: 1000 } })
  const a = await contextA.newPage()
  const b = await contextB.newPage()
  let roomId: string | undefined
  try {
    host.createRepo()
    const starts = await Promise.allSettled([host.start(), guest.start()])
    const startupErrors = starts.flatMap(result => result.status === 'rejected' ? [result.reason] : [])
    if (startupErrors.length) throw new AggregateError(startupErrors, 'Collaboration instances failed to start')
    if (agent === 'claude') await requireClaude(host)
    expect(host.dataDir).not.toBe(guest.dataDir)
    expect(host.rpcPort).not.toBe(guest.rpcPort)
    const workspace = await createWorkspace(a, host, testInfo, false)
    await b.goto(guest.url)
    await a.getByTestId('new-chat-button').click()
    await a.getByTestId('agent-select').selectOption(agent)
    await a.getByTestId('permission-mode-select').selectOption(agent === 'claude' ? 'bypassPermissions' : 'default')
    await a.getByTestId('start-chat-button').click()
    await expect(a.getByTestId('agent-chat-container')).toHaveAttribute('data-session-id', /.+/)
    const sessionId = await a.getByTestId('agent-chat-container').getAttribute('data-session-id')
    if (agent === 'claude') host.trackClaudeSession(sessionId!, workspace.worktreePath)
    const permissionMode = (await host.rpc<{ permissionMode: string }>(`${agent}.get`, { sessionId })).permissionMode
    expect(permissionMode).toBe(agent === 'claude' ? 'bypassPermissions' : 'default')
    roomId = `workspace:${workspace.worktreeId}`
    const controlInvitation = await share(a, 'control')
    await join(b, controlInvitation, 'control')
    expect((await guest.rpc<Array<{ roomId: string }>>('collaboration.list'))[0]?.roomId).toBe(roomId)
    // B's sidebar keeps B's own (empty) projects and lists A's workspace under Shared.
    expect(await guest.rpc('worktree.listAll')).toEqual([])
    await expect(b.getByTestId('shared-workspace-link')).toContainText('codex/proof-A')
    await expect(b.getByTestId('agent-chat-container')).toHaveAttribute('data-session-id', sessionId!)
    await expect(b.getByTestId('active-agent')).toHaveText(agent === 'claude' ? 'Claude' : 'Codex')
    await expect(b.getByTestId('presence-avatars').getByTitle('User A', { exact: true })).toBeVisible()
    // B sees the host's permission mode; changing it stays with the host.
    await expect(b.getByTestId('permission-mode-select')).toBeDisabled()
    await expect(a.getByTestId('presence-avatars').getByTitle('User B', { exact: true })).toBeVisible()
    // The host's terminal is mirrored read-only, including output typed after B joined.
    await expect(b.getByTestId(/^remote-terminal-tab-/)).toHaveCount(1)
    await a.getByTestId('terminal-viewport').click()
    await a.keyboard.type('echo HOST_TERMINAL_$((40+2))')
    await a.keyboard.press('Enter')
    await expect(b.getByTestId('terminal-viewport')).toContainText('HOST_TERMINAL_42', { timeout: 20_000 })
    await pairScreenshot(browser, a, b, testInfo, '01-two-instances-control-and-presence')

    await send(a, 'First announce A_STREAM_VISIBLE in an assistant message. Then run a shell command sleeping 5 seconds. Create collaboration.txt containing "HOST_TASK". Finish with A_TASK_FINISHED. Do not commit.')
    await expect(assistant(b, 'A_STREAM_VISIBLE')).toBeVisible({ timeout: 120_000 })
    expect((await host.rpc<{ status: string }>(`${agent}.get`, { sessionId })).status).toBe('running')
    await expect(b.getByTestId('chat-input')).toBeDisabled()
    await pairScreenshot(browser, a, b, testInfo, `02-${agent}-messages-stream-to-b`)
    await expect(assistant(b, 'A_TASK_FINISHED')).toBeVisible({ timeout: 150_000 })
    // B sees who wrote each message, and the host's changes panel.
    await expect(b.locator('[data-message-role="user"]').filter({ hasText: 'A_STREAM_VISIBLE' }).getByTestId('message-author')).toHaveText('User A')
    await expect(b.getByTestId('right-panel').getByText('collaboration.txt')).toBeVisible({ timeout: 20_000 })
    await expect(b.getByTestId('chat-input')).toBeEnabled()

    const remotePrompt = 'B_RELAY_REQUEST: First announce B_STREAM_VISIBLE. Then run a shell command sleeping 5 seconds. Append "GUEST_TASK" to collaboration.txt. Finish with B_RELAY_FINISHED. Do not commit.'
    await send(b, remotePrompt)
    await expect(a.locator('[data-message-role="user"]').filter({ hasText: 'B_RELAY_REQUEST' }).getByTestId('message-author')).toHaveText('User B')
    await expect(assistant(a, 'B_STREAM_VISIBLE')).toBeVisible({ timeout: 120_000 })
    expect((await host.rpc<{ status: string }>(`${agent}.get`, { sessionId })).status).toBe('running')
    await pairScreenshot(browser, a, b, testInfo, '03-b-message-and-live-reply-on-a')
    await expect(assistant(a, 'B_RELAY_FINISHED')).toHaveAttribute('data-message-status', 'complete', { timeout: 150_000 })
    await expect(assistant(b, 'B_RELAY_FINISHED')).toBeVisible()
    await pairScreenshot(browser, a, b, testInfo, '04-relay-complete-on-both')

    if (agent === 'codex') {
      // The agent's permission request reaches both screens, and B answers it as A could.
      const outside = outsideFixture()
      try {
        const marker = joinPath(outside.root, 'approved-by-b')
        await send(a, writePrompt(marker, 'B_APPROVED', 'codex'))
        await expect(b.getByTestId('approval-card')).toHaveCount(1, { timeout: 120_000 })
        await expect(a.getByTestId('approval-card')).toHaveCount(1)
        await expect(b.getByTestId('approval-card')).toContainText(marker)
        await pairScreenshot(browser, a, b, testInfo, '04b-permission-request-on-both')
        await b.getByTestId('approval-allow').click()
        await expect(a.getByTestId('approval-card')).toHaveCount(0, { timeout: 30_000 })
        await expect.poll(() => existsSync(marker), { timeout: 120_000 }).toBe(true)
        await expect(assistant(b, 'B_APPROVED_DONE')).toBeVisible({ timeout: 120_000 })
      } finally { outside.cleanup() }
    }

    // Replace B's joined grant with a view invitation; B rejoins from the sidebar.
    const revokedCommand = await guest.rpc<Record<string, unknown>>('collaboration.prepareRelay', { roomId, sessionId, content: 'REVOKED_CONTROL_MUST_NOT_RUN', requestId: randomUUID() })
    const viewInvitation = await share(a, 'view')
    await join(b, viewInvitation, 'view')
    await expect(b.getByTestId('chat-input')).toBeDisabled()
    await expect(b.getByTestId('chat-input')).toHaveAttribute('placeholder', /view only/)
    await expect(b.getByTestId('send-button')).toBeDisabled()
    const revoked = await host.rpc<{ error: string }>('collaboration.relay', { ...revokedCommand, worktreeId: workspace.worktreeId })
    expect(revoked.error).toContain('revoked')
    const before = await host.rpc<Array<unknown>>(`${agent}.getMessages`, { sessionId })
    const joined = await guest.rpc<Array<{ roomId: string }>>('collaboration.list')
    expect(joined).toHaveLength(1)
    const signed = await guest.rpc<Record<string, unknown>>('collaboration.prepareRelay', { roomId: joined[0]!.roomId, sessionId, content: 'VIEW_MUST_NOT_RUN', requestId: randomUUID() })
    const rejection = await host.rpc<{ error: string }>('collaboration.relay', { ...signed, worktreeId: workspace.worktreeId })
    expect(rejection.error).toContain('View permission cannot send messages')
    expect((await host.rpc<Array<unknown>>(`${agent}.getMessages`, { sessionId })).length).toBe(before.length)
    await pairScreenshot(browser, a, b, testInfo, '05-view-permission-enforced')

    await send(a, 'Without tools, reply exactly VIEW_CAN_STILL_WATCH.')
    await expect(assistant(b, 'VIEW_CAN_STILL_WATCH')).toBeVisible({ timeout: 120_000 })
    await pairScreenshot(browser, a, b, testInfo, '06-viewer-still-receives-live-messages')
    const upstreamSession = await host.rpc<{ threadId: string | null }>(`${agent}.get`, { sessionId })
    expect(upstreamSession.threadId).toBeTruthy()
    writeFileSync(testInfo.outputPath('evidence.json'), JSON.stringify({
      hostPids: host.pids, guestPids: guest.pids, separateDataDirectories: host.dataDir !== guest.dataDir,
      agent, permissionMode, sessionId, threadId: upstreamSession.threadId, worktreeId: workspace.worktreeId, viewBackendRejection: rejection.error, revokedControlRejection: revoked.error,
      proof: `Two real sidecars, separate SQLite databases and browser contexts, real ${agent} runtime and Liveblocks cloud. Side-by-side PNGs compose unmodified captures of both browser windows; not native Tauri webview automation.`,
    }, null, 2))
  } finally {
    const cleanupErrors: unknown[] = []
    // Every independently owned resource gets a cleanup attempt even if an
    // earlier browser, native session, or process cleanup failed.
    for (const cleanup of [
      () => contextA.close(), () => contextB.close(),
      () => host.cleanup(), () => guest.cleanup(),
      async () => {
        if (!roomId) return
        const response = await fetch(`https://api.liveblocks.io/v2/rooms/${encodeURIComponent(roomId)}`, {
          method: 'DELETE', headers: { Authorization: `Bearer ${process.env.LIVEBLOCKS_SECRET_KEY}` }, signal: AbortSignal.timeout(15_000),
        })
        if (!response.ok && response.status !== 404) throw new Error(`Proof room cleanup failed (${response.status}) for ${roomId}`)
      },
    ]) {
      try { await cleanup() } catch (error) { cleanupErrors.push(error) }
    }
    if (cleanupErrors.length) throw new AggregateError(cleanupErrors, 'Collaboration proof cleanup failed')
  }
})
}
