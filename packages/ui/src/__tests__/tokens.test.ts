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
  type ThemeDefinition,
} from '../tokens'
import legacyThemeValues from './legacy-theme-values.json'

function resolveToken(value: string, tokens: Record<string, string>, seen = new Set<string>()): string {
  return value.replace(/var\((--[\w-]+)\)/g, (_match, name: string) => {
    if (seen.has(name)) throw new Error(`Circular token: ${name}`)
    const token = tokens[name]
    if (token === undefined) throw new Error(`Missing token: ${name}`)
    return resolveToken(token, tokens, new Set([...seen, name]))
  })
}

const legacyThemes: Record<string, ThemeDefinition> = {
  codexDarkTheme: themes.obsidian,
  codexLightTheme: themes.light,
  codexDimTheme: themes.dim,
  kodaGraphiteTheme: themes.graphite,
}

function declarations(css: string, selector: string): Record<string, string> {
  const start = css.indexOf(`${selector} {`)
  const block = css.slice(start, css.indexOf('}', start))
  return Object.fromEntries([...block.matchAll(/(--[\w-]+):\s*([^;]+);/g)].map(([, name, value]) => [name, value]))
}

describe('shared Koda tokens', () => {
  it.each(Object.entries(legacyThemeValues))('preserves every pre-move desktop value in %s', (name, expected) => {
    const theme = legacyThemes[name]!
    const tokens = { ...baseTokens, ...theme.variables }
    // Fixture captured from the original :root + .light + bundled theme cascade.
    // Resolving aliases catches visually different substitutions, not just names.
    for (const [key, value] of Object.entries(expected)) {
      // koda-token-exception: Regression reference for the intentionally opaque Light surface.
      const current = name === 'codexLightTheme' && key === '--surface-popover' ? '#ffffff' : value
      expect(resolveToken(tokens[key as keyof typeof tokens], tokens), `${theme.name}: ${key}`).toBe(current)
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
