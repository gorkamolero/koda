import type { Preview } from '@storybook/react-vite'
import { withThemeByDataAttribute } from '@storybook/addon-themes'
import '../src/styles.css'
import { kodaTheme } from './kodaTheme'

const preview: Preview = {
  decorators: [
    withThemeByDataAttribute({
      themes: { Obsidian: 'obsidian', Light: 'light', Dim: 'dim', Graphite: 'graphite' },
      defaultTheme: import.meta.env.VITE_KODA_THEME ?? 'Obsidian',
      attributeName: 'data-koda-theme',
    }),
    (Story, context) => {
      const theme = context.globals.theme as string | undefined
      document.documentElement.classList.toggle('light', theme === 'Light')
      document.documentElement.classList.toggle('dark', theme !== 'Light')
      return <div className={context.viewMode === 'docs' ? 'bg-surface-messages p-4 font-code text-text-primary' : 'font-code text-text-primary'}><Story /></div>
    },
  ],
  parameters: {
    layout: 'padded',
    controls: { expanded: true },
    docs: { theme: kodaTheme },
    a11y: { test: 'error' },
    options: { storySort: { order: ['Introduction', 'Foundations', 'Brand', 'Primitives', 'Patterns', 'App screens'] } },
  },
}

export default preview
