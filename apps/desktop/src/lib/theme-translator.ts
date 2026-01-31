/**
 * VS Code Theme Translator
 *
 * Translates VS Code theme JSON files into our CSS variable system.
 * This allows importing any VS Code theme and applying it to the app.
 */

// ============================================================================
// TYPES
// ============================================================================

export interface VSCodeTheme {
  name: string
  type: 'dark' | 'light' | 'hc' | 'hcLight'
  colors: Record<string, string>
  tokenColors?: TokenColor[]
  semanticHighlighting?: boolean
  semanticTokenColors?: Record<string, string | TokenSettings>
}

export interface TokenColor {
  name?: string
  scope?: string | string[]
  settings: TokenSettings
}

export interface TokenSettings {
  foreground?: string
  background?: string
  fontStyle?: string
}

export interface TranslatedTheme {
  name: string
  type: 'dark' | 'light'
  variables: Record<string, string>
  tokenColors?: TokenColor[]
}

// ============================================================================
// VS CODE → CSS VARIABLE MAPPING
// ============================================================================

/**
 * Maps VS Code color tokens to our CSS variables.
 * Format: 'vscode.token': '--our-variable'
 *
 * Reference: https://code.visualstudio.com/api/references/theme-color
 */
export const THEME_MAPPING: Record<string, string> = {
  // === Editor (main content area) ===
  'editor.background': '--surface-messages',
  'editor.foreground': '--text-primary',
  'editor.selectionBackground': '--surface-active',
  'editor.lineHighlightBackground': '--surface-hover',
  'editorCursor.foreground': '--text-accent',
  'editorWhitespace.foreground': '--text-dim',
  'editorIndentGuide.background': '--border-subtle',
  'editorIndentGuide.activeBackground': '--border-strong',
  'editorLineNumber.foreground': '--text-dim',
  'editorLineNumber.activeForeground': '--text-muted',
  'editorBracketMatch.background': '--surface-active',
  'editorBracketMatch.border': '--border-accent',

  // === Sidebar ===
  'sideBar.background': '--surface-sidebar',
  'sideBar.foreground': '--text-muted',
  'sideBar.border': '--border-subtle',
  'sideBarTitle.foreground': '--text-strong',
  'sideBarSectionHeader.background': '--surface-card',
  'sideBarSectionHeader.foreground': '--text-emphasis',
  'sideBarSectionHeader.border': '--border-subtle',

  // === Activity Bar ===
  'activityBar.background': '--surface-sidebar',
  'activityBar.foreground': '--text-primary',
  'activityBar.inactiveForeground': '--text-faint',
  'activityBar.border': '--border-subtle',
  'activityBarBadge.background': '--status-unread',
  'activityBarBadge.foreground': '--text-strong',

  // === Status Bar (topbar) ===
  'statusBar.background': '--surface-topbar',
  'statusBar.foreground': '--text-faint',
  'statusBar.border': '--border-subtle',
  'statusBarItem.activeBackground': '--surface-active',
  'statusBarItem.hoverBackground': '--surface-hover',
  'statusBarItem.prominentBackground': '--surface-card-strong',
  'statusBarItem.prominentForeground': '--text-strong',
  'statusBarItem.errorBackground': '--status-error',
  'statusBarItem.warningBackground': '--status-warning',

  // === Title Bar ===
  'titleBar.activeBackground': '--surface-topbar',
  'titleBar.activeForeground': '--text-primary',
  'titleBar.inactiveBackground': '--surface-topbar',
  'titleBar.inactiveForeground': '--text-muted',
  'titleBar.border': '--border-subtle',

  // === Input fields ===
  'input.background': '--surface-control',
  'input.foreground': '--text-primary',
  'input.border': '--border-strong',
  'input.placeholderForeground': '--text-dim',
  'inputOption.activeBackground': '--surface-active',
  'inputOption.activeBorder': '--border-accent',
  'inputValidation.errorBackground': '--status-error',
  'inputValidation.errorBorder': '--status-error',
  'inputValidation.warningBackground': '--status-warning',
  'inputValidation.warningBorder': '--status-warning',

  // === Buttons ===
  'button.background': '--surface-card-strong',
  'button.foreground': '--text-primary',
  'button.hoverBackground': '--surface-control-hover',
  'button.secondaryBackground': '--surface-control',
  'button.secondaryForeground': '--text-muted',
  'button.secondaryHoverBackground': '--surface-hover',

  // === Lists ===
  'list.activeSelectionBackground': '--surface-active',
  'list.activeSelectionForeground': '--text-strong',
  'list.inactiveSelectionBackground': '--surface-card',
  'list.inactiveSelectionForeground': '--text-primary',
  'list.hoverBackground': '--surface-hover',
  'list.hoverForeground': '--text-primary',
  'list.focusBackground': '--surface-active',
  'list.focusForeground': '--text-strong',
  'list.highlightForeground': '--text-accent',
  'list.errorForeground': '--status-error',
  'list.warningForeground': '--status-warning',

  // === Tabs ===
  'tab.activeBackground': '--surface-card-strong',
  'tab.activeForeground': '--text-strong',
  'tab.inactiveBackground': '--surface-card',
  'tab.inactiveForeground': '--text-muted',
  'tab.border': '--border-subtle',
  'tab.activeBorder': '--border-accent',
  'tab.hoverBackground': '--surface-hover',
  'tab.unfocusedActiveBackground': '--surface-card',
  'tab.unfocusedActiveForeground': '--text-muted',

  // === Panel (bottom panel, right panel) ===
  'panel.background': '--surface-right-panel',
  'panel.border': '--border-subtle',
  'panelTitle.activeBorder': '--border-accent',
  'panelTitle.activeForeground': '--text-strong',
  'panelTitle.inactiveForeground': '--text-muted',
  'panelSection.border': '--border-subtle',
  'panelSectionHeader.background': '--surface-card',

  // === Terminal ===
  'terminal.background': '--surface-terminal',
  'terminal.foreground': '--text-primary',
  'terminal.cursor.foreground': '--text-accent',
  'terminal.selectionBackground': '--surface-active',
  'terminalCursor.background': '--surface-terminal',
  'terminalCursor.foreground': '--text-accent',

  // === Dropdown ===
  'dropdown.background': '--surface-popover',
  'dropdown.foreground': '--text-primary',
  'dropdown.border': '--border-strong',
  'dropdown.listBackground': '--surface-popover',

  // === Scrollbar ===
  'scrollbar.shadow': '--shadow-accent',
  'scrollbarSlider.background': '--border-strong',
  'scrollbarSlider.hoverBackground': '--border-stronger',
  'scrollbarSlider.activeBackground': '--border-accent',

  // === Badge ===
  'badge.background': '--surface-card-strong',
  'badge.foreground': '--text-primary',

  // === Progress Bar ===
  'progressBar.background': '--border-accent',

  // === Notifications ===
  'notifications.background': '--surface-popover',
  'notifications.foreground': '--text-primary',
  'notifications.border': '--border-strong',
  'notificationCenterHeader.background': '--surface-card-strong',
  'notificationsErrorIcon.foreground': '--status-error',
  'notificationsWarningIcon.foreground': '--status-warning',
  'notificationsInfoIcon.foreground': '--status-unread',

  // === Focus border ===
  'focusBorder': '--border-accent',

  // === Selection ===
  'selection.background': '--surface-active',

  // === Errors and warnings ===
  'errorForeground': '--status-error',
  'editorError.foreground': '--status-error',
  'editorWarning.foreground': '--status-warning',
  'editorInfo.foreground': '--status-unread',

  // === Diff editor ===
  'diffEditor.insertedTextBackground': '--surface-review-done',
  'diffEditor.removedTextBackground': '--surface-review',
  'diffEditor.insertedLineBackground': '--surface-review-done',
  'diffEditor.removedLineBackground': '--surface-review',

  // === Git decorations ===
  'gitDecoration.addedResourceForeground': '--status-success',
  'gitDecoration.modifiedResourceForeground': '--status-warning',
  'gitDecoration.deletedResourceForeground': '--status-error',
  'gitDecoration.untrackedResourceForeground': '--status-unread',
  'gitDecoration.conflictingResourceForeground': '--status-error',

  // === Peek view ===
  'peekView.border': '--border-accent',
  'peekViewEditor.background': '--surface-diff-card',
  'peekViewTitle.background': '--surface-card-strong',
  'peekViewResult.background': '--surface-card',

  // === Merge conflict ===
  'merge.currentHeaderBackground': '--surface-review-done',
  'merge.incomingHeaderBackground': '--surface-review',
  'merge.border': '--border-accent',

  // === Widget ===
  'widget.shadow': '--shadow-accent',
  'editorWidget.background': '--surface-popover',
  'editorWidget.border': '--border-strong',
  'editorWidget.foreground': '--text-primary',
  'editorSuggestWidget.background': '--surface-popover',
  'editorSuggestWidget.border': '--border-strong',
  'editorSuggestWidget.foreground': '--text-primary',
  'editorSuggestWidget.selectedBackground': '--surface-active',
  'editorHoverWidget.background': '--surface-popover',
  'editorHoverWidget.border': '--border-strong',

  // === Quick input ===
  'quickInput.background': '--surface-popover',
  'quickInput.foreground': '--text-primary',
  'quickInputTitle.background': '--surface-card-strong',

  // === Keybinding ===
  'keybindingLabel.background': '--surface-card',
  'keybindingLabel.foreground': '--text-muted',
  'keybindingLabel.border': '--border-strong',

  // === Breadcrumb ===
  'breadcrumb.foreground': '--text-muted',
  'breadcrumb.focusForeground': '--text-primary',
  'breadcrumb.activeSelectionForeground': '--text-strong',
  'breadcrumbPicker.background': '--surface-popover',

  // === Menu ===
  'menu.background': '--surface-popover',
  'menu.foreground': '--text-primary',
  'menu.selectionBackground': '--surface-active',
  'menu.selectionForeground': '--text-strong',
  'menu.separatorBackground': '--border-subtle',
  'menubar.selectionBackground': '--surface-active',
  'menubar.selectionForeground': '--text-strong',

  // === Command center ===
  'commandCenter.background': '--surface-control',
  'commandCenter.foreground': '--text-muted',
  'commandCenter.border': '--border-subtle',
  'commandCenter.activeBackground': '--surface-active',
  'commandCenter.activeForeground': '--text-strong',
}

