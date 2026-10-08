/**
 * Records a real collaboration between two machines for the 16:9 demo video.
 * This machine hosts the workspace and runs Claude; the collaborator machine
 * (reachable over SSH) runs its own Koda and its own browser. Each screen is
 * captured at 60 fps on its own machine and aligned by the measured clock offset.
 */
import { test, expect, chromium, type Browser, type Locator, type Page } from '@playwright/test'
import { execFileSync, spawn, type ChildProcessWithoutNullStreams } from 'node:child_process'
import { copyFileSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { createInterface } from 'node:readline'
import { KodaInstance, requireClaude, requireLiveblocks } from '../proofs/harness'
import { ScreenCapture, encodeFrames, installPointer, type Frame } from './two-machine/capture'

const COLLABORATOR = process.env.KODA_COLLABORATOR_SSH ?? 'cyberyogin'
const HOST_NAME = process.env.KODA_HOST_NAME ?? 'Gorka'
const GUEST_NAME = process.env.KODA_GUEST_NAME ?? 'Alex'
const GUEST_RPC_PORT = 3949
const GUEST_FRONTEND = 'http://localhost:5273'
const BROWSER_PORT = 9333
const FPS = 60
// Each half of the 16:9 frame: 1280×1440 CSS pixels captured at 1920×2160.
const VIEWPORT = { width: 1280, height: 1440 }
const HOST_PROMPT = 'Add a short FAQ section to index.html with three questions about Koda, matching the existing style.'
const GUEST_PROMPT = "Make the hero headline shorter and add a 'Join the beta' button under it."

const ssh = ['-o', 'BatchMode=yes', COLLABORATOR]
const remote = (command: string) => execFileSync('ssh', [...ssh, command], { encoding: 'utf8' }).trim()
const pause = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

/** Runs a remote command and resolves once a line matches; the process keeps running. */
function remoteProcess(command: string, ready: RegExp, timeout = 120_000) {
  const child = spawn('ssh', [...ssh, command], { stdio: ['pipe', 'pipe', 'pipe'] })
  const lines = createInterface({ input: child.stdout })
  let output = ''
  child.stderr.on('data', (chunk) => { output += chunk })
  return new Promise<{ child: ChildProcessWithoutNullStreams; lines: typeof lines }>((resolve, reject) => {
    const timer = setTimeout(() => { child.kill(); reject(new Error(`Timed out waiting for ${ready} from ${command}: ${output}`)) }, timeout)
    const onLine = (line: string) => {
      output += line + '\n'
      if (!ready.test(line)) return
      clearTimeout(timer); lines.off('line', onLine); resolve({ child, lines })
    }
    lines.on('line', onLine)
    child.on('exit', (code) => { clearTimeout(timer); reject(new Error(`${command} exited ${code}: ${output}`)) })
  })
}

/** RPC to the collaborator's sidecar from its own page, so nothing is exposed on the network. */
function guestRpc<T>(page: Page, method: string, params: unknown = {}) {
  return page.evaluate(async ({ port, method, params }) => {
    const response = await fetch(`http://localhost:${port}/rpc`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ jsonrpc: '2.0', id: 1, method, params }) })
    const data = await response.json() as { result: unknown; error?: { message: string } }
    if (data.error) throw new Error(`${method}: ${data.error.message}`)
    return data.result
  }, { port: GUEST_RPC_PORT, method, params }) as Promise<T>
}

/** Glides the visible pointer to an element, then clicks it. */
async function glide(page: Page, target: Locator) {
  const box = await target.boundingBox()
  if (!box) throw new Error('Target is not visible')
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2)
  await pause(800)
  await target.click()
}

/** The right panel (files, changes, terminal) is hidden so each half shows the session. */
async function hideRightPanel(page: Page) {
  if (!await page.getByTestId('right-panel').isVisible()) return
  // The shortcut is ignored while the chat input (focused on load) has focus.
  await page.evaluate(() => (document.activeElement as HTMLElement | null)?.blur())
  await page.keyboard.press('Meta+Backslash')
  await expect(page.getByTestId('right-panel')).toBeHidden()
}

