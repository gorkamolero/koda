import { spawn, execFileSync, type ChildProcess } from 'node:child_process'
import { createWriteStream, existsSync, readFileSync, mkdirSync, mkdtempSync, writeFileSync, rmSync, rmdirSync, realpathSync, type WriteStream } from 'node:fs'
import { homedir, tmpdir } from 'node:os'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { createRequire } from 'node:module'
import { createServer } from 'node:net'
import { expect, type Browser, type Page, type TestInfo } from '@playwright/test'

export const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), '../..')

// Read only the explicit environment file; never dump credentials into evidence.
const envFile = process.env.KODA_ENV_FILE ?? join(projectRoot, '.env.local')
if (existsSync(envFile)) {
  for (const line of readFileSync(envFile, 'utf8').split(/\r?\n/)) {
    const match = line.match(/^\s*(?:export\s+)?([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*?)\s*$/)
    if (match?.[1] && match[2] !== undefined && !process.env[match[1]]) {
      const value = match[2]
      process.env[match[1]] = /^(['"]).*\1$/.test(value) ? value.slice(1, -1) : value.replace(/\s+#.*$/, '')
    }
  }
}

export function requireCodex() {
  if (!process.env.OPENAI_API_KEY && !process.env.CODEX_API_KEY && !existsSync(join(process.env.CODEX_HOME ?? join(process.env.HOME ?? '', '.codex'), 'auth.json'))) {
    throw new Error('Real Codex credentials required: run codex login or set OPENAI_API_KEY in .env.local. Proofs never skip or use a fake agent.')
  }
}

export function requireLiveblocks() {
  if (!process.env.LIVEBLOCKS_SECRET_KEY) throw new Error('Real LIVEBLOCKS_SECRET_KEY required in .env.local for the collaboration proof. The test does not mock Liveblocks or skip.')
}

/** Ask the running app about its supported local Claude authentication. */
export async function requireClaude(instance: KodaInstance) {
  const status = await instance.rpc<{ available: boolean; authenticated: boolean; error?: string }>('claude.status')
  if (!status.available || !status.authenticated) {
    throw new Error(status.error || 'Real Claude authentication required: sign in with the installed Claude CLI, then rerun. Proofs never skip or use a fake agent.')
  }
}

async function freePort(): Promise<number> {
  const server = createServer()
  return new Promise((resolvePort, reject) => {
    server.once('error', reject)
    server.listen(0, '127.0.0.1', () => {
      const address = server.address()
      const port = typeof address === 'object' && address ? address.port : 0
      server.close(error => error ? reject(error) : resolvePort(port))
    })
  })
}

interface ManagedProcess { process: ChildProcess; log: WriteStream }
interface ClaudeProofSession { sessionId: string; directory: string; threadId?: string }

async function archiveCodexProofSession(session: ClaudeProofSession) {
  if (!session.threadId) return false
  const { CodexAppServer } = await import(pathToFileURL(join(projectRoot, 'apps/sidecar/dist/agents/codexTransport.js')).href) as {
    CodexAppServer: new () => { initialize(): Promise<void>; request(method: string, params: unknown): Promise<{ thread: { id: string; cwd: string; path: string; status: { type: string } } }>; close(): Promise<void> }
  }
  const server = new CodexAppServer()
  try {
    await server.initialize()
    const { thread } = await server.request('thread/read', { threadId: session.threadId, includeTurns: false })
    if (thread.id !== session.threadId || thread.cwd !== session.directory || thread.status.type !== 'notLoaded') throw new Error('Refusing to archive an active or unowned Codex proof session')
    if (!thread.path.includes('/archived_sessions/')) await server.request('thread/archive', { threadId: session.threadId })
    const { thread: after } = await server.request('thread/read', { threadId: session.threadId, includeTurns: false })
    if (after.id !== session.threadId || after.cwd !== session.directory || !after.path.includes('/archived_sessions/') || !existsSync(after.path) || (after.path !== thread.path && existsSync(thread.path))) throw new Error('Codex proof session archival was not verified')
    return true
  } finally { await server.close() }
}

async function deleteClaudeProofSession(session: ClaudeProofSession) {
  if (!session.threadId) return false // An idle chat never started a native session.
  const require = createRequire(join(projectRoot, 'apps/sidecar/package.json'))
  const sdk = await import(pathToFileURL(require.resolve('@anthropic-ai/claude-agent-sdk')).href) as {
    deleteSession: (threadId: string, options: { dir: string }) => Promise<void>
    getSessionInfo: (threadId: string, options: { dir: string }) => Promise<unknown>
  }
  await sdk.deleteSession(session.threadId, { dir: session.directory })
  if (await sdk.getSessionInfo(session.threadId, { dir: session.directory })) throw new Error(`Temporary Claude SDK session cleanup failed: ${session.threadId}`)
  return true
}

export class KodaInstance {
  readonly root: string
  readonly dataDir: string
  readonly repoPath: string
  readonly profilePath: string
  readonly userName: string
  rpcPort = 0
  vitePort = 0
  private children: ManagedProcess[] = []
  private claudeSessions = new Map<string, ClaudeProofSession>()
  private codexSessions = new Map<string, ClaudeProofSession>()
  private generation = 0
  private readonly serviceUrl?: string
  constructor(readonly label: string, readonly testInfo: TestInfo, options: { userName?: string; root?: string; serviceUrl?: string } = {}) {
    this.serviceUrl = options.serviceUrl
    this.root = options.root ? (mkdirSync(options.root, { recursive: true }), options.root) : mkdtempSync(join(tmpdir(), 'koda-proof-'))
    this.dataDir = join(this.root, 'data')
    this.repoPath = join(this.root, 'throwaway-repo')
    this.profilePath = join(this.root, 'browser')
    this.userName = options.userName ?? `User ${label}`
    mkdirSync(this.dataDir, { recursive: true })
  }
  get url() { return `http://localhost:${this.vitePort}` }
  get pids() { return this.children.map(child => child.process.pid) }

  /** Register only the exact Claude session this fixture created. */
  trackClaudeSession(sessionId: string, workingDirectory: string) {
    this.claudeSessions.set(sessionId, { sessionId, directory: realpathSync(workingDirectory) })
  }

  /** Only register sessions created inside this exact disposable fixture. */
  trackCodexSession(sessionId: string, workingDirectory: string) {
    const directory = realpathSync(workingDirectory)
    if (!directory.startsWith(realpathSync(this.root) + '/')) throw new Error('Codex proof session must belong to this fixture')
    this.codexSessions.set(sessionId, { sessionId, directory })
  }

  createRepo() {
    mkdirSync(this.repoPath, { recursive: true })
    const git = (...args: string[]) => execFileSync('git', args, { cwd: this.repoPath, stdio: 'pipe' })
    git('init', '-b', 'main')
    git('config', 'user.name', 'Koda Proof')
    git('config', 'user.email', 'proof@example.invalid')
    writeFileSync(join(this.repoPath, 'README.md'), '# Koda proof\n\nOriginal content.\n')
    git('add', 'README.md')
    git('commit', '-m', 'Initial throwaway fixture')
  }

  private launch(args: string[], cwd: string, env: NodeJS.ProcessEnv, name: string) {
    const log = createWriteStream(this.testInfo.outputPath(`${this.label}-${name}-${this.generation}.log`))
    const child = spawn(process.execPath, args, { cwd, env, detached: true, stdio: ['ignore', 'pipe', 'pipe'] })
    child.stdout?.pipe(log, { end: false })
    child.stderr?.pipe(log, { end: false })
    this.children.push({ process: child, log })
    child.on('error', error => log.write(String(error)))
    return child
  }

  async start() {
    if (!this.rpcPort) this.rpcPort = await freePort()
    if (!this.vitePort) this.vitePort = await freePort()
    this.generation++
    const env: NodeJS.ProcessEnv = {
      ...process.env,
      KODA_DATA_DIR: this.dataDir,
      KODA_USER_NAME: this.userName,
      KODA_DB_PATH: join(this.dataDir, 'koda.db'),
      KODA_SOCKET: join(this.root, 'koda.sock'),
      KODA_HTTP_HOST: 'localhost', KODA_HTTP_PORT: String(this.rpcPort),
      KODA_MODE: 'local', KODA_AUTH_ENABLED: 'false',
      VITE_PORT: String(this.vitePort), VITE_HTTP_RPC_PORT: String(this.rpcPort),
      KODA_VITE_CACHE_DIR: join(this.root, 'vite-cache'),
      KODA_CORS_ORIGINS: this.url,
      // Git never prompts in a proof, and identities belong only to the fixture.
      GIT_TERMINAL_PROMPT: '0',
      // Proof approvals are answered in Koda; the user's hook apps (e.g. a notch) must not prompt or race them.
      KODA_USER_HOOKS: 'off',
    }
    // KODA_TEST_DB used to wipe on every start. Use the normal persisted path.
    delete env.KODA_TEST_DB
    if (this.serviceUrl) {
      delete env.LIVEBLOCKS_SECRET_KEY
      delete env.KODA_ENV_FILE
      env.KODA_COLLAB_URL = this.serviceUrl
      expect('LIVEBLOCKS_SECRET_KEY' in env).toBe(false)
    }
    const sidecar = this.launch(['dist/index.js'], join(projectRoot, 'apps/sidecar'), env, 'sidecar')
    await expect.poll(async () => {
      if (sidecar.exitCode !== null) throw new Error(`Sidecar exited ${sidecar.exitCode}; inspect ${this.label} sidecar log`)
      try { return await this.rpc('ping') } catch { return null }
    }, { timeout: 30_000, message: 'Real sidecar startup' }).toBe('pong')
    if (this.serviceUrl) {
      const status = await this.rpc<{ mode: string; reachable: boolean }>('collaboration.status')
      expect(status.mode).toBe('service'); expect(status.reachable).toBe(true)
    }
    const vite = this.launch(['node_modules/vite/bin/vite.js', '--host', 'localhost'], join(projectRoot, 'apps/desktop'), env, 'frontend')
    await expect.poll(async () => {
      if (vite.exitCode !== null) throw new Error(`Frontend exited ${vite.exitCode}; inspect ${this.label} frontend log`)
      try { return (await fetch(this.url)).status } catch { return 0 }
    }, { timeout: 30_000, message: 'Real frontend startup' }).toBe(200)
  }

  async rpc<T = unknown>(method: string, params: unknown = {}, options: { timeoutMs?: number } = {}): Promise<T> {
    const response = await fetch(`http://localhost:${this.rpcPort}/rpc`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ jsonrpc: '2.0', id: 1, method, params }),
      signal: options.timeoutMs ? AbortSignal.timeout(options.timeoutMs) : undefined,
    })
    const data = await response.json() as { result: T; error?: { message: string } }
    if (data.error) throw new Error(`${method}: ${data.error.message}`)
    if (method === 'claude.get' || method === 'codex.get') {
      const session = data.result as { id?: string; threadId?: string }
      const tracked = session.id ? (method === 'claude.get' ? this.claudeSessions : this.codexSessions).get(session.id) : undefined
      if (tracked && session.threadId) tracked.threadId = session.threadId
    }
    return data.result
  }

  async stop() {
    const children = this.children.splice(0)
    await Promise.all(children.map(async ({ process: child, log }) => {
      if (child.pid && child.exitCode === null) {
        try { process.kill(-child.pid, 'SIGTERM') } catch { /* already exited */ }
        await Promise.race([
          new Promise(resolveExit => child.once('exit', resolveExit)),
          new Promise(resolveTimeout => setTimeout(resolveTimeout, 5000)),
        ])
        if (child.exitCode === null) { try { process.kill(-child.pid, 'SIGKILL') } catch { /* already exited */ } }
      }
      log.end()
    }))
  }

  async cleanup() {
    let captureError: unknown
    try {
      for (const session of this.claudeSessions.values()) {
        // Capture before stopping the app. Stop/restart alone must preserve it.
        await this.rpc('claude.get', { sessionId: session.sessionId }, { timeoutMs: 5000 })
      }
      for (const session of this.codexSessions.values()) await this.rpc('codex.get', { sessionId: session.sessionId }, { timeoutMs: 5000 })
    } catch (error) { captureError = error }
    finally { await this.stop() }
    if (captureError) throw captureError // Preserve this fixture if ownership is uncertain.
    // Restricted migration runs may retain provider history outside their fixture root.
    // This does not skip any runtime, approval, persistence, or artifact assertion.
    const keepNativeSessions = process.env.KODA_PROOF_KEEP_NATIVE_SESSIONS === '1'
    if (this.claudeSessions.size && !keepNativeSessions) {
      const removed: string[] = []
      for (const session of this.claudeSessions.values()) {
        if (await deleteClaudeProofSession(session)) removed.push(session.threadId!)
      }
      writeFileSync(this.testInfo.outputPath(`${this.label}-claude-cleanup.json`), JSON.stringify({ temporarySdkSessionsRemoved: removed }, null, 2))
    }
    if (this.codexSessions.size && !keepNativeSessions) {
      const archived: string[] = []
      for (const session of this.codexSessions.values()) if (await archiveCodexProofSession(session)) archived.push(session.threadId!)
      writeFileSync(this.testInfo.outputPath(`${this.label}-codex-cleanup.json`), JSON.stringify({ temporaryThreadsArchived: archived, providerArchiveVerified: true }, null, 2))
    }
    if (keepNativeSessions) writeFileSync(this.testInfo.outputPath(`${this.label}-native-history.json`), JSON.stringify({ retained: true, reason: 'Provider history is outside the allowed fixture root' }, null, 2))
    // Only this test's mkdtemp tree; never a shared database or arbitrary port.
    rmSync(this.root, { recursive: true, force: true })
  }
}

