// Scroll through every live project in WORK and stitch what a visitor sees into a tall "filmstrip":
// one viewport per scroll step, so pinned / scroll-driven sections show up the way they really play.
// usage: node tools/shoot-strips.mjs [onlyShot ...]
// writes public/images/work/strips/<shot>.webp (desktop, 1100w) and <shot>-m.webp (phone, 450w)
import { chromium } from 'playwright';
import sharp from 'sharp';
import fs from 'node:fs';
import path from 'node:path';
import { WORK } from '../src/config.js';

const out = path.resolve('public/images/work/strips');
fs.mkdirSync(out, { recursive: true });
const only = process.argv.slice(2);
const list = only.length ? WORK.filter((w) => only.includes(w.shot)) : WORK;

const MODES = [
  { suffix: '', ctx: { viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1 }, tiles: 7, width: 1100 },
  { suffix: '-m', ctx: { viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2 }, tiles: 6, width: 450 },
];
// after the first screen, hide bars pinned to the top/bottom edge (navs, cookie bars, chat bubbles) so they
// don't repeat down the stitched strip; full-screen fixed layers (WebGL backdrops etc.) are left alone
const HIDE_BARS = () => {
  const vh = innerHeight;
  for (const el of document.querySelectorAll('body *')) {
    const cs = getComputedStyle(el);
    if (cs.position !== 'fixed' && cs.position !== 'sticky') continue;
    const r = el.getBoundingClientRect();
    if (r.height > vh * 0.3 || r.height === 0) continue;
    if (r.top < 140 || r.bottom > vh - 140) el.style.setProperty('visibility', 'hidden', 'important');
  }
};

const browser = await chromium.launch({ args: ['--use-angle=d3d11', '--enable-gpu', '--ignore-gpu-blocklist'] });
for (const w of list) {
  for (const m of MODES) {
    const ctx = await browser.newContext({ ...m.ctx, reducedMotion: 'no-preference' });
    const page = await ctx.newPage();
    const tiles = [];
    try {
      await page.goto(w.url, { waitUntil: 'load', timeout: 45000 });
      await page.waitForTimeout(5000); // intros / loaders
      const vh = m.ctx.viewport.height;
      await page.mouse.move(m.ctx.viewport.width / 2, vh / 2);
      const dpr = m.ctx.deviceScaleFactor;
      const scrollYNow = () => page.evaluate(() => Math.round(scrollY));
      // wait for smooth-scroll libraries to finish moving, then a beat for reveal animations
      const settle = async () => {
        let prev = await scrollYNow();
        for (let i = 0; i < 20; i++) { await page.waitForTimeout(150); const y = await scrollYNow(); if (y === prev) break; prev = y; }
        await page.waitForTimeout(900);
        return prev;
      };
      let y0 = await settle();
      for (let k = 0; k < m.tiles; k++) {
        if (k > 0) await page.evaluate(HIDE_BARS);
        const shot = await page.screenshot();
        await page.mouse.wheel(0, vh * 0.92);
        const y1 = await settle();
        const dy = y1 - y0;
        // keep only the part of this screen that the next one won't show again
        tiles.push(dy > 0 && dy < vh ? await sharp(shot).extract({ left: 0, top: 0, width: m.ctx.viewport.width * dpr, height: Math.round(dy * dpr) }).toBuffer() : shot);
        if (dy <= 0) break; // reached the end (or the page doesn't scroll)
        y0 = y1;
      }
      const k = m.width / (m.ctx.viewport.width * dpr);
      const resized = await Promise.all(tiles.map(async (t) => {
        const { height } = await sharp(t).metadata();
        const h = Math.max(1, Math.round(height * k));
        return { input: await sharp(t).resize(m.width, h).toBuffer(), h };
      }));
      let top = 0;
      const comps = resized.map(({ input, h }) => { const c = { input, left: 0, top }; top += h; return c; });
      await sharp({ create: { width: m.width, height: top, channels: 3, background: '#000' } })
        .composite(comps)
        .webp({ quality: 62 })
        .toFile(path.join(out, `${w.shot}${m.suffix}.webp`));
      console.log(w.shot + m.suffix, resized.length, 'tiles');
    } catch (e) {
      console.log(w.shot + m.suffix, 'FAILED', e.message.split('\n')[0]);
    }
    await ctx.close();
  }
}
await browser.close();
