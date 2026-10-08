import { test, expect, type BrowserContext, type Page } from '@playwright/test'
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, rmdirSync, writeFileSync } from 'node:fs'
import { homedir } from 'node:os'
import { join } from 'node:path'
import { KodaInstance, createWorkspace, requireClaude, requireCodex, screenshot, send } from './harness'

type Agent = 'codex' | 'claude'
type Session = { status: string; permissionMode: string; threadId: string }
type Pending = { id: string; sessionId: string; input: Record<string, unknown> }

// OS temporary directories are allowed by Codex workspace-write. This exact
// throwaway directory is deliberately outside them and contains only markers.
function outsideFixture() {
  const parent = join(homedir(), '.koda-approval-proofs')
  const createdParent = !existsSync(parent)
  mkdirSync(parent, { recursive: true })
  const root = mkdtempSync(join(parent, 'owned-'))
  return { root, cleanup() { rmSync(root, { recursive: true, force: true }); if (createdParent) { try { rmdirSync(parent) } catch { /* another owned proof may still use it */ } } } }
}

function writePrompt(path: string, marker: string, agent: Agent, bypass = false) {
  const command = agent === 'codex' ? `/usr/bin/touch '${path}'` : `printf '%s\\n' '${marker}' > '${path}'`
  const mode = bypass ? 'This chat explicitly has bypass permissions selected; run normally.' : 'Try normal tool execution first. If sandboxing blocks the command, request permission to run this exact command outside the sandbox with no reusable command rule. Wait for the tool approval; do not ask an ordinary chat question.'
  return `Use only your shell tool to execute this exact command: ${command}. This is a disposable permission-test marker outside the worktree. Do not read any other files. ${mode} If permission is denied, stop without retrying, writing by another tool, or choosing another path. After success reply ${marker}_DONE; after denial reply PERMISSION_DENIED.`
}

async function pendingRequest(page: Page, instance: KodaInstance, sessionId: string, path: string) {
  await expect(page.getByTestId('approval-card')).toHaveCount(1, { timeout: 120_000 })
  const pending = await instance.rpc<Pending[]>('approval.list', { sessionId })
  expect(pending).toHaveLength(1)
  expect(pending[0]!.sessionId).toBe(sessionId)
  expect(JSON.stringify(pending[0]!.input)).toContain(path)
  await expect(page.getByTestId('approval-card')).toContainText(path)
  await expect(page.getByTestId('stop-agent-button')).toBeEnabled()
  await expect(page.getByTestId('permission-mode-select')).toBeDisabled()
  return pending[0]!
}

async function idle(instance: KodaInstance, agent: Agent, sessionId: string, expectedStatus = 'idle') {
  await expect.poll(async () => (await instance.rpc<Session>(`${agent}.get`, { sessionId }, { timeoutMs: 5000 })).status, { timeout: 120_000 }).toBe(expectedStatus)
  expect(await instance.rpc('approval.list', { sessionId })).toEqual([])
}

