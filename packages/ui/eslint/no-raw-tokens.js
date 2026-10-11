// Rules are syntax-based so they work in both the library and desktop flat configs.
const hex = /#[\da-f]{3,4}(?![\da-f])|#[\da-f]{6}(?:[\da-f]{2})?(?![\da-f])/i
const palette = /(?:^|[\s:'"`])(?:!?)(?:(?:bg|text|border|ring|outline|fill|stroke|shadow|divide|from|via|to|decoration|accent|caret)-(?:slate|gray|zinc|neutral|stone|red|orange|amber|yellow|lime|green|emerald|teal|cyan|sky|blue|indigo|violet|purple|fuchsia|pink|rose)-(?:50|[1-9]00|950)|(?:bg|text|border|ring|fill|stroke|from|via|to)-(?:black|white))(?:\b|\/)/
const pixels = /\[[^\]]*\b\d*\.?\d+px[^\]]*\]|(?:^|\s)-?\d*\.?\d+px(?:$|\s)/
const colorProperty = /^(?:color|background|backgroundColor|border(?:Top|Right|Bottom|Left)?Color|outlineColor|fill|stroke|boxShadow|textShadow|caretColor|accentColor)$/

export default {
  meta: {
    type: 'problem',
    docs: { description: 'Use Koda tokens instead of raw colors and arbitrary pixel values.' },
    schema: [],
    messages: {
      raw: 'Use a Koda token instead of {{kind}}. A necessary exception must have a nearby koda-token-exception: reason comment.',
    },
  },
  create(context) {
    const source = context.sourceCode
    const comments = source.getAllComments()
    const tokenFile = comments.some(comment => comment.loc.start.line <= 5 && /koda-token-file:\s*\S.{8,}/.test(comment.value))
    function exempt(node) {
      return tokenFile || comments.some(comment =>
        /koda-token-exception:\s*\S.{8,}/.test(comment.value) &&
        comment.loc.end.line >= node.loc.start.line - 1 && comment.loc.start.line <= node.loc.end.line,
      )
    }
    function report(node, kind) {
      if (!exempt(node)) context.report({ node, messageId: 'raw', data: { kind } })
    }
    function inspect(node, value) {
      if (hex.test(value)) report(node, 'a hex color')
      if (palette.test(value)) report(node, 'a Tailwind palette color')
      if (pixels.test(value)) report(node, 'an arbitrary pixel value')
    }
    function insideStyle(node) {
      let parent = node.parent
      while (parent && parent.type !== 'JSXAttribute' && parent.type !== 'Program') parent = parent.parent
      return parent?.type === 'JSXAttribute' && parent.name.name === 'style'
    }
    return {
      Literal(node) { if (typeof node.value === 'string') inspect(node, node.value) },
      TemplateElement(node) { inspect(node, node.value.raw) },
      Property(node) {
        if (!insideStyle(node)) return
        const key = node.key.name ?? node.key.value
        if (typeof key !== 'string' || !colorProperty.test(key)) return
        const value = node.value.type === 'Literal' ? node.value.value : undefined
        // Token references, inheritance and currentColor are the only inline colors allowed.
        if (typeof value === 'string' && /^(?:var\(--[\w-]+\)|inherit|currentColor|transparent)$/.test(value)) return
        report(node, 'an inline color style')
      },
    }
  },
}
