/**
 * Theme Loader Service
 *
 * Handles loading, applying, and persisting themes.
 */

import { translateTheme, parseThemeJson, type VSCodeTheme, type TranslatedTheme } from './theme-translator'

// ============================================================================
// CONSTANTS
// ============================================================================

const STORAGE_KEY = 'minnetonka-theme'
const CUSTOM_THEMES_KEY = 'minnetonka-custom-themes'

// ============================================================================
// BUNDLED THEMES
// ============================================================================

/**
 * KODA Obsidian - Deep blacks with warm terracotta accent (inspired by Conductor)
 */
export const codexDarkTheme: TranslatedTheme = {
  name: 'KODA Obsidian',
  type: 'dark',
  variables: {
    // Deep blacks - not plastic grays
    '--text-primary': '#c5c5c5',
    '--text-strong': '#e8e8e8',
    '--text-emphasis': '#d8d8d8',
    '--text-muted': '#9a9a9a',
    '--text-faint': '#5a5a5a',
    '--text-dim': '#3a3a3a',
    '--text-accent': 'rgba(224, 122, 95, 0.6)',
    '--surface-sidebar': '#050505',
    '--surface-topbar': '#050505',
    '--surface-messages': '#000000',
    '--surface-card': '#141414',
    '--surface-card-strong': '#1a1a1a',
    '--surface-control': '#141414',
    '--surface-hover': '#1a1a1a',
    '--surface-active': 'rgba(224, 122, 95, 0.15)',
    '--surface-popover': '#141414',
    '--surface-bubble-user': 'rgba(224, 122, 95, 0.15)',
    '--border-subtle': 'rgba(255, 255, 255, 0.05)',
    '--border-strong': 'rgba(255, 255, 255, 0.08)',
    '--border-accent': '#e07a5f',
    '--status-success': '#4ade80',
    '--status-warning': '#fbbf24',
    '--status-error': '#f87171',
    '--shadow-accent': 'rgba(0, 0, 0, 0.5)',
  },
}

/**
 * Light theme variant.
 */
export const codexLightTheme: TranslatedTheme = {
  name: 'Codex Light',
  type: 'light',
  variables: {
    '--text-primary': '#1a1a1a',
    '--text-strong': '#000000',
    '--text-emphasis': 'rgba(0, 0, 0, 0.9)',
    '--text-muted': 'rgba(0, 0, 0, 0.6)',
    '--text-faint': 'rgba(0, 0, 0, 0.4)',
    '--text-dim': 'rgba(0, 0, 0, 0.3)',
    '--text-accent': 'rgba(50, 120, 200, 0.8)',
    '--surface-sidebar': 'rgba(245, 245, 245, 0.9)',
    '--surface-topbar': 'rgba(250, 250, 250, 0.9)',
    '--surface-messages': 'rgba(255, 255, 255, 0.95)',
    '--surface-card': 'rgba(0, 0, 0, 0.03)',
    '--surface-card-strong': 'rgba(0, 0, 0, 0.08)',
    '--surface-control': 'rgba(0, 0, 0, 0.05)',
    '--surface-hover': 'rgba(0, 0, 0, 0.04)',
    '--surface-active': 'rgba(100, 200, 255, 0.2)',
    '--surface-popover': 'rgba(255, 255, 255, 0.98)',
    '--surface-bubble-user': 'rgba(60, 140, 255, 0.3)',
    '--border-subtle': 'rgba(0, 0, 0, 0.08)',
    '--border-strong': 'rgba(0, 0, 0, 0.12)',
    '--border-accent': 'rgba(60, 140, 255, 0.6)',
    '--status-success': 'rgba(34, 197, 94, 0.9)',
    '--status-warning': 'rgba(234, 179, 8, 0.9)',
    '--status-error': 'rgba(239, 68, 68, 0.9)',
    '--shadow-accent': 'rgba(60, 140, 255, 0.2)',
  },
}

/**
 * KODA Dim - Softer variant with same terracotta accent
 */