for (const agent of ['codex', 'claude'] as const) {
  test(`${agent} permissions: pending reload → approve → deny → stop → saved bypass restart`, async ({ browser }, testInfo) => {
    if (agent === 'codex') requireCodex()
    const instance = new KodaInstance(`permissions-${agent}`, testInfo)
    const outside = outsideFixture()
    let context: BrowserContext | undefined
    const outcomes: Record<string, unknown> = { agent, outsideFixture: outside.root }
    try {
      context = await browser.newContext({ viewport: { width: 1440, height: 1000 } })
      instance.createRepo()
      await instance.start()
      if (agent === 'claude') await requireClaude(instance)
      let page = await context.newPage()
      await page.goto(`${instance.url}/settings`)
      await expect(page.getByTestId('default-permission-mode-select')).toHaveValue('bypassPermissions')
      await expect(page.getByTestId('command-guard-recommendation')).toContainText('Requires separate setup')
      await screenshot(page, testInfo, '00-new-conversation-permissions-setting')
      await page.getByTestId('default-permission-mode-select').selectOption('default')
      await page.reload()
      await expect(page.getByTestId('default-permission-mode-select')).toHaveValue('default')
      const workspace = await createWorkspace(page, instance, testInfo, false)
      await page.getByTestId('agent-select').selectOption(agent)
      await expect(page.getByTestId('permission-mode-select')).toHaveValue('default')
      // Use a live discovered model, not an obsolete hard-coded model ID.
      const models = await instance.rpc<Array<{ model: string; isDefault?: boolean }>>(`${agent}.models`)
      const choice = agent === 'claude' ? models.find(model => model.model === 'sonnet') : models.find(model => model.isDefault)
      if (choice) await page.getByTestId(`${agent}-model-select`).selectOption(choice.model)
      await page.getByTestId('start-chat-button').click()
      await expect(page.getByTestId('agent-chat-container')).toHaveAttribute('data-session-id', /.+/)
      const sessionId = (await page.getByTestId('agent-chat-container').getAttribute('data-session-id'))!
      if (agent === 'claude') instance.trackClaudeSession(sessionId, workspace.worktreePath)
      outcomes.sessionId = sessionId
      expect((await instance.rpc<Session>(`${agent}.get`, { sessionId })).permissionMode).toBe('default')

      const allowed = join(outside.root, 'allowed.txt')
      await send(page, writePrompt(allowed, 'KODA_ALLOWED', agent))
      const first = await pendingRequest(page, instance, sessionId, allowed)
      expect(existsSync(allowed)).toBe(false)
      // Keep the real provider request unresolved long enough to distinguish
      // Koda's later decision from a rule, hook, or external prompt response.
      const holdUntil = Date.now() + 10_000
      while (Date.now() < holdUntil) {
        expect(await instance.rpc<Pending[]>('approval.list', { sessionId })).toEqual([first])
        expect(existsSync(allowed)).toBe(false)
        await page.waitForTimeout(500)
      }
      outcomes.approvalHeldWithoutExternalDecision = true
      await screenshot(page, testInfo, '01-awaiting-outside-write-approval')
      await page.reload()
      await expect(page.getByTestId('approval-card')).toHaveAttribute('data-approval-id', first.id)
      await expect(page.getByTestId('approval-card')).toContainText(allowed)
      await expect(page.getByTestId('stop-agent-button')).toBeEnabled()
      await screenshot(page, testInfo, '02-pending-request-restored-on-reload')
      await page.getByTestId('approval-allow').click()
      await idle(instance, agent, sessionId)
      expect(readFileSync(allowed, 'utf8').trim()).toBe(agent === 'codex' ? '' : 'KODA_ALLOWED')
      await expect(page.getByTestId('approval-card')).toHaveCount(0)
      outcomes.approvedFileWritten = true
      await screenshot(page, testInfo, '03-approved-write-completed')

      const denied = join(outside.root, 'denied.txt')
      await send(page, writePrompt(denied, 'KODA_DENIED', agent))
      await pendingRequest(page, instance, sessionId, denied)
      await page.getByTestId('approval-deny').click()
      await idle(instance, agent, sessionId)
      expect(existsSync(denied)).toBe(false)
      await expect(page.getByTestId('approval-card')).toHaveCount(0)
      outcomes.deniedFileAbsent = true
      await screenshot(page, testInfo, '04-denied-write-not-executed')

      const cancelled = join(outside.root, 'cancelled.txt')
      await send(page, writePrompt(cancelled, 'KODA_CANCELLED', agent))
      await pendingRequest(page, instance, sessionId, cancelled)
      await page.getByTestId('stop-agent-button').click()
      await idle(instance, agent, sessionId, 'cancelled')
      await expect(page.locator('[data-message-role="assistant"]').last()).toContainText('Stopped.')
      expect(existsSync(cancelled)).toBe(false)
      await expect(page.getByTestId('approval-card')).toHaveCount(0)
      outcomes.cancelledFileAbsent = true
      await screenshot(page, testInfo, '05-stopped-while-waiting')

      await expect(page.getByTestId('permission-mode-select')).toBeEnabled()
      await page.getByTestId('permission-mode-select').selectOption('bypassPermissions')
      await expect(page.getByTestId('bypass-permissions-notice')).toContainText('collaborators with control')
      await expect.poll(async () => (await instance.rpc<Session>(`${agent}.get`, { sessionId })).permissionMode).toBe('bypassPermissions')
      const original = await instance.rpc<Session>(`${agent}.get`, { sessionId })
      expect(original.threadId).toBeTruthy()
      const storage = await context.storageState()
      const oldPids = instance.pids
      await context.close()
      await instance.stop()
      await instance.start()
      expect(instance.pids.every(pid => !oldPids.includes(pid))).toBe(true)
      context = await browser.newContext({ viewport: { width: 1440, height: 1000 }, storageState: storage })
      page = await context.newPage()
      await page.goto(instance.url)
      await page.getByRole('link').filter({ hasText: `codex/proof-permissions-${agent}` }).click()
      await expect(page.getByTestId('agent-chat-container')).toHaveAttribute('data-session-id', sessionId)
      await expect(page.getByTestId('permission-mode-select')).toHaveValue('bypassPermissions')
      expect((await instance.rpc<Session>(`${agent}.get`, { sessionId })).threadId).toBe(original.threadId)
      outcomes.modeRestoredAfterProcessRestart = true
      await screenshot(page, testInfo, '06-bypass-mode-restored-after-restart')

      const bypassed = join(outside.root, 'bypassed.txt')
      let bypassRequestedApproval = false
      await send(page, writePrompt(bypassed, 'KODA_BYPASSED', agent, true))
      await expect.poll(async () => {
        const pending = await instance.rpc<Pending[]>('approval.list', { sessionId })
        bypassRequestedApproval ||= pending.length > 0
        const session = await instance.rpc<Session>(`${agent}.get`, { sessionId })
        return existsSync(bypassed) && session.status === 'idle'
      }, { timeout: 120_000 }).toBe(true)
      expect(bypassRequestedApproval).toBe(false)
      expect(readFileSync(bypassed, 'utf8').trim()).toBe(agent === 'codex' ? '' : 'KODA_BYPASSED')
      await expect(page.getByTestId('approval-card')).toHaveCount(0)
      outcomes.bypassFileWrittenWithoutApproval = true
      outcomes.threadId = original.threadId
      await screenshot(page, testInfo, '07-explicit-bypass-completed')
      // A new chat follows the configured preference, not the previous chat's override.
      await page.getByTestId('new-chat-button').click()
      await page.getByTestId('agent-select').selectOption(agent)
      await expect(page.getByTestId('permission-mode-select')).toHaveValue('default')
      outcomes.newChatFollowsConfiguredDefault = true
    } finally {
      const cleanupErrors: unknown[] = []
      for (const cleanup of [() => context?.close(), () => instance.cleanup(), () => outside.cleanup()]) {
        try { await cleanup() } catch (error) { cleanupErrors.push(error) }
      }
      outcomes.outsideFixtureRemoved = !existsSync(outside.root)
      outcomes.appFixtureRemoved = !existsSync(instance.root)
      writeFileSync(testInfo.outputPath('permission-evidence.json'), JSON.stringify(outcomes, null, 2))
      if (cleanupErrors.length) throw new AggregateError(cleanupErrors, 'Permission proof cleanup failed')
    }
  })
}
