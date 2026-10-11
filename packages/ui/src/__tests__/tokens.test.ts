import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import {
  baseTokens,
  baseColorTokens,
  foundationTokens,
  lightClassTokens,
  themes,
  spacing,
  typography,
} from '../tokens'

function resolveToken(value: string, tokens: Record<string, string>, seen = new Set<string>()): string {
  return value.replace(/var\((--[\w-]+)\)/g, (_match, name: string) => {
    if (seen.has(name)) throw new Error(`Circular token: ${name}`)
    const token = tokens[name]
    if (token === undefined) throw new Error(`Missing token: ${name}`)
    return resolveToken(token, tokens, new Set([...seen, name]))
  })
}

function declarations(css: string, selector: string): Record<string, string> {
  const start = css.indexOf(`${selector} {`)
  const block = css.slice(start, css.indexOf('}', start))
  return Object.fromEntries([...block.matchAll(/(--[\w-]+):\s*([^;]+);/g)].map(([, name, value]) => [name, value]))
}

describe('shared Koda tokens', () => {
  it.each(Object.entries(themes))('keeps %s meaningful text and status foregrounds at AA on desktop surfaces', (_name, theme) => {
    const tokens: Record<string, string> = { ...baseTokens, ...theme.variables }
    const rgb = (value: string): number[] => {
      if (value.startsWith('#')) return value.slice(1).match(/../g)!.map(v => parseInt(v, 16) / 255)
      return value.match(/[\d.]+/g)!.map((v, i) => i < 3 ? Number(v) / 255 : Number(v))
    }
    const blend = (color: number[], base: number[]) => color.slice(0, 3).map((v, i) => v * (color[3] ?? 1) + base[i]! * (1 - (color[3] ?? 1)))
    const luminance = (color: number[]) => color.map(v => v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4).reduce((sum, v, i) => sum + v * [0.2126, 0.7152, 0.0722][i]!, 0)
    const resolve = (key: string) => rgb(resolveToken(tokens[key]!, tokens))
    const base = resolve('--surface-base')
    for (const surface of ['base', 'sidebar', 'messages', 'card', 'card-strong', 'control', 'popover', 'composer', 'terminal', 'hover']) {
      const background = blend(resolve(`--surface-${surface}`), base)
      for (const text of ['text-primary', 'text-secondary', 'text-quiet', 'text-muted', 'text-subtle', 'text-faint', 'text-fainter', 'text-dim', 'text-action', ...['success', 'warning', 'error', 'processing', 'reviewing', 'ready', 'unread', 'unknown'].map(status => `status-${status}-foreground`)]) {
        const bg = luminance(background), fg = luminance(blend(resolve(`--${text}`), background))
        expect((Math.max(bg, fg) + 0.05) / (Math.min(bg, fg) + 0.05), `${text} on ${surface}`).toBeGreaterThanOrEqual(4.5)
      }
    }
  })

  it('provides the same complete color namespace in every theme, with valid aliases', () => {
    for (const theme of Object.values(themes)) {
      expect(Object.keys(theme.variables).sort()).toEqual(Object.keys(baseColorTokens).sort())
      const tokens = { ...baseTokens, ...theme.variables }
      for (const value of Object.values(tokens)) expect(() => resolveToken(value, tokens)).not.toThrow()
    }
  })

  it('keeps distributed CSS synchronized with the typed tokens and themes', () => {
    const css = readFileSync(new URL('../tokens.css', import.meta.url), 'utf8')
    expect(declarations(css, ':root')).toEqual(baseTokens)
    expect(declarations(css, '.light')).toEqual(lightClassTokens)
    for (const [name, theme] of Object.entries(themes)) {
      expect(declarations(css, `[data-koda-theme="${name}"]`)).toEqual(theme.variables)
    }
  })

  it.each(Object.entries(themes))('keeps %s floating surfaces opaque with AA secondary text', (name, theme) => {
    const tokens = { ...baseTokens, ...theme.variables }
    const surface = resolveToken(tokens['--surface-popover'], tokens)
    expect(surface).toMatch(/^#[0-9a-f]{6}$/i)
    expect(tokens['--surface-overlay']).toBe(name === 'light' ? 'rgba(0, 0, 0, 0.45)' : 'rgba(0, 0, 0, 0.8)')
    const luminance = (hex: string) => {
      const rgb = hex.slice(1).match(/../g)!.map(channel => {
        const value = parseInt(channel, 16) / 255
        return value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4
      })
      return rgb[0]! * 0.2126 + rgb[1]! * 0.7152 + rgb[2]! * 0.0722
    }
    const background = luminance(surface)
    const foreground = luminance(resolveToken(tokens['--text-secondary'], tokens))
    const ratio = (Math.max(background, foreground) + 0.05) / (Math.min(background, foreground) + 0.05)
    expect(ratio).toBeGreaterThanOrEqual(4.5)
  })

  it('makes shadcn colors aliases of named Koda colors', () => {
    for (const name of ['background', 'foreground', 'card', 'popover', 'primary', 'secondary', 'muted', 'accent', 'destructive', 'border', 'input', 'ring', 'chart-1', 'chart-2', 'chart-3', 'chart-4', 'chart-5']) {
      expect(baseColorTokens[`--${name}` as keyof typeof baseColorTokens]).toMatch(/^var\(--koda-[\w-]+\)$/)
    }
  })

  it('exposes the same spacing and type scales in CSS and TypeScript', () => {
    for (const [step, value] of Object.entries(spacing)) {
      expect(foundationTokens[`--space-${step.replace('.', '_')}` as keyof typeof foundationTokens]).toBe(value)
    }
    for (const [role, values] of Object.entries(typography)) {
      expect(foundationTokens[`--type-${role}-size` as keyof typeof foundationTokens]).toBe(values.fontSize)
      expect(foundationTokens[`--type-${role}-line-height` as keyof typeof foundationTokens]).toBe(values.lineHeight)
      expect(foundationTokens[`--type-${role}-tracking` as keyof typeof foundationTokens]).toBe(values.letterSpacing)
    }
  })
})
