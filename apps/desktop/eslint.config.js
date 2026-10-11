import js from '@eslint/js'
import globals from 'globals'
import reactHooks from 'eslint-plugin-react-hooks'
import reactRefresh from 'eslint-plugin-react-refresh'
import tseslint from 'typescript-eslint'
import koda from '@koda/ui/eslint'

export default tseslint.config(
  { ignores: ['dist', 'src-tauri'] },
  {
    extends: [js.configs.recommended, ...tseslint.configs.recommendedTypeChecked],
    files: ['**/*.{ts,tsx}'],
    languageOptions: {
      ecmaVersion: 2020,
      globals: globals.browser,
      parserOptions: {
        project: ['./tsconfig.json', './tsconfig.node.json'],
        tsconfigRootDir: import.meta.dirname,
      },
    },
    plugins: {
      'react-hooks': reactHooks,
      'react-refresh': reactRefresh,
    },
    rules: {
      ...reactHooks.configs.recommended.rules,
      'react-refresh/only-export-components': [
        'warn',
        { allowConstantExport: true },
      ],
      '@typescript-eslint/no-unused-vars': [
        'error',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_' },
      ],
      // Allow async event handlers in JSX attributes
      '@typescript-eslint/no-misused-promises': [
        'error',
        { checksVoidReturn: { attributes: false } },
      ],
    },
  },
  // Enforce shared tokens in all desktop feature components.
  {
    files: ['src/components/**/*.{ts,tsx}', 'src/pages/**/*.{ts,tsx}'],
    plugins: { koda },
    rules: { 'koda/no-raw-tokens': 'error' },
  },
  // Stylesheets use the same shared token contract.
  {
    files: ['src/**/*.css'],
    plugins: { koda },
    processor: 'koda/css',
    rules: { 'koda/no-raw-tokens': 'error' },
  },
  // Test files - relax method binding checks for mocks
  {
    files: ['**/__tests__/**/*.{ts,tsx}', '**/*.test.{ts,tsx}', '**/*.spec.{ts,tsx}'],
    rules: {
      '@typescript-eslint/unbound-method': 'off',
      // Async mocks deliberately emulate Promise-returning APIs without I/O.
      '@typescript-eslint/require-await': 'off',
    },
  },
  // Providers export hooks alongside components.
  {
    files: ['**/*Provider*.tsx'],
    rules: { 'react-refresh/only-export-components': 'off' },
  },
)
