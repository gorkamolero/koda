import { createHash, createPrivateKey, generateKeyPairSync, randomUUID, sign } from 'node:crypto'

export type DeviceIdentity = { publicKey: string; privateKey: string }
export function createDeviceIdentity(): DeviceIdentity {
  const { publicKey, privateKey } = generateKeyPairSync('ed25519')
  const jwk = publicKey.export({ format: 'jwk' })
  return { publicKey: jwk.x!, privateKey: privateKey.export({ type: 'pkcs8', format: 'pem' }).toString() }
}
export function serviceOrigin(value: string): string {
  const url = new URL(value)
  if (url.username || url.password || url.search || url.hash || url.pathname !== '/' ||
      (url.protocol !== 'https:' && !(url.protocol === 'http:' && ['localhost', '127.0.0.1', '[::1]'].includes(url.hostname)))) {
    throw new Error('Use an HTTPS collaboration service origin (HTTP is allowed on localhost)')
  }
  return url.origin
}
const hash = (value: string) => createHash('sha256').update(value).digest('hex')
export function signedRequest(origin: string, identity: DeviceIdentity, path: string, body: unknown, method = 'POST') {
  const raw = JSON.stringify(body)
  const timestamp = String(Date.now())
  const nonce = randomUUID()
  const message = [method, path, origin, timestamp, nonce, hash(raw)].join('\n')
  return { method, body: raw, headers: {
    'Content-Type': 'application/json', 'x-koda-device': hash(identity.publicKey),
    'x-koda-timestamp': timestamp, 'x-koda-nonce': nonce,
    'x-koda-signature': sign(null, Buffer.from(message), createPrivateKey(identity.privateKey)).toString('base64url'),
  } }
}
export class CollaborationService {
  readonly origin: string
  private registeredName: string | undefined
  private registering: Promise<void> | undefined
  constructor(origin: string, readonly identity: DeviceIdentity, readonly name: () => string, readonly machineId: string) { this.origin = serviceOrigin(origin) }
  async request<T>(path: string, body: unknown, method = 'POST'): Promise<T> {
    const response = await fetch(`${this.origin}${path}`, { ...signedRequest(this.origin, this.identity, path, body, method), signal: AbortSignal.timeout(20000), redirect: 'error' })
    if (!response.ok) {
      const error = await response.json().catch(() => ({})) as { error?: string }
      throw new Error(error.error || `Collaboration service request failed (${response.status})`)
    }
    return response.json() as Promise<T>
  }
  async register() {
    const name = this.name().slice(0, 100)
    if (this.registeredName === name) return
    if (!this.registering) this.registering = this.request('/devices', { publicKey: this.identity.publicKey, name }).then(() => { this.registeredName = name }).finally(() => { this.registering = undefined })
    await this.registering
    if (this.registeredName !== name) await this.register()
  }
  async claim(roomId: string) { await this.register(); return this.request('/rooms/claim', { roomId }) }
  async code(roomId: string) { await this.register(); return this.request<{ code: string }>('/rooms/code', { roomId }) }
  async redeem(code: string) { await this.register(); return this.request<{ roomId: string }>('/redeem', { code }) }
  async token(roomId: string, role: 'host' | 'ui' | 'guest') { await this.register(); return this.request<{ token: string }>('/tokens', { roomId, role, machineId: this.machineId }) }
  async delete(roomId: string) { await this.register(); return this.request('/rooms', { roomId }, 'DELETE') }
  async reachable() {
    try { const response = await fetch(`${this.origin}/health`, { signal: AbortSignal.timeout(3000), redirect: 'error' }); return response.ok && (await response.json() as { ok?: boolean }).ok === true } catch { return false }
  }
}
