import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { loadCsf } from 'storybook/internal/csf-tools'
import coverage from './brief-coverage.json'

const brief = readFileSync(new URL('../../../../briefs/design-system.md', import.meta.url), 'utf8')
const componentSection = brief.split('## Components\n')[1]?.split('### Not in the design system')[0] ?? ''
const items = [...componentSection.matchAll(/^(\d+)\. (.+)$/gm)].map(([, number, text]) => ({ item: Number(number), text: text! }))

// Use Storybook's own CSF parser, not a guessed title/export-name slug. This
// respects meta.id, story names, includeStories and excludeStories without a
// stale storybook-static directory or executing React/browser story modules.
const sources = import.meta.glob<string>('../**/*.stories.tsx', { query: '?raw', import: 'default', eager: true })
const stories = Object.entries(sources).flatMap(([fileName, source]) =>
  loadCsf(source, { fileName, makeTitle: title => title }).parse().stories,
)
const storyIds = new Set(stories.map(story => story.id))

function componentNames(text: string) {
  const heading = text.match(/^\*\*(.+?)\.\*\*/)?.[1] ?? ''
  const names = heading === 'Layout helpers'
    ? text.match(/\*\* (.+?)\./)![1]!
    : heading.replace(/ \([^)]*\)/g, '').replace(' shell', '')
  const result = names.split(/,\s*(?:and )?| and /)
  // These three groups explicitly introduce additional components in prose.
  for (const extra of ['LoadingScreen', 'CompactWorkingIndicator', 'ToolCallSummary']) {
    if (text.includes(`\`${extra}\``)) result.push(extra)
  }
  return result.sort()
}

describe('design brief Storybook coverage', () => {
  it('accounts for exactly the numbered component items 1–40', () => {
    const expected = Array.from({ length: 40 }, (_, index) => index + 1)
    expect(items.map(item => item.item)).toEqual(expected)
    expect(coverage.map(row => row.item)).toEqual(expected)
  })

  for (const item of items) {
    it(`maps every component in brief item ${item.item}`, () => {
      const row = coverage.find(row => row.item === item.item)
      expect(row, `Missing brief item ${item.item}`).toBeDefined()
      // A prose change requires an explicit re-audit of the table, including
      // requirements outside the labelled Variants/Sizes/States clauses.
      expect(row!.brief, 'Brief changed: review the coverage entries').toBe(item.text)
      expect(row!.components.map(component => component.name).sort()).toEqual(componentNames(item.text))

      for (const component of row!.components) {
        expect(component.entries.length, component.name).toBeGreaterThan(0)
        const keys = component.entries.map(entry => `${entry.kind}:${entry.name}`)
        expect(new Set(keys).size, `${component.name}: duplicate coverage entry`).toBe(keys.length)
        for (const entry of component.entries) {
          expect(['variant', 'size', 'state', 'feature']).toContain(entry.kind)
          expect(entry.name.trim()).not.toBe('')
          expect(storyIds.has(entry.storyId), `${component.name} / ${entry.name}: unknown story ${entry.storyId}`).toBe(true)
          if (/^(hover|focus|keyboard focus|hover actions|hover action slot|keyboard navigation)$/.test(entry.name) || (component.name === 'Button' && entry.name === 'active')) {
            expect('note' in entry && entry.note, 'Interaction coverage must explain its play or pseudo-state').toBeTruthy()
          }
        }
      }

      // Labelled lists are machine-checkable as well: deleting a named variant,
      // size or state from the mapping must fail even if its item still exists.
      for (const [, label, list] of item.text.matchAll(/(Variants|Sizes|States): ([^.]+)\./g)) {
        const kind = { Variants: 'variant', Sizes: 'size', States: 'state' }[label!]
        const names = list!.replace(/\([^)]*\)/g, '').split(/,\s*| and /).map(name => name.trim()).filter(Boolean)
        for (const name of names) {
          expect(row!.components.some(component => component.entries.some(entry => entry.kind === kind && entry.name === name)), `Missing ${label}: ${name}`).toBe(true)
        }
      }
    })
  }
})
