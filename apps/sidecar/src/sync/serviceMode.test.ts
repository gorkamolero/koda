import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { mkdtempSync, readFileSync, statSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { randomUUID } from 'node:crypto'
import { signCapability } from './capabilities.js'
let directory: string
let sync: typeof import('./LiveblocksClient.js')
beforeAll(async () => {
  directory = mkdtempSync(join(tmpdir(), 'koda-service-mode-'))
  vi.stubEnv('KODA_DATA_DIR', directory)
  vi.stubEnv('LIVEBLOCKS_SECRET_KEY', '')
  vi.stubEnv('KODA_COLLAB_URL', '')
  vi.stubEnv('KODA_USER_NAME', '')
  sync = await import('./LiveblocksClient.js')
})
beforeEach(() => {
  vi.stubEnv('KODA_COLLAB_MODE', '')
  vi.stubEnv('LIVEBLOCKS_SECRET_KEY', '')
  vi.stubEnv('KODA_COLLAB_URL', '')
  sync.setCollaborationSettings({ displayName: '', serviceUrl: '' })
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue(Response.json({ ok: true })))
})
afterEach(() => { vi.unstubAllGlobals(); vi.restoreAllMocks() })
afterAll(() => { vi.unstubAllEnvs(); rmSync(directory, { recursive: true, force: true }) })
describe('service-mode onboarding', () => {
  it('persists settings, honors environment precedence, reports reachability and stores private keys with mode 0600', async () => {
    expect(await sync.collaborationStatus()).toMatchObject({ mode: 'service', enabled: true, serviceUrl: 'https://koda-collaboration.gorka-molero.workers.dev' })
    sync.setCollaborationSettings({ displayName: 'Saved name', serviceUrl: 'https://configured.example.com/' })
    expect(sync.getMachineName()).toBe('Saved name')
    expect(sync.getServiceUrl()).toBe('https://configured.example.com')
    vi.stubEnv('KODA_USER_NAME', 'Environment name'); vi.stubEnv('KODA_COLLAB_URL', 'https://override.example.com')
    expect(sync.getMachineName()).toBe('Environment name')
    expect(sync.getServiceUrl()).toBe('https://override.example.com')
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(Response.json({ ok: true })))
    expect(await sync.collaborationStatus()).toMatchObject({ mode: 'service', reachable: true })
    const filename = join(directory, 'collaboration.json')
    const state = JSON.parse(readFileSync(filename, 'utf8')) as { device: { privateKey: string } }
    expect(state.device.privateKey).toContain('PRIVATE KEY')
    expect(statSync(filename).mode & 0o777).toBe(0o600)
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('offline')))
    expect(await sync.collaborationStatus()).toMatchObject({ mode: 'service', reachable: false })
  })
  it('redeems without a Liveblocks secret or host key and rejects service/workspace mismatches before storing', async () => {
    vi.stubEnv('KODA_COLLAB_URL', 'https://override.example.com')
    const worktreeId = randomUUID()
    const capability = { version: 1 as const, roomId: `workspace:${worktreeId}`, worktreeId, hostMachineId: 'remote-host', permission: 'view' as const, nonce: randomUUID(), serviceUrl: 'https://override.example.com', joinCode: 'private-code' }
    const invitation = signCapability(capability, 'host-only-key')
    const fetcher = vi.fn().mockImplementation((url: string) => Promise.resolve(Response.json(url.endsWith('/devices') ? { deviceId: 'device' } : { roomId: capability.roomId })))
    vi.stubGlobal('fetch', fetcher)
    expect(await sync.joinWorkspace(invitation)).toEqual(capability)
    expect(sync.getInvitation(capability.roomId).invitation).toBe(invitation)
    expect(sync.listSharedWorkspaces()).toHaveLength(1)
    expect(fetcher.mock.calls.some(([url]) => String(url).endsWith('/redeem'))).toBe(true)
    const other = signCapability({ ...capability, serviceUrl: 'https://other.example.com' }, 'host-only-key')
    await expect(sync.joinWorkspace(other)).rejects.toThrow('different collaboration service')
    fetcher.mockResolvedValueOnce(Response.json({ roomId: 'workspace:wrong' }))
    await expect(sync.joinWorkspace(signCapability({ ...capability, worktreeId: randomUUID(), roomId: `workspace:${randomUUID()}` }, 'key'))).rejects.toThrow('mismatch')
  })
})

it.each([
  ['', '', 'service', true],
  ['', 'unit-test-only', 'service', true],
  ['service', 'unit-test-only', 'service', true],
  ['development', 'unit-test-only', 'development-key', true],
  ['development', '', 'not-configured', false],
])('selects mode for request %s with configured key %s', async (requested, key, mode, enabled) => {
  vi.stubEnv('KODA_COLLAB_MODE', requested)
  vi.stubEnv('LIVEBLOCKS_SECRET_KEY', key)
  expect(await sync.collaborationStatus()).toMatchObject({ mode, enabled })
  if (requested === 'development') expect(fetch).not.toHaveBeenCalled()
})
it('keeps service invitations compatible with locally installed secrets and rejects both mode mismatches', async () => {
  const worktreeId = randomUUID()
  const capability = { version: 1 as const, roomId: `workspace:${worktreeId}`, worktreeId, hostMachineId: 'host', permission: 'view' as const, nonce: randomUUID() }
  const development = signCapability(capability, 'host-key')
  vi.stubEnv('LIVEBLOCKS_SECRET_KEY', 'unit-test-only')
  await expect(sync.joinWorkspace(development)).rejects.toThrow('requires development-key mode')
  const hosted = signCapability({ ...capability, serviceUrl: sync.getServiceUrl(), joinCode: 'test-code' }, 'host-key')
  vi.stubGlobal('fetch', vi.fn().mockImplementation(async () => Response.json({ roomId: capability.roomId })))
  await expect(sync.joinWorkspace(hosted)).resolves.toMatchObject({ roomId: capability.roomId })
  vi.stubEnv('KODA_COLLAB_MODE', 'development')
  await expect(sync.joinWorkspace(hosted)).rejects.toThrow('requires service mode')
  await expect(sync.joinWorkspace(development)).resolves.toMatchObject({ roomId: capability.roomId })
})