// ============================================================================
// COLOR UTILITIES
// ============================================================================

/**
 * Parse a color string and return RGBA components.
 */
export function parseColor(color: string): { r: number; g: number; b: number; a: number } | null {
  // Remove whitespace
  color = color.trim()

  // Handle hex colors
  if (color.startsWith('#')) {
    const hex = color.slice(1)
    if (hex.length === 3) {
      // #RGB
      const r = hex[0]!, g = hex[1]!, b = hex[2]!
      return {
        r: parseInt(r + r, 16),
        g: parseInt(g + g, 16),
        b: parseInt(b + b, 16),
        a: 1,
      }
    } else if (hex.length === 4) {
      // #RGBA
      const r = hex[0]!, g = hex[1]!, b = hex[2]!, a = hex[3]!
      return {
        r: parseInt(r + r, 16),
        g: parseInt(g + g, 16),
        b: parseInt(b + b, 16),
        a: parseInt(a + a, 16) / 255,
      }
    } else if (hex.length === 6) {
      // #RRGGBB
      return {
        r: parseInt(hex.slice(0, 2), 16),
        g: parseInt(hex.slice(2, 4), 16),
        b: parseInt(hex.slice(4, 6), 16),
        a: 1,
      }
    } else if (hex.length === 8) {
      // #RRGGBBAA
      return {
        r: parseInt(hex.slice(0, 2), 16),
        g: parseInt(hex.slice(2, 4), 16),
        b: parseInt(hex.slice(4, 6), 16),
        a: parseInt(hex.slice(6, 8), 16) / 255,
      }
    }
  }

  // Handle rgb/rgba
  const rgbMatch = color.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)(?:,\s*([\d.]+))?\)/)
  if (rgbMatch && rgbMatch[1] && rgbMatch[2] && rgbMatch[3]) {
    return {
      r: parseInt(rgbMatch[1], 10),
      g: parseInt(rgbMatch[2], 10),
      b: parseInt(rgbMatch[3], 10),
      a: rgbMatch[4] ? parseFloat(rgbMatch[4]) : 1,
    }
  }

  return null
}

