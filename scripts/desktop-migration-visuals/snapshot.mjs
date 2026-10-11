import { execFileSync, spawn } from 'node:child_process'
import { mkdirSync, readFileSync, writeFileSync, symlinkSync, createWriteStream, cpSync, rmSync } from 'node:fs'
import { createServer } from 'node:net'
import { resolve } from 'node:path'
import { projectRoot, outputRoot, outputDirectory } from './common.mjs'

const [label, ref = 'HEAD', filter = 'full', ...flags] = process.argv.slice(2)
const installDependencies = flags.includes('--install-dependencies')
outputDirectory(label) // Validate before constructing or removing any paths.
const workingCopy = ref === 'WORKTREE'
const commit = execFileSync('git', ['rev-parse', '--verify', '--end-of-options', `${workingCopy ? 'HEAD' : ref}^{commit}`], { cwd: projectRoot, encoding: 'utf8' }).trim()
const snapshot = resolve(outputRoot, `${label}-source`)
const paths = [
  'package.json', 'pnpm-workspace.yaml', 'pnpm-lock.yaml',
  'apps/desktop/src', 'apps/desktop/index.html', 'apps/desktop/vite.config.ts',
  'apps/desktop/tailwind.config.js', 'apps/desktop/postcss.config.js', 'apps/desktop/package.json',
  'packages/ui/src', 'packages/ui/package.json', 'packages/ui/tailwind.preset.js',
]
mkdirSync(outputRoot, { recursive: true })
rmSync(snapshot, { recursive: true, force: true })
mkdirSync(snapshot, { recursive: true })
const archive = execFileSync('git', ['archive', commit, ...paths], { cwd: projectRoot, maxBuffer: 50 * 1024 * 1024 })
execFileSync('tar', ['-x', '-C', snapshot], { input: archive })
if (workingCopy) {
  for (const path of paths) {
    rmSync(resolve(snapshot, path), { recursive: true, force: true })
    cpSync(resolve(projectRoot, path), resolve(snapshot, path), { recursive: true })
  }
}
const patchedDependencies = JSON.parse(readFileSync(resolve(snapshot, 'package.json'), 'utf8')).pnpm?.patchedDependencies ?? {}
const patchPaths = Object.values(patchedDependencies).map(value => typeof value === 'string' ? value : value.path)
for (const patchPath of patchPaths) {
  if (!patchPath.startsWith('patches/') || patchPath.split('/').includes('..')) throw new Error(`Unexpected patch path: ${patchPath}`)
}
if (patchPaths.length) {
  if (workingCopy) for (const path of patchPaths) { mkdirSync(resolve(snapshot, 'patches'), { recursive: true }); cpSync(resolve(projectRoot, path), resolve(snapshot, path)) }
  else execFileSync('tar', ['-x', '-C', snapshot], { input: execFileSync('git', ['archive', commit, ...patchPaths], { cwd: projectRoot, maxBuffer: 50 * 1024 * 1024 }) })
}
if (installDependencies) {
  // Historical revisions can import dependencies removed from the current app.
  // Install only inside this disposable snapshot, without running lifecycle scripts.
  execFileSync('pnpm', ['install', '--frozen-lockfile', '--ignore-scripts', '--filter', 'desktop', '--filter', '@koda/ui'], { cwd: snapshot, stdio: 'inherit' })
} else {
  for (const pkg of ['apps/desktop', 'packages/ui']) {
    symlinkSync(resolve(projectRoot, pkg, 'node_modules'), resolve(snapshot, pkg, 'node_modules'), 'dir')
  }
}
// Resolve both desktop and UI sources from this immutable snapshot. Dependencies
// are reused from this checkout; no env files or user data enter the snapshot.
const config = resolve(snapshot, 'apps/desktop/vite.config.ts')
let configSource = readFileSync(config, 'utf8')
// Optimizer caches must not live inside the shared node_modules symlinks.
const cacheOption = "  cacheDir: path.resolve(__dirname, '../../.vite-cache'),\n"
configSource = /\bcacheDir:/.test(configSource)
  ? configSource.replace(/^\s*cacheDir:.*\n/m, cacheOption)
  : configSource.replace('export default defineConfig({\n', `export default defineConfig({\n${cacheOption}`)
