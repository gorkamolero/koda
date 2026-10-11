import type { Preview } from '@storybook/react-vite'
import { withThemeByDataAttribute } from '@storybook/addon-themes'
import '../src/styles.css'

const preview: Preview = {
  decorators: [
    withThemeByDataAttribute({
      themes: { Obsidian: 'obsidian', Light: 'light', Dim: 'dim', Graphite: 'graphite' },
      defaultTheme: 'Obsidian',
      attributeName: 'data-koda-theme',
    }),
    (Story, context) => {
      const theme = context.globals.theme as string | undefined
      document.documentElement.classList.toggle('light', theme === 'Light')
      document.documentElement.classList.toggle('dark', theme !== 'Light')
      return <Story />
    },
  ],
  parameters: {
    layout: 'padded',
    controls: { expanded: true },
    a11y: { test: 'error' },
    options: { storySort: { order: ['Introduction', 'Foundations', 'Brand', 'Primitives', 'Patterns', 'App screens'] } },
  },
}

export default preview
