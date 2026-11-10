// Debug helper: mobile viewport, scroll to a selector, report frame timing.
// usage: node tools/probe-mobile.mjs "#pitstop"
import { chromium } from 'playwright';
const sel = process.argv[2] || '#pitstop';
const browser = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, deviceScaleFactor: 1, reducedMotion: 'no-preference' });
const page = await ctx.newPage();
page.on('pageerror', (e) => console.log('pageerror', e.message));
page.on('console', (m) => ['warning', 'error'].includes(m.type()) && console.log(m.type(), m.text().slice(0, 300)));
await page.goto('http://localhost:5173/', { waitUntil: 'domcontentloaded' });
await page.waitForTimeout(6000);
console.log('before', await page.evaluate(() => new Promise((r) => { const t0 = performance.now(); let n = 0; const f = () => { n++; if (performance.now() - t0 < 2000) requestAnimationFrame(f); else r(`${n} frames/2s`); }; requestAnimationFrame(f); })));
await page.evaluate((s) => { const el = document.querySelector(s); window.__lenis.scrollTo(el.getBoundingClientRect().top + scrollY + 2, { immediate: true }); }, sel);
await page.waitForTimeout(1500);
const res = await Promise.race([
  page.evaluate(() => new Promise((r) => { const t0 = performance.now(); let n = 0, worst = 0, last = t0; const f = () => { const now = performance.now(); worst = Math.max(worst, now - last); last = now; n++; if (now - t0 < 3000) requestAnimationFrame(f); else r({ frames: n, worstMs: Math.round(worst), sector: document.documentElement.dataset.sector, cls: document.documentElement.className }); }; requestAnimationFrame(f); })),
  new Promise((r) => setTimeout(() => r('evaluate timed out (main thread blocked?)'), 20000)),
]);
console.log('after', JSON.stringify(res));
await browser.close();
