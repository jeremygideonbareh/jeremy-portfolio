// Screenshot every sector of the Track Day site (desktop + mobile).
// usage: node tools/capture.mjs [url] [outDir]
// Needs the dev server (exposes window.__stage / window.__lenis).
import { chromium } from 'playwright';
import fs from 'node:fs';
import path from 'node:path';

const url = process.argv[2] || 'http://localhost:5173/';
const out = process.argv[3] || 'shots';
fs.mkdirSync(out, { recursive: true });
const browser = await chromium.launch({ args: process.env.CAPTURE_GL === 'swiftshader' ? ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'] : ['--use-angle=d3d11', '--enable-gpu', '--ignore-gpu-blocklist'] });
const errors = [];

async function run(name, viewport, isMobile) {
  const ctx = await browser.newContext({ viewport, deviceScaleFactor: 1, isMobile, hasTouch: isMobile, reducedMotion: 'no-preference' });
  const open = async () => {
    const p = await ctx.newPage();
    p.on('pageerror', (e) => errors.push(`[${name}] ${e.message}`));
    p.on('console', (m) => m.type() === 'error' && errors.push(`[${name}] console: ${m.text()}`));
    await p.goto(url, { waitUntil: 'domcontentloaded', timeout: 60000 });
    // ready = intro finished (loader gone, scrolling unlocked, pins built)
    await p.waitForFunction(() => !document.querySelector('.loader') && !document.body.classList.contains('is-loading') && document.querySelector('.pin-spacer'), null, { timeout: 60000 }).catch(() => {});
    return p;
  };
  let page = await open();
  await page.waitForTimeout(7000);
  await page.screenshot({ path: path.join(out, `${name}-00-grid.png`) });
  const stops = await page.evaluate(() => {
    const top = (el) => el.getBoundingClientRect().top + scrollY;
    const vh = innerHeight;
    const s2 = document.querySelector('#sector2');
    const sp = s2.parentElement.classList.contains('pin-spacer') ? s2.parentElement : s2;
    const dev = document.querySelector('.s3__device');
    return [
      ['grid-half', vh * 0.55],
      ['s1-statement', top(document.querySelector('.statement')) - vh * 0.25],
      ['s1-notes', top(document.querySelector('.notes')) - vh * 0.35],
      ['s2-start', top(sp) + 4],
      ['s2-mid', top(sp) + (sp.offsetHeight - vh) * 0.45],
      ['s2-end', top(sp) + (sp.offsetHeight - vh) * 0.95],
      ['s3-device', top(dev) + dev.offsetHeight / 2 - vh / 2],
      ['s3-telemetry', top(document.querySelector('.telemetry')) - vh * 0.2],
      ['s3-garage', top(document.querySelector('.garage')) - vh * 0.15],
      ['pit', top(document.querySelector('#pitstop')) + 2],
      ['podium', top(document.querySelector('.podium__steps')) - vh * 0.3],
      ['classification', top(document.querySelector('.classification')) - vh * 0.25],
      ['finish', top(document.querySelector('#finish')) + vh * 0.05],
      ['footer', document.documentElement.scrollHeight],
    ].map(([k, y]) => [k, Math.round(y)]);
  });
  let n = 1;
  let shots = 0;
  for (const [key, y] of stops) {
    // software WebGL slows down over a long session: start a fresh page every few stops
    if (shots && shots % 4 === 0) {
      await page.close();
      page = await open();
      await page.waitForTimeout(1500);
    }
    shots++;
    await page.evaluate((y) => (window.__lenis ? window.__lenis.scrollTo(y, { immediate: true }) : window.scrollTo(0, y)), y);
    for (let i = 0; i < 4; i++) { await page.waitForTimeout(250); await page.evaluate(() => window.__stage && (window.__stage.snapNext = true)); }
    await page.waitForTimeout(1800);
    await page.screenshot({ path: path.join(out, `${name}-${String(n++).padStart(2, '0')}-${key}.png`), timeout: 90000 });
  }
  await ctx.close();
}

await run('desktop', { width: 1440, height: 900 }, false);
await run('mobile', { width: 390, height: 844 }, true);
await browser.close();
console.log('saved to', out);
console.log(errors.length ? errors.join('\n') : 'no page errors');
