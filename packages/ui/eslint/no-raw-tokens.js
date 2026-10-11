// Rules are syntax-based so they work in both the library and desktop flat configs.
const hex = /#[\da-f]{3,4}(?![\da-f])|#[\da-f]{6}(?:[\da-f]{2})?(?![\da-f])/i
const palette = /(?:^|[\s:'"`])!?(?:(?:bg|text|border(?:-[trblxyse])?|ring(?:-offset)?|outline|fill|stroke|shadow|divide(?:-[xy])?|from|via|to|decoration|accent|caret)-(?:slate|gray|zinc|neutral|stone|red|orange|amber|yellow|lime|green|emerald|teal|cyan|sky|blue|indigo|violet|purple|fuchsia|pink|rose)-(?:50|[1-9]00|950)|(?:bg|text|border(?:-[trblxyse])?|ring(?:-offset)?|outline|fill|stroke|shadow|divide(?:-[xy])?|from|via|to|decoration|accent|caret)-(?:black|white))(?:\b|\/)/
const pixels = /(?:^|[^\w-])-?(?:\d*\.)?\d+px\b/
const colorProperty = /^(?:color|background(?:Color|Image)?|border(?:Top|Right|Bottom|Left|Block|Inline)?(?:Start|End)?Color|outlineColor|fill|stroke|boxShadow|textShadow|caretColor|accentColor)$/
const pixelProperty = /^(?:(?:min|max)?(?:Width|Height)|width|height|(?:padding|margin|inset)(?:Top|Right|Bottom|Left|Block|Inline|Start|End)?|top|right|bottom|left|gap|rowGap|columnGap|border(?:Top|Right|Bottom|Left)?Width|border(?:TopLeft|TopRight|BottomLeft|BottomRight)?Radius|outlineWidth|outlineOffset|fontSize|letterSpacing|wordSpacing|textIndent|verticalAlign|perspective|flexBasis)$/
const cssColorProperty = /^(?:color|background(?:-color|-image)?|border(?:-[\w-]+)?|outline(?:-color)?|fill|stroke|(?:box|text)-shadow|caret-color|accent-color)$/
const rawCssColor = /(?:^|[\s,(])(?:rgba?|hsla?|hwb|lab|lch|oklab|oklch|color)\(|(?:^|[\s,(])(?:black|white|red|green|blue|yellow|orange|purple|pink|gray|grey|silver|gold|navy|teal|aqua|lime|maroon|olive|fuchsia|rebeccapurple)(?=$|[\s,)])/i

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
    const reported = new Set()
    function exempt(node) {
      return tokenFile || comments.some(comment =>
        /koda-token-exception:\s*\S.{8,}/.test(comment.value) &&
        comment.loc.end.line >= node.loc.start.line - 1 && comment.loc.start.line <= node.loc.end.line,
      )
    }
    function report(node, kind) {
      const key = `${node.range?.join(':')}:${kind}`
      if (!exempt(node) && !reported.has(key)) {
        reported.add(key)
        context.report({ node, messageId: 'raw', data: { kind } })
      }
    }
    function inspect(node, value) {
      if (hex.test(value)) report(node, 'a hex color')
      if (palette.test(value)) report(node, 'a Tailwind palette color')
      if (pixels.test(value)) report(node, 'an arbitrary pixel value')
    }
    function dereference(node, seen = new Set()) {
      if (!node || seen.has(node)) return node
      seen.add(node)
      if (['TSAsExpression', 'TSTypeAssertion', 'TSNonNullExpression', 'ChainExpression'].includes(node.type)) return dereference(node.expression, seen)
      if (node.type === 'Identifier') {
        let scope = source.getScope(node)
        while (scope) {
          const variable = scope.set.get(node.name)
          if (variable) {
            const definition = variable.defs.find(def => def.type === 'Variable')
            return definition?.node.init ? dereference(definition.node.init, seen) : node
          }
          scope = scope.upper
        }
      }
      if (node.type === 'MemberExpression') {
        const object = dereference(node.object, seen)
        const name = node.computed ? node.property.value : node.property.name
        if (object?.type === 'ObjectExpression') {
          const property = object.properties.find(prop => prop.type === 'Property' && (prop.key.name ?? prop.key.value) === name)
          if (property) return dereference(property.value, seen)
        }
      }
      return node
    }
    function inspectStyle(expression, seen = new Set()) {
      const node = dereference(expression)
      if (!node || seen.has(node)) return
      seen.add(node)
      if (node.type === 'ConditionalExpression') { inspectStyle(node.consequent, seen); inspectStyle(node.alternate, seen); return }
      if (node.type === 'LogicalExpression') { inspectStyle(node.left, seen); inspectStyle(node.right, seen); return }
      if (node.type !== 'ObjectExpression') return
      for (const property of node.properties) {
        if (property.type === 'SpreadElement') { inspectStyle(property.argument, seen); continue }
        if (property.type !== 'Property') continue
        const key = property.key.name ?? property.key.value
        if (typeof key !== 'string') continue
        const value = dereference(property.value)
        if (colorProperty.test(key)) {
          // Resolve local constants too, so a token color may be shared safely.
          const literal = value?.type === 'Literal' ? value.value : undefined
          if (!(typeof literal === 'string' && /^(?:var\(--[\w-]+\)|inherit|currentColor|transparent)$/.test(literal))) report(property, 'an inline color style')
        }
        if (pixelProperty.test(key)) {
          const number = value?.type === 'Literal' ? value.value : value?.type === 'UnaryExpression' && value.argument.type === 'Literal' ? value.argument.value : undefined
          if (typeof number === 'number' && number !== 0) report(property, 'a numeric inline pixel value')
        }
      }
    }
    return {
      Literal(node) { if (typeof node.value === 'string') inspect(node, node.value) },
      TemplateElement(node) { inspect(node, node.value.raw) },
      JSXAttribute(node) {
        if (node.name.name === 'style' && node.value?.type === 'JSXExpressionContainer') inspectStyle(node.value.expression)
      },
      // The CSS processor feeds declarations through the same configured rule,
      // preserving error/warning severity and documented-exception behavior.
      CallExpression(node) {
        if (node.callee.type !== 'Identifier' || node.callee.name !== '__kodaCss') return
        const [property, value] = node.arguments
        if (property?.type !== 'Literal' || value?.type !== 'Literal' || typeof property.value !== 'string' || typeof value.value !== 'string') return
        if ((cssColorProperty.test(property.value) || property.value.startsWith('--')) && rawCssColor.test(value.value)) report(value, 'a raw CSS color')
      },
    }
  },
}
