/**
 * Seed Test Data Script
 *
 * Connects to the sidecar (via HTTP or Unix socket) and creates test data
 * (repo + workspace) for E2E tests.
 *
 * Usage: npx tsx seed-data.ts
 */

import * as net from 'node:net'
import * as path from 'node:path'
import * as os from 'node:os'
import * as fs from 'node:fs'
import * as http from 'node:http'
import { fileURLToPath } from 'node:url'
import { execSync } from 'node:child_process'

// ESM equivalent of __dirname
const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

// HTTP port for RPC (sidecar runs HTTP server in dev mode)
const HTTP_PORT = process.env.KODA_HTTP_PORT || '3847'

// Socket path - matches what the app uses
function getSocketPath(): string {
  // Check for test socket override
  if (process.env.KODA_SOCKET) {
    return process.env.KODA_SOCKET
  }

  const platform = os.platform()
  if (platform === 'darwin') {
    return path.join(
      os.homedir(),
      'Library',
      'Application Support',
      'com.koda.app',
      'koda.sock'
    )
  } else if (platform === 'linux') {
    return `/tmp/koda-${process.getuid?.() ?? 'unknown'}.sock`
  }
  throw new Error(`Unsupported platform: ${platform}`)
}

// JSON-RPC client interface
interface RpcClient {
  call<T>(method: string, params?: unknown): Promise<T>
  close(): void
}

// HTTP RPC client (for E2E tests where socket may not be accessible)
class HttpRpcClient implements RpcClient {
  private baseUrl: string
  private nextId = 1

  constructor(port: string | number) {
    this.baseUrl = `http://localhost:${port}/rpc`
  }

  async call<T>(method: string, params?: unknown): Promise<T> {
    const id = this.nextId++
    const request = {
      jsonrpc: '2.0',
      method,
      params: params ?? null,
      id,
    }

    return new Promise((resolve, reject) => {
      const url = new URL(this.baseUrl)
      const options: http.RequestOptions = {
        hostname: url.hostname,
        port: url.port,
        path: url.pathname,
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        timeout: 10000,
      }

      const req = http.request(options, (res) => {
        let data = ''
        res.on('data', (chunk) => (data += chunk))
        res.on('end', () => {
          try {
            const response = JSON.parse(data)
            if (response.error) {
              reject(new Error(response.error.message))
            } else {
              resolve(response.result as T)
            }
          } catch (e) {
            reject(new Error(`Failed to parse response: ${data}`))
          }
        })
      })

      req.on('error', reject)
      req.on('timeout', () => {
        req.destroy()
        reject(new Error(`HTTP request to ${method} timed out`))
      })

      req.write(JSON.stringify(request))
      req.end()
    })
  }

  close(): void {
    // HTTP doesn't need cleanup
  }
}

// Socket RPC client
class SocketRpcClient implements RpcClient {
  private socket: net.Socket | null = null
  private buffer = ''
  private pendingRequests = new Map<
    number,
    { resolve: (result: unknown) => void; reject: (error: Error) => void }
  >()
  private nextId = 1

  async connect(socketPath: string): Promise<void> {
    return new Promise((resolve, reject) => {
      this.socket = net.createConnection(socketPath, () => {
        console.log(`Connected to sidecar at ${socketPath}`)
        resolve()
      })

      this.socket.on('error', (err) => {
        reject(err)
      })

      this.socket.on('data', (data) => {
        this.buffer += data.toString()
        this.processBuffer()
      })
    })
  }

  private processBuffer(): void {
    const lines = this.buffer.split('\n')
    this.buffer = lines.pop() || ''

    for (const line of lines) {
      if (line.trim()) {
        try {
          const response = JSON.parse(line)
          const pending = this.pendingRequests.get(response.id)
          if (pending) {
            this.pendingRequests.delete(response.id)
            if (response.error) {
              pending.reject(new Error(response.error.message))
            } else {
              pending.resolve(response.result)
            }
          }
        } catch (e) {
          console.error('Failed to parse response:', line)
        }
      }
    }
  }

  async call<T>(method: string, params?: unknown): Promise<T> {
    if (!this.socket) {
      throw new Error('Not connected')
    }

    const id = this.nextId++
    const request = {
      jsonrpc: '2.0',
      method,
      params: params ?? null,
      id,
    }

    return new Promise((resolve, reject) => {
      this.pendingRequests.set(id, {
        resolve: resolve as (result: unknown) => void,
        reject,
      })
      this.socket!.write(JSON.stringify(request) + '\n')

      // Timeout after 10 seconds
      setTimeout(() => {
        if (this.pendingRequests.has(id)) {
          this.pendingRequests.delete(id)
          reject(new Error(`RPC call ${method} timed out`))
        }
      }, 10000)
    })
  }

  close(): void {
    if (this.socket) {
      this.socket.end()
      this.socket = null
    }
  }
}

interface Repo {
  id: string
  rootPath: string
  name: string | null
}

interface Workspace {
  id: string
  directoryName: string
  branch: string | null
}

/**
 * Create test files in the worktree to have data for diff view tests
 */
