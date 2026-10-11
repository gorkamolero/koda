import { existsSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { spawn } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import path from 'node:path'

const root = fileURLToPath(new URL('..', import.meta.url))
const envFile = process.env.KODA_ENV_FILE
  ? path.resolve(process.env.KODA_ENV_FILE)
  : path.join(root, '.env.local')
if (process.env.KODA_ENV_FILE || existsSync(envFile)) {
  process.loadEnvFile(envFile)
}

function run(args, command = 'pnpm') {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, { cwd: root, env: process.env, stdio: 'inherit' })
    const stop = (signal) => child.kill(signal)
    const terminate = () => stop('SIGTERM')
    const interrupt = () => stop('SIGINT')
    process.on('SIGTERM', terminate)
    process.on('SIGINT', interrupt)
    child.on('error', reject)
    child.on('exit', (code, signal) => {
      process.off('SIGTERM', terminate)
      process.off('SIGINT', interrupt)
      if (code === 0) resolve()
      else reject(new Error(`Koda command exited with ${signal ?? code}`))
    })
  })
}

try {
  if (process.argv[2] === 'app') {
    await run(['--filter', '@koda/sidecar', 'build'])
    await run(['--filter', 'desktop', 'tauri', 'dev', ...process.argv.slice(3)])
  } else if (process.argv[2] === 'sidecar') {
    await run(['--filter', '@koda/sidecar', 'dev', ...process.argv.slice(3)])
  } else if (process.argv[2] === 'verify-clean') {
    await run([path.join(root, 'scripts/verify-clean.mjs')], process.execPath)
  } else if (process.argv[2] === 'collab-deploy') {
    // The Worker's Liveblocks secret comes from the env file loaded above and reaches
    // Cloudflare through a private temporary file, removed as soon as wrangler exits.
    if (!process.env.LIVEBLOCKS_SECRET_KEY) throw new Error('collab-deploy needs LIVEBLOCKS_SECRET_KEY in the env file')
    const directory = mkdtempSync(path.join(tmpdir(), 'koda-collab-'))
    const secrets = path.join(directory, 'secrets.env')
    writeFileSync(secrets, `LIVEBLOCKS_SECRET_KEY=${process.env.LIVEBLOCKS_SECRET_KEY}\n`, { mode: 0o600 })
    try {
      await run(['--filter', '@koda/collab-service', 'exec', 'wrangler', 'd1', 'migrations', 'apply', 'DB', '--remote'])
      await run(['--filter', '@koda/collab-service', 'exec', 'wrangler', 'deploy', '--secrets-file', secrets])
    } finally {
      rmSync(directory, { recursive: true, force: true })
    }
  } else if (process.argv[2] === 'built') {
    const executable = path.join(root, 'apps/desktop/src-tauri/target/debug/bundle/macos/Koda.app/Contents/MacOS/koda-desktop')
    if (!existsSync(executable)) throw new Error('Build the local app first: pnpm --filter desktop tauri build --debug --bundles app')
    await run(process.argv.slice(3), executable)
  } else {
    throw new Error('Usage: node scripts/run.mjs app|sidecar|built|verify-clean')
  }
} catch (error) {
  console.error(error.message)
  process.exitCode = 1
}