writeFileSync(config, configSource.replace("'@': path.resolve(__dirname, './src'),", `'@': path.resolve(__dirname, './src'),
      '@koda/ui/tokens.css': path.resolve(__dirname, '../../packages/ui/src/tokens.css'),
      '@koda/ui/tokens': path.resolve(__dirname, '../../packages/ui/src/tokens.ts'),
      '@koda/ui/source-styles.css': path.resolve(__dirname, '../../packages/ui/src/styles.css'),
      '@koda/ui': path.resolve(__dirname, '../../packages/ui/src/index.ts'),`))
const tailwind = resolve(snapshot, 'apps/desktop/tailwind.config.js')
writeFileSync(tailwind, readFileSync(tailwind, 'utf8').replace("'@koda/ui/tailwind-preset'", "'../../packages/ui/tailwind.preset.js'"))
const port = await new Promise((accept, reject) => {
  const server = createServer()
  server.on('error', reject)
  server.listen(0, '127.0.0.1', () => {
    const { port } = server.address()
    server.close(error => error ? reject(error) : accept(port))
  })
})
const url = `http://127.0.0.1:${port}`
const log = createWriteStream(resolve(outputRoot, `${label}-vite.log`))
const preview = spawn(process.execPath, [resolve(installDependencies ? snapshot : projectRoot, 'apps/desktop/node_modules/vite/bin/vite.js'), '--host', '127.0.0.1'], {
  cwd: resolve(snapshot, 'apps/desktop'),
  env: { ...process.env, VITE_PORT: String(port), VITE_HTTP_RPC_PORT: '15333', KODA_VITE_CACHE_DIR: resolve(snapshot, '.vite-cache') },
  stdio: ['ignore', 'pipe', 'pipe'],
})
preview.stdout.pipe(log)
preview.stderr.pipe(log)
const record = { pid: preview.pid, port, ref, commit, workingCopy, installDependencies, stopped: false, sourceRemoved: false }
const recordPath = resolve(outputRoot, `${label}-process.json`)
writeFileSync(recordPath, JSON.stringify(record, null, 2))
let capture
try {
  let ready = false
  for (let attempt = 0; attempt < 100; attempt++) {
    if (preview.exitCode !== null) throw new Error(`Preview exited ${preview.exitCode}; inspect ${label}-vite.log`)
    try { ready = (await fetch(url)).ok } catch { /* Starting Vite. */ }
    if (ready) break
    await new Promise(resolveWait => setTimeout(resolveWait, 200))
  }
  if (!ready) throw new Error(`Preview did not start: ${url}`)
  capture = spawn(process.execPath, [resolve(projectRoot, 'scripts/desktop-migration-visuals/capture.mjs'), label, url, filter], {
    cwd: projectRoot,
    env: { ...process.env, KODA_VISUAL_COMMIT: commit, KODA_VISUAL_WORKING_COPY: String(workingCopy) },
    stdio: 'inherit',
  })
  process.exitCode = await new Promise((accept, reject) => { capture.once('error', reject); capture.once('exit', code => accept(code ?? 1)) })
} finally {
  if (capture?.exitCode === null) capture.kill('SIGTERM')
  if (preview.exitCode === null) {
    const exited = new Promise(resolveExit => preview.once('exit', resolveExit))
    preview.kill('SIGTERM')
    await exited
  }
  log.end()
  record.stopped = true
  rmSync(snapshot, { recursive: true, force: true })
  record.sourceRemoved = true
  writeFileSync(recordPath, JSON.stringify(record, null, 2))
}
