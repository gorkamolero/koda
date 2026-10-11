import { describe, it } from 'vitest'
import { RuleTester } from 'eslint'
import rule from './no-raw-tokens.js'

RuleTester.describe = describe
RuleTester.it = it

new RuleTester({ languageOptions: { ecmaVersion: 'latest', sourceType: 'module', parserOptions: { ecmaFeatures: { jsx: true } } } }).run('no-raw-tokens', rule, {
  valid: [
    '<div style={{ width: 0, opacity: 0.5, lineHeight: 1.4, zIndex: 10 }} />',
    '<svg width={12} height={14}><path strokeWidth={2} /></svg>',
    'const color = "var(--text-primary)"; const styles = { color }; <div style={styles} />',
    'const styles = { root: { color: "var(--text-primary)", width: "50%" } }; <div style={styles.root} />',
    '<div className="bg-surface-card text-text-primary p-4 rounded-md" />',
    '<div className="text-gray-14 bg-gray-0" />',
    '<div style={{ color: "var(--text-primary)", width: "50%" }} />',
    '// koda-token-exception: Xterm requires a literal palette at its API boundary.\nconst xterm = "#ffffff"',
    '// koda-token-file: The single source of truth for theme values.\nconst primary = "#ee9988"',
    '<div className="text-[length:var(--type-body-size)]" />',
  ],
  invalid: [
    { code: '<div style={{ width: 17 }} />', errors: [{ messageId: 'raw' }] },
    { code: '<div style={{ marginTop: -9, fontSize: 13 }} />', errors: [{ messageId: 'raw' }, { messageId: 'raw' }] },
    { code: 'const width = 17; const styles = { width }; <div style={styles} />', errors: [{ messageId: 'raw' }] },
    { code: '<div className="border-t-red-500 ring-offset-white divide-x-zinc-500" />', errors: [{ messageId: 'raw' }] },
    { code: 'const style = { color: "red" }; <div style={style} />', errors: [{ messageId: 'raw' }] },
    { code: 'const styles = { root: { color: "red" } }; <div style={styles.root} />', errors: [{ messageId: 'raw' }] },
    { code: 'const style = { color: "red" }; <div style={{ ...style }} />', errors: [{ messageId: 'raw' }] },
    { code: '<div style={{ padding: "calc(100% - 2px)" }} />', errors: [{ messageId: 'raw' }] },
    { code: '<div className="hover:bg-zinc-500/20" />', errors: [{ messageId: 'raw' }] },
    { code: '<div className="text-white" />', errors: [{ messageId: 'raw' }] },
    { code: '<div className="text-gray-500" />', errors: [{ messageId: 'raw' }] },
    { code: '<div className="text-[#c0ffee]" />', errors: [{ messageId: 'raw' }] },
    { code: '<div className="w-[22px]" />', errors: [{ messageId: 'raw' }] },
    { code: 'const classes = `text-blue-500 p-[3px]`', errors: [{ messageId: 'raw' }, { messageId: 'raw' }] },
    { code: '<div style={{ color: "red" }} />', errors: [{ messageId: 'raw' }] },
    { code: '<div style={{ backgroundColor: color }} />', errors: [{ messageId: 'raw' }] },
    { code: '<div style={{ margin: "12px" }} />', errors: [{ messageId: 'raw' }] },
    { code: '// koda-token-exception:\nconst color = "#abc"', errors: [{ messageId: 'raw' }] },
  ],
})