/** Real local Worker + isolated D1. The secret stays in the Worker environment. */
export class CollaborationWorker {
  readonly root = mkdtempSync(join(tmpdir(), 'koda-worker-proof-'))
  url = ''
  private child?: ChildProcess
  private log?: WriteStream
  constructor(readonly testInfo: TestInfo) {}
  async start() {
    requireLiveblocks()
    const port = await freePort()
    this.url = `http://127.0.0.1:${port}`
    const cwd = join(projectRoot, 'apps/collab-service')
    const cli = join(cwd, 'node_modules/wrangler/bin/wrangler.js')
    const env = { ...process.env, CI: '1', WRANGLER_SEND_METRICS: 'false', CLOUDFLARE_INCLUDE_PROCESS_ENV: 'true' }
    // Wrangler declares only LIVEBLOCKS_SECRET_KEY as a required secret and
    // reads it from this environment; no secret appears in arguments or files.
    execFileSync(process.execPath, [cli, 'd1', 'migrations', 'apply', 'DB', '--local', '--persist-to', this.root], { cwd, env, stdio: 'pipe', timeout: 60000 })
    this.log = createWriteStream(this.testInfo.outputPath('collaboration-worker.log'))
    this.child = spawn(process.execPath, [cli, 'dev', '--local', '--ip', '127.0.0.1', '--port', String(port), '--persist-to', this.root], { cwd, env, detached: true, stdio: ['ignore', 'pipe', 'pipe'] })
    this.child.stdout?.pipe(this.log, { end: false }); this.child.stderr?.pipe(this.log, { end: false })
    await expect.poll(async () => {
      if (this.child?.exitCode !== null) throw new Error('Local Worker exited; inspect collaboration-worker.log')
      try { return (await fetch(`${this.url}/health`)).ok } catch { return false }
    }, { timeout: 30000 }).toBe(true)
  }
  async cleanup() {
    if (this.child?.pid && this.child.exitCode === null) {
      try { process.kill(-this.child.pid, 'SIGTERM') } catch { /* already stopped */ }
      await Promise.race([new Promise(resolve => this.child!.once('exit', resolve)), new Promise(resolve => setTimeout(resolve, 5000))])
      if (this.child.exitCode === null) { try { process.kill(-this.child.pid, 'SIGKILL') } catch { /* already stopped */ } }
    }
    this.log?.end()
    rmSync(this.root, { recursive: true, force: true })
  }
}

