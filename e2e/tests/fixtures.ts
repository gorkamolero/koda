import { test as base, expect } from '@playwright/test'

/**
 * Extend the base test with Tauri mock setup.
 * All tests that use this `test` function will have Tauri mocks automatically set up.
 */
export const test = base.extend({
  page: async ({ page }, use) => {
    // Set up Tauri mocks before each test
    await page.addInitScript(() => {
      // Mock workspace/repo data
      const mockWorkspaces: unknown[] = []
      const mockRepos: unknown[] = []

      // Mock Tauri IPC
      ;(window as unknown as { __TAURI_INTERNALS__: unknown }).__TAURI_INTERNALS__ = {
        invoke: async (cmd: string, args?: unknown) => {
          // console.log('[Tauri Mock] invoke:', cmd, args)

          // Route commands
          switch (cmd) {
            // Sidecar management
            case 'spawn_sidecar':
              return { running: true, pid: 12345, socket_path: '/tmp/test.sock' }
            case 'stop_sidecar':
              return { running: false }
            case 'get_sidecar_status':
              return { running: true, pid: 12345, socket_path: '/tmp/test.sock' }

            // RPC calls via sidecar
            case 'rpc_call': {
              const rpcArgs = args as { method: string; params?: unknown }
              switch (rpcArgs.method) {
                case 'ping':
                  return 'pong'
                case 'getStatus':
                  return { status: 'ok', timestamp: Date.now(), version: '1.0.0' }
                case 'workspace.list':
                  return mockWorkspaces
                case 'repo.list':
                  return mockRepos
                case 'repo.create': {
                  const params = rpcArgs.params as { rootPath?: string }
                  const newRepo = {
                    id: `repo_${Date.now()}`,
                    rootPath: params?.rootPath || '/test/repo',
                    name: params?.rootPath?.split('/').pop() || 'test-repo',
                    createdAt: new Date().toISOString(),
                  }
                  mockRepos.push(newRepo)
                  return newRepo
                }
                case 'worktree.create': {
                  const params = rpcArgs.params as { branch?: string; repoId?: string }
                  const newWorkspace = {
                    id: `ws_${Date.now()}`,
                    directoryName: params?.branch || 'test-branch',
                    branch: params?.branch,
                    repositoryId: params?.repoId,
                    workspaceType: 'standard',
                    createdAt: new Date().toISOString(),
                  }
                  mockWorkspaces.push(newWorkspace)
                  return newWorkspace
                }
                case 'workspace.get': {
                  const params = rpcArgs.params as { id?: string }
                  return mockWorkspaces.find((w) => (w as { id: string }).id === params?.id) || {
                    id: params?.id,
                    directoryName: 'test-workspace',
                    branch: 'main',
                    workspaceType: 'standard',
                  }
                }
                case 'workspace.update':
                  return { success: true }
                case 'checkpoint.list':
                  return []
                case 'checkpoint.diff':
                  return { files: [], summary: { filesChanged: 0, additions: 0, deletions: 0 } }
                case 'claude.start':
                  return { sessionId: 'test-session', status: 'running' }
                case 'claude.getSession':
                  return null
                case 'claude.getMessages':
                  return []
                default:
                  // console.warn('[Tauri Mock] Unknown RPC method:', rpcArgs.method)
                  return null
              }
            }

            default:
              // console.warn('[Tauri Mock] Unknown command:', cmd)
              return null
          }
        },
        convertFileSrc: (path: string) => `file://${path}`,
        metadata: { currentWindow: { label: 'main' } },
      }

      // Also set __TAURI__ for older API
      ;(window as unknown as { __TAURI__: unknown }).__TAURI__ = {
        invoke: (window as unknown as { __TAURI_INTERNALS__: { invoke: unknown } }).__TAURI_INTERNALS__.invoke,
      }
    })

    // Pass the page to the test
    await use(page)
  },
})

export { expect }
