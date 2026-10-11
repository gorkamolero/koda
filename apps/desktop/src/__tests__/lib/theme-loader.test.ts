import { afterEach, describe, expect, it } from 'vitest'
import {
  applyTheme,
  BUNDLED_THEMES,
  codexLightTheme,
  kodaGraphiteTheme,
  loadThemeFromJson,
  resetTheme,
} from '../../lib/theme-loader'

afterEach(() => {
  document.documentElement.removeAttribute('style')
  document.documentElement.removeAttribute('data-koda-theme')
  document.documentElement.className = ''
})

describe('shared token theme integration', () => {
  it('preserves persisted bundled IDs and sets the shared Storybook theme selector', () => {
    expect(Object.keys(BUNDLED_THEMES)).toEqual(['codex-dark', 'codex-light', 'codex-dim', 'koda-graphite'])
    applyTheme(kodaGraphiteTheme)
    expect(document.documentElement.dataset.kodaTheme).toBe('graphite')
    expect(document.documentElement.classList.contains('dark')).toBe(true)
    expect(document.documentElement.style.getPropertyValue('--surface-messages')).toBe(kodaGraphiteTheme.variables['--surface-messages'])
  })

  it('keeps imported VS Code translation working after a complete bundled theme', () => {
    applyTheme(codexLightTheme)
    const imported = loadThemeFromJson(JSON.stringify({
      name: 'Imported dusk',
      type: 'dark',
      colors: { 'editor.background': 'rgb(20, 24, 30)', 'editor.foreground': 'rgb(220, 224, 230)' },
    }))
    applyTheme(imported)
    expect(document.documentElement.dataset.kodaTheme).toBeUndefined()
    expect(document.documentElement.classList.contains('dark')).toBe(true)
    expect(document.documentElement.style.getPropertyValue('--surface-messages')).toBe('rgb(20, 24, 30)')
    expect(document.documentElement.style.getPropertyValue('--text-primary')).toBe('rgb(220, 224, 230)')
    // Unspecified compatibility colors must fall back to the active CSS class.
    expect(document.documentElement.style.getPropertyValue('--background')).toBe('')
  })

  it('resets shared declarations and returns to the default dark CSS tokens', () => {
    applyTheme(codexLightTheme)
    resetTheme()
    expect(document.documentElement.dataset.kodaTheme).toBeUndefined()
    expect(document.documentElement.classList.contains('dark')).toBe(true)
    expect(document.documentElement.style.getPropertyValue('--surface-sidebar')).toBe('')
  })
})
