import { mkdirSync, readFileSync, writeFileSync, existsSync } from 'node:fs'
import { resolve } from 'node:path'
import { chromium, outputDirectory, groups, themes, imageData } from './common.mjs'

const [label, baseline] = process.argv.slice(2)
const output = outputDirectory(label)
const reference = baseline ? outputDirectory(baseline) : null
const manifest = JSON.parse(readFileSync(resolve(output, 'manifest.json'), 'utf8'))
const browser = await chromium.launch({ headless: true })
const page = await browser.newPage()
// Native browser canvas keeps review tooling portable without adding image dependencies.
async function sheet(entries, destination, columns = 4) {
  const image = await page.evaluate(async ({ entries, columns }) => {
    const width = 480, height = 334, caption = 24
    const canvas = document.createElement('canvas')
    canvas.width = columns * width
    canvas.height = Math.ceil(entries.length / columns) * (height + caption)
    const context = canvas.getContext('2d')
    for (const [index, entry] of entries.entries()) {
      const x = index % columns * width, y = Math.floor(index / columns) * (height + caption)
      const image = new Image()
      image.src = entry.data
      await image.decode()
      context.fillStyle = '#eeeeee'
      context.fillRect(x, y, width, caption)
      context.fillStyle = '#222222'
      context.font = '13px Arial'
      context.fillText(entry.title, x + 8, y + 17)
      context.drawImage(image, x, y + caption, width, height)
    }
    return canvas.toDataURL('image/png').split(',')[1]
  }, { entries, columns })
  writeFileSync(destination, Buffer.from(image, 'base64'))
}
try {
  for (const [group, scenes] of Object.entries(groups)) {
    const available = scenes.filter(scene => themes.every(theme => existsSync(resolve(output, `${theme}-${scene}.png`))))
    if (!available.length) continue
    const entries = available.flatMap(scene => themes.map(theme => ({
      title: `${label} · ${theme} · ${scene}`,
      data: imageData(resolve(output, `${theme}-${scene}.png`)),
    })))
    await sheet(entries, resolve(output, `${group}-themes.png`))
    if (reference) {
      const pairs = available.filter(scene => themes.every(theme => existsSync(resolve(reference, `${theme}-${scene}.png`))))
        .flatMap(scene => [baseline, label].flatMap(source => themes.map(theme => ({
          title: `${source} · ${theme} · ${scene}`,
          data: imageData(resolve(outputDirectory(source), `${theme}-${scene}.png`)),
        }))))
      if (pairs.length) await sheet(pairs, resolve(output, `${group}-comparison.png`))
    }
  }
  if (reference) {
    mkdirSync(resolve(output, 'diffs'), { recursive: true })
    const results = []
    for (const capture of manifest.captured) {
      const name = `${capture.theme}-${capture.name}`
      const beforePath = resolve(reference, `${name}.png`)
      if (!existsSync(beforePath)) continue
      const result = await page.evaluate(async ({ before, after }) => {
        const images = await Promise.all([before, after].map(async source => { const image = new Image(); image.src = source; await image.decode(); return image }))
        if (images[0].width !== images[1].width || images[0].height !== images[1].height) return { resized: true }
        const canvas = document.createElement('canvas')
        canvas.width = images[0].width; canvas.height = images[0].height
        const context = canvas.getContext('2d', { willReadFrequently: true })
        context.drawImage(images[0], 0, 0)
        const beforePixels = context.getImageData(0, 0, canvas.width, canvas.height).data
        context.drawImage(images[1], 0, 0)
        const afterImage = context.getImageData(0, 0, canvas.width, canvas.height)
        let changed = 0, totalDelta = 0
        for (let index = 0; index < beforePixels.length; index += 4) {
          let max = 0
          for (let channel = 0; channel < 3; channel++) {
            const delta = Math.abs(beforePixels[index + channel] - afterImage.data[index + channel])
            totalDelta += delta; max = Math.max(max, delta)
          }
          if (max > 15) {
            changed++; afterImage.data[index] = 255; afterImage.data[index + 1] = 80; afterImage.data[index + 2] = 80
          } else for (let channel = 0; channel < 3; channel++) afterImage.data[index + channel] *= 0.25
        }
        context.putImageData(afterImage, 0, 0)
        return {
          changedPercent: Number((changed / (canvas.width * canvas.height) * 100).toFixed(3)),
          meanChannelDelta: Number((totalDelta / (canvas.width * canvas.height * 3)).toFixed(3)),
          png: canvas.toDataURL('image/png').split(',')[1],
        }
      }, { before: imageData(beforePath), after: imageData(resolve(output, `${name}.png`)) })
      const { png, ...metrics } = result
      results.push({ name, ...metrics })
      if (png) writeFileSync(resolve(output, 'diffs', `${name}.png`), Buffer.from(png, 'base64'))
    }
    writeFileSync(resolve(output, 'pixel-diff.json'), JSON.stringify({ baseline, label, threshold: 15, note: 'Review aid, not a pass/fail threshold. Inspect screenshots for intended changes and rendering artifacts.', results }, null, 2))
  }
} finally {
  await browser.close()
}
console.log(`Review sheets${reference ? ', comparisons, and difference maps' : ''}: ${output}`)
