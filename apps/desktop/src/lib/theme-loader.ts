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
 * CodexMonitor-inspired dark theme (default).
 */
export const codexDarkTheme: TranslatedTheme = {
  name: 'Codex Dark',
  type: 'dark',
  variables: {
    // These are the defaults from index.css - they serve as fallback values
    '--text-primary': '#e6e7ea',
    '--text-strong': '#ffffff',
    '--text-emphasis': 'rgba(255, 255, 255, 0.9)',
    '--text-muted': 'rgba(255, 255, 255, 0.7)',
    '--text-faint': 'rgba(255, 255, 255, 0.5)',
    '--text-dim': 'rgba(255, 255, 255, 0.35)',
    '--text-accent': 'rgba(164, 195, 255, 0.7)',
    '--surface-sidebar': 'rgba(18, 18, 18, 0.5)',
    '--surface-topbar': 'rgba(10, 14, 20, 0.45)',
    '--surface-messages': 'rgba(8, 10, 16, 0.45)',
    '--surface-card': 'rgba(255, 255, 255, 0.04)',
    '--surface-card-strong': 'rgba(255, 255, 255, 0.12)',
    '--surface-control': 'rgba(255, 255, 255, 0.08)',
    '--surface-hover': 'rgba(255, 255, 255, 0.05)',
    '--surface-active': 'rgba(100, 200, 255, 0.14)',
    '--surface-popover': 'rgba(10, 14, 20, 0.995)',
    '--surface-bubble-user': 'rgba(77, 153, 255, 0.45)',
    '--border-subtle': 'rgba(255, 255, 255, 0.08)',
    '--border-strong': 'rgba(255, 255, 255, 0.14)',
    '--border-accent': 'rgba(100, 200, 255, 0.6)',
    '--status-success': 'rgba(120, 235, 190, 0.95)',
    '--status-warning': 'rgba(255, 175, 85, 0.95)',
    '--status-error': 'rgba(255, 110, 110, 0.95)',
    '--shadow-accent': 'rgba(92, 168, 255, 0.28)',
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
 * Dim theme variant (softer dark).
 */
export const codexDimTheme: TranslatedTheme = {
  name: 'Codex Dim',
  type: 'dark',
  variables: {
    '--text-primary': '#c8c8c8',
    '--text-strong': '#e8e8e8',
    '--text-emphasis': 'rgba(232, 232, 232, 0.9)',
    '--text-muted': 'rgba(200, 200, 200, 0.65)',
    '--text-faint': 'rgba(200, 200, 200, 0.45)',
    '--text-dim': 'rgba(200, 200, 200, 0.3)',
    '--text-accent': 'rgba(140, 180, 230, 0.7)',
    '--surface-sidebar': 'rgba(35, 35, 40, 0.6)',
    '--surface-topbar': 'rgba(30, 32, 38, 0.55)',
    '--surface-messages': 'rgba(28, 30, 36, 0.55)',
    '--surface-card': 'rgba(255, 255, 255, 0.03)',
    '--surface-card-strong': 'rgba(255, 255, 255, 0.08)',
    '--surface-control': 'rgba(255, 255, 255, 0.06)',
    '--surface-hover': 'rgba(255, 255, 255, 0.04)',
    '--surface-active': 'rgba(140, 180, 230, 0.12)',
    '--surface-popover': 'rgba(30, 32, 40, 0.98)',
    '--surface-bubble-user': 'rgba(100, 160, 230, 0.35)',
    '--border-subtle': 'rgba(255, 255, 255, 0.06)',
    '--border-strong': 'rgba(255, 255, 255, 0.1)',
    '--border-accent': 'rgba(140, 180, 230, 0.5)',
    '--status-success': 'rgba(100, 200, 160, 0.9)',
    '--status-warning': 'rgba(230, 170, 80, 0.9)',
    '--status-error': 'rgba(230, 100, 100, 0.9)',
    '--shadow-accent': 'rgba(140, 180, 230, 0.2)',
  },
}

/**
 * All bundled themes.
 */
export const BUNDLED_THEMES: Record<string, TranslatedTheme> = {
  'codex-dark': codexDarkTheme,
  'codex-light': codexLightTheme,
  'codex-dim': codexDimTheme,
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
