// Screenshot every chapter of the scroll story (desktop + mobile).
// usage: node tools/capture.mjs [url] [outDir]
// Needs the dev server (exposes window.__world / window.__lenis).
import { chromium } from 'playwright';
import fs from 'node:fs';
import path from 'node:path';

const url = process.argv[2] || 'http://localhost:5173/';
const out = process.argv[3] || 'shots';
fs.mkdirSync(out, { recursive: true });

const browser = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const errors = [];

async function run(name, viewport, isMobile) {
  const ctx = await browser.newContext({ viewport, deviceScaleFactor: 1, isMobile, hasTouch: isMobile, reducedMotion: 'no-preference' });
  const page = await ctx.newPage();
  page.on('pageerror', (e) => errors.push(`[${name}] ${e.message}`));
  page.on('console', (m) => m.type() === 'error' && errors.push(`[${name}] console: ${m.text()}`));
  await page.goto(url, { waitUntil: 'networkidle' });
  await page.waitForTimeout(6500);
  await page.evaluate(() => window.__world && (window.__world.snapNext = true));
  await page.waitForTimeout(800);
  await page.screenshot({ path: path.join(out, `${name}-00-hero.png`) });
  const stops = await page.evaluate(() => {
    const tr = window.__world?.track || [];
    const seen = new Set();
    return tr.filter((t) => (seen.has(t.key) ? false : seen.add(t.key))).map((t) => ({ key: t.key, y: Math.round(t.y) }));
  });
  // a few in-between frames to see transitions
  const mids = [];
  for (let i = 0; i < stops.length - 1; i++) if (['hero', 'monitor', 'work2'].includes(stops[i].key)) mids.push({ key: `${stops[i].key}-to-${stops[i + 1].key}`, y: Math.round((stops[i].y + stops[i + 1].y) / 2) });
  const all = [...stops.slice(1), ...mids].sort((a, b) => a.y - b.y);
  let n = 1;
  for (const s of all) {
    await page.evaluate((y) => window.__lenis ? window.__lenis.scrollTo(y, { immediate: true }) : window.scrollTo(0, y), s.y + 2);
    // software WebGL renders slowly: snap the camera instead of waiting for damping
    for (let i = 0; i < 3; i++) { await page.waitForTimeout(250); await page.evaluate(() => window.__world && (window.__world.snapNext = true)); }
    await page.waitForTimeout(2200);
    await page.screenshot({ path: path.join(out, `${name}-${String(n++).padStart(2, '0')}-${s.key}.png`) });
  }
  // footer
  await page.evaluate(() => window.__lenis ? window.__lenis.scrollTo(document.documentElement.scrollHeight, { immediate: true }) : window.scrollTo(0, 1e7));
  await page.waitForTimeout(2000);
  await page.screenshot({ path: path.join(out, `${name}-${String(n++).padStart(2, '0')}-footer.png`) });
  await ctx.close();
}

await run('desktop', { width: 1440, height: 900 }, false);
await run('mobile', { width: 390, height: 844 }, true);
await browser.close();
console.log('saved to', out);
console.log(errors.length ? errors.join('\n') : 'no page errors');
