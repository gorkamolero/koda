import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest'
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
afterEach(() => { vi.unstubAllGlobals(); vi.restoreAllMocks() })
afterAll(() => { vi.unstubAllEnvs(); rmSync(directory, { recursive: true, force: true }) })
describe('service-mode onboarding', () => {
  it('persists settings, honors environment precedence, reports reachability and stores private keys with mode 0600', async () => {
    expect((await sync.collaborationStatus()).mode).toBe('not-configured')
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
