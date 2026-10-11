import { createRequire } from 'node:module'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { readFileSync } from 'node:fs'

export const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), '../..')
export const outputRoot = resolve(projectRoot, '.migration-visual')
const require = createRequire(resolve(projectRoot, 'packages/ui/package.json'))
export const { chromium } = require('playwright')
export const themes = ['obsidian', 'light', 'dim', 'graphite']
export const groups = {
  batch1: ['workspace-list', 'create-workspace', 'add-repo'],
  batch2: ['agent-chat', 'agent-approval', 'agent-question'],
  batch3: ['workspace-files', 'workspace-checks', 'workspace-review'],
  batch4: ['sharing', 'command-palette', 'settings', 'interview'],
  details: ['workspace-diff-expanded', 'workspace-files-expanded'],
  extras: ['toast', 'join-workspace', 'settings-collaboration'],
}
export function outputDirectory(label) {
  if (!/^[a-z0-9-]+$/.test(label ?? '')) throw new Error('Labels must use lowercase letters, digits, or hyphens')
  return resolve(outputRoot, label)
}
export function imageData(path) {
  return `data:image/png;base64,${readFileSync(path).toString('base64')}`
}