export const codexDimTheme: TranslatedTheme = {
  name: 'KODA Dim',
  type: 'dark',
  variables: {
    '--text-primary': '#b0b0b0',
    '--text-strong': '#d8d8d8',
    '--text-emphasis': '#c5c5c5',
    '--text-muted': '#7a7a7a',
    '--text-faint': '#4a4a4a',
    '--text-dim': '#3a3a3a',
    '--text-accent': 'rgba(224, 122, 95, 0.5)',
    '--surface-sidebar': '#0a0a0a',
    '--surface-topbar': '#0a0a0a',
    '--surface-messages': '#050505',
    '--surface-card': '#171717',
    '--surface-card-strong': '#1f1f1f',
    '--surface-control': '#171717',
    '--surface-hover': '#1f1f1f',
    '--surface-active': 'rgba(224, 122, 95, 0.12)',
    '--surface-popover': '#171717',
    '--surface-bubble-user': 'rgba(224, 122, 95, 0.12)',
    '--border-subtle': 'rgba(255, 255, 255, 0.04)',
    '--border-strong': 'rgba(255, 255, 255, 0.06)',
    '--border-accent': '#d97a5f',
    '--status-success': '#4ade80',
    '--status-warning': '#fbbf24',
    '--status-error': '#f87171',
    '--shadow-accent': 'rgba(0, 0, 0, 0.4)',
  },
}

/**
 * KODA Graphite - Cool gray surfaces with the same terracotta accent
 */
export const kodaGraphiteTheme: TranslatedTheme = {
  name: 'KODA Graphite',
  type: 'dark',
  variables: {
    '--text-primary': '#cdd0d4',
    '--text-strong': '#eceef1',
    '--text-emphasis': '#dde0e4',
    '--text-muted': '#9ba1a8',
    '--text-faint': '#6d737a',
    '--text-dim': '#4f545a',
    '--text-accent': 'rgba(224, 122, 95, 0.7)',
    '--surface-sidebar': '#1a1c20',
    '--surface-topbar': '#1a1c20',
    '--surface-messages': '#212328',
    '--surface-card': '#2a2d33',
    '--surface-card-strong': '#31353b',
    '--surface-control': '#2a2d33',
    '--surface-hover': '#2c2f35',
    '--surface-active': 'rgba(224, 122, 95, 0.18)',
    '--surface-popover': '#2a2d33',
    '--surface-bubble-user': 'rgba(224, 122, 95, 0.18)',
    '--border-subtle': 'rgba(255, 255, 255, 0.09)',
    '--border-strong': 'rgba(255, 255, 255, 0.14)',
    '--border-accent': '#e07a5f',
    '--status-success': '#4ade80',
    '--status-warning': '#fbbf24',
    '--status-error': '#f87171',
    '--shadow-accent': 'rgba(0, 0, 0, 0.4)',
  },
}

/**
 * All bundled themes.
 */
export const BUNDLED_THEMES: Record<string, TranslatedTheme> = {
  'codex-dark': codexDarkTheme,
  'codex-light': codexLightTheme,
  'codex-dim': codexDimTheme,
  'koda-graphite': kodaGraphiteTheme,
}

export const DEFAULT_THEME = 'codex-dark'

// ============================================================================
// THEME APPLICATION
// ============================================================================

/**
 * Apply theme variables to the document root.
 */
export function applyTheme(theme: TranslatedTheme): void {
  const root = document.documentElement

  // Apply each variable
  for (const [variable, value] of Object.entries(theme.variables)) {
    root.style.setProperty(variable, value)
  }

  // Set theme type class for light/dark mode specific styles
  root.classList.remove('light', 'dark')
  root.classList.add(theme.type)

  // Update meta theme-color for mobile browsers
  const metaThemeColor = document.querySelector('meta[name="theme-color"]')
  if (metaThemeColor) {
    const bgColor = theme.variables['--surface-sidebar'] || theme.variables['--surface-messages']
    if (bgColor) {
      metaThemeColor.setAttribute('content', bgColor)
    }
  }
}

/**
 * Reset theme to defaults (remove custom properties).
 */
