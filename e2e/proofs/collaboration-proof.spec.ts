import { test, expect, type Page } from '@playwright/test'
import { randomUUID } from 'node:crypto'
import { writeFileSync } from 'node:fs'
import { KodaInstance, createWorkspace, pairScreenshot, requireCodex, requireLiveblocks, send } from './harness'

async function share(page: Page, permission: 'control' | 'view') {
  await page.getByTestId('share-workspace').click()
  await page.getByTestId('share-permission').selectOption(permission)
  await page.getByTestId('create-invitation').click()
  await expect(page.getByTestId('share-invitation')).toBeVisible({ timeout: 40_000 })
  const invitation = await page.getByTestId('share-invitation').inputValue()
  await page.getByRole('dialog', { name: 'Share workspace', exact: true }).getByRole('button', { name: 'Close', exact: true }).click()
  return invitation
}

async function join(page: Page, invitation: string) {
  await page.getByTestId('join-workspace').click()
  await page.getByTestId('join-invitation').fill(invitation)
  await page.getByTestId('join-confirm').click()
  await expect(page.getByTestId('shared-status')).toHaveText('connected', { timeout: 40_000 })
}

test('Liveblocks: two separate instances, live Codex/presence, control relay, enforced view access', async ({ browser }, testInfo) => {
  requireCodex()
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
    await Promise.all([host.start(), guest.start()])
    expect(host.dataDir).not.toBe(guest.dataDir)
    expect(host.rpcPort).not.toBe(guest.rpcPort)
    const workspace = await createWorkspace(a, host, testInfo, false)
    await b.goto(guest.url)
    await a.getByTestId('new-chat-button').click()
    await expect(a.getByTestId('agent-chat-container')).toHaveAttribute('data-session-id', /.+/)
    const sessionId = await a.getByTestId('agent-chat-container').getAttribute('data-session-id')
    roomId = `workspace:${workspace.worktreeId}`
    const controlInvitation = await share(a, 'control')
    await join(b, controlInvitation)
    expect((await guest.rpc<Array<{ roomId: string }>>('collaboration.list'))[0]?.roomId).toBe(roomId)
    expect(await guest.rpc('worktree.listAll')).toEqual([])
    await expect(b.getByTestId('shared-workspace-name')).toHaveText('codex/proof-A')
    await expect(b.getByTestId('shared-permission')).toHaveText('control')
    await expect(b.getByTestId('shared-session')).toContainText('codex')
    await expect(b.getByTestId('shared-presence')).toContainText('User A')
    await expect(a.getByTestId('presence-avatars').getByTitle('User B', { exact: true })).toBeVisible()
    await pairScreenshot(browser, a, b, testInfo, '01-two-instances-control-and-presence')

    await send(a, 'First announce A_STREAM_VISIBLE in an assistant message. Then run a shell command sleeping 5 seconds. Create collaboration.txt containing "HOST_TASK". Finish with A_TASK_FINISHED. Do not commit.')
    await expect(b.getByTestId('shared-running')).toBeVisible()
    await expect(b.getByTestId('shared-message-assistant').filter({ hasText: 'A_STREAM_VISIBLE' })).toBeVisible({ timeout: 120_000 })
    expect((await host.rpc<{ status: string }>('codex.get', { sessionId })).status).toBe('running')
    await pairScreenshot(browser, a, b, testInfo, '02-codex-messages-stream-to-b')
    await expect(b.getByTestId('shared-message-assistant').filter({ hasText: 'A_TASK_FINISHED' })).toBeVisible({ timeout: 150_000 })
    await expect(b.getByTestId('shared-composer')).toBeEnabled()

    const remotePrompt = 'B_RELAY_REQUEST: First announce B_STREAM_VISIBLE. Then run a shell command sleeping 5 seconds. Append "GUEST_TASK" to collaboration.txt. Finish with B_RELAY_FINISHED. Do not commit.'
    await b.getByTestId('shared-composer').fill(remotePrompt)
    await b.getByTestId('shared-send').click()
    await expect(a.locator('[data-message-role="user"]').filter({ hasText: 'B_RELAY_REQUEST' })).toBeVisible()
    await expect(a.locator('[data-message-role="assistant"]').filter({ hasText: 'B_STREAM_VISIBLE' })).toBeVisible({ timeout: 120_000 })
    expect((await host.rpc<{ status: string }>('codex.get', { sessionId })).status).toBe('running')
    await pairScreenshot(browser, a, b, testInfo, '03-b-message-and-live-reply-on-a')
    await expect(a.locator('[data-message-role="assistant"]').filter({ hasText: 'B_RELAY_FINISHED' })).toHaveAttribute('data-message-status', 'complete', { timeout: 150_000 })
    await expect(b.getByTestId('shared-message-assistant').filter({ hasText: 'B_RELAY_FINISHED' })).toBeVisible()
    await pairScreenshot(browser, a, b, testInfo, '04-relay-complete-on-both')

    // Replace B's joined grant with a view invitation; establish the live room again.
    await b.getByRole('button', { name: 'Back to local workspaces' }).click()
    const revokedCommand = await guest.rpc<Record<string, unknown>>('collaboration.prepareRelay', { roomId, sessionId, content: 'REVOKED_CONTROL_MUST_NOT_RUN', requestId: randomUUID() })
    const viewInvitation = await share(a, 'view')
    await join(b, viewInvitation)
    await expect(b.getByTestId('view-only-notice')).toBeVisible()
    await expect(b.getByTestId('shared-composer')).toBeDisabled()
    await expect(b.getByTestId('shared-send')).toBeDisabled()
    const revoked = await host.rpc<{ error: string }>('collaboration.relay', { ...revokedCommand, worktreeId: workspace.worktreeId })
    expect(revoked.error).toContain('revoked')
    const before = await host.rpc<Array<unknown>>('codex.getMessages', { sessionId })
    const joined = await guest.rpc<Array<{ roomId: string }>>('collaboration.list')
    expect(joined).toHaveLength(1)
    const signed = await guest.rpc<Record<string, unknown>>('collaboration.prepareRelay', { roomId: joined[0]!.roomId, sessionId, content: 'VIEW_MUST_NOT_RUN', requestId: randomUUID() })
    const rejection = await host.rpc<{ error: string }>('collaboration.relay', { ...signed, worktreeId: workspace.worktreeId })
    expect(rejection.error).toContain('View permission cannot send messages')
    expect((await host.rpc<Array<unknown>>('codex.getMessages', { sessionId })).length).toBe(before.length)
    await pairScreenshot(browser, a, b, testInfo, '05-view-permission-enforced')

    await send(a, 'Without tools, reply exactly VIEW_CAN_STILL_WATCH.')
    await expect(b.getByTestId('shared-message-assistant').filter({ hasText: 'VIEW_CAN_STILL_WATCH' })).toBeVisible({ timeout: 120_000 })
    await pairScreenshot(browser, a, b, testInfo, '06-viewer-still-receives-live-messages')
    writeFileSync(testInfo.outputPath('evidence.json'), JSON.stringify({
      hostPids: host.pids, guestPids: guest.pids, separateDataDirectories: host.dataDir !== guest.dataDir,
      sessionId, worktreeId: workspace.worktreeId, viewBackendRejection: rejection.error, revokedControlRejection: revoked.error,
      proof: 'Two real sidecars, separate SQLite databases and browser contexts, real Codex SDK and Liveblocks cloud. Side-by-side PNGs compose unmodified captures of both browser windows; not native Tauri webview automation.',
    }, null, 2))
  } finally {
    await Promise.all([contextA.close(), contextB.close()])
    await Promise.all([host.cleanup(), guest.cleanup()])
    // Only delete the exact Liveblocks room created by this isolated proof.
    if (roomId) {
      const response = await fetch(`https://api.liveblocks.io/v2/rooms/${encodeURIComponent(roomId)}`, {
        method: 'DELETE', headers: { Authorization: `Bearer ${process.env.LIVEBLOCKS_SECRET_KEY}` },
      })
      if (!response.ok && response.status !== 404) throw new Error(`Proof room cleanup failed (${response.status}) for ${roomId}`)
    }
  }
})
