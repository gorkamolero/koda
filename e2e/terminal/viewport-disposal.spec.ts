import { createRequire } from 'node:module'
import { test, expect } from '@playwright/test'

const desktopRequire = createRequire(new URL('../../apps/desktop/package.json', import.meta.url))

for (const lifecycle of ['write', 'reset', 'open'] as const) {
  test(`disposing after ${lifecycle} leaves no unsafe viewport callbacks`, async ({ page }) => {
    const pageErrors: string[] = []
    page.on('pageerror', (error) => pageErrors.push(error.message))
    await page.setContent('<div id="terminal" style="width:800px;height:300px"></div>')
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
        Terminal: new (options: { cols: number; rows: number }) => BrowserTerminal
      }
      const terminal = new Terminal({ cols: 80, rows: 12 })
      const errors: string[] = []
      try {
        terminal.open(document.getElementById('terminal')!)
        if (lifecycle !== 'open') {
          await new Promise<void>((resolve) => terminal.write('first\r\nsecond\r\nthird\r\n', resolve))
        }
        if (lifecycle === 'reset') terminal.reset()
        const framesBeforeDispose = callbacks.size
        const terminalHeight = document.querySelector('.xterm-screen')!.getBoundingClientRect().height
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
        return { framesBeforeDispose, framesAfterDispose, terminalHeight, errors }
      } finally {
        terminal.dispose()
        window.requestAnimationFrame = nativeRequest
        window.cancelAnimationFrame = nativeCancel
      }
    }, lifecycle)

    expect(result.terminalHeight).toBeGreaterThan(0)
    expect(result.framesBeforeDispose).toBeGreaterThan(0)
    expect(result.errors).toEqual([])
    if (lifecycle === 'write') expect(result.framesAfterDispose).toBe(0)
    expect(pageErrors).toEqual([])
  })
}
