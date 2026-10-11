import { createServer } from 'node:http'
import { readFile, mkdir, writeFile } from 'node:fs/promises'
import { resolve, extname, sep } from 'node:path'
import { chromium } from 'playwright'

const root = resolve('storybook-static')
const output = resolve('visual-review')
const mime = { '.html': 'text/html', '.js': 'application/javascript', '.css': 'text/css', '.json': 'application/json', '.svg': 'image/svg+xml', '.woff2': 'font/woff2', '.png': 'image/png' }
const server = createServer(async (request, response) => {
  const url = new URL(request.url, 'http://localhost')
  if (url.pathname === '/') { response.writeHead(302, { Location: '/koda/' }); response.end(); return }
  const path = resolve(root, decodeURIComponent(url.pathname.replace(/^\/koda\//, '')) || 'index.html')
  if (path !== root && !path.startsWith(root + sep)) { response.writeHead(403); response.end(); return }
  try {
    const data = await readFile(path === root ? resolve(root, 'index.html') : path)
    response.writeHead(200, { 'Content-Type': mime[extname(path)] ?? 'application/octet-stream' })
    response.end(data)
  } catch { response.writeHead(404); response.end('Not found') }
})
await new Promise(done => server.listen(0, '127.0.0.1', done))
const origin = `http://127.0.0.1:${server.address().port}/koda/`
await mkdir(output, { recursive: true })
const browser = await chromium.launch()
const context = await browser.newContext({ viewport: { width: 1440, height: 1050 }, deviceScaleFactor: 1, reducedMotion: 'reduce' })
const results = []
try {
  const index = JSON.parse(await readFile(resolve(root, 'index.json'), 'utf8'))
  const stories = ['app-screens--host-workspace', 'app-screens--collaborator-workspace', 'primitives-button--sizes', 'primitives-dialog--open']
  for (const theme of ['Obsidian', 'Light', 'Dim', 'Graphite']) {
    for (const story of stories) {
      if (!index.entries[story]) throw new Error(`Missing story: ${story}`)
      const page = await context.newPage()
      const errors = []
      page.on('pageerror', error => errors.push(error.message))
      await page.goto(`${origin}iframe.html?id=${story}&viewMode=story&globals=theme:${theme}`, { waitUntil: 'networkidle' })
      await page.locator('#storybook-root').waitFor()
      await page.waitForFunction(() => document.querySelector('#storybook-root')?.childElementCount > 0)
      if (story === 'primitives-dialog--open') await page.getByRole('dialog').waitFor()
      await page.evaluate(() => document.fonts.ready)
      const themeAttribute = await page.locator('html').getAttribute('data-koda-theme')
      if (themeAttribute !== theme.toLowerCase()) throw new Error(`${story}: expected ${theme}, got ${themeAttribute}`)
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth > innerWidth)
      const screenshot = `${theme.toLowerCase()}-${story}.png`
      await page.screenshot({ path: resolve(output, screenshot), fullPage: true, animations: 'disabled' })
      results.push({ theme, story, screenshot, themeAttribute, overflow, errors })
      await page.close()
    }
  }
  // Verify the actual manager and its generated props documentation at the Pages base path.
  const manager = await context.newPage()
  await manager.goto(`${origin}?path=/docs/primitives-button--docs`, { waitUntil: 'networkidle' })
  await manager.frameLocator('#storybook-preview-iframe').getByRole('heading', { name: 'Button', exact: true }).waitFor()
  await manager.screenshot({ path: resolve(output, 'storybook-manager.png'), fullPage: true })
  await manager.frameLocator('#storybook-preview-iframe').getByRole('table').first().waitFor()
  await manager.screenshot({ path: resolve(output, 'storybook-manager.png'), fullPage: true })
  await manager.close()
  await writeFile(resolve(output, 'manifest.json'), JSON.stringify({ base: '/koda/', captures: results }, null, 2) + '\n')
  const failed = results.filter(result => result.overflow || result.errors.length)
  if (failed.length) throw new Error(`Screenshot review detected errors: ${JSON.stringify(failed)}`)
  console.log(`Captured ${results.length} themed story screenshots and Storybook manager in ${output}`)
} finally {
  await browser.close()
  await new Promise(done => server.close(done))
}
