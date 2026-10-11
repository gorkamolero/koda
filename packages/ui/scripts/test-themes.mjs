import { spawnSync } from 'node:child_process'

for (const theme of ['Obsidian', 'Light', 'Dim', 'Graphite']) {
  console.log(`\nTesting all stories in ${theme}`)
  const result = spawnSync('pnpm', ['test-storybook'], {
    stdio: 'inherit',
    env: { ...process.env, VITE_KODA_THEME: theme },
  })
  if (result.status !== 0) process.exit(result.status ?? 1)
}
