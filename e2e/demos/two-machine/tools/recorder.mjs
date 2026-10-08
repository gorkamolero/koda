// Captures one page of this machine's Chromium (debugging port on localhost)
// as JPEG frames stamped with this machine's clock.
// Usage: node recorder.mjs <port> <url-prefix> <directory>
// stdin: "ping" → "pong <ms>", "stop" → writes frames.json, prints "stopped <n>".
import { mkdirSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { createInterface } from 'node:readline'

const [port, urlPrefix, directory] = process.argv.slice(2)
mkdirSync(directory, { recursive: true })
const targets = await (await fetch(`http://127.0.0.1:${port}/json/list`)).json()
const target = targets.find((item) => item.type === 'page' && item.url.startsWith(urlPrefix))
if (!target) { console.log(`error no page at ${urlPrefix}`); process.exit(1) }

const socket = new WebSocket(target.webSocketDebuggerUrl)
const pending = new Map()
let nextId = 0
const send = (method, params = {}) => new Promise((resolve, reject) => {
  const id = ++nextId
  pending.set(id, { resolve, reject })
  socket.send(JSON.stringify({ id, method, params }))
})
const frames = []
socket.onmessage = ({ data }) => {
  const message = JSON.parse(data)
  if (message.id) {
    const waiter = pending.get(message.id)
    pending.delete(message.id)
    if (message.error) waiter?.reject(new Error(message.error.message))
    else waiter?.resolve(message.result)
    return
  }
  if (message.method !== 'Page.screencastFrame') return
  const name = `${String(frames.length).padStart(6, '0')}.jpg`
  frames.push({ name, at: Date.now() })
  writeFileSync(join(directory, name), Buffer.from(message.params.data, 'base64'))
  socket.send(JSON.stringify({ id: ++nextId, method: 'Page.screencastFrameAck', params: { sessionId: message.params.sessionId } }))
}
await new Promise((resolve, reject) => { socket.onopen = resolve; socket.onerror = reject })
await send('Page.startScreencast', { format: 'jpeg', quality: 85, maxWidth: 3840, maxHeight: 4320 })
console.log('ready')

for await (const line of createInterface({ input: process.stdin })) {
  if (line === 'ping') console.log(`pong ${Date.now()}`)
  if (line === 'stop') {
    await send('Page.stopScreencast')
    writeFileSync(join(directory, 'frames.json'), JSON.stringify(frames))
    console.log(`stopped ${frames.length}`)
    socket.close()
    process.exit(0)
  }
}
