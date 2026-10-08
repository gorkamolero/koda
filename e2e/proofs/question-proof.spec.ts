import { test, expect, type BrowserContext, type Page } from '@playwright/test'
import { existsSync, writeFileSync } from 'node:fs'
import { randomUUID } from 'node:crypto'
import { KodaInstance, createWorkspace, requireClaude, requireCodex, screenshot, send } from './harness'

type Agent = 'codex' | 'claude'
type Session = { status: string; permissionMode: string; threadId: string }
type QuestionRequest = { id: string; sessionId: string; questions: Array<{ id: string; header: string; question: string; options: Array<{ label: string }>; multiSelect: boolean; allowOther: boolean }> }

function questionPrompt(agent: Agent, cancel = false) {
  const tool = agent === 'claude' ? 'AskUserQuestion' : 'request_user_input'
  const colour = { ...(agent === 'codex' ? { id: 'colour', isOther: true, isSecret: false } : { multiSelect: false }), header: 'Colour', question: 'Which colour?', options: [{ label: 'Blue', description: 'A blue accent.' }, { label: 'Green', description: 'A green accent.' }] }
  const note = { ...(agent === 'codex' ? { id: 'note', isOther: true, isSecret: false } : { multiSelect: false }), header: 'Note', question: 'Which note?', options: [{ label: 'Plain', description: 'A plain note.' }, { label: 'Detailed', description: 'A detailed note.' }] }
  const details = { header: 'Details', question: 'Which details?', multiSelect: true, options: [{ label: 'Short', description: 'Keep it brief.' }, { label: 'Illustrated', description: 'Include pictures.' }] }
  const questions = cancel ? [colour] : agent === 'claude' ? [colour, details, note] : [colour, note]
  return `This is an interactive form integration test. Immediately invoke your built-in ${tool} tool with exactly this questions array: ${JSON.stringify(questions)}. Do not read files, run commands, or ask in ordinary prose. This tool is available in this session even though tool permissions are bypassed. Wait for the actual tool answer; never answer it yourself. ${cancel ? 'After receiving an answer reply KODA_UNEXPECTED_CONTINUATION.' : 'After the tool returns, reply KODA_QUESTIONS_OK followed by the actual received answers, including any custom text. Do not print that marker until the human has answered.'}`
}

async function pending(page: Page, instance: KodaInstance, sessionId: string, agent: Agent) {
  await expect(page.getByTestId('question-card')).toHaveCount(1, { timeout: 120_000 })
  const requests = await instance.rpc<QuestionRequest[]>('question.list', { sessionId })
  expect(requests).toHaveLength(1)
  expect(requests[0]!.sessionId).toBe(sessionId)
  await expect(page.getByTestId('question-card')).toHaveAttribute('data-request-id', requests[0]!.id)
  await expect(page.getByTestId('stop-agent-button')).toBeEnabled()
  await expect(page.getByTestId('permission-mode-select')).toBeDisabled()
  expect((await instance.rpc<Session>(`${agent}.get`, { sessionId })).status).toBe('running')
  return requests[0]!
}

