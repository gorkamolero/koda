import { create } from 'storybook/theming'
import { codexDarkTheme } from '../src/tokens'

const obsidian = codexDarkTheme.variables

/** Storybook's own frame (sidebar, toolbar, docs) in Koda's Obsidian tokens. */
export const kodaTheme = create({
  base: 'dark',
  brandTitle: 'KODA · design system',
  brandUrl: 'https://github.com/gorkamolero/koda',
  brandTarget: '_blank',
  fontBase: '"SF Mono", "SFMono-Regular", Menlo, Monaco, monospace',
  fontCode: '"SF Mono", "SFMono-Regular", Menlo, Monaco, monospace',
  colorPrimary: obsidian['--border-accent'],
  colorSecondary: obsidian['--border-accent'],
  appBg: obsidian['--surface-sidebar'],
  appContentBg: obsidian['--surface-messages'],
  appPreviewBg: obsidian['--surface-messages'],
  appBorderColor: obsidian['--border-strong'],
  appBorderRadius: 4,
  barBg: obsidian['--surface-topbar'],
  barTextColor: obsidian['--text-muted'],
  barSelectedColor: obsidian['--border-accent'],
  barHoverColor: obsidian['--text-strong'],
  textColor: obsidian['--text-primary'],
  textMutedColor: obsidian['--text-muted'],
  inputBg: obsidian['--surface-control'],
  inputBorder: obsidian['--border-strong'],
  inputTextColor: obsidian['--text-primary'],
})