export function resetTheme(): void {
  const root = document.documentElement

  // Remove all custom properties we might have set
  for (const variable of Object.keys(codexDarkTheme.variables)) {
    root.style.removeProperty(variable)
  }

  root.classList.remove('light')
  root.classList.add('dark')
}

// ============================================================================
// THEME LOADING
// ============================================================================

/**
 * Load a VS Code theme from a File object.
 */
export async function loadThemeFromFile(file: File): Promise<TranslatedTheme> {
  const text = await file.text()
  const theme = parseThemeJson(text)

  if (!theme) {
    throw new Error('Invalid theme file format')
  }

  // Use filename as theme name if not specified
  if (!theme.name) {
    theme.name = file.name.replace(/\.json$/, '')
  }

  return translateTheme(theme)
}

/**
 * Load a VS Code theme from a URL.
 */
export async function loadThemeFromUrl(url: string): Promise<TranslatedTheme> {
  const response = await fetch(url)
  if (!response.ok) {
    throw new Error(`Failed to fetch theme: ${response.statusText}`)
  }

  const text = await response.text()
  const theme = parseThemeJson(text)

  if (!theme) {
    throw new Error('Invalid theme file format')
  }

  return translateTheme(theme)
}

/**
 * Load a VS Code theme from a JSON string.
 */
export function loadThemeFromJson(json: string, name?: string): TranslatedTheme {
  const theme = parseThemeJson(json)

  if (!theme) {
    throw new Error('Invalid theme JSON')
  }

  if (name) {
    theme.name = name
  }

  return translateTheme(theme)
}

// ============================================================================
// PERSISTENCE
// ============================================================================

/**
 * Save active theme ID to localStorage.
 */
export function saveActiveTheme(themeId: string): void {
  try {
    localStorage.setItem(STORAGE_KEY, themeId)
  } catch {
    console.warn('Failed to save theme preference')
  }
}

/**
 * Load active theme ID from localStorage.
 */
export function loadActiveTheme(): string {
  try {
    return localStorage.getItem(STORAGE_KEY) || DEFAULT_THEME
  } catch {
    return DEFAULT_THEME
  }
}

/**
 * Save custom themes to localStorage.
 */
export function saveCustomThemes(themes: TranslatedTheme[]): void {
  try {
    localStorage.setItem(CUSTOM_THEMES_KEY, JSON.stringify(themes))
  } catch {
    console.warn('Failed to save custom themes')
  }
}

/**
 * Load custom themes from localStorage.
 */
export function loadCustomThemes(): TranslatedTheme[] {
  try {
    const stored = localStorage.getItem(CUSTOM_THEMES_KEY)
    if (stored) {
      return JSON.parse(stored) as TranslatedTheme[]
    }
  } catch {
    console.warn('Failed to load custom themes')
  }
  return []
}

/**
 * Generate a unique ID for a custom theme.
 */
export function generateThemeId(name: string): string {
  const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
  const timestamp = Date.now().toString(36)
  return `custom-${slug}-${timestamp}`
}

// ============================================================================
// INITIALIZATION
// ============================================================================

/**
 * Initialize theme system.
 * Call this on app startup.
 */
export function initializeTheme(): { themeId: string; theme: TranslatedTheme } {
  const themeId = loadActiveTheme()
  const customThemes = loadCustomThemes()

  // Find the theme
  let theme: TranslatedTheme | undefined

  // Check bundled themes first
  if (themeId in BUNDLED_THEMES) {
    theme = BUNDLED_THEMES[themeId]
  }

  // Check custom themes
  if (!theme) {
    theme = customThemes.find(t => generateThemeId(t.name) === themeId)
  }

  // Fall back to default (always exists)
  if (!theme) {
    const defaultTheme = BUNDLED_THEMES[DEFAULT_THEME]
    const firstTheme = Object.values(BUNDLED_THEMES)[0]
    theme = defaultTheme ?? firstTheme
    if (!theme) {
      throw new Error('No bundled themes available')
    }
  }

  // Apply the theme
  applyTheme(theme)

  return { themeId, theme }
}

// ============================================================================
// EXPORTS
// ============================================================================

export type { VSCodeTheme, TranslatedTheme }
