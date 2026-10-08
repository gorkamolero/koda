import { atom } from 'jotai'
import { atomWithStorage } from 'jotai/utils'
import type { AgentType } from '@/lib/rpc'

/**
 * Settings Store - Conductor-style user preferences
 *
 * Uses atomWithStorage for persistence to localStorage.
 * All settings are reactive and persist across sessions.
 */

// =============================================================================
// Model & Agent Settings
// =============================================================================

/**
 * Default agent model to use for new sessions
 */
export const defaultModelAtom = atomWithStorage<AgentType>('settings:defaultModel', 'codex')

/**
 * Available models (static for now, could be dynamic later)
 */
export interface ModelOption {
  id: AgentType
  name: string
  description: string
  contextLimit: number
  thinkingSupport: boolean
}

export const availableModelsAtom = atom<ModelOption[]>([
  {
    id: 'claude',
    name: 'Claude Code',
    description: 'Anthropic Claude for code generation',
    contextLimit: 200000,
    thinkingSupport: true,
  },
  {
    id: 'codex',
    name: 'Codex',
    description: 'OpenAI Codex for code completion',
    contextLimit: 128000,
    thinkingSupport: false,
  },
  {
    id: 'kimi',
    name: 'Kimi Code',
    description: 'Moonshot Kimi for long context',
    contextLimit: 2000000,
    thinkingSupport: false,
  },
])

/**
 * Whether extended thinking is enabled by default
 */
export const thinkingEnabledDefaultAtom = atomWithStorage('settings:thinkingEnabled', true)

/**
 * Whether plan mode is enabled by default
 * When enabled, agent will create a plan before executing
 */
export const planModeEnabledAtom = atomWithStorage('settings:planModeEnabled', false)

// =============================================================================
// Branch Settings
// =============================================================================

/**
 * Branch prefix type for new workspaces
 */
export type BranchPrefixType = 'none' | 'feature' | 'fix' | 'custom'

export const branchPrefixTypeAtom = atomWithStorage<BranchPrefixType>(
  'settings:branchPrefixType',
  'feature'
)

/**
 * Custom branch prefix (used when branchPrefixType is 'custom')
 */
export const branchPrefixCustomAtom = atomWithStorage('settings:branchPrefixCustom', '')

/**
 * Derived: full branch prefix to use
 */
export const branchPrefixAtom = atom((get) => {
  const type = get(branchPrefixTypeAtom)
  switch (type) {
    case 'none':
      return ''
    case 'feature':
      return 'feature/'
    case 'fix':
      return 'fix/'
    case 'custom':
      return get(branchPrefixCustomAtom)
    default:
      return ''
  }
})

/**
 * Whether to delete branch when archiving workspace
 */
export const deleteBranchOnArchiveAtom = atomWithStorage('settings:deleteBranchOnArchive', false)

// =============================================================================
// UI Settings
// =============================================================================

/**
 * Monospace font family for code/terminal
 */
export const monoFontAtom = atomWithStorage(
  'settings:monoFont',
  'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace'
)

/**
 * Available mono fonts
 */
