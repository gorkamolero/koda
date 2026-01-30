import { Page } from '@playwright/test'

/**
 * Mock Tauri IPC for browser-based E2E tests
 *
 * This allows testing the UI without running inside Tauri's webview.
 * The mocks return minimal data to allow the app to render.
 */
export async function setupTauriMocks(page: Page) {
  await page.addInitScript(() => {
    // Mock workspace/repo data
    const mockWorkspaces: unknown[] = []
    const mockRepos: unknown[] = []

    // Mock Tauri IPC
    ;(window as unknown as { __TAURI_INTERNALS__: unknown }).__TAURI_INTERNALS__ = {
      invoke: async (cmd: string, args?: unknown) => {
        console.log('[Tauri Mock] invoke:', cmd, args)

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
                const newRepo = {
                  id: `repo_${Date.now()}`,
                  ...(rpcArgs.params as object),
                  name: (rpcArgs.params as { rootPath?: string })?.rootPath?.split('/').pop(),
                  createdAt: new Date().toISOString(),
                }
                mockRepos.push(newRepo)
                return newRepo
              }
              case 'worktree.create': {
                const newWorkspace = {
                  id: `ws_${Date.now()}`,
                  directoryName: (rpcArgs.params as { branch?: string })?.branch || 'test-branch',
                  branch: (rpcArgs.params as { branch?: string })?.branch,
                  workspaceType: 'standard',
                  createdAt: new Date().toISOString(),
                }
                mockWorkspaces.push(newWorkspace)
                return newWorkspace
              }
              case 'workspace.get': {
                const id = (rpcArgs.params as { id?: string })?.id
                return mockWorkspaces.find((w: unknown) => (w as { id: string }).id === id) || {
                  id,
                  directoryName: 'test-workspace',
                  branch: 'main',
                  workspaceType: 'standard',
                }
              }
              case 'workspace.update':
                return { success: true }
              case 'checkpoint.list':
                return []
              case 'claude.start':
                return { sessionId: 'test-session', status: 'running' }
              case 'claude.getSession':
                return null
              case 'claude.getMessages':
                return []
              default:
                console.warn('[Tauri Mock] Unknown RPC method:', rpcArgs.method)
                return null
            }
          }

          default:
            console.warn('[Tauri Mock] Unknown command:', cmd)
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
}

/**
 * Add a workspace to the mock data
 */
export async function addMockWorkspace(page: Page, workspace: {
  id: string
  directoryName: string
  branch?: string
  workspaceType?: string
}) {
  await page.evaluate((ws) => {
    const win = window as unknown as { __mockWorkspaces: unknown[] }
    if (!win.__mockWorkspaces) win.__mockWorkspaces = []
    win.__mockWorkspaces.push({
      ...ws,
      createdAt: new Date().toISOString(),
    })
  }, workspace)
}

/**
 * Add a repo to the mock data
 */
export async function addMockRepo(page: Page, repo: {
  id: string
  rootPath: string
  name?: string
}) {
  await page.evaluate((r) => {
    const win = window as unknown as { __mockRepos: unknown[] }
    if (!win.__mockRepos) win.__mockRepos = []
    win.__mockRepos.push({
      ...r,
      createdAt: new Date().toISOString(),
    })
  }, repo)
}