for (const agent of ['codex', 'claude'] as const) {
  test(`${agent} questions: bypass waits → reload → answer → cancel → stop`, async ({ browser }, testInfo) => {
    if (agent === 'codex') requireCodex()
    const instance = new KodaInstance(`questions-${agent}`, testInfo)
    let context: BrowserContext | undefined
    const outcomes: Record<string, unknown> = { agent }
    try {
      context = await browser.newContext({ viewport: { width: 1440, height: 1000 } })
      instance.createRepo()
      await instance.start()
      if (agent === 'claude') await requireClaude(instance)
      const page = await context.newPage()
      const workspace = await createWorkspace(page, instance, testInfo, false)
      await page.getByTestId('agent-select').selectOption(agent)
      await expect(page.getByTestId('permission-mode-select')).toHaveValue('bypassPermissions')
      const models = await instance.rpc<Array<{ model: string; isDefault?: boolean }>>(`${agent}.models`)
      const choice = agent === 'claude' ? models.find(model => model.model === 'sonnet') : models.find(model => model.isDefault)
      if (choice) await page.getByTestId(`${agent}-model-select`).selectOption(choice.model)
      await page.getByTestId('start-chat-button').click()
      await expect(page.getByTestId('agent-chat-container')).toHaveAttribute('data-session-id', /.+/)
      const sessionId = (await page.getByTestId('agent-chat-container').getAttribute('data-session-id'))!
      if (agent === 'claude') instance.trackClaudeSession(sessionId, workspace.worktreePath)
      else instance.trackCodexSession(sessionId, workspace.worktreePath)
      outcomes.sessionId = sessionId
      outcomes.worktreePath = workspace.worktreePath

      await send(page, questionPrompt(agent))
      const first = await pending(page, instance, sessionId, agent)
      expect(first.questions).toHaveLength(agent === 'claude' ? 3 : 2)
      await expect(page.getByTestId('question-submit')).toBeDisabled()
      expect(await page.getByTestId('question-card').locator('input:checked').count()).toBe(0)
      const holdUntil = Date.now() + 5000
      while (Date.now() < holdUntil) {
        expect(await instance.rpc('question.list', { sessionId })).toEqual([first])
        expect((await instance.rpc<Session>(`${agent}.get`, { sessionId })).status).toBe('running')
        await page.waitForTimeout(500)
      }
      outcomes.bypassWaitsForHuman = true
      await expect(instance.rpc('question.respond', { sessionId: randomUUID(), requestId: first.id, decision: 'cancel' })).rejects.toThrow('no longer pending')
      await expect(instance.rpc('question.respond', { sessionId, requestId: first.id, decision: 'submit', answers: {} })).rejects.toThrow('Answer every question')
      expect(await instance.rpc('question.list', { sessionId })).toEqual([first])
      outcomes.wrongSessionAndIncompleteAnswersRejected = true
      await screenshot(page, testInfo, '01-pending-form-in-bypass')
      await page.getByRole('group', { name: 'Colour', exact: true }).getByRole('radio', { name: /^Blue/ }).check()
      await page.reload()
      await expect(page.getByTestId('question-card')).toHaveAttribute('data-request-id', first.id)
      await expect(page.getByTestId('question-submit')).toBeDisabled()
      expect(await page.getByTestId('question-card').locator('input:checked').count()).toBe(0)
      outcomes.pendingRestoredDraftDiscardedOnReload = true
      // Long forms scroll independently; Stop remains reachable at a small height.
      await page.setViewportSize({ width: 1100, height: 720 })
      await expect(page.getByTestId('stop-agent-button')).toBeInViewport()
      await screenshot(page, testInfo, '02-restored-form-compact-window')
      await page.getByRole('group', { name: 'Colour', exact: true }).getByRole('radio', { name: /^Blue/ }).check()
      if (agent === 'claude') {
        const details = page.getByRole('group', { name: 'Details', exact: true })
        await details.getByRole('checkbox', { name: /^Short/ }).check()
        await details.getByRole('checkbox', { name: /^Illustrated/ }).check()
      }
      const note = page.getByRole('group', { name: 'Note', exact: true })
      await note.getByRole('radio', { name: 'Other', exact: true }).check()
      await note.getByRole('textbox', { name: 'Other answer for Note', exact: true }).fill('KODA_NOTE_731')
      await expect(page.getByTestId('question-submit')).toBeEnabled()
      await page.getByTestId('question-submit').click()
      await expect.poll(async () => (await instance.rpc<Session>(`${agent}.get`, { sessionId })).status, { timeout: 120_000 }).toBe('idle')
      expect(await instance.rpc('question.list', { sessionId })).toEqual([])
      await expect(page.getByTestId('question-card')).toHaveCount(0)
      const reply = page.locator('[data-message-role="assistant"]').last()
      await expect(reply).toContainText('KODA_QUESTIONS_OK')
      await expect(reply).toContainText('Blue')
      await expect(reply).toContainText('KODA_NOTE_731')
      if (agent === 'claude') { await expect(reply).toContainText('Short'); await expect(reply).toContainText('Illustrated') }
      outcomes.providerReceivedSelectionsAndCustomText = true
      await expect(instance.rpc('question.respond', { sessionId, requestId: first.id, decision: 'cancel' })).rejects.toThrow('no longer pending')
      await screenshot(page, testInfo, '03-provider-acknowledged-answers')

      await send(page, questionPrompt(agent, true))
      const cancelled = await pending(page, instance, sessionId, agent)
      await page.getByTestId('question-cancel').click()
      await expect.poll(async () => (await instance.rpc<Session>(`${agent}.get`, { sessionId })).status, { timeout: 30_000 }).toBe('cancelled')
      expect(await instance.rpc('question.list', { sessionId })).toEqual([])
      await expect(page.getByTestId('question-card')).toHaveCount(0)
      await expect(page.locator('[data-message-role="assistant"]').last()).toContainText('Stopped.')
      await expect(instance.rpc('question.respond', { sessionId, requestId: cancelled.id, decision: 'cancel' })).rejects.toThrow('no longer pending')
      outcomes.formCancelStopsTurn = true
      await screenshot(page, testInfo, '04-cancelled-form')

      await send(page, questionPrompt(agent, true))
      await pending(page, instance, sessionId, agent)
      await page.getByTestId('stop-agent-button').click()
      await expect.poll(async () => (await instance.rpc<Session>(`${agent}.get`, { sessionId })).status, { timeout: 30_000 }).toBe('cancelled')
      expect(await instance.rpc('question.list', { sessionId })).toEqual([])
      await expect(page.getByTestId('question-card')).toHaveCount(0)
      outcomes.toolbarStopWithdrawsQuestion = true
      outcomes.threadId = (await instance.rpc<Session>(`${agent}.get`, { sessionId })).threadId
      await screenshot(page, testInfo, '05-stopped-pending-form')
    } finally {
      const cleanupErrors: unknown[] = []
      for (const cleanup of [() => context?.close(), () => instance.cleanup()]) {
        try { await cleanup() } catch (error) { cleanupErrors.push(error) }
      }
      outcomes.appFixtureRemoved = !existsSync(instance.root)
      writeFileSync(testInfo.outputPath('question-evidence.json'), JSON.stringify(outcomes, null, 2))
      if (cleanupErrors.length) throw new AggregateError(cleanupErrors, 'Question proof cleanup failed')
    }
  })
}