/**
 * Convert color to rgba string with optional opacity override.
 */
export function toRgba(color: string, opacity?: number): string {
  const parsed = parseColor(color)
  if (!parsed) return color

  const a = opacity !== undefined ? opacity : parsed.a
  return `rgba(${parsed.r}, ${parsed.g}, ${parsed.b}, ${a})`
}

/**
 * Convert color to hex string (without alpha).
 */
export function toHex(color: string): string {
  const parsed = parseColor(color)
  if (!parsed) return color

  const r = parsed.r.toString(16).padStart(2, '0')
  const g = parsed.g.toString(16).padStart(2, '0')
  const b = parsed.b.toString(16).padStart(2, '0')
  return `#${r}${g}${b}`
}

/**
 * Adjust color brightness.
 * factor > 1 = lighter, factor < 1 = darker
 */
export function adjustBrightness(color: string, factor: number): string {
  const parsed = parseColor(color)
  if (!parsed) return color

  const r = Math.min(255, Math.round(parsed.r * factor))
  const g = Math.min(255, Math.round(parsed.g * factor))
  const b = Math.min(255, Math.round(parsed.b * factor))

  return `rgba(${r}, ${g}, ${b}, ${parsed.a})`
}

/**
 * Check if a color is "dark" (for determining light vs dark theme).
 */
