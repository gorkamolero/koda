/** Frame capture of a real Koda page through Chrome's screencast, and its assembly into video. */
import type { CDPSession, Page } from '@playwright/test'
import { execFileSync } from 'node:child_process'
import { linkSync, mkdirSync, rmSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'

export type Frame = { file: string; at: number }

export class ScreenCapture {
  readonly frames: Frame[] = []
  private cdp: CDPSession | undefined

  constructor(readonly page: Page, readonly directory: string) { mkdirSync(directory, { recursive: true }) }

  async start() {
    const cdp = this.cdp = await this.page.context().newCDPSession(this.page)
    cdp.on('Page.screencastFrame', ({ data, sessionId }) => {
      const file = join(this.directory, `${String(this.frames.length).padStart(6, '0')}.jpg`)
      // Arrival time on this machine: both screens share one clock.
      this.frames.push({ file, at: Date.now() })
      writeFileSync(file, Buffer.from(data, 'base64'))
      void cdp.send('Page.screencastFrameAck', { sessionId }).catch(() => {})
    })
    // Device-scale frames require the browser to run with --force-device-scale-factor.
    await cdp.send('Page.startScreencast', { format: 'jpeg', quality: 85, maxWidth: 3840, maxHeight: 4320 })
  }

  async stop() {
    await this.cdp?.send('Page.stopScreencast').catch(() => {})
    await this.cdp?.detach().catch(() => {})
  }

  /** Encodes [from, to] at a constant rate; every tick shows the newest frame captured by then. */
  assemble(from: number, to: number, output: string, fps = 60) {
    writeFileSync(join(this.directory, 'frames.json'), JSON.stringify(this.frames))
    encodeFrames(this.frames, from, to, join(this.directory, 'cfr'), output, fps)
  }
}

export function encodeFrames(frames: Frame[], from: number, to: number, directory: string, output: string, fps = 60) {
  if (!frames.length) throw new Error('No frames captured')
  rmSync(directory, { recursive: true, force: true })
  mkdirSync(directory, { recursive: true })
  const ticks = Math.round(((to - from) / 1000) * fps)
  let current = 0
  for (let tick = 0; tick < ticks; tick++) {
    const at = from + (tick * 1000) / fps
    while (current + 1 < frames.length && frames[current + 1]!.at <= at) current++
    linkSync(frames[current]!.file, join(directory, `${String(tick).padStart(6, '0')}.jpg`))
  }
  execFileSync('ffmpeg', ['-y', '-loglevel', 'error', '-framerate', String(fps), '-i', join(directory, '%06d.jpg'),
    '-vf', 'format=yuv420p', '-c:v', 'libx264', '-preset', 'slow', '-crf', '12', '-movflags', '+faststart', output])
}

/** A visible pointer for headless pages, so viewers can follow clicks. */
export function installPointer() {
  const install = () => {
    if (document.getElementById('koda-demo-pointer')) return
    const pointer = document.createElement('div')
    pointer.id = 'koda-demo-pointer'
    pointer.innerHTML = '<svg width="26" height="26" viewBox="0 0 24 24"><path d="M4 2.5 19.5 12l-6.8 1.6L9 20.5z" fill="#fff" stroke="#000" stroke-width="1.4" stroke-linejoin="round"/></svg>'
    // The browser animates the glide between pointer positions at its full frame rate.
    Object.assign(pointer.style, { position: 'fixed', left: '0', top: '0', zIndex: '2147483647', pointerEvents: 'none', transform: 'translate(-80px, -80px)', filter: 'drop-shadow(0 2px 3px rgba(0,0,0,.6))', transition: 'transform 700ms cubic-bezier(0.22, 0.7, 0.2, 1)' })
    document.documentElement.appendChild(pointer)
    addEventListener('mousemove', (event) => { pointer.style.transform = `translate(${event.clientX - 4}px, ${event.clientY - 3}px)` }, true)
    addEventListener('mousedown', () => { pointer.animate([{ scale: '1' }, { scale: '0.82' }, { scale: '1' }], { duration: 220 }) }, true)
  }
  if (document.readyState === 'loading') addEventListener('DOMContentLoaded', install)
  else install()
}
