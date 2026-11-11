// Screenshot the v1 floating-island page at each camera keyframe (dev server).
// usage: node tools/capture-island.mjs [outDir] [url]
import { chromium } from 'playwright';
import fs from 'node:fs';
import path from 'node:path';

const out = process.argv[2] || 'shots-island';
const url = process.argv[3] || 'http://localhost:5173/island/';
fs.mkdirSync(out, { recursive: true });
const browser = await chromium.launch({ args: ['--use-angle=d3d11', '--enable-gpu', '--ignore-gpu-blocklist'] });
const errors = [];
for (const [name, viewport, mobile] of [['desktop', { width: 1440, height: 900 }, false], ['mobile', { width: 390, height: 844 }, true]]) {
  const ctx = await browser.newContext({ viewport, isMobile: mobile, hasTouch: mobile, deviceScaleFactor: 1, reducedMotion: 'no-preference' });
  const page = await ctx.newPage();
  page.on('pageerror', (e) => errors.push(`[${name}] ${e.message}`));
  await page.goto(url, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => !document.querySelector('.loader') && window.__world, null, { timeout: 60000 });
  await page.waitForTimeout(2500);
  const stops = await page.evaluate(() => {
    const seen = new Set();
    return window.__world.track.filter((t) => (seen.has(t.key) ? false : seen.add(t.key))).map((t) => [t.key, Math.round(t.y)]);
  });
  let n = 0;
  for (const [key, y] of stops) {
    await page.evaluate((y) => window.__lenis.scrollTo(y + 2, { immediate: true }), y);
    for (let i = 0; i < 3; i++) { await page.waitForTimeout(200); await page.evaluate(() => (window.__world.snapNext = true)); }
    await page.waitForTimeout(1200);
    await page.screenshot({ path: path.join(out, `${name}-${String(n++).padStart(2, '0')}-${key}.png`) });
  }
  await ctx.close();
}
await browser.close();
console.log(errors.length ? errors.join('\n') : 'no page errors');
