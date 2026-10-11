import postcss from 'postcss'

const locations = new Map()

/** Parse declarations, then let no-raw-tokens report with its configured severity. */
export default {
  meta: { name: 'koda-token-css', version: '1.0.0' },
  preprocess(source, filename) {
    const lineMap = new Map()
    const lines = ['']
    const globals = new Set()
    try {
      const css = postcss.parse(source, { from: filename })
      css.walkComments(comment => {
        if (comment.source.start.line <= 5 && /koda-token-file:/.test(comment.text)) lines.push(`/* ${comment.text} */`)
      })
      function add(node, code, global) {
        globals.add(global)
        const previous = node.prev()
        if (previous?.type === 'comment' && /koda-token-exception:/.test(previous.text)) lines.push(`/* ${previous.text} */`)
        lines.push(code)
        lineMap.set(lines.length, { line: node.source.start.line, column: node.source.start.column })
      }
      css.walkDecls(declaration => add(declaration, `__kodaCss(${JSON.stringify(declaration.prop)}, ${JSON.stringify(declaration.value)});`, '__kodaCss'))
      css.walkAtRules(rule => add(rule, `__kodaCssValue(${JSON.stringify(rule.params)});`, '__kodaCssValue'))
      lines[0] = globals.size ? `/* global ${[...globals].join(', ')} */` : ''
      locations.set(filename, { lineMap })
      return [lines.join('\n')]
    } catch (error) {
      locations.set(filename, { lineMap, error: { ruleId: null, severity: 2, message: error.reason ?? error.message, line: error.line ?? 1, column: error.column ?? 1, fatal: true } })
      return ['']
    }
  },
  postprocess(messages, filename) {
    const state = locations.get(filename)
    locations.delete(filename)
    if (state?.error) return [state.error]
    return messages.flat().map(message => {
      const original = state?.lineMap.get(message.line)
      return original ? { ...message, ...original, endLine: original.line, endColumn: original.column + 1 } : message
    })
  },
}
