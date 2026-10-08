/** Reproduce both real-service proofs from the committed tree, without copying local files. */
import { spawn, execFileSync } from 'node:child_process'
import { createWriteStream, existsSync, mkdirSync, mkdtempSync, cpSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const source = fileURLToPath(new URL('..', import.meta.url))
const git = (...args) => execFileSync('git', ['-C', source, ...args], { encoding: 'utf8' }).trim()
const head = git('rev-parse', 'HEAD')
if (git('status', '--porcelain', '--untracked-files=normal')) {
  console.error('Commit the source changes before running verify:clean. It verifies the exact committed HEAD.')
  process.exit(1)
}

const started = new Date()
const stamp = started.toISOString().replace(/[:.]/g, '-')
const output = path.join(source, 'proof-results', `clean-${head.slice(0, 12)}-${stamp}`)
const temporary = mkdtempSync(path.join(tmpdir(), 'koda-clean-proof-'))
const clone = path.join(temporary, 'checkout')
mkdirSync(output, { recursive: true })
const env = { ...process.env, CI: '1', PLAYWRIGHT_HTML_OPEN: 'never' }
// scripts/run.mjs already loaded the user's explicit env file. Child programs get
// the inherited values; the clone never reads or copies the source credential file.
delete env.KODA_ENV_FILE
const manifest = {
  sourceHead: head,
  sourcePath: source,
  node: process.version,
  pnpm: execFileSync('pnpm', ['--version'], { encoding: 'utf8' }).trim(),
  platform: process.platform,
  architecture: process.arch,
  startedAt: started.toISOString(),
  clonePath: clone,
  status: 'running',
  stages: [],
  evidence: 'Real Codex and Liveblocks proofs in a git clone --no-local of committed HEAD; no ignored source files copied.',
}
const saveManifest = () => writeFileSync(path.join(output, 'manifest.json'), JSON.stringify(manifest, null, 2) + '\n')
saveManifest()
let active
let interrupted = false
function stop(signal) {
  interrupted = true
  if (active?.pid) {
    // Playwright receives the signal first so its finally blocks can stop the
    // independently grouped fixture sidecars and remove their data directories.
    try { active.kill(signal) } catch { /* already stopped */ }
  }
}
process.on('SIGINT', () => stop('SIGINT'))
process.on('SIGTERM', () => stop('SIGTERM'))

async function run(name, command, args, cwd = clone) {
  if (interrupted) throw new Error('Verification interrupted')
  console.log(`[Clean proof] ${name}`)
  const logPath = path.join(output, `${String(manifest.stages.length + 1).padStart(2, '0')}-${name.replace(/[^a-z0-9]+/gi, '-').toLowerCase()}.log`)
  const log = createWriteStream(logPath)
  const stage = { name, command: [command, ...args], startedAt: new Date().toISOString(), log: path.basename(logPath) }
  manifest.stages.push(stage)
  saveManifest()
  const exitCode = await new Promise((resolve, reject) => {
    const child = spawn(command, args, { cwd, env, stdio: ['ignore', 'pipe', 'pipe'] })
    active = child
    child.stdout.pipe(log, { end: false })
    child.stderr.pipe(log, { end: false })
    child.on('error', reject)
    child.on('close', (code, signal) => { stage.signal = signal; resolve(code ?? 1) })
  }).finally(async () => {
    active = undefined
    await new Promise(resolve => log.end(resolve))
  })
  stage.exitCode = exitCode
  stage.finishedAt = new Date().toISOString()
  saveManifest()
  if (exitCode !== 0) throw new Error(`${name} failed (${exitCode}); see ${logPath}`)
}

function retainProofs() {
  for (const directory of ['proof-results', 'proof-report']) {
    const origin = path.join(clone, 'e2e', directory)
    if (existsSync(origin)) cpSync(origin, path.join(output, directory), { recursive: true })
  }
}

try {
  await run('Clone committed source', 'git', ['clone', '--no-local', '--no-checkout', source, clone], temporary)
  await run('Checkout exact commit', 'git', ['checkout', '--detach', head])
  await run('Install locked dependencies', 'pnpm', ['install', '--frozen-lockfile'])
  await run('Install Chromium', 'pnpm', ['--filter', 'e2e', 'exec', 'playwright', 'install', 'chromium'])
  await run('Build from source', 'pnpm', ['build', '--force'])
  await run('Run both real service proofs', 'pnpm', ['--filter', 'e2e', 'test:proof'])
  retainProofs()
  if (git('rev-parse', 'HEAD') !== head || git('status', '--porcelain', '--untracked-files=normal')) {
    throw new Error('The source checkout changed during verification; commit and rerun for a final reproducible result')
  }
  manifest.status = 'passed'
  manifest.finishedAt = new Date().toISOString()
  manifest.cloneRemoved = true
  saveManifest()
  rmSync(temporary, { recursive: true, force: true })
  console.log(`[Clean proof] Both proofs passed for ${head}. Evidence: ${output}`)
} catch (error) {
  retainProofs()
  manifest.status = interrupted ? 'interrupted' : 'failed'
  manifest.finishedAt = new Date().toISOString()
  manifest.error = error instanceof Error ? error.message : String(error)
  manifest.cloneRemoved = false
  saveManifest()
  console.error(`[Clean proof] ${manifest.error}`)
  console.error(`[Clean proof] Evidence: ${output}`)
  console.error(`[Clean proof] Retained checkout for diagnosis: ${clone}`)
  process.exitCode = 1
}