function createTestFilesInWorktree(worktreePath: string): void {
  console.log(`Creating test files in: ${worktreePath}`)

  // Create a test directory with sample files
  const testDir = path.join(worktreePath, 'e2e-test-files')
  if (!fs.existsSync(testDir)) {
    fs.mkdirSync(testDir, { recursive: true })
  }

  // Create new files
  fs.writeFileSync(
    path.join(testDir, 'new-feature.ts'),
    `// New feature file for E2E testing
export function newFeature(): string {
  return 'Hello from E2E test!'
}
`
  )

  fs.writeFileSync(
    path.join(testDir, 'config.json'),
    JSON.stringify({ test: true, createdAt: Date.now() }, null, 2)
  )

  fs.writeFileSync(
    path.join(testDir, 'README.md'),
    `# E2E Test Files

This directory contains test files created for E2E testing.
These files demonstrate the diff view functionality.
`
  )

  // Modify an existing file (package.json should exist)
  const packageJsonPath = path.join(worktreePath, 'package.json')
  if (fs.existsSync(packageJsonPath)) {
    const content = fs.readFileSync(packageJsonPath, 'utf-8')
    const pkg = JSON.parse(content)
    pkg.e2eTestModified = Date.now() // Add a field to show as modified
    fs.writeFileSync(packageJsonPath, JSON.stringify(pkg, null, 2) + '\n')
    console.log('Modified package.json')
  }

  // Stage the new files to show as "added" in diff
  try {
    execSync('git add e2e-test-files/', { cwd: worktreePath, stdio: 'pipe' })
    console.log('Staged new files')
  } catch (e) {
    console.log('Could not stage files:', e)
  }

  console.log('Created test files for diff testing')
}

/**
 * Try to connect via HTTP first, then fall back to socket
 */
async function getClient(): Promise<RpcClient> {
  // Try HTTP first (more reliable for E2E tests)
  const httpClient = new HttpRpcClient(HTTP_PORT)
  try {
    // Test connection with a ping
    await httpClient.call('ping')
    console.log(`Connected via HTTP on port ${HTTP_PORT}`)
    return httpClient
  } catch (httpError) {
    console.log(`HTTP connection failed: ${httpError}`)
  }

  // Fall back to socket
  const socketPath = getSocketPath()
  console.log(`Trying socket connection: ${socketPath}`)
  
  const socketClient = new SocketRpcClient()
  
  // Wait for sidecar with retries
  const maxRetries = 30
  const retryDelay = 1000
  
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      await socketClient.connect(socketPath)
      return socketClient
    } catch (error) {
      if (attempt === maxRetries) {
        throw new Error(`Failed to connect via HTTP (port ${HTTP_PORT}) or socket (${socketPath})`)
      }
      console.log(`Waiting for sidecar (attempt ${attempt}/${maxRetries})...`)
      await new Promise((resolve) => setTimeout(resolve, retryDelay))
    }
  }
  
  throw new Error('Failed to connect to sidecar')
}

async function main() {
  console.log(`Seeding test data...`)
  console.log(`HTTP port: ${HTTP_PORT}`)
  console.log(`Socket: ${getSocketPath()}`)

  let client: RpcClient | null = null

  try {
    client = await getClient()

    // Check existing repos
    const repos = await client.call<Repo[]>('repo.list')
    console.log(`Found ${repos.length} existing repos`)

    let repoId: string
    const projectRoot = path.resolve(__dirname, '..')

    if (repos.length === 0) {
      // Register this project as a repo
      console.log(`Registering repo at: ${projectRoot}`)

      const newRepo = await client.call<Repo>('repo.create', {
        rootPath: projectRoot,
      })
      repoId = newRepo.id
      console.log(`Created repo: ${newRepo.id} (${newRepo.name})`)
    } else {
      repoId = repos[0].id
      console.log(`Using existing repo: ${repoId}`)
    }

    // Check existing workspaces
    const workspaces = await client.call<Workspace[]>('workspace.list')
    console.log(`Found ${workspaces.length} existing workspaces`)

    let worktreePath: string | null = null

    if (workspaces.length === 0) {
      // Create a test workspace using worktree
      const branchName = `e2e-test-${Date.now()}`
      console.log(`Creating worktree with branch: ${branchName}`)

      try {
        const workspace = await client.call<Workspace>('worktree.create', {
          repoId,
          branch: branchName,
        })
        console.log(`Created workspace: ${workspace.id} (${workspace.branch})`)
        worktreePath = path.join(projectRoot, '.worktrees', branchName)
      } catch (error) {
        // Worktree creation might fail if git isn't set up properly
        // Fall back to creating a simple workspace entry
        console.log('Worktree creation failed, creating simple workspace...')

        const workspace = await client.call<Workspace>('workspace.create', {
          directoryName: 'e2e-test-workspace',
          workspaceType: 'standard',
          repositoryId: repoId,
        })
        console.log(`Created workspace: ${workspace.id}`)
      }
    } else {
      console.log('Workspaces already exist, checking for existing worktree...')
      // Try to find existing worktree path
      const ws = workspaces[0]
      if (ws.branch) {
        worktreePath = path.join(projectRoot, '.worktrees', ws.branch)
      }
    }

    // Create test files in the worktree if it exists
    if (worktreePath && fs.existsSync(worktreePath)) {
      createTestFilesInWorktree(worktreePath)
    } else {
      console.log('No worktree path found, skipping test file creation')
    }

    // Verify final state
    const finalWorkspaces = await client.call<Workspace[]>('workspace.list')
    console.log(`\nFinal state: ${finalWorkspaces.length} workspace(s)`)
    for (const ws of finalWorkspaces) {
      console.log(`  - ${ws.directoryName} (${ws.branch || 'no branch'})`)
    }

    console.log('\nSeed complete!')
  } catch (error) {
    console.error('Seed failed:', error)
    process.exit(1)
  } finally {
    client?.close()
  }
}

main()