export function isDarkColor(color: string): boolean {
  const parsed = parseColor(color)
  if (!parsed) return true

  // Using relative luminance formula
  const luminance = (0.299 * parsed.r + 0.587 * parsed.g + 0.114 * parsed.b) / 255
  return luminance < 0.5
}

// ============================================================================
// TRANSLATION
// ============================================================================

/**
 * Translate a VS Code theme to our CSS variable system.
 */
export function translateTheme(theme: VSCodeTheme): TranslatedTheme {
  const variables: Record<string, string> = {}

  // Determine theme type from editor background if not specified
  let themeType: 'dark' | 'light' = theme.type === 'light' || theme.type === 'hcLight' ? 'light' : 'dark'

  // Check editor background to confirm
  const editorBg = theme.colors?.['editor.background']
  if (editorBg) {
    themeType = isDarkColor(editorBg) ? 'dark' : 'light'
  }

  // Translate each VS Code color to our variable
  for (const [vscodeToken, ourVariable] of Object.entries(THEME_MAPPING)) {
    const color = theme.colors?.[vscodeToken]
    if (color) {
      variables[ourVariable] = color
    }
  }

  // Generate derived colors that VS Code doesn't have
  generateDerivedColors(variables, theme.colors || {}, themeType)

  return {
    name: theme.name || 'Imported Theme',
    type: themeType,
    variables,
    tokenColors: theme.tokenColors,
  }
}

/**
 * Generate derived colors that don't have direct VS Code mappings.
 */
