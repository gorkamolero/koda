import { axePath } from './common.mjs'

/** Run against the real composed DOM, including native controls and floating surfaces. */
export async function checkContrast(page) {
  await page.addScriptTag({ path: axePath })
  return page.evaluate(async () => {
    const result = await window.axe.run(document, { runOnly: { type: 'rule', values: ['color-contrast'] } })
    const nodes = items => items.flatMap(item => item.nodes.map(node => ({
      target: node.target,
      html: node.html,
      summary: node.failureSummary,
      checks: [...node.any, ...node.all, ...node.none].map(check => ({ id: check.id, data: check.data, message: check.message })),
    })))
    const incomplete = nodes(result.incomplete)
    // Axe marks single-digit unread counts as incomplete even when it measured
    // a failing ratio. They carry meaning, so enforce the same AA threshold.
    const shortTextFailures = incomplete.filter(node => node.checks.some(check => check.data?.messageKey === 'shortTextContent' && check.data.contrastRatio < 4.5))
    return {
      violations: [...nodes(result.violations), ...shortTextFailures],
      incomplete,
      passes: result.passes.reduce((count, rule) => count + rule.nodes.length, 0),
    }
  })
}
