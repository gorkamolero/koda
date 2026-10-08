import { existsSync } from 'node:fs'
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
  } else if (process.argv[2] === 'built') {
    const executable = path.join(root, 'apps/desktop/src-tauri/target/debug/bundle/macos/Koda.app/Contents/MacOS/koda-desktop')
    if (!existsSync(executable)) throw new Error('Build the local app first: pnpm --filter desktop tauri build --debug --bundles app')
    await run(process.argv.slice(3), executable)
  } else {
    throw new Error('Usage: node scripts/run.mjs app|sidecar|built')
  }
} catch (error) {
  console.error(error.message)
  process.exitCode = 1
}
