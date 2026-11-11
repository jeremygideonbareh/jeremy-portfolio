// Visit each GitHub Pages project, record whether it loads, and save a hero screenshot.
// usage: node tools/shoot-sites.mjs <outDir> name1 name2 ...
// env: WAIT=ms (default 5000), MOBILE=1 for a 390x844 phone shot saved as <name>-m.webp
import { chromium } from 'playwright';
import sharp from 'sharp';
import fs from 'node:fs';
import path from 'node:path';

const [out, ...names] = process.argv.slice(2);
fs.mkdirSync(out, { recursive: true });
const browser = await chromium.launch({ args: ['--use-angle=d3d11', '--enable-gpu', '--ignore-gpu-blocklist'] });
const mobile = !!process.env.MOBILE;
const results = [];
for (const name of names) {
  const url = `https://jeremygideonbareh.github.io/${name}/`;
  const ctx = await browser.newContext(mobile
    ? { viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2, reducedMotion: 'no-preference' }
    : { viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1, reducedMotion: 'no-preference' });
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message.slice(0, 120)));
  let status = 0, title = '';
  try {
    const res = await page.goto(url, { waitUntil: 'load', timeout: 45000 });
    status = res?.status() ?? 0;
    await page.waitForTimeout(+(process.env.WAIT || 5000)); // let loaders / intros finish
    title = await page.title();
    const textLen = await page.evaluate(() => document.body?.innerText.trim().length || 0);
    const buf = await page.screenshot();
    const file = path.join(out, `${name}${mobile ? '-m' : ''}.webp`);
    await sharp(buf).resize(mobile ? 390 : 1200, mobile ? 844 : 750).webp({ quality: 78 }).toFile(file);
    results.push({ name, url, status, title, textLen, errors: errors.length, file });
  } catch (e) {
    results.push({ name, url, status, title, error: e.message.split('\n')[0] });
  }
  await ctx.close();
  console.log(name, status, title.slice(0, 60));
}
await browser.close();
fs.writeFileSync(path.join(out, mobile ? 'results-m.json' : 'results.json'), JSON.stringify(results, null, 2));