test('record two machines sharing one Claude session', async ({}, testInfo) => {
  requireLiveblocks()
  const stamp = new Date().toISOString().replaceAll(':', '-').slice(0, 19)
  const remoteDir = `${remote('echo $HOME')}/koda-demo/${stamp}`
  // A short root keeps file paths readable in the tool cards.
  rmSync('/tmp/koda-demo', { recursive: true, force: true })
  const host = new KodaInstance('A', testInfo, { userName: HOST_NAME, root: '/tmp/koda-demo' })
  let localBrowser: Browser | undefined
  let guestBrowser: Browser | undefined
  let tunnel: ReturnType<typeof spawn> | undefined
  let recorder: Awaited<ReturnType<typeof remoteProcess>> | undefined
  let roomId: string | undefined
  const marks: Array<{ beat: string; at: number }> = []
  const mark = (beat: string) => { marks.push({ beat, at: Date.now() }); console.log(`[Video] ${beat}`) }
  try {
    // Host projects: the shared landing page and a second repo for a realistic sidebar.
    const git = (cwd: string, ...args: string[]) => execFileSync('git', args, { cwd, stdio: 'pipe' })
    const landing = join(host.root, 'koda-landing')
    const docs = join(host.root, 'koda-docs')
    for (const repo of [landing, docs]) {
      mkdirSync(repo, { recursive: true })
      git(repo, 'init', '-q', '-b', 'main')
      git(repo, 'config', 'user.name', 'Koda Demo')
      git(repo, 'config', 'user.email', 'demo@example.invalid')
    }
    for (const file of ['index.html', 'styles.css']) copyFileSync(join(import.meta.dirname, 'two-machine/landing', file), join(landing, file))
    writeFileSync(join(docs, 'CHANGELOG.md'), '# Changelog\n')
    for (const repo of [landing, docs]) { git(repo, 'add', '-A'); git(repo, 'commit', '-qm', 'Initial commit') }

    await Promise.all([
      host.start(),
      remoteProcess(`KODA_DEMO_DIR=${remoteDir} KODA_USER_NAME=${GUEST_NAME} ~/Developer/koda/e2e/demos/two-machine/collaborator.sh start`, /^ready rpc=/)
        .then(({ child }) => { child.kill() }),
    ])
    await requireClaude(host)
    remote(`set -e; for r in portfolio-site notes-api; do d=${remoteDir}/repos/$r; mkdir -p $d; cd $d; git init -q -b main; git config user.name ${GUEST_NAME}; git config user.email guest@example.invalid; printf '# %s\\n' $r > README.md; git add README.md; git commit -qm 'Initial commit'; done`)
    // The collaborator's browser debugging port never leaves that machine.
    tunnel = spawn('ssh', ['-N', '-o', 'ExitOnForwardFailure=yes', '-L', `${BROWSER_PORT}:127.0.0.1:${BROWSER_PORT}`, ...ssh], { stdio: 'ignore' })
    await expect.poll(async () => { try { return (await fetch(`http://127.0.0.1:${BROWSER_PORT}/json/version`)).ok } catch { return false } }, { timeout: 20_000 }).toBe(true)

    const workspace = await host.rpc<{ id: string }>('workspace.createStandalone', { name: 'Koda launch' })
    let shared = { worktreeId: '', worktreePath: '' }
    for (const [path, branch] of [[landing, `${HOST_NAME.toLowerCase()}/landing-faq`], [docs, `${HOST_NAME.toLowerCase()}/changelog`]] as const) {
      const repo = await host.rpc<{ id: string }>('repo.create', { rootPath: path })
      await host.rpc('workspaceRepo.attach', { workspaceId: workspace.id, repoId: repo.id })
      const worktree = await host.rpc<{ id: string; worktreePath: string }>('worktree.create', { repoId: repo.id, branch, workspaceId: workspace.id })
      if (path === landing) shared = { worktreeId: worktree.id, worktreePath: worktree.worktreePath }
    }
    const session = await host.rpc<{ id: string; sessionId?: string }>('claude.start', { worktreeId: shared.worktreeId, model: 'default' })
    const sessionId = session.sessionId ?? session.id
    host.trackClaudeSession(sessionId, shared.worktreePath)
    const invitation = (await host.rpc<{ invitation: string }>('collaboration.share', { worktreeId: shared.worktreeId, permission: 'control' })).invitation
    roomId = `workspace:${shared.worktreeId}`

    localBrowser = await chromium.launch({ args: ['--force-device-scale-factor=1.5'] })
    guestBrowser = await chromium.connectOverCDP(`http://127.0.0.1:${BROWSER_PORT}`)
    const contextA = await localBrowser.newContext({ viewport: VIEWPORT })
    const contextB = await guestBrowser.newContext({ viewport: VIEWPORT })
    for (const context of [contextA, contextB]) await context.addInitScript(installPointer)
    // Alex's Koda uses the gray theme so the two screens read as different machines.
    await contextB.addInitScript(() => localStorage.setItem('minnetonka-active-theme', JSON.stringify('koda-graphite')))
    const a = await contextA.newPage()
    const b = await contextB.newPage()

    // The collaborator's own projects, and the invitation joined off camera.
    await b.goto(GUEST_FRONTEND)
    const guestWorkspace = await guestRpc<{ id: string }>(b, 'workspace.createStandalone', { name: `${GUEST_NAME}'s projects` })
    let guestWorktreeId = ''
    for (const [name, branch] of [['portfolio-site', 'alex/new-hero'], ['notes-api', 'alex/auth-fix']]) {
      const repo = await guestRpc<{ id: string }>(b, 'repo.create', { rootPath: `${remoteDir}/repos/${name}` })
      await guestRpc(b, 'workspaceRepo.attach', { workspaceId: guestWorkspace.id, repoId: repo.id })
      const worktree = await guestRpc<{ id: string }>(b, 'worktree.create', { repoId: repo.id, branch, workspaceId: guestWorkspace.id })
      guestWorktreeId ||= worktree.id
    }
    await guestRpc(b, 'collaboration.join', { invitation })
    // B starts in their own project when its agent is ready there, otherwise on their home screen.
    const guestHasAgent = await guestRpc(b, 'codex.models').then(() => true, () => false)

    await a.goto(`${host.url}/workspace/${workspace.id}/${shared.worktreeId}`)
    await b.goto(guestHasAgent ? `${GUEST_FRONTEND}/workspace/${guestWorkspace.id}/${guestWorktreeId}` : GUEST_FRONTEND)
    await expect(a.getByTestId('agent-chat-container')).toHaveAttribute('data-session-id', sessionId, { timeout: 30_000 })
    await expect(b.getByTestId('shared-workspace-link')).toBeVisible({ timeout: 30_000 })
    await hideRightPanel(a)
    if (guestHasAgent) await hideRightPanel(b)
    await Promise.all([a.mouse.move(820, 1150), b.mouse.move(640, 900)])
    await pause(1500)

    // B is captured on its own machine; ping it to map its clock onto this one.
    recorder = await remoteProcess(`export PATH=/opt/homebrew/bin:$PATH; node ~/Developer/koda/e2e/demos/two-machine/tools/recorder.mjs ${BROWSER_PORT} ${GUEST_FRONTEND} ${remoteDir}/frames-B`, /^ready$/)
    const samples: Array<{ rtt: number; offset: number }> = []
    for (let i = 0; i < 12; i++) {
      const sent = Date.now()
      const pong = await new Promise<number>((resolve) => {
        const onLine = (line: string) => { if (line.startsWith('pong ')) { recorder!.lines.off('line', onLine); resolve(Number(line.slice(5))) } }
        recorder!.lines.on('line', onLine)
        recorder!.child.stdin.write('ping\n')
      })
      const received = Date.now()
      samples.push({ rtt: received - sent, offset: pong - (sent + received) / 2 })
    }
    const clock = samples.sort((x, y) => x.rtt - y.rtt)[0]!
    const captureA = new ScreenCapture(a, testInfo.outputPath('frames-A'))
    await captureA.start()
    await pause(500)
    mark('open')
    await pause(2500)

    // B opens A's workspace from B's own sidebar.
    await glide(b, b.getByTestId('shared-workspace-link'))
    await expect(b.getByTestId('agent-chat-container')).toHaveAttribute('data-session-id', sessionId, { timeout: 30_000 })
    await hideRightPanel(b)
    await expect(b.getByTestId('presence-avatars').getByTitle(HOST_NAME, { exact: true })).toBeVisible({ timeout: 30_000 })
    mark('joined')
    await pause(3000)

    // A asks Claude; the turn streams on both screens.
    const status = async () => (await host.rpc<{ status: string }>('claude.get', { sessionId })).status
    await glide(a, a.getByTestId('chat-input'))
    await a.getByTestId('chat-input').pressSequentially(HOST_PROMPT, { delay: 28 })
    await pause(600)
    mark('host-sent')
    await a.getByTestId('chat-input').press('Enter')
    await expect.poll(status, { timeout: 30_000 }).toBe('running')
    await expect(b.locator('[data-message-role="assistant"]').first()).toBeVisible({ timeout: 120_000 })
    mark('streaming-on-both')
    await expect.poll(status, { timeout: 240_000, intervals: [1000] }).not.toBe('running')
    await pause(1500)
    mark('host-done')
    await pause(2000)

    // B asks for a change; it lands on A under B's name.
    await glide(b, b.getByTestId('chat-input'))
    await b.getByTestId('chat-input').pressSequentially(GUEST_PROMPT, { delay: 30 })
    await pause(600)
    mark('guest-sent')
    await b.getByTestId('chat-input').press('Enter')
    await expect(a.locator('[data-message-role="user"]').filter({ hasText: 'Join the beta' }).getByTestId('message-author')).toHaveText(GUEST_NAME, { timeout: 30_000 })
    mark('guest-on-host')
    await expect.poll(status, { timeout: 30_000 }).toBe('running')
    await expect.poll(status, { timeout: 240_000, intervals: [1000] }).not.toBe('running')
    await pause(1500)
    mark('guest-done')
    await pause(3000)
    mark('end')

    await captureA.stop()
    const stopped = new Promise<void>((resolve) => recorder!.lines.on('line', (line) => { if (line.startsWith('stopped ')) resolve() }))
    recorder.child.stdin.write('stop\n')
    await stopped
    const from = marks[0]!.at
    const to = marks.at(-1)!.at
    captureA.assemble(from, to, testInfo.outputPath('A.mp4'), FPS)
    const localB = testInfo.outputPath('frames-B')
    execFileSync('rsync', ['-a', `${COLLABORATOR}:${remoteDir}/frames-B/`, `${localB}/`])
    const framesB: Frame[] = (JSON.parse(readFileSync(join(localB, 'frames.json'), 'utf8')) as Array<{ name: string; at: number }>)
      .map(({ name, at }) => ({ file: join(localB, name), at: at - clock.offset }))
    encodeFrames(framesB, from, to, join(localB, 'cfr'), testInfo.outputPath('B.mp4'), FPS)
    writeFileSync(testInfo.outputPath('timeline.json'), JSON.stringify({
      fps: FPS, size: { width: 1920, height: 2160 }, host: HOST_NAME, guest: GUEST_NAME,
      prompts: { host: HOST_PROMPT, guest: GUEST_PROMPT }, clock,
      beats: marks.map(({ beat, at }) => ({ beat, seconds: +((at - from) / 1000).toFixed(3) })),
      frames: { A: captureA.frames.length, B: framesB.length },
    }, null, 2))
  } finally {
    const errors: unknown[] = []
    for (const cleanup of [
      () => recorder?.child.kill(),
      () => localBrowser?.close(),
      () => guestBrowser?.close(),
      () => tunnel?.kill(),
      () => remote(`KODA_DEMO_DIR=${remoteDir} ~/Developer/koda/e2e/demos/two-machine/collaborator.sh stop; rm -rf ${remoteDir}`),
      () => host.cleanup(),
      async () => {
        if (!roomId) return
        const response = await fetch(`https://api.liveblocks.io/v2/rooms/${encodeURIComponent(roomId)}`, { method: 'DELETE', headers: { Authorization: `Bearer ${process.env.LIVEBLOCKS_SECRET_KEY}` } })
        if (!response.ok && response.status !== 404) throw new Error(`Room cleanup failed (${response.status})`)
      },
    ]) {
      try { await cleanup() } catch (error) { errors.push(error) }
    }
    if (errors.length) throw new AggregateError(errors, 'Recording cleanup failed')
  }
})
