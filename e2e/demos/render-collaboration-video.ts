import { execFileSync } from 'node:child_process'
import { readFileSync, writeFileSync, statSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { chromium, type Browser } from '@playwright/test'

type Evidence = {
  workflowStatus: string
  chapters: Array<{ chapter: string; atSeconds: number }>
  files: { webmA: string; webmB: string; mp4: string }
  [key: string]: unknown
}

/** Re-render saved actual recordings without starting an app or another agent turn. */
export async function renderCollaborationVideo(directory: string, existingBrowser?: Browser) {
  const evidencePath = join(directory, 'evidence.json')
  const evidence = JSON.parse(readFileSync(evidencePath, 'utf8')) as Evidence
  if (evidence.workflowStatus !== 'passed') throw new Error('The actual collaboration workflow must pass before rendering')
  function markerTime(file: string) {
    const pixels = execFileSync('ffmpeg', ['-i', file, '-t', '5', '-vf', 'fps=25,scale=1:1,format=rgb24', '-f', 'rawvideo', 'pipe:1'], { stdio: ['ignore', 'pipe', 'ignore'] })
    for (let frame = 0; frame < pixels.length / 3; frame++) {
      if (pixels[frame * 3]! < 60 && pixels[frame * 3 + 1]! > 190 && pixels[frame * 3 + 2]! < 60) return frame / 25
    }
    throw new Error('Recording synchronization marker was not found')
  }
  const trimA = markerTime(evidence.files.webmA) + 0.4
  const trimB = markerTime(evidence.files.webmB) + 0.4
  const browser = existingBrowser ?? await chromium.launch()
  const context = await browser.newContext({ viewport: { width: 1920, height: 120 } })
  const headers: string[] = []
  const chapters = [{ chapter: 'Connecting both people', atSeconds: 0 }, ...evidence.chapters]
  try {
    const page = await context.newPage()
    await page.setContent(`<!doctype html><html><head><meta charset="utf-8"><style>
      *{box-sizing:border-box}body{margin:0;background:#11151a;color:#eef3f6;font-family:Arial,sans-serif}
      h1{position:absolute;left:24px;top:12px;margin:0;font-size:26px}small{position:absolute;left:24px;top:48px;font-size:16px;color:#a5b4c3}
      #chapter{position:absolute;right:24px;top:30px;font-size:20px;color:#a3e0c0}.person{position:absolute;top:88px;font-size:19px}
    </style></head><body><h1>Koda · Claude collaboration</h1><small>Real browser UI · separate instances · live Claude + Liveblocks</small><div id="chapter"></div><div class="person" style="left:24px">User A · host</div><div class="person" style="left:984px">User B · collaborator</div></body></html>`)
    for (const [index, chapter] of chapters.entries()) {
      await page.locator('#chapter').evaluate((element, text) => { element.textContent = text }, chapter.chapter)
      const path = join(directory, `header-${index}.png`)
      await page.screenshot({ path })
      headers.push(path)
    }
  } finally {
    await context.close()
    if (!existingBrowser) await browser.close()
  }
  const inputs = ['-y', '-i', evidence.files.webmA, '-i', evidence.files.webmB]
  for (const header of headers) inputs.push('-loop', '1', '-framerate', '25', '-i', header)
  const filters = [
    `[0:v]trim=start=${trimA},setpts=PTS-STARTPTS[a]`,
    `[1:v]trim=start=${trimB},setpts=PTS-STARTPTS[b]`,
    '[a][b]hstack=inputs=2:shortest=1,pad=1920:1080:0:120:color=0x11151a[base]',
  ]
  for (const [index, chapter] of chapters.entries()) {
    const previous = index ? `v${index - 1}` : 'base'
    const next = chapters[index + 1]?.atSeconds ?? 99999
    filters.push(`[${previous}][${index + 2}:v]overlay=0:0:shortest=1:enable='between(t,${chapter.atSeconds},${next})'[v${index}]`)
  }
  execFileSync('ffmpeg', [...inputs, '-filter_complex', filters.join(';'), '-map', `[v${chapters.length - 1}]`, '-c:v', 'libx264', '-preset', 'fast', '-crf', '20', '-pix_fmt', 'yuv420p', '-movflags', '+faststart', '-an', evidence.files.mp4], { stdio: 'pipe', timeout: 180_000 })
  const metadata = JSON.parse(execFileSync('ffprobe', ['-v', 'error', '-show_entries', 'stream=codec_name,width,height,r_frame_rate:format=duration,size', '-of', 'json', evidence.files.mp4], { encoding: 'utf8' })) as { streams: Array<{ width?: number; height?: number }>; format: { duration: string } }
  const duration = Number(metadata.format.duration)
  if (!metadata.streams.some(stream => stream.width === 1920 && stream.height === 1080) || duration < (evidence.chapters.at(-1)?.atSeconds ?? 0) + 3 || statSync(evidence.files.mp4).size < 1000) throw new Error('Rendered recording did not pass media validation')
  const reviewFrames: string[] = []
  for (const [name, at] of [
    ['host-live-reply', evidence.chapters[2]!.atSeconds + 2],
    ['guest-relay-live-reply', evidence.chapters[4]!.atSeconds + 2],
    ['view-only', evidence.chapters[6]!.atSeconds + 2],
    ['final-frame', duration - 1],
  ] as const) {
    const path = join(directory, `${name}.png`)
    execFileSync('ffmpeg', ['-y', '-ss', String(at), '-i', evidence.files.mp4, '-frames:v', '1', path], { stdio: 'pipe' })
    reviewFrames.push(path)
  }
  writeFileSync(evidencePath, JSON.stringify({ ...evidence, status: 'passed', videoStatus: 'passed', synchronization: { trimA, trimB, method: 'First full green frame before app navigation plus 0.4 seconds, 25 fps' }, media: metadata, reviewFrames }, null, 2))
  console.log(`Collaboration video saved: ${evidence.files.mp4}`)
}

if (process.argv[1]?.endsWith('/render-collaboration-video.ts')) {
  if (!process.argv[2]) throw new Error('Pass the saved recording directory')
  await renderCollaborationVideo(resolve(process.argv[2]))
}