export async function screenshot(page: Page, testInfo: TestInfo, name: string) {
  const path = testInfo.outputPath(`${name}.png`)
  await page.screenshot({ path, fullPage: true })
  await testInfo.attach(name, { path, contentType: 'image/png' })
}

/** Put unmodified captures of the two real windows side by side for review. */
export async function pairScreenshot(browser: Browser, a: Page, b: Page, testInfo: TestInfo, name: string) {
  const [left, right] = await Promise.all([a.screenshot(), b.screenshot()])
  const page = await browser.newPage({ viewport: { width: 2880, height: 1040 } })
  try {
    await page.setContent(`<html><body style="margin:0;background:#111;color:white;font:16px monospace"><div style="display:flex"><section><header style="height:40px;line-height:40px;padding-left:20px">User A · host</header><img width="1440" src="data:image/png;base64,${left.toString('base64')}"></section><section><header style="height:40px;line-height:40px;padding-left:20px">User B · collaborator</header><img width="1440" src="data:image/png;base64,${right.toString('base64')}"></section></div></body></html>`)
    await screenshot(page, testInfo, name)
  } finally { await page.close() }
}

export async function createWorkspace(page: Page, instance: KodaInstance, testInfo: TestInfo, screenshots = true) {
  await page.goto(instance.url)
  await page.getByTestId('new-workspace-button').click()
  await page.getByPlaceholder('my-workspace').fill(`Proof ${instance.label}`)
  await page.getByRole('button', { name: '[+] CREATE', exact: true }).click()
  await page.getByTestId('connect-repo-button').click()
  await page.getByTestId('repository-path').fill(instance.repoPath)
  await page.getByRole('button', { name: '[+ ADD GIT REPOSITORY]', exact: true }).click()
  await expect(page.getByTestId('branch-name-input')).toBeVisible()
  if (screenshots) await screenshot(page, testInfo, '01-repository-added')
  await page.getByTestId('branch-name-input').fill(`codex/proof-${instance.label}`)
  await page.getByTestId('create-branch-button').click()
  await expect(page.getByTestId('agent-chat-container')).toBeVisible()
  const [workspaceId, worktreeId] = new URL(page.url()).pathname.split('/').slice(-2)
  const worktree = await instance.rpc<{ worktreePath: string; repoId: string }>('worktree.get', { worktreeId })
  expect(worktree.worktreePath).not.toBe(instance.repoPath)
  expect(existsSync(join(worktree.worktreePath, '.git'))).toBe(true)
  // A fresh worktree owns one automatic shell, including under StrictMode.
  await expect(page.getByTestId(/^terminal-tab-term-/)).toHaveCount(1)
  await expect(page.getByTestId('terminal-pid')).toHaveCount(1)
  await expect.poll(() => instance.rpc<unknown[]>('pty.list')).toHaveLength(1)
  if (screenshots) await screenshot(page, testInfo, '02-isolated-worktree')
  return { workspaceId, worktreeId, ...worktree }
}

