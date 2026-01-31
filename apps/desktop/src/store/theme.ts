import { atom } from 'jotai'
import { atomWithStorage } from 'jotai/utils'
import {
  type TranslatedTheme,
  BUNDLED_THEMES,
  DEFAULT_THEME,
  applyTheme,
  loadThemeFromFile,
  generateThemeId,
  codexDarkTheme,
} from '../lib/theme-loader'

// ============================================================================
// TYPES
// ============================================================================

export interface ThemeState {
  activeThemeId: string
  customThemes: TranslatedTheme[]
  isLoading: boolean
  error: string | null
}

export interface ThemeOption {
  id: string
  name: string
  type: 'dark' | 'light'
  isCustom: boolean
}

// ============================================================================
// BASE ATOMS
// ============================================================================

/**
 * Active theme ID, persisted to localStorage.
 */
export const activeThemeIdAtom = atomWithStorage<string>(
  'minnetonka-active-theme',
  DEFAULT_THEME
)

/**
 * Custom themes, persisted to localStorage.
 */
export const customThemesAtom = atomWithStorage<TranslatedTheme[]>(
  'minnetonka-custom-themes',
  []
)

/**
 * Loading state for theme import.
 */
export const themeLoadingAtom = atom<boolean>(false)

/**
 * Error state for theme operations.
 */
export const themeErrorAtom = atom<string | null>(null)

// ============================================================================
// DERIVED ATOMS
// ============================================================================

/**
 * Get all available themes (bundled + custom).
 */
export const allThemesAtom = atom<ThemeOption[]>((get) => {
  const customThemes = get(customThemesAtom)

  const bundledOptions: ThemeOption[] = Object.entries(BUNDLED_THEMES).map(
    ([id, theme]) => ({
      id,
      name: theme.name,
      type: theme.type,
      isCustom: false,
    })
  )

  const customOptions: ThemeOption[] = customThemes.map((theme) => ({
    id: generateThemeId(theme.name),
    name: theme.name,
    type: theme.type,
    isCustom: true,
  }))

  return [...bundledOptions, ...customOptions]
})

/**
 * Get the currently active theme object.
 */
export const activeThemeAtom = atom<TranslatedTheme>((get) => {
  const themeId = get(activeThemeIdAtom)
  const customThemes = get(customThemesAtom)

  // Check bundled themes first
  const bundledTheme = BUNDLED_THEMES[themeId]
  if (bundledTheme) {
    return bundledTheme
  }

  // Check custom themes
  const customTheme = customThemes.find(
    (t) => generateThemeId(t.name) === themeId
  )
  if (customTheme) {
    return customTheme
  }

  // Fall back to default
  const defaultTheme = BUNDLED_THEMES[DEFAULT_THEME]
  if (defaultTheme) {
    return defaultTheme
  }

  // Ultimate fallback (should never happen)
  return codexDarkTheme
})

/**
 * Is the current theme dark or light?
 */
export const isDarkThemeAtom = atom<boolean>((get) => {
  const theme = get(activeThemeAtom)
  return theme.type === 'dark'
})

// ============================================================================
// ACTION ATOMS
// ============================================================================

/**
 * Select and apply a theme.
 */
export const selectThemeAtom = atom(
  null,
  (get, set, themeId: string) => {
    // Validate theme exists
    const allThemes = get(allThemesAtom)
    const exists = allThemes.some((t) => t.id === themeId)

    if (!exists) {
      set(themeErrorAtom, `Theme not found: ${themeId}`)
      return
    }

    // Update active theme
    set(activeThemeIdAtom, themeId)
    set(themeErrorAtom, null)

    // Apply the theme
    const theme = get(activeThemeAtom)
    applyTheme(theme)
  }
)

/**
 * Import a VS Code theme from a File.
 */
export const importThemeAtom = atom(
  null,
  async (get, set, file: File) => {
    set(themeLoadingAtom, true)
    set(themeErrorAtom, null)

    try {
      const theme = await loadThemeFromFile(file)
      const themeId = generateThemeId(theme.name)

      // Check if theme with same name already exists
      const customThemes = get(customThemesAtom)
      const existingIndex = customThemes.findIndex(
        (t) => generateThemeId(t.name) === themeId
      )

      if (existingIndex >= 0) {
        // Update existing theme
        const updated = [...customThemes]
        updated[existingIndex] = theme
        set(customThemesAtom, updated)
      } else {
        // Add new theme
        set(customThemesAtom, [...customThemes, theme])
      }

      // Select the imported theme
      set(activeThemeIdAtom, themeId)
      applyTheme(theme)

      set(themeLoadingAtom, false)
      return { success: true, theme }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to import theme'
      set(themeErrorAtom, message)
      set(themeLoadingAtom, false)
      return { success: false, error: message }
    }
  }
)

/**
 * Delete a custom theme.
 */
export const deleteThemeAtom = atom(
  null,
  (get, set, themeId: string) => {
    const customThemes = get(customThemesAtom)
    const activeThemeId = get(activeThemeIdAtom)

    // Can only delete custom themes
    const themeIndex = customThemes.findIndex(
      (t) => generateThemeId(t.name) === themeId
    )

    if (themeIndex < 0) {
      set(themeErrorAtom, 'Cannot delete bundled themes')
      return
    }

    // Remove the theme
    const updated = customThemes.filter((_, i) => i !== themeIndex)
    set(customThemesAtom, updated)

    // If we deleted the active theme, switch to default
    if (activeThemeId === themeId) {
      set(activeThemeIdAtom, DEFAULT_THEME)
      applyTheme(codexDarkTheme)
    }

    set(themeErrorAtom, null)
  }
)

/**
 * Reset to default theme.
 */
export const resetToDefaultAtom = atom(
  null,
  (_get, set) => {
    set(activeThemeIdAtom, DEFAULT_THEME)
    set(themeErrorAtom, null)
    applyTheme(codexDarkTheme)
  }
)

/**
 * Clear error state.
 */
export const clearThemeErrorAtom = atom(
  null,
  (_get, set) => {
    set(themeErrorAtom, null)
  }
)

// ============================================================================
// INITIALIZATION
// ============================================================================

/**
 * Initialize theme on app startup.
 * Call this atom once when the app mounts.
 */
export const initializeThemeAtom = atom(
  null,
  (get, _set) => {
    const theme = get(activeThemeAtom)
    applyTheme(theme)
  }
)