function generateDerivedColors(
  variables: Record<string, string>,
  colors: Record<string, string>,
  themeType: 'dark' | 'light'
): void {
  const editorBg = colors['editor.background'] || (themeType === 'dark' ? '#1e1e1e' : '#ffffff')
  const editorFg = colors['editor.foreground'] || (themeType === 'dark' ? '#d4d4d4' : '#333333')
  const sidebarBg = colors['sideBar.background'] || editorBg
  const accentColor = colors['focusBorder'] || colors['button.background'] || '#007acc'

  // Surface variations (if not already set)
  if (!variables['--surface-card']) {
    variables['--surface-card'] = themeType === 'dark'
      ? toRgba(editorFg, 0.04)
      : toRgba(editorBg, 0.04)
  }

  if (!variables['--surface-card-strong']) {
    variables['--surface-card-strong'] = themeType === 'dark'
      ? toRgba(editorFg, 0.12)
      : toRgba(editorBg, 0.12)
  }

  if (!variables['--surface-hover']) {
    variables['--surface-hover'] = themeType === 'dark'
      ? toRgba(editorFg, 0.05)
      : toRgba(editorBg, 0.05)
  }

  if (!variables['--surface-bubble-user']) {
    variables['--surface-bubble-user'] = toRgba(accentColor, 0.45)
  }

  if (!variables['--surface-bubble']) {
    variables['--surface-bubble'] = themeType === 'dark'
      ? toRgba(editorFg, 0.12)
      : toRgba(editorBg, 0.12)
  }

  // Text variations
  if (!variables['--text-strong']) {
    variables['--text-strong'] = themeType === 'dark' ? '#ffffff' : '#000000'
  }

  if (!variables['--text-emphasis']) {
    variables['--text-emphasis'] = toRgba(variables['--text-strong'] || editorFg, 0.9)
  }

  if (!variables['--text-faint']) {
    variables['--text-faint'] = toRgba(editorFg, 0.5)
  }

  if (!variables['--text-dim']) {
    variables['--text-dim'] = toRgba(editorFg, 0.35)
  }

  if (!variables['--text-accent']) {
    variables['--text-accent'] = toRgba(accentColor, 0.7)
  }

  // Border variations
  if (!variables['--border-subtle']) {
    variables['--border-subtle'] = themeType === 'dark'
      ? toRgba('#ffffff', 0.08)
      : toRgba('#000000', 0.08)
  }

  if (!variables['--border-strong']) {
    variables['--border-strong'] = themeType === 'dark'
      ? toRgba('#ffffff', 0.14)
      : toRgba('#000000', 0.14)
  }

  if (!variables['--border-accent']) {
    variables['--border-accent'] = toRgba(accentColor, 0.6)
  }

  if (!variables['--border-accent-soft']) {
    variables['--border-accent-soft'] = toRgba(accentColor, 0.3)
  }

  // Composer and terminal
  if (!variables['--surface-composer']) {
    variables['--surface-composer'] = variables['--surface-topbar'] || toRgba(sidebarBg, 0.45)
  }

  if (!variables['--surface-terminal']) {
    variables['--surface-terminal'] = toRgba(editorBg, 0.9)
  }

  // Shadow
  if (!variables['--shadow-accent']) {
    variables['--shadow-accent'] = toRgba(accentColor, 0.28)
  }
}

/**
 * Validate a VS Code theme structure.
 */
export function validateTheme(theme: unknown): theme is VSCodeTheme {
  if (!theme || typeof theme !== 'object') return false

  const t = theme as Record<string, unknown>

  // Must have colors object
  if (!t.colors || typeof t.colors !== 'object') return false

  // Type must be valid if present
  if (t.type && !['dark', 'light', 'hc', 'hcLight'].includes(t.type as string)) {
    return false
  }

  return true
}

/**
 * Parse theme from JSON string.
 */
export function parseThemeJson(json: string): VSCodeTheme | null {
  try {
    // VS Code themes sometimes have comments (jsonc format)
    // Remove single-line comments
    const cleanJson = json.replace(/\/\/.*$/gm, '')
    const parsed = JSON.parse(cleanJson)

    if (validateTheme(parsed)) {
      return parsed
    }

    return null
  } catch {
    return null
  }
}