export const availableMonoFontsAtom = atom([
  { id: 'system', name: 'System Default', value: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace' },
  { id: 'jetbrains', name: 'JetBrains Mono', value: '"JetBrains Mono", monospace' },
  { id: 'fira', name: 'Fira Code', value: '"Fira Code", monospace' },
  { id: 'cascadia', name: 'Cascadia Code', value: '"Cascadia Code", monospace' },
  { id: 'sf-mono', name: 'SF Mono', value: '"SF Mono", monospace' },
])

/**
 * Markdown rendering style
 */
export type MarkdownStyle = 'default' | 'compact' | 'expanded'

export const markdownStyleAtom = atomWithStorage<MarkdownStyle>('settings:markdownStyle', 'default')

/**
 * Whether sidebar is collapsed
 */
export const sidebarCollapsedAtom = atomWithStorage('settings:sidebarCollapsed', false)

/**
 * Sidebar width in pixels
 */
export const sidebarWidthAtom = atomWithStorage('settings:sidebarWidth', 280)

/**
 * Whether to show context wheel (usage indicator) always
 */
export const alwaysShowContextWheelAtom = atomWithStorage('settings:alwaysShowContextWheel', false)

/**
 * Whether to auto-convert long text to files
 */
export const autoConvertLongTextAtom = atomWithStorage('settings:autoConvertLongText', true)

/**
 * Long text threshold (characters before conversion)
 */
export const longTextThresholdAtom = atomWithStorage('settings:longTextThreshold', 5000)

// =============================================================================
// Archive Settings
// =============================================================================

/**
 * Whether to auto-archive merged workspaces
 */
export const archiveOnMergeAtom = atomWithStorage('settings:archiveOnMerge', true)

/**
 * Show archived workspaces in sidebar
 */
export const showArchivedInSidebarAtom = atomWithStorage('settings:showArchivedInSidebar', false)

// =============================================================================
// Experimental Features
// =============================================================================

/**
 * Chrome mode (experimental UI mode)
 */
export const chromeModeEnabledAtom = atomWithStorage('settings:chromeModeEnabled', false)

/**
 * Big terminal mode default
 */
export const bigTerminalModeDefaultAtom = atomWithStorage('settings:bigTerminalModeDefault', false)

// =============================================================================
// Claude Settings
// =============================================================================

/**
 * Claude environment variables (JSON string)
 */
export const claudeEnvVarsAtom = atomWithStorage('settings:claudeEnvVars', '{}')

/**
 * Parsed Claude env vars (derived)
 */
export const claudeEnvVarsParsedAtom = atom((get) => {
  const raw = get(claudeEnvVarsAtom)
  try {
    return JSON.parse(raw) as Record<string, string>
  } catch {
    return {}
  }
})

// =============================================================================
// Codex Settings
// =============================================================================

/**
 * Codex API key (encrypted in production)
 */
export const codexApiKeyAtom = atomWithStorage('settings:codexApiKey', '')

/**
 * Codex provider (openai, azure, etc)
 */
export type CodexProvider = 'openai' | 'azure' | 'local'

export const codexProviderAtom = atomWithStorage<CodexProvider>('settings:codexProvider', 'openai')

// =============================================================================
// Notification Settings
// =============================================================================

/**
 * Enable desktop notifications
 */
export const notificationsEnabledAtom = atomWithStorage('settings:notificationsEnabled', true)

/**
 * Sound effects enabled
 */
export const soundEffectsEnabledAtom = atomWithStorage('settings:soundEffectsEnabled', true)

// =============================================================================
// Actions
// =============================================================================

/**
 * Reset all settings to defaults
 */
export const resetAllSettingsAtom = atom(null, (_get, set) => {
  // Model settings
  set(defaultModelAtom, 'codex')
  set(thinkingEnabledDefaultAtom, true)
  set(planModeEnabledAtom, false)

  // Branch settings
  set(branchPrefixTypeAtom, 'feature')
  set(branchPrefixCustomAtom, '')
  set(deleteBranchOnArchiveAtom, false)

  // UI settings
  set(monoFontAtom, 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace')
  set(markdownStyleAtom, 'default')
  set(sidebarCollapsedAtom, false)
  set(sidebarWidthAtom, 280)
  set(alwaysShowContextWheelAtom, false)
  set(autoConvertLongTextAtom, true)
  set(longTextThresholdAtom, 5000)

  // Archive settings
  set(archiveOnMergeAtom, true)
  set(showArchivedInSidebarAtom, false)

  // Experimental
  set(chromeModeEnabledAtom, false)
  set(bigTerminalModeDefaultAtom, false)

  // Claude settings
  set(claudeEnvVarsAtom, '{}')

  // Codex settings
  set(codexApiKeyAtom, '')
  set(codexProviderAtom, 'openai')

  // Notifications
  set(notificationsEnabledAtom, true)
  set(soundEffectsEnabledAtom, true)
})
