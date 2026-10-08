import { test, expect, type BrowserContext, type Page } from '@playwright/test'
import { execFileSync } from 'node:child_process'
import { readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { randomUUID } from 'node:crypto'
import { KodaInstance, requireClaude, requireLiveblocks } from '../proofs/harness'
import { renderCollaborationVideo } from './render-collaboration-video'

type App = Page
type Session = { status: string; threadId: string }

async function submit(app: App, message: string, remote = false) {
  const input = app.getByTestId(remote ? 'shared-composer' : 'chat-input')
  await input.fill(message)
  // Let a viewer read the actual request before it is submitted.
  await new Promise(resolve => setTimeout(resolve, 1600))
  if (remote) await app.getByTestId('shared-send').click()
  else await input.press('Enter')
}

test('record real Claude collaboration between two independent Koda instances', async ({ browser }, testInfo) => {
  requireLiveblocks()
  const host = new KodaInstance('A', testInfo)
  const guest = new KodaInstance('B', testInfo)
  const setup = await browser.newContext({ viewport: { width: 1440, height: 1000 } })
  let recordingA: BrowserContext | undefined
  let recordingB: BrowserContext | undefined
  let pageA: Page | undefined
  let pageB: Page | undefined
  let syncWallTime = 0
  let roomId: string | undefined
  let successful = false
  let stopPresentation = false
  let presentation: Promise<void> | undefined
  const milestones: Array<{ chapter: string; at: string }> = []
  let evidence: Record<string, unknown> = {}
  try {
    console.log('[Video] Preparing isolated instances and launch-plan workspace')
    host.createRepo()
    // This fixture performs real file validation; its delay makes a live turn
    // visible long enough for a teammate to watch the result arrive.
    writeFileSync(join(host.repoPath, 'verify-launch.mjs'), [
      "import { readFile } from 'node:fs/promises'",
      "const plan = await readFile('launch-plan.md', 'utf8')",
      "if (!plan.includes('#') || plan.trim().split('\\n').length < 4) throw new Error('Launch plan needs a heading and checklist')",
      "console.log('Checking the launch plan…')",
      'await new Promise(resolve => setTimeout(resolve, 5000))',
      "console.log('Launch plan check passed.')",
      '',
    ].join('\n'))
    execFileSync('git', ['add', 'verify-launch.mjs'], { cwd: host.repoPath })
    execFileSync('git', ['commit', '-m', 'Add a launch checklist validator'], { cwd: host.repoPath, stdio: 'pipe' })
    const starts = await Promise.allSettled([host.start(), guest.start()])
    const startupErrors = starts.flatMap(result => result.status === 'rejected' ? [result.reason] : [])
    if (startupErrors.length) throw new AggregateError(startupErrors, 'Video instances failed to start')
    await requireClaude(host)
    const prepare = await setup.newPage()
    await prepare.goto(host.url)
    await prepare.getByTestId('new-workspace-button').click()
    await prepare.getByPlaceholder('my-workspace').fill('Shared launch plan')
    await prepare.getByRole('button', { name: '[+] CREATE', exact: true }).click()
    await prepare.getByTestId('connect-repo-button').click()
    await prepare.getByTestId('repository-path').fill(host.repoPath)
    await prepare.getByRole('button', { name: '[+ ADD GIT REPOSITORY]', exact: true }).click()
    await prepare.getByTestId('branch-name-input').fill('collaboration/launch-plan')
    await prepare.getByTestId('create-branch-button').click()
    await expect(prepare.getByTestId('agent-chat-container')).toBeVisible()
    await prepare.getByTestId('agent-select').selectOption('claude')
    await prepare.getByTestId('start-chat-button').click()
    await expect(prepare.getByTestId('agent-chat-container')).toHaveAttribute('data-session-id', /.+/)
    const sessionId = (await prepare.getByTestId('agent-chat-container').getAttribute('data-session-id'))!
    const workspaceUrl = prepare.url()
    const worktreeId = new URL(workspaceUrl).pathname.split('/').at(-1)!
    const worktree = await host.rpc<{ worktreePath: string }>('worktree.get', { worktreeId })
    host.trackClaudeSession(sessionId, worktree.worktreePath)
    roomId = `workspace:${worktreeId}`
    const share = await host.rpc<{ invitation: string }>('collaboration.share', { worktreeId, permission: 'control' })
    await guest.rpc('collaboration.join', { invitation: share.invitation })
    await setup.close()
    console.log('[Video] Workspace and private invitation ready; opening recorded windows')

    recordingA = await browser.newContext({ viewport: { width: 960, height: 960 }, recordVideo: { dir: testInfo.outputPath('raw-A'), size: { width: 960, height: 960 } } })
    recordingB = await browser.newContext({ viewport: { width: 960, height: 960 }, recordVideo: { dir: testInfo.outputPath('raw-B'), size: { width: 960, height: 960 } } })
    const a = await recordingA.newPage()
    const b = await recordingB.newPage()
    pageA = a; pageB = b
    await Promise.all([a.setContent('<body style="margin:0;background:black"></body>'), b.setContent('<body style="margin:0;background:black"></body>')])
    await a.waitForTimeout(500)
    // The raw-only color marker aligns both recordings before real app navigation.
    syncWallTime = Date.now()
    await Promise.all([a, b].map(page => page.locator('body').evaluate(element => { element.style.background = '#00ff00' })))
    await a.waitForTimeout(250)
    await Promise.all([a.goto(workspaceUrl, { waitUntil: 'domcontentloaded' }), b.goto(guest.url, { waitUntil: 'domcontentloaded' })])
    console.log('[Video] Both independent browser pages loaded')
    async function chapter(text: string) {
      milestones.push({ chapter: text, at: new Date().toISOString() })
      console.log(`[Video] ${text}`)
    }
    async function reopenGuest() {
      await b.getByTestId('join-workspace').click()
      await b.getByRole('button', { name: /Open shared workspace/ }).click()
      await expect(b.getByTestId('shared-status')).toHaveText('connected')
    }
    await expect(a.getByTestId('agent-chat-container')).toHaveAttribute('data-session-id', sessionId)
    await expect(b.getByTestId('join-workspace')).toBeVisible()
    console.log('[Video] Host session restored; checking browser security')
    for (const [label, app] of [['A', a], ['B', b]] as const) {
      const browserSecurity = await app.locator('body').evaluate(element => ({
        url: element.ownerDocument.location.href,
        secureContext: element.ownerDocument.defaultView?.isSecureContext,
        randomUUID: typeof element.ownerDocument.defaultView?.crypto.randomUUID,
      }))
      console.log(`[Video] ${label} browser context: ${JSON.stringify(browserSecurity)}`)
      expect(browserSecurity).toMatchObject({ secureContext: true, randomUUID: 'function' })
    }
    await a.getByTestId('chat-input').press('Control+k')
    await a.getByTestId('command-palette-input').fill('Toggle Right Sidebar')
    await a.getByRole('option', { name: /Toggle Right Sidebar/ }).click()
    await expect(a.getByTestId('right-panel')).toBeHidden()
    await reopenGuest()
    await expect(b.getByTestId('shared-presence')).toContainText('User A')
    await expect(a.getByTestId('presence-avatars').getByTitle('User B', { exact: true })).toBeVisible()
    await expect(b.getByTestId('shared-session')).toContainText('claude')
    // Use real UI controls to keep verbose tool arguments folded and scroll the
    // conversations as messages arrive. No app content is replaced or hidden.
    presentation = (async () => {
      while (!stopPresentation) {
        try {
          for (const button of await a.locator('[data-message-role="assistant"] button[aria-expanded="true"]').all()) {
            await button.click({ timeout: 500 })
          }
          await a.getByTestId('message-list').evaluate(element => { element.scrollTop = element.scrollHeight })
          if (await b.getByTestId('shared-messages').count()) {
            await b.getByTestId('shared-messages').evaluate(element => { element.scrollTop = element.scrollHeight })
          }
        } catch { /* A frame can be reloading while B changes permission. */ }
        await new Promise(resolve => setTimeout(resolve, 500))
      }
    })()
    await chapter('1 · Both people see the same Claude session')
    await a.waitForTimeout(2500)

    await chapter('2 · A asks Claude to draft a launch plan')
    await submit(a, 'First say "I’m drafting the launch plan." Create launch-plan.md with a heading and three short checklist items for a small product launch. Run node verify-launch.mjs to validate it. Finish with "The launch plan is ready for review." Do not commit.')
    await expect(b.getByTestId('shared-message-assistant').filter({ hasText: 'drafting the launch plan' })).toBeVisible({ timeout: 150_000 })
    expect((await host.rpc<Session>('claude.get', { sessionId })).status).toBe('running')
    await chapter('Claude’s reply streams to both people live')
    await expect(a.locator('[data-message-role="assistant"]').last()).toHaveAttribute('data-message-status', 'complete', { timeout: 150_000 })
    await expect(b.getByTestId('shared-message-assistant').filter({ hasText: 'ready for review' })).toBeVisible()
    await expect(b.getByTestId('shared-composer')).toBeEnabled()
    expect(readFileSync(join(worktree.worktreePath, 'launch-plan.md'), 'utf8')).toContain('#')
    await a.waitForTimeout(2000)

    await chapter('3 · B sends a follow-up to A’s Claude session')
    await submit(b, 'Please add a rollback step to launch-plan.md. First say "I’m adding a rollback step for the team." Run node verify-launch.mjs again, then finish with "The rollback step is included." Do not commit.', true)
    await expect(b.getByTestId('shared-composer')).toHaveValue('')
    const relayed = a.locator('[data-message-role="user"]').filter({ hasText: 'Please add a rollback step' })
    await expect(relayed).toBeVisible()
    await expect(relayed).toContainText('User B')
    await expect(a.locator('[data-message-role="assistant"]').last()).toContainText('adding a rollback step', { timeout: 150_000 })
    expect((await host.rpc<Session>('claude.get', { sessionId })).status).toBe('running')
    await chapter('A sees B’s message and Claude’s live reply')
    await expect(a.locator('[data-message-role="assistant"]').last()).toHaveAttribute('data-message-status', 'complete', { timeout: 150_000 })
    await expect(b.getByTestId('shared-message-assistant').filter({ hasText: 'rollback step is included' })).toBeVisible()
    expect(readFileSync(join(worktree.worktreePath, 'launch-plan.md'), 'utf8')).toMatch(/roll\s*back/i)
    await a.waitForTimeout(2500)

    await chapter('4 · A changes B’s access to view only')
    // Issue the replacement grant without ever displaying bearer invitations in
    // the recording. The complete UI invitation flow is covered by the proof.
    await b.getByRole('button', { name: 'Back to local workspaces' }).click()
    const oldControl = await guest.rpc<Record<string, unknown>>('collaboration.prepareRelay', { roomId, sessionId, requestId: randomUUID(), content: 'This revoked request must never execute' })
    const view = await host.rpc<{ invitation: string }>('collaboration.share', { worktreeId, permission: 'view' })
    await guest.rpc('collaboration.join', { invitation: view.invitation })
    // Refresh the actual app so its joined-workspace query picks up the new grant.
    await b.reload({ waitUntil: 'domcontentloaded' })
    await reopenGuest()
    await expect(b.getByTestId('view-only-notice')).toBeVisible()
    await expect(b.getByTestId('shared-composer')).toBeDisabled()
    await expect(b.getByTestId('shared-send')).toBeDisabled()
    const revoked = await host.rpc<{ error: string }>('collaboration.relay', { ...oldControl, worktreeId })
    expect(revoked.error).toContain('revoked')
    const denied = await guest.rpc<Record<string, unknown>>('collaboration.prepareRelay', { roomId, sessionId, requestId: randomUUID(), content: 'This view-only request must never execute' })
    const rejection = await host.rpc<{ error: string }>('collaboration.relay', { ...denied, worktreeId })
    expect(rejection.error).toContain('View permission cannot send messages')
    await a.waitForTimeout(2500)
    await chapter('B can still watch, but cannot send messages')
    await submit(a, 'Without tools, summarize the agreed launch checklist in one short sentence beginning "The launch plan now covers". Include the rollback step.')
    await expect(b.getByTestId('shared-message-assistant').filter({ hasText: 'The launch plan now covers' })).toBeVisible({ timeout: 150_000 })
    await expect(a.locator('[data-message-role="assistant"]').last()).toHaveAttribute('data-message-status', 'complete')
    await expect.poll(async () => (await host.rpc<Session>('claude.get', { sessionId })).status).toBe('idle')
    await expect(b.getByTestId('shared-composer')).toBeDisabled()
    await chapter('Same workspace. Live collaboration. Enforced permissions.')
    await a.waitForTimeout(5000)
    await Promise.all([a.screenshot({ path: testInfo.outputPath('final-A.png') }), b.screenshot({ path: testInfo.outputPath('final-B.png') })])
    evidence = {
      agent: 'claude', sessionId, worktreeId, hostPids: host.pids, guestPids: guest.pids,
      separateDataDirectories: host.dataDir !== guest.dataDir,
      threadId: (await host.rpc<Session>('claude.get', { sessionId })).threadId,
      viewBackendRejection: rejection.error, revokedControlRejection: revoked.error,
      launchPlan: readFileSync(join(worktree.worktreePath, 'launch-plan.md'), 'utf8'), milestones,
      recording: 'Two continuous Playwright recordings of independent Koda browser contexts, sidecars and databases with real Claude and Liveblocks. Browser UI, not native Tauri. A shared color marker before app navigation synchronizes the original recordings, which are composed side by side with titles and chapter captions. No simulated agent output or screenshots. Invitations prepared outside recording; permission grants replaced through the real host API without exposing invitation text.',
    }
    writeFileSync(testInfo.outputPath('evidence.json'), JSON.stringify({
      ...evidence, status: 'recorded', workflowStatus: 'passed', videoStatus: 'pending',
      chapters: milestones.map(item => ({ chapter: item.chapter, atSeconds: Math.max(0, (Date.parse(item.at) - syncWallTime) / 1000 - 0.4) })),
      files: { webmA: testInfo.outputPath('user-A.raw.webm'), webmB: testInfo.outputPath('user-B.raw.webm'), mp4: testInfo.outputPath('collaboration.mp4') },
    }, null, 2))
    successful = true
  } catch (error) {
    await Promise.allSettled([pageA?.screenshot({ path: testInfo.outputPath('failure-A.png'), timeout: 5000 }), pageB?.screenshot({ path: testInfo.outputPath('failure-B.png'), timeout: 5000 })])
    throw error
  } finally {
    stopPresentation = true
    const videoA = pageA?.video()
    const videoB = pageB?.video()
    const cleanupErrors: unknown[] = []
    for (const cleanup of [
      async () => { await presentation },
      () => setup.close(),
      async () => { await recordingA?.close() },
      async () => { await recordingB?.close() },
      async () => { if (videoA) await videoA.saveAs(testInfo.outputPath('user-A.raw.webm')) },
      async () => { if (videoB) await videoB.saveAs(testInfo.outputPath('user-B.raw.webm')) },
      () => host.cleanup(), () => guest.cleanup(),
      async () => {
        if (!roomId) return
        const response = await fetch(`https://api.liveblocks.io/v2/rooms/${encodeURIComponent(roomId)}`, { method: 'DELETE', headers: { Authorization: `Bearer ${process.env.LIVEBLOCKS_SECRET_KEY}` }, signal: AbortSignal.timeout(15_000) })
        if (!response.ok && response.status !== 404) throw new Error(`Video room cleanup failed (${response.status})`)
      },
    ]) {
      try { await cleanup() } catch (error) { cleanupErrors.push(error) }
    }
    if (cleanupErrors.length) throw new AggregateError(cleanupErrors, 'Collaboration video cleanup failed')
  }
  if (successful) {
    await renderCollaborationVideo(testInfo.outputDir, browser)
    await testInfo.attach('Claude collaboration video', { path: testInfo.outputPath('collaboration.mp4'), contentType: 'video/mp4' })
  }
})
