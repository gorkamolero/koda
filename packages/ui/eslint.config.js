import js from '@eslint/js'
import globals from 'globals'
import tseslint from 'typescript-eslint'
import koda from './eslint/index.js'

export default tseslint.config(
  { ignores: ['dist/**', 'storybook-static/**', 'visual-review/**', '**/__screenshots__/**'] },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  { languageOptions: { globals: { ...globals.browser, ...globals.node } } },
  {
    files: ['src/**/*.{ts,tsx}', 'src/**/*.css'],
    plugins: { koda },
    rules: {
      'koda/no-raw-tokens': 'error',
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_', varsIgnorePattern: '^_' }],
    },
  },
  { files: ['src/**/*.css'], processor: 'koda/css' },
)
