import type { StorybookConfig } from '@storybook/react-vite'

const config: StorybookConfig = {
  stories: ['../src/**/*.mdx', '../src/**/*.stories.tsx'],
  addons: ['@storybook/addon-docs', '@storybook/addon-themes', '@storybook/addon-a11y', '@storybook/addon-vitest'],
  framework: '@storybook/react-vite',
  typescript: { reactDocgen: 'react-docgen-typescript' },
  core: { disableTelemetry: true },
  // Builds for a site root by default; STORYBOOK_BASE serves it from a subpath (GitHub Pages uses /koda/).
  async viteFinal(config) {
    return { ...config, base: process.env.STORYBOOK_BASE ?? '/', optimizeDeps: { ...config.optimizeDeps, include: [...(config.optimizeDeps?.include ?? []), 'react/jsx-dev-runtime'] } }
  },
}

export default config
