// Measures screencast frames per second for a continuously animating 1280×1440 page at 1.5×.
import { chromium } from '@playwright/test'
const quality = Number(process.argv[2] ?? 85)
const browser = await chromium.launch({ args: ['--force-device-scale-factor=1.5', ...(process.argv[3] ? process.argv[3].split(',') : [])] })
const page = await browser.newPage({ viewport: { width: 1280, height: 1440 } })
await page.setContent(`<body style="margin:0;background:#000;color:#ddd;font:14px monospace"><div id=t style="padding:40px;white-space:pre-wrap"></div><div id=b style="position:fixed;top:600px;left:0;width:200px;height:200px;background:#e07a5f"></div><script>
let i=0;const t=document.getElementById('t');const b=document.getElementById('b');(function f(){i++;b.style.transform='translateX('+((i*8)%1000)+'px)';if(i%2==0)t.textContent+='token ';requestAnimationFrame(f)})()</script></body>`)
const cdp = await page.context().newCDPSession(page)
let frames = 0
cdp.on('Page.screencastFrame', ({ sessionId }) => { frames++; cdp.send('Page.screencastFrameAck', { sessionId }).catch(() => {}) })
await cdp.send('Page.startScreencast', { format: 'jpeg', quality, maxWidth: 3840, maxHeight: 4320 })
await page.waitForTimeout(1000); frames = 0
await page.waitForTimeout(5000)
console.log(JSON.stringify({ quality, args: process.argv[3] ?? '', fps: frames / 5 }))
await browser.close()
