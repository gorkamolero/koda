/**
 * Theme Loader Service
 *
 * Handles loading, applying, and persisting themes.
 */

import { BUNDLED_THEMES, DEFAULT_THEME, baseColorTokens, themes } from '@koda/ui/tokens'
import { translateTheme, parseThemeJson, type VSCodeTheme, type TranslatedTheme } from './theme-translator'

// ============================================================================
// CONSTANTS
// ============================================================================

const STORAGE_KEY = 'minnetonka-theme'
const CUSTOM_THEMES_KEY = 'minnetonka-custom-themes'

// ============================================================================
// BUNDLED THEMES
// ============================================================================

// Definitions live in @koda/ui; exports remain stable for existing desktop callers.
export {
  codexDarkTheme,
  codexLightTheme,
  codexDimTheme,
  kodaGraphiteTheme,
  BUNDLED_THEMES,
  DEFAULT_THEME,
} from '@koda/ui/tokens'

// ============================================================================
// THEME APPLICATION
// ============================================================================

/**
 * Apply theme variables to the document root.
 */
export function applyTheme(theme: TranslatedTheme): void {
  const root = document.documentElement

  // Clear the shared color namespace so imported themes retain the CSS fallbacks
  // for their light/dark class instead of inheriting the previous bundled theme.
  for (const variable of Object.keys(baseColorTokens)) {
    root.style.removeProperty(variable)
  }
  const bundledTheme = Object.entries(themes).find(([, candidate]) => candidate === theme)
  if (bundledTheme) {
    root.dataset.kodaTheme = bundledTheme[0]
  } else {
    delete root.dataset.kodaTheme
  }

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
  for (const variable of Object.keys(baseColorTokens)) {
    root.style.removeProperty(variable)
  }

  delete root.dataset.kodaTheme
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
