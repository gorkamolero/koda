import type { StorybookConfig } from '@storybook/react-vite'

const config: StorybookConfig = {
  stories: ['../src/**/*.mdx', '../src/**/*.stories.tsx'],
  addons: ['@storybook/addon-docs', '@storybook/addon-themes', '@storybook/addon-a11y', '@storybook/addon-vitest'],
  framework: '@storybook/react-vite',
  typescript: { reactDocgen: 'react-docgen-typescript' },
  core: { disableTelemetry: true },
  async viteFinal(config, { configType }) {
    return { ...config, base: configType === 'PRODUCTION' ? '/koda/' : '/', optimizeDeps: { ...config.optimizeDeps, include: [...(config.optimizeDeps?.include ?? []), 'react/jsx-dev-runtime'] } }
  },
}

export default config
