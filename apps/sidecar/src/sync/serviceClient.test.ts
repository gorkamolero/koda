import { afterEach, describe, expect, it, vi } from 'vitest'
import { createHash, createPublicKey, verify } from 'node:crypto'
import { CollaborationService, createDeviceIdentity, serviceOrigin, signedRequest } from './serviceClient.js'
import { parseCapability, signCapability, verifyCapability, type Capability } from './capabilities.js'

afterEach(() => { vi.unstubAllGlobals() })
it('signs method, path, origin, timestamp, nonce and the exact body with its device key', () => {
  const identity = createDeviceIdentity()
  const origin = 'https://collab.example.com'
  const request = signedRequest(origin, identity, '/tokens', { roomId: 'workspace:example', role: 'ui' })
  const h = request.headers
  const hash = (value: string) => createHash('sha256').update(value).digest('hex')
  const message = [request.method, '/tokens', origin, h['x-koda-timestamp'], h['x-koda-nonce'], hash(request.body)].join('\n')
  const key = createPublicKey({ key: { kty: 'OKP', crv: 'Ed25519', x: identity.publicKey }, format: 'jwk' })
  expect(verify(null, Buffer.from(message), key, Buffer.from(h['x-koda-signature'], 'base64url'))).toBe(true)
  expect(verify(null, Buffer.from(message + '!'), key, Buffer.from(h['x-koda-signature'], 'base64url'))).toBe(false)
  expect(h['x-koda-device']).toBe(hash(identity.publicKey))
  expect(signedRequest(origin, identity, '/tokens', {}).headers['x-koda-nonce']).not.toBe(h['x-koda-nonce'])
})
it('registers automatically once, sends roles, redeems codes, deletes rooms and surfaces service failures', async () => {
  const fetcher = vi.fn<Parameters<typeof fetch>, ReturnType<typeof fetch>>().mockImplementation(() => Promise.resolve(Response.json({ token: 'issued-token' })))
  vi.stubGlobal('fetch', fetcher)
  const name = { value: 'Gorka' }
  const client = new CollaborationService('https://collab.example.com/', createDeviceIdentity(), () => name.value, 'machine-a')
  await Promise.all([client.token('workspace:a', 'host'), client.token('workspace:a', 'ui')])
  expect(fetcher.mock.calls.filter(([url]) => String(url).endsWith('/devices'))).toHaveLength(1)
  expect(JSON.parse(fetcher.mock.calls[0][1]!.body as string)).toMatchObject({ name: 'Gorka' })
  expect(JSON.parse(fetcher.mock.calls[1][1]!.body as string)).toMatchObject({ role: 'host', machineId: 'machine-a' })
  await client.claim('workspace:a'); await client.code('workspace:a'); await client.redeem('private-code'); await client.delete('workspace:a')
  expect(fetcher.mock.calls.at(-1)?.[1]?.method).toBe('DELETE')
  name.value = 'Alex'; await client.register()
  expect(fetcher.mock.calls.filter(([url]) => String(url).endsWith('/devices'))).toHaveLength(2)
  fetcher.mockResolvedValueOnce(Response.json({ error: 'Room access denied' }, { status: 403 }))
  await expect(client.token('workspace:b', 'guest')).rejects.toThrow('Room access denied')
})
it('accepts HTTPS origins and loopback development, refuses credentials, paths and insecure remote origins', () => {
  expect(serviceOrigin('https://collab.example.com/')).toBe('https://collab.example.com')
  expect(serviceOrigin('http://127.0.0.1:8787')).toBe('http://127.0.0.1:8787')
  for (const url of ['http://example.com', 'https://user:secret@example.com', 'https://example.com/path', 'https://example.com?token=secret', 'https://example.com#fragment']) expect(() => serviceOrigin(url)).toThrow()
})
describe('host-local invitations', () => {
  const capability: Capability = { version: 1, roomId: 'workspace:12345678-1234-4234-8234-123456789abc', worktreeId: '12345678-1234-4234-8234-123456789abc', hostMachineId: 'host-a', permission: 'control', nonce: '12345678-1234-4234-8234-123456789def', serviceUrl: 'https://collab.example.com', joinCode: 'join-code' }
  it('lets a guest parse without the host key, but only the host can verify', () => {
    const invitation = signCapability(capability, 'local-random-host-key')
    expect(parseCapability(invitation)).toEqual(capability)
    expect(verifyCapability(invitation, 'local-random-host-key')).toEqual(capability)
    expect(() => verifyCapability(invitation, 'different-install-key')).toThrow('signature')
    expect(() => parseCapability(signCapability({ ...capability, roomId: 'workspace:other' }, 'local-key'))).toThrow('mismatch')
    expect(() => parseCapability(signCapability({ ...capability, joinCode: undefined }, 'local-key'))).toThrow('Incomplete')
  })
})
