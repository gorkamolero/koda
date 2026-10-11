import { describe, expect, it } from 'vitest'
import { Linter } from 'eslint'
import plugin from './index.js'

function lint(source, severity = 'error') {
  return new Linter().verify(source, [{
    files: ['**/*.css'],
    plugins: { koda: plugin },
    processor: 'koda/css',
    rules: { 'koda/no-raw-tokens': severity },
  }], { filename: 'component.css' })
}

describe('token CSS enforcement', () => {
  it('accepts token declarations and documented exceptions', () => {
    expect(lint('.label { color: var(--text-primary); padding: var(--space-4); }')).toEqual([])
    expect(lint('.legacy { color: hsl(var(--primary)); background: rgb(var(--surface-rgb) / 0.5); }')).toEqual([])
    expect(lint('/* koda-token-file: Canonical theme token definitions. */\n:root { --text-primary: #fff; --space-4: 16px; }')).toEqual([])
    expect(lint('.terminal { /* koda-token-exception: External terminal palette is required here. */\ncolor: #fff; }')).toEqual([])
  })
  it('rejects raw hex, named and functional colors, pixels, and palette apply rules', () => {
    const violations = lint('.card {\n color: #fff;\n background: rgb(1, 2, 3);\n border-color: red;\n padding: calc(100% - 2px);\n @apply border-t-zinc-500;\n}')
    expect(violations).toHaveLength(5)
    expect(violations.map(message => message.line)).toEqual([2, 3, 4, 5, 6])
    expect(violations.every(message => message.ruleId === 'koda/no-raw-tokens' && message.severity === 2)).toBe(true)
  })
  it('checks arbitrary pixels in media query parameters', () => {
    expect(lint('@media (min-width: 713px) { .card { color: var(--text-primary); } }')).toHaveLength(1)
  })
  it('checks ad hoc CSS custom properties outside the canonical token file', () => {
    expect(lint('.card { --card-color: rgb(1, 2, 3); }')).toHaveLength(1)
  })
  it('retains warning severity for a staged desktop migration', () => {
    expect(lint('.card { padding: 12px; }', 'warn')[0]?.severity).toBe(1)
  })
  it('reports malformed CSS at its original source location', () => {
    const errors = lint('.card {\n color: var(--text-primary);')
    expect(errors[0]?.fatal).toBe(true)
    expect(errors[0]?.line).toBe(1)
  })
})
