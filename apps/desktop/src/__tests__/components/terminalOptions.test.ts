import { afterEach, describe, expect, it } from 'vitest'
import type { Terminal } from '@xterm/xterm'
import { themes } from '@koda/ui/tokens'
import { syncTerminalTheme } from '@/components/Terminal/terminalOptions'

afterEach(() => document.documentElement.removeAttribute('style'))

describe('terminal theme adapter', () => {
  it('updates an existing terminal on theme changes and disconnects on disposal', async () => {
    const options: Terminal['options'] = {}
    const terminal = { options } as Terminal
    const surface = '--surface-terminal'
    document.documentElement.style.setProperty(surface, themes.light.variables[surface])
    const stop = syncTerminalTheme(terminal)
    expect(options.theme?.background).toBe(themes.light.variables[surface])
    expect(options.minimumContrastRatio).toBe(4.5)
    document.documentElement.style.setProperty(surface, themes.graphite.variables['--surface-messages'])
    await new Promise(resolve => setTimeout(resolve, 0))
    expect(options.theme?.background).toBe(themes.graphite.variables['--surface-messages'])
    stop()
    document.documentElement.style.setProperty(surface, themes.light.variables[surface])
    await new Promise(resolve => setTimeout(resolve, 0))
    expect(options.theme?.background).toBe(themes.graphite.variables['--surface-messages'])
  })
})
