import { createRequire } from 'node:module'
import { readFileSync } from 'node:fs'
import { test, expect } from '@playwright/test'

const desktopRequire = createRequire(new URL('../../apps/desktop/package.json', import.meta.url))
const uiTokens = readFileSync(new URL('../../packages/ui/src/tokens.css', import.meta.url), 'utf8')
const uiBaseStyles = readFileSync(new URL('../../packages/ui/src/styles.css', import.meta.url), 'utf8')
  .replace(/^@(?:import|tailwind).*;$/gm, '')

test.beforeEach(async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' })
})

for (const lifecycle of ['write', 'reset', 'open'] as const) {
  test(`disposing after ${lifecycle} leaves no unsafe viewport callbacks`, async ({ page }) => {
    const pageErrors: string[] = []
    page.on('pageerror', (error) => pageErrors.push(error.message))
    await page.setContent('<div id="terminal" style="width:800px;height:300px"></div>')
    await page.addStyleTag({ content: uiTokens + uiBaseStyles })
    await page.addStyleTag({ path: desktopRequire.resolve('xterm/css/xterm.css') })
    await page.addScriptTag({ path: desktopRequire.resolve('xterm') })

    const result = await page.evaluate(async (lifecycle) => {
      // Hold browser frames so public open/write/dispose deterministically occurs
      // before the queued viewport refresh, as when a user leaves the workspace.
      const callbacks = new Map<number, FrameRequestCallback>()
      let nextFrame = 1
      const nativeRequest = window.requestAnimationFrame
      const nativeCancel = window.cancelAnimationFrame
      window.requestAnimationFrame = (callback) => {
        const id = nextFrame++
        callbacks.set(id, callback)
        return id
      }
      window.cancelAnimationFrame = (id) => { callbacks.delete(id) }

      type BrowserTerminal = {
        open(element: HTMLElement): void
        write(data: string, callback: () => void): void
        reset(): void
        dispose(): void
      }
      const { Terminal } = window as unknown as {
        Terminal: new (options: { cols: number; rows: number; fontSize: number; lineHeight: number }) => BrowserTerminal
      }
      const terminal = new Terminal({ cols: 80, rows: 12, fontSize: 13, lineHeight: 1.2 })
      const errors: string[] = []
      try {
        terminal.open(document.getElementById('terminal')!)
        if (lifecycle !== 'open') {
          await new Promise<void>((resolve) => terminal.write('first\r\nsecond\r\nthird\r\n', resolve))
          // Advance actual browser frames so a mistaken CSS font transition
          // would finish while the terminal's queued refresh is still held.
          await new Promise<void>((resolve) => nativeRequest(() => resolve()))
          await new Promise<void>((resolve) => nativeRequest(() => resolve()))
        }
        if (lifecycle === 'reset') terminal.reset()
        const framesBeforeDispose = callbacks.size
        const terminalHeight = document.querySelector('.xterm-screen')!.getBoundingClientRect().height
        const rowHeight = document.querySelector('.xterm-rows>div')!.getBoundingClientRect().height
        const measureHeight = document.querySelector('.xterm-char-measure-element')!.getBoundingClientRect().height
        terminal.dispose()
        // The open case also covers xterm's initial asynchronous size sync.
        await new Promise<void>((resolve) => setTimeout(resolve, 0))
        const framesAfterDispose = callbacks.size
        // If a disposed dependency leaves work behind, execute it exactly as the
        // browser would on its next frame and surface the original exception.
        for (const [id, callback] of [...callbacks]) {
          callbacks.delete(id)
          try { callback(performance.now()) } catch (error) { errors.push(String(error)) }
        }
        return { framesBeforeDispose, framesAfterDispose, terminalHeight, rowHeight, measureHeight, errors }
      } finally {
        terminal.dispose()
        window.requestAnimationFrame = nativeRequest
        window.cancelAnimationFrame = nativeCancel
      }
    }, lifecycle)

    expect(result.terminalHeight).toBeGreaterThan(0)
    // Reduced-motion styles must not animate font changes during xterm's
    // synchronous measurement and leave the renderer with stale row geometry.
    if (lifecycle !== 'open') expect(result.rowHeight).toBe(Math.floor(Math.ceil(result.measureHeight) * 1.2))
    expect(result.framesBeforeDispose).toBeGreaterThan(0)
    expect(result.errors).toEqual([])
    if (lifecycle === 'write') expect(result.framesAfterDispose).toBe(0)
    expect(pageErrors).toEqual([])
  })
}

test('reduced motion keeps terminal font measurement synchronous', async ({ page }) => {
  await page.setContent('<span id="font-measure" style="font-size:16px">WWWW</span>')
  await page.addStyleTag({ content: uiTokens + uiBaseStyles })
  await page.addStyleTag({ path: desktopRequire.resolve('xterm/css/xterm.css') })
  const metrics = await page.evaluate(async () => {
    // This is xterm's measurement sequence: attach a span, then set its font
    // and synchronously read layout. A global font transition corrupts it.
    const measure = document.getElementById('font-measure')!
    const before = measure.getBoundingClientRect().height
    measure.style.fontSize = '13px'
    const immediateFontSize = getComputedStyle(measure).fontSize
    const immediateHeight = measure.getBoundingClientRect().height
    await new Promise<void>((resolve) => requestAnimationFrame(() => requestAnimationFrame(() => resolve())))
    return { before, immediateFontSize, immediateHeight, settledHeight: measure.getBoundingClientRect().height }
  })
  expect(metrics.immediateFontSize).toBe('13px')
  expect(metrics.immediateHeight).toBe(metrics.settledHeight)
  expect(metrics.immediateHeight).toBeLessThan(metrics.before)
})