export async function send(page: Page, prompt: string) {
  await page.getByTestId('chat-input').fill(prompt)
  await page.getByTestId('chat-input').press('Enter')
}

export type Agent = 'codex' | 'claude'

// OS temporary directories are allowed by Codex workspace-write. This exact
// throwaway directory is deliberately outside them and contains only markers.
export function outsideFixture() {
  const parent = process.env.KODA_PROOF_OUTSIDE_ROOT || join(homedir(), '.koda-approval-proofs')
  const createdParent = !existsSync(parent)
  mkdirSync(parent, { recursive: true })
  const root = mkdtempSync(join(parent, 'owned-'))
  return { root, cleanup() { rmSync(root, { recursive: true, force: true }); if (createdParent) { try { rmdirSync(parent) } catch { /* another owned proof may still use it */ } } } }
}

export function writePrompt(path: string, marker: string, agent: Agent, bypass = false) {
  const command = agent === 'codex' ? `/usr/bin/touch '${path}'` : `printf '%s\\n' '${marker}' > '${path}'`
  const mode = bypass ? 'This chat explicitly has bypass permissions selected; run normally.' : 'Try normal tool execution first. If sandboxing blocks the command, request permission to run this exact command outside the sandbox with no reusable command rule. Wait for the tool approval; do not ask an ordinary chat question.'
  return `Use only your shell tool to execute this exact command: ${command}. This is a disposable permission-test marker outside the worktree. Do not read any other files. ${mode} If permission is denied, stop without retrying, writing by another tool, or choosing another path. After success reply ${marker}_DONE; after denial reply PERMISSION_DENIED.`
}
