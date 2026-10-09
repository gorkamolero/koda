interface Env { DB: D1Database; LIVEBLOCKS_SECRET_KEY: string }
class Failure extends Error { constructor(readonly status: number, message: string) { super(message) } }
const encoder = new TextEncoder()
export async function digest(value: string) {
  return [...new Uint8Array(await crypto.subtle.digest('SHA-256', encoder.encode(value)))].map(b => b.toString(16).padStart(2, '0')).join('')
}
function bytes(value: string) { return Uint8Array.from(atob(value.replace(/-/g, '+').replace(/_/g, '/')), c => c.charCodeAt(0)) }
function encode(value: Uint8Array) { return btoa(String.fromCharCode(...value)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '') }
function field(body: Record<string, unknown>, key: string, max = 200) {
  const value = body[key]
  if (typeof value !== 'string' || !value.trim() || value.length > max) throw new Failure(400, `Invalid ${key}`)
  return value
}
async function limit(env: Env, scope: string, maximum: number, seconds: number) {
  const bucket = Math.floor(Date.now() / (seconds * 1000))
  const result = await env.DB.prepare('INSERT INTO limits(scope,bucket,count) VALUES(?,?,1) ON CONFLICT(scope,bucket) DO UPDATE SET count=count+1 RETURNING count').bind(scope, bucket).first<{ count: number }>()
  if (!result || result.count > maximum) throw new Failure(429, 'Collaboration rate limit reached; retry later')
}
async function liveblocks(env: Env, path: string, method: string, body?: unknown) {
  const response = await fetch(`https://api.liveblocks.io/v2${path}`, { method, headers: { Authorization: `Bearer ${env.LIVEBLOCKS_SECRET_KEY}`, 'Content-Type': 'application/json' }, body: body === undefined ? undefined : JSON.stringify(body), signal: AbortSignal.timeout(15000) })
  if (!response.ok && !(method === 'DELETE' && response.status === 404)) throw new Failure(502, 'Liveblocks service unavailable')
  return response
}
async function handle(request: Request, env: Env) {
  const url = new URL(request.url)
  if (request.method === 'GET' && url.pathname === '/health') return Response.json({ ok: true })
  if (url.search || !['POST', 'DELETE'].includes(request.method)) throw new Failure(404, 'Unknown endpoint')
  if (Number(request.headers.get('content-length')) > 8192) throw new Failure(413, 'Request too large')
  const raw = await request.text()
  if (raw.length > 8192) throw new Failure(413, 'Request too large')
  let body: Record<string, unknown>
  try { body = JSON.parse(raw); if (!body || Array.isArray(body) || typeof body !== 'object') throw new Error() } catch { throw new Failure(400, 'Invalid JSON') }
  const device = request.headers.get('x-koda-device') || ''
  const timestamp = request.headers.get('x-koda-timestamp') || ''
  const nonce = request.headers.get('x-koda-nonce') || ''
  if (!/^[a-f0-9]{64}$/.test(device) || !/^\d{13}$/.test(timestamp) || !/^[\w-]{16,100}$/.test(nonce) || Math.abs(Date.now() - Number(timestamp)) > 60000) throw new Failure(401, 'Invalid request timestamp or identity')
  const registering = request.method === 'POST' && url.pathname === '/devices'
  const stored = await env.DB.prepare('SELECT public_key,name FROM devices WHERE id=?').bind(device).first<{ public_key: string; name: string }>()
  const publicKey = registering ? field(body, 'publicKey', 100) : stored?.public_key
  if (!publicKey || await digest(publicKey) !== device) throw new Failure(401, 'Unknown device')
  try {
    const key = await crypto.subtle.importKey('raw', bytes(publicKey), { name: 'Ed25519' }, false, ['verify'])
    const message = [request.method, url.pathname, url.origin, timestamp, nonce, await digest(raw)].join('\n')
    if (!await crypto.subtle.verify('Ed25519', key, bytes(request.headers.get('x-koda-signature') || ''), encoder.encode(message))) throw new Error()
  } catch { throw new Failure(401, 'Invalid request signature') }
  // A unique insertion is the replay barrier across Worker instances.
  await env.DB.prepare('DELETE FROM nonces WHERE expires < ?').bind(Date.now()).run()
  const inserted = await env.DB.prepare('INSERT OR IGNORE INTO nonces VALUES(?,?,?)').bind(device, nonce, Number(timestamp) + 60000).run()
  if (!inserted.meta.changes) throw new Failure(401, 'Reused request nonce')
  await env.DB.prepare('DELETE FROM limits WHERE bucket < ? AND scope LIKE ?').bind(Math.floor(Date.now() / 3600000) - 2, 'register:%').run()
  await env.DB.prepare('DELETE FROM limits WHERE bucket < ? AND scope LIKE ?').bind(Math.floor(Date.now() / 60000) - 2, 'token:%').run()
  if (registering) {
    await limit(env, `register:${await digest(request.headers.get('cf-connecting-ip') || 'local')}`, 10, 3600)
    const name = field(body, 'name', 100).trim()
    await env.DB.prepare('INSERT INTO devices VALUES(?,?,?) ON CONFLICT(id) DO UPDATE SET name=excluded.name').bind(device, publicKey, name).run()
    return Response.json({ deviceId: device })
  }
  if (!stored) throw new Failure(401, 'Unknown device')
  if (url.pathname === '/redeem' && request.method === 'POST') {
    const code = field(body, 'code', 100)
    const result = await env.DB.prepare('INSERT INTO grants(room,device,generation) SELECT id,?,generation FROM rooms WHERE code_hash=? ON CONFLICT(room,device) DO UPDATE SET generation=excluded.generation RETURNING room').bind(device, await digest(code)).first<{ room: string }>()
    if (!result) throw new Failure(403, 'Invitation has been revoked or is invalid')
    return Response.json({ roomId: result.room })
  }
  const roomId = field(body, 'roomId', 100)
  if (!/^workspace:[0-9a-f-]{36}$/.test(roomId)) throw new Failure(400, 'Invalid roomId')
  if (url.pathname === '/rooms/claim' && request.method === 'POST') {
    // Count and claim happen in one SQL statement, so concurrent claims cannot bypass the cap.
    await env.DB.prepare('INSERT OR IGNORE INTO rooms(id,owner,generation) SELECT ?,?,? WHERE (SELECT COUNT(*) FROM rooms WHERE owner=?) < 20').bind(roomId, device, crypto.randomUUID(), device).run()
    const room = await env.DB.prepare('SELECT owner FROM rooms WHERE id=?').bind(roomId).first<{ owner: string }>()
    if (!room) throw new Failure(429, 'Room limit reached (20 per device)')
    if (room.owner !== device) throw new Failure(403, 'Room already claimed by another device')
    // Ownership is retained on a transient upstream failure, and retry is idempotent.
    const existing = await fetch(`https://api.liveblocks.io/v2/rooms/${encodeURIComponent(roomId)}`, { headers: { Authorization: `Bearer ${env.LIVEBLOCKS_SECRET_KEY}` }, signal: AbortSignal.timeout(15000) })
    if (existing.status === 404) await liveblocks(env, '/rooms', 'POST', { id: roomId, defaultAccesses: [] })
    else if (!existing.ok) throw new Failure(502, 'Liveblocks service unavailable')
    return Response.json({ roomId })
  }
  const room = await env.DB.prepare('SELECT owner,generation FROM rooms WHERE id=?').bind(roomId).first<{ owner: string; generation: string }>()
  if (!room) throw new Failure(403, 'Room access denied')
  if (url.pathname === '/rooms' && request.method === 'DELETE') {
    if (room.owner !== device) throw new Failure(403, 'Only the owner can delete this room')
    await liveblocks(env, `/rooms/${encodeURIComponent(roomId)}`, 'DELETE')
    await env.DB.prepare('DELETE FROM rooms WHERE id=? AND owner=?').bind(roomId, device).run()
    return Response.json({ deleted: true })
  }
  if (url.pathname === '/rooms/code' && request.method === 'POST') {
    if (room.owner !== device) throw new Failure(403, 'Only the owner can invite')
    const code = encode(crypto.getRandomValues(new Uint8Array(32)))
    await env.DB.batch([
      env.DB.prepare('DELETE FROM grants WHERE room=?').bind(roomId),
      env.DB.prepare('UPDATE rooms SET code_hash=?,generation=? WHERE id=? AND owner=?').bind(await digest(code), crypto.randomUUID(), roomId, device),
    ])
    return Response.json({ code })
  }
  if (url.pathname === '/tokens' && request.method === 'POST') {
    await limit(env, `token:${device}`, 120, 60)
    const role = field(body, 'role', 10)
    if (!['host', 'ui', 'guest'].includes(role)) throw new Failure(400, 'Invalid token role')
    const grant = await env.DB.prepare('SELECT 1 FROM grants g JOIN rooms r ON r.id=g.room AND r.generation=g.generation WHERE g.room=? AND g.device=?').bind(roomId, device).first()
    if ((role === 'host' && room.owner !== device) || (role === 'guest' && !grant) || (role === 'ui' && room.owner !== device && !grant)) throw new Failure(403, 'Room access denied')
    const permissions = role === 'host' ? ['room:write', 'comments:write'] : ['room:read', 'room:presence:write', 'comments:read']
    const response = await liveblocks(env, '/authorize-user', 'POST', { userId: `${device}:${role}`, userInfo: { name: stored.name, machineId: field(body, 'machineId', 100), color: '#22c55e' }, permissions: { [roomId]: permissions } })
    return Response.json(await response.json())
  }
  throw new Failure(404, 'Unknown endpoint')
}
export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    try { return await handle(request, env) }
    catch (error) { return Response.json({ error: error instanceof Failure ? error.message : 'Collaboration service unavailable' }, { status: error instanceof Failure ? error.status : 503 }) }
  },
}
