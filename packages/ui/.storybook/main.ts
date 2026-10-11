import type { StorybookConfig } from '@storybook/react-vite'

const config: StorybookConfig = {
  stories: ['../src/**/*.mdx', '../src/**/*.stories.tsx'],
  addons: ['@storybook/addon-docs', '@storybook/addon-themes', '@storybook/addon-a11y', '@storybook/addon-vitest'],
  framework: '@storybook/react-vite',
  typescript: { reactDocgen: 'react-docgen-typescript' },
  core: { disableTelemetry: true },
  // The public Storybook is served from a site root (Cloudflare Pages); STORYBOOK_BASE serves it from a subpath.
  async viteFinal(config) {
    return { ...config, base: process.env.STORYBOOK_BASE ?? '/', optimizeDeps: { ...config.optimizeDeps, include: [...(config.optimizeDeps?.include ?? []), 'react/jsx-dev-runtime'] } }
  },
}

export default config
