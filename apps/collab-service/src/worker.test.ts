import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { Miniflare } from 'miniflare'
import { readFileSync } from 'node:fs'
import { createHash, generateKeyPairSync, randomUUID, sign } from 'node:crypto'

const origin = 'https://collaboration.test'
const hash = (value: string) => createHash('sha256').update(value).digest('hex')
function identity() {
  const { publicKey, privateKey } = generateKeyPairSync('ed25519')
  const key = publicKey.export({ format: 'jwk' }).x!
  return { key, privateKey, id: hash(key) }
}
type Device = ReturnType<typeof identity>
let worker: Miniflare
let calls: { path: string; method: string; body?: any }[]
function signed(device: Device, path: string, body: unknown, options: { method?: string; timestamp?: string; nonce?: string; origin?: string } = {}) {
  const raw = JSON.stringify(body)
  const timestamp = options.timestamp || String(Date.now())
  const nonce = options.nonce || randomUUID()
  const method = options.method || 'POST'
  return { method, body: raw, headers: {
    'x-koda-device': device.id, 'x-koda-timestamp': timestamp, 'x-koda-nonce': nonce,
    'x-koda-signature': sign(null, Buffer.from([method, path, options.origin || origin, timestamp, nonce, hash(raw)].join('\n')), device.privateKey).toString('base64url'),
  } }
}
async function request(device: Device, path: string, body: unknown, options = {}) { return worker.dispatchFetch(`${origin}${path}`, signed(device, path, body, options)) }
async function register(device: Device, ip = randomUUID()) {
  const init = signed(device, '/devices', { publicKey: device.key, name: 'Tester' })
  return worker.dispatchFetch(`${origin}/devices`, { ...init, headers: { ...init.headers, 'cf-connecting-ip': ip } })
}
async function claim(device: Device, roomId: string) { expect((await request(device, '/rooms/claim', { roomId })).status).toBe(200) }
const room = () => `workspace:${randomUUID()}`
beforeEach(async () => {
  calls = []
  worker = new Miniflare({ modules: true, scriptPath: 'dist/worker.js', compatibilityDate: '2026-08-01', d1Databases: ['DB'], bindings: { LIVEBLOCKS_SECRET_KEY: 'test-worker-only-secret' },
    outboundService: async request => {
      const path = new URL(request.url).pathname
      const body = request.method === 'POST' ? await request.json() : undefined
      calls.push({ path, method: request.method, body })
      expect(request.headers.get('Authorization')).toBe('Bearer test-worker-only-secret')
      if (request.method === 'GET') return new Response('', { status: 404 })
      if (path === '/v2/authorize-user') return Response.json({ token: 'mocked-at-http-boundary' })
      return Response.json({ id: 'room' })
    },
  })
  const db = await worker.getD1Database('DB')
  const migration = readFileSync('migrations/0001_identity.sql', 'utf8')
  await db.batch(migration.split(';').filter(s => s.trim()).map(sql => db.prepare(sql)))
})
afterEach(async () => { await worker.dispose() })
describe('signed device requests', () => {
  it('rejects changed body, method, path, origin, stale/future timestamps and replay', async () => {
    const device = identity()
    expect((await register(device)).status).toBe(200)
    const roomId = room()
    const init = signed(device, '/rooms/claim', { roomId })
    expect((await worker.dispatchFetch(`${origin}/rooms/claim`, { ...init, body: JSON.stringify({ roomId: room() }) })).status).toBe(401)
    expect((await worker.dispatchFetch(`${origin}/rooms/claim`, { ...init, method: 'DELETE' })).status).toBe(401)
    expect((await worker.dispatchFetch(`${origin}/tokens`, init)).status).toBe(401)
    expect((await request(device, '/rooms/claim', { roomId }, { origin: 'https://other.test' })).status).toBe(401)
    for (const offset of [-61000, 61000]) expect((await request(device, '/rooms/claim', { roomId }, { timestamp: String(Date.now() + offset) })).status).toBe(401)
    expect((await worker.dispatchFetch(`${origin}/rooms/claim`, init)).status).toBe(200)
    expect((await worker.dispatchFetch(`${origin}/rooms/claim`, init)).status).toBe(401)
  })
  it('requires possession of the public key used as the device ID', async () => {
    const device = identity(), other = identity()
    expect((await request(device, '/devices', { publicKey: other.key, name: 'Impersonator' })).status).toBe(401)
    expect((await request(device, '/tokens', { roomId: room(), role: 'ui' })).status).toBe(401)
  })
})
it('enforces ownership, owner-only invitation/deletion and the room cap under concurrent claims', async () => {
  const owner = identity(), stranger = identity()
  await register(owner); await register(stranger)
  const roomId = room()
  await claim(owner, roomId); await claim(owner, roomId)
  expect((await request(stranger, '/rooms/claim', { roomId })).status).toBe(403)
  expect((await request(stranger, '/rooms/code', { roomId })).status).toBe(403)
  expect((await request(stranger, '/rooms', { roomId }, { method: 'DELETE' })).status).toBe(403)
  const claims = await Promise.all(Array.from({ length: 25 }, () => request(owner, '/rooms/claim', { roomId: room() })))
  expect(claims.filter(r => r.status === 200)).toHaveLength(19)
  expect(claims.filter(r => r.status === 429)).toHaveLength(6)
  expect((await request(owner, '/rooms', { roomId }, { method: 'DELETE' })).status).toBe(200)
  expect((await request(owner, '/tokens', { roomId, role: 'host' })).status).toBe(403)
})
it('grants only the redeemed room, revokes codes and grants on replacement, and checks every token role', async () => {
  const owner = identity(), guest = identity(), stranger = identity()
  await register(owner); await register(guest); await register(stranger)
  const roomId = room(), otherRoom = room()
  await claim(owner, roomId); await claim(owner, otherRoom)
  for (const role of ['host', 'ui', 'guest']) expect((await request(stranger, '/tokens', { roomId, role, machineId: 'stranger' })).status).toBe(403)
  expect((await request(owner, '/tokens', { roomId, role: 'guest', machineId: 'host' })).status).toBe(403)
  const { code } = await (await request(owner, '/rooms/code', { roomId })).json() as { code: string }
  expect((await request(guest, '/redeem', { code })).status).toBe(200)
  for (const role of ['ui', 'guest']) expect((await request(guest, '/tokens', { roomId, role, machineId: 'guest' })).status).toBe(200)
  expect((await request(guest, '/tokens', { roomId, role: 'host', machineId: 'guest' })).status).toBe(403)
  expect((await request(guest, '/tokens', { roomId: otherRoom, role: 'ui', machineId: 'guest' })).status).toBe(403)
  for (const role of ['host', 'ui']) expect((await request(owner, '/tokens', { roomId, role, machineId: 'host' })).status).toBe(200)
  const tokens = calls.filter(call => call.path === '/v2/authorize-user')
  expect(tokens.map(call => call.body.permissions[roomId])).toEqual([
    ['room:read', 'room:presence:write', 'comments:read'], ['room:read', 'room:presence:write', 'comments:read'], ['room:write', 'comments:write'], ['room:read', 'room:presence:write', 'comments:read'],
  ])
  const replacement = await (await request(owner, '/rooms/code', { roomId })).json() as { code: string }
  expect(replacement.code).not.toBe(code)
  expect((await request(guest, '/redeem', { code })).status).toBe(403)
  for (const role of ['ui', 'guest']) expect((await request(guest, '/tokens', { roomId, role, machineId: 'guest' })).status).toBe(403)
  expect((await request(guest, '/redeem', { code: replacement.code })).status).toBe(200)
})
it('limits registration per IP and tokens per device', async () => {
  for (let n = 0; n < 10; n++) expect((await register(identity(), 'same-ip')).status).toBe(200)
  expect((await register(identity(), 'same-ip')).status).toBe(429)
  const owner = identity(); await register(owner)
  const roomId = room(); await claim(owner, roomId)
  for (let n = 0; n < 120; n++) expect((await request(owner, '/tokens', { roomId, role: 'host', machineId: 'host' })).status).toBe(200)
  expect((await request(owner, '/tokens', { roomId, role: 'host', machineId: 'host' })).status).toBe(429)
  expect(calls.filter(call => call.path === '/v2/authorize-user')).toHaveLength(120)
})
