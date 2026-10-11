import { strict as assert } from 'node:assert'
import { test } from 'node:test'
import { chromium } from './common.mjs'
import { checkContrast } from './contrast.mjs'

test('desktop audit catches low-contrast text and unread counts, and accepts AA text', async () => {
  const browser = await chromium.launch({ headless: true })
  try {
    const page = await browser.newPage()
    await page.setContent('<body style="background:#fff;color:#aaa"><p>Meaningful metadata</p><span>1</span></body>')
    const failing = await checkContrast(page)
    assert(failing.violations.some(node => node.html.includes('Meaningful metadata')))
    assert(failing.violations.some(node => node.html.includes('>1<')))
    await page.setContent('<body style="background:#fff;color:#333"><p>Meaningful metadata</p><span>1</span></body>')
    assert.equal((await checkContrast(page)).violations.length, 0)
  } finally {
    await browser.close()
  }
})
