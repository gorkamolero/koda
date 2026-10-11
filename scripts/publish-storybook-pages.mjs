// Publishes the static Storybook to the gh-pages branch, which GitHub Pages serves at
// https://gorkamolero.github.io/koda/ through its branch build (no Actions workflow).
// The build is committed from a temporary directory, without a checkout or worktree,
// and each deploy is a fast-forward on top of the previous one.
import { execFileSync } from 'node:child_process'
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

const root = new URL('..', import.meta.url).pathname
const git = (args, env = {}) => execFileSync('git', args, { cwd: root, encoding: 'utf8', env: { ...process.env, ...env } }).trim()
const scratch = mkdtempSync(join(tmpdir(), 'koda-storybook-pages-'))
const out = join(scratch, 'site')
const index = { GIT_INDEX_FILE: join(scratch, 'index') }

try {
  execFileSync('pnpm', ['--filter', '@koda/ui', 'exec', 'storybook', 'build', '-o', out, '--quiet'], { cwd: root, stdio: 'inherit', env: { ...process.env, STORYBOOK_BASE: '/koda/' } })
  // Without this file GitHub Pages runs Jekyll, which drops Storybook's underscore-prefixed files.
  writeFileSync(join(out, '.nojekyll'), '')
  git(['--work-tree', out, 'add', '--all', '.'], index)
  const tree = git(['write-tree'], index)
  const parent = git(['ls-remote', 'origin', 'refs/heads/gh-pages']).split(/\s/)[0]
  if (parent) git(['fetch', '--quiet', 'origin', 'gh-pages'])
  const source = git(['rev-parse', '--short', 'HEAD'])
  const commit = git(['commit-tree', tree, ...(parent ? ['-p', parent] : []), '-m', `Storybook from ${source}`])
  git(['push', '--quiet', 'origin', `${commit}:refs/heads/gh-pages`])
  console.log(`Published Storybook from ${source} to gh-pages (${commit.slice(0, 7)}): https://gorkamolero.github.io/koda/`)
} finally {
  rmSync(scratch, { recursive: true, force: true })
}
