import { Button, Input } from '@koda/ui'
import { useRef, useCallback, type ChangeEvent } from 'react'
import { useAtom, useAtomValue, useSetAtom } from 'jotai'
import { cn } from '@/lib/utils'
import {
  allThemesAtom,
  activeThemeIdAtom,
  selectThemeAtom,
  importThemeAtom,
  deleteThemeAtom,
  themeLoadingAtom,
  themeErrorAtom,
  clearThemeErrorAtom,
  type ThemeOption,
} from '@/store/theme'
import {
  Palette,
  Upload,
  Check,
  Trash2,
  Loader2,
  AlertCircle,
  Sun,
  Moon,
} from 'lucide-react'

/**
 * Theme preview card component
 */
function ThemeCard({
  theme,
  isActive,
  onSelect,
  onDelete,
}: {
  theme: ThemeOption
  isActive: boolean
  onSelect: () => void
  onDelete?: () => void
}) {
  return (
    <div className="relative">
    <Button variant="unstyled"
      onClick={onSelect}
      className={cn(
        'relative w-full h-full p-4 rounded-xl border transition-all text-left',
        'hover:border-border-accent hover:bg-surface-hover',
        isActive
          ? 'border-border-accent bg-surface-active ring-1 ring-border-accent-soft'
          : 'border-border-subtle bg-surface-card'
      )}
    >
      {/* Active indicator */}
      {isActive && (
        <div className="absolute top-2 right-2">
          <Check className="w-4 h-4 text-status-success" />
        </div>
      )}

      {/* Theme icon */}
      <div className="flex items-center gap-3 mb-2">
        <div
          className={cn(
            'w-8 h-8 rounded-lg flex items-center justify-center',
            theme.type === 'dark' ? 'bg-surface-card' : 'bg-surface-hover'
          )}
        >
          {theme.type === 'dark' ? (
            <Moon className="w-4 h-4 text-status-unread" />
          ) : (
            <Sun className="w-4 h-4 text-status-warning" />
          )}
        </div>
        <div>
          <p className="text-sm font-medium text-text-primary">{theme.name}</p>
          <p className="text-xs text-text-faint capitalize">{theme.type}</p>
        </div>
      </div>

    </Button>
      {/* Delete button for custom themes */}
      {theme.isCustom && onDelete && (
        <Button variant="unstyled"
          onClick={(e) => {
            e.stopPropagation()
            onDelete()
          }}
          className="absolute bottom-2 right-2 inline-flex items-center justify-center size-8 rounded-md p-0 text-text-muted hover:bg-surface-hover hover:text-text-primary text-text-dim hover:text-status-error"
        >
          <Trash2 className="w-3.5 h-3.5" />
        </Button>
      )}

      {/* Custom badge */}
      {theme.isCustom && (
        <span className="absolute bottom-2 left-2 text-2xs text-text-dim px-1.5 py-0.5 bg-surface-control rounded">
          Custom
        </span>
      )}
    </div>
  )
}

/**
 * Theme selector component for Settings page
 */
export function ThemeSelector() {
  const themes = useAtomValue(allThemesAtom)
  const [activeThemeId] = useAtom(activeThemeIdAtom)
  const selectTheme = useSetAtom(selectThemeAtom)
  const importTheme = useSetAtom(importThemeAtom)
  const deleteTheme = useSetAtom(deleteThemeAtom)
  const isLoading = useAtomValue(themeLoadingAtom)
  const error = useAtomValue(themeErrorAtom)
  const clearError = useSetAtom(clearThemeErrorAtom)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const handleImportClick = useCallback(() => {
    fileInputRef.current?.click()
  }, [])

  const handleFileChange = useCallback(
    (e: ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0]
      if (!file) return

      void importTheme(file).then(() => {
        // Reset input
        if (fileInputRef.current) {
          fileInputRef.current.value = ''
        }
      })
    },
    [importTheme]
  )

  const handleSelectTheme = useCallback(
    (themeId: string) => {
      selectTheme(themeId)
      clearError()
    },
    [selectTheme, clearError]
  )

  const handleDeleteTheme = useCallback(
    (themeId: string) => {
      deleteTheme(themeId)
    },
    [deleteTheme]
  )

  // Separate bundled and custom themes
  const bundledThemes = themes.filter((t) => !t.isCustom)
  const customThemes = themes.filter((t) => t.isCustom)

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-surface-card-strong flex items-center justify-center">
            <Palette className="w-5 h-5 text-text-accent" />
          </div>
          <div>
            <h3 className="text-text-strong font-semibold">Theme</h3>
            <p className="text-text-faint text-sm">Customize the app appearance</p>
          </div>
        </div>

        {/* Import button */}
        <Button variant="unstyled" onClick={handleImportClick} className="px-4 py-2 rounded-lg font-semibold text-sm text-text-primary bg-surface-card-strong disabled:opacity-50 disabled:cursor-not-allowed transition-colors duration-150 enabled:hover:bg-surface-control-hover" disabled={isLoading}>
          {isLoading ? (
            <>
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              Importing...
            </>
          ) : (
            <>
              <Upload className="w-4 h-4 mr-2" />
              Import VS Code Theme
            </>
          )}
        </Button>
        <Input
          ref={fileInputRef}
          type="file"
          accept=".json"
          onChange={handleFileChange}
          className="hidden"
        />
      </div>

      {/* Error message */}
      {error && (
        <div className="flex items-start gap-3 p-4 rounded-xl bg-status-error/10 border border-status-error/30">
          <AlertCircle className="w-5 h-5 text-status-error flex-shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-medium text-status-error">Import failed</p>
            <p className="text-xs text-text-muted mt-0.5">{error}</p>
          </div>
          <Button variant="unstyled" onClick={clearError} className="ml-auto inline-flex items-center justify-center size-8 rounded-md p-0 text-text-muted hover:bg-surface-hover hover:text-text-primary text-status-error">
            ×
          </Button>
        </div>
      )}

      {/* Bundled themes */}
      <div>
        <h4 className="text-xs font-medium text-text-faint uppercase tracking-wider mb-3">
          Built-in Themes
        </h4>
        <div className="grid grid-cols-3 gap-3">
          {bundledThemes.map((theme) => (
            <ThemeCard
              key={theme.id}
              theme={theme}
              isActive={theme.id === activeThemeId}
              onSelect={() => { handleSelectTheme(theme.id) }}
            />
          ))}
        </div>
      </div>

      {/* Custom themes */}
      {customThemes.length > 0 && (
        <div>
          <h4 className="text-xs font-medium text-text-faint uppercase tracking-wider mb-3">
            Custom Themes
          </h4>
          <div className="grid grid-cols-3 gap-3">
            {customThemes.map((theme) => (
              <ThemeCard
                key={theme.id}
                theme={theme}
                isActive={theme.id === activeThemeId}
                onSelect={() => { handleSelectTheme(theme.id) }}
                onDelete={() => { handleDeleteTheme(theme.id) }}
              />
            ))}
          </div>
        </div>
      )}

      {/* Help text */}
      <p className="text-xs text-text-dim">
        Import any VS Code theme by uploading its JSON file. The theme colors will be automatically
        translated to match our UI components.
      </p>
    </div>
  )
}
