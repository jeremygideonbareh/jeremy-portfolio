// Debug helper: evaluate an expression in the running dev page after load.
// usage: node tools/probe.mjs "<js expression>" [url]
import { chromium } from 'playwright';
const expr = process.argv[2];
const url = process.argv[3] || 'http://localhost:5173/';
const browser = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const page = await (await browser.newContext({ viewport: { width: 1440, height: 900 }, reducedMotion: 'no-preference' })).newPage();
page.on('pageerror', (e) => console.log('pageerror', e.message));
page.on('console', (m) => ['warning', 'error'].includes(m.type()) && console.log(m.type(), m.text().slice(0, 400)));
await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 60000 });
await page.waitForTimeout(7000);
console.log(await page.evaluate(expr));
await browser.close();
