import '@fontsource-variable/archivo/wdth.css';
import '@fontsource/instrument-serif/400.css';
import '@fontsource/instrument-serif/400-italic.css';
import '@fontsource-variable/jetbrains-mono';
import 'iconify-icon';
import './style.css';

import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import Lenis from 'lenis';
import { SITE, PROJECTS, PALETTES, FONTS } from './config.js';
import { Configurator } from './configurator.js';
import { paintSite } from './sitepainter.js';

gsap.registerPlugin(ScrollTrigger);

const $ = (s, el = document) => el.querySelector(s);
const $$ = (s, el = document) => [...el.querySelectorAll(s)];
const html = document.documentElement;
const coarse = matchMedia('(pointer: coarse)').matches;
const isMobile = () => innerWidth < 900;

// ------------------------------------------------------------------ motion preference
const osReduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
let motionPref = null;
try { motionPref = localStorage.getItem('motion'); } catch {}
const reduced = motionPref === 'off' || (motionPref !== 'on' && osReduced);
if (reduced) html.classList.add('reduced');
const setMotion = (on) => { try { localStorage.setItem('motion', on ? 'on' : 'off'); } catch {} location.reload(); };
$$('.nav__motion').forEach((b) => {
  b.setAttribute('aria-pressed', String(!reduced));
  $('.nav__motion-state', b).textContent = reduced ? 'Off' : 'On';
  b.addEventListener('click', () => setMotion(reduced));
});
if (reduced && osReduced && motionPref !== 'off') {
  const note = $('.motion-note');
  note.hidden = false;
  $('[data-motion-on]', note).addEventListener('click', () => setMotion(true));
  $('[data-motion-dismiss]', note).addEventListener('click', () => { note.hidden = true; try { localStorage.setItem('motion', 'off'); } catch {} });
}
const hasWebGL = (() => { try { const c = document.createElement('canvas'); return !!(c.getContext('webgl2') || c.getContext('webgl')); } catch { return false; } })();

// ------------------------------------------------------------------ basics
$('.year').textContent = new Date().getFullYear();
$('#mail-cta').href = `mailto:${SITE.email}?subject=${encodeURIComponent('New project')}`;
const clock = $('.clock');
const tickClock = () => (clock.textContent = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }));
tickClock();
setInterval(tickClock, 15000);

// ------------------------------------------------------------------ split text (accessible)
function splitWords(el) {
  if (el.dataset.splitDone) return;
  el.dataset.splitDone = '1';
  if (!el.closest('[aria-label]') && !el.hasAttribute('aria-label')) el.setAttribute('aria-label', el.textContent.replace(/\s+/g, ' ').trim());
  const walk = (node) => {
    [...node.childNodes].forEach((n) => {
      if (n.nodeType === 3) {
        const frag = document.createDocumentFragment();
        n.textContent.split(/(\s+)/).forEach((part) => {
          if (!part) return;
          if (/^\s+$/.test(part)) { frag.append(' '); return; }
          const w = document.createElement('span');
          w.className = 'w';
          w.setAttribute('aria-hidden', 'true');
          const i = document.createElement('span');
          i.className = 'wi';
          i.textContent = part;
          w.append(i);
          frag.append(w);
        });
        n.replaceWith(frag);
      } else if (n.nodeType === 1 && n.tagName !== 'BR' && !n.classList.contains('w')) {
        n.setAttribute('aria-hidden', 'true');
        walk(n);
      }
    });
  };
  walk(el);
  $$('.w', el).forEach((w) => {
    if (!/^[.,!?;:…]+$/.test(w.textContent)) return;
    let prev = w.previousSibling;
    while (prev && prev.nodeType === 3 && !prev.textContent.trim()) prev = prev.previousSibling;
    const host = prev?.nodeType === 1 ? (prev.classList.contains('w') ? prev : [...prev.querySelectorAll('.w')].pop()) : null;
    if (!host) return;
    const tail = document.createElement('span');
    tail.className = 'w-tail';
    tail.textContent = w.textContent;
    $('.wi', host).append(tail);
    w.remove();
  });
}
// headings: split whole h1/h2 so every word can race in
['#hero-title', '#s2-title', '#s3-title', '#pit-title', '#podium-title', '#finish-title'].forEach((s) => splitWords($(s)));
// statement: words light up as you read
(() => {
  const el = $('.statement');
  el.innerHTML = el.innerHTML.split(/(<[^>]+>|\s+)/).filter(Boolean).map((w) => (w.startsWith('<') || /^\s+$/.test(w) ? w : `<span class="fw">${w}</span>`)).join('');
})();

// ------------------------------------------------------------------ content: speed-run frames, podium, classification
const setupOf = (cfg) => `${PALETTES[cfg.palette]?.label} · ${FONTS[cfg.font]?.label} · ${cfg.layout}`;
$('.s2__frames').innerHTML = PROJECTS.map((p, i) => `
  <li class="frame" data-i="${i}">
    <span class="frame__num" aria-hidden="true">${String(i + 1).padStart(2, '0')}</span>
    <div class="frame__media" data-cursor="Remix"><canvas width="960" height="600" aria-hidden="true"></canvas><span class="frame__badge mono">${p.concept ? 'Concept' : 'Client'} · ${p.year}</span></div>
    <div class="frame__meta"><h3>${p.title}</h3><span class="mono">${p.kind}</span></div>
    <p class="frame__summary">${p.summary}</p>
    <button class="frame__remix mono" type="button" data-remix="${i}">Remix in the pit stop →</button>
  </li>`).join('');
$('.s2__total').textContent = String(PROJECTS.length).padStart(2, '0');

const podiumOrder = [1, 0, 2]; // 2nd · 1st · 3rd
$('.podium__steps').innerHTML = podiumOrder.map((idx) => {
  const p = PROJECTS[idx];
  return `<div class="step" data-i="${idx}">
    <div class="step__card" data-cursor="Remix"><canvas width="960" height="600" aria-hidden="true"></canvas></div>
    <div class="step__name"><h3>${p.title}</h3><span class="mono">${p.kind}</span></div>
    <div class="step__block" aria-hidden="true">${idx + 1}</div>
  </div>`;
}).join('');
$('.classification__rows').innerHTML = PROJECTS.map((p, i) => `
  <li class="row" tabindex="0" data-remix="${i}" data-i="${i}" aria-label="P${i + 1}: ${p.title}, ${p.kind}. Open in the configurator">
    <span class="row__pos">P${i + 1}</span><span class="row__name">${p.title}</span><span class="mono">${p.kind}</span><span class="mono">${setupOf(p.cfg)}</span><span class="row__status mono">${p.concept ? 'Concept' : 'Live'}</span>
  </li>`).join('');

const paintCanvas = (c, cfg, t = 0) => paintSite(c.getContext('2d'), c.width, c.height, cfg, t, 1, { chrome: true });
const frameCanvases = $$('.frame canvas').map((c, i) => ({ c, cfg: PROJECTS[i].cfg }));
const stepCanvases = $$('.step canvas').map((c) => ({ c, cfg: PROJECTS[+c.closest('.step').dataset.i].cfg }));

// ------------------------------------------------------------------ configurator
let stage = null;
const configurator = new Configurator({
  form: $('#cfg'),
  canvas: $('#preview-canvas'),
  summaryEl: $('.build__summary'),
  statusEl: $('.cfg__status'),
  onChange: () => stage && (stage.previewDirty = true),
});

// ------------------------------------------------------------------ smooth scroll
let lenis = null;
if (!reduced) {
  lenis = new Lenis({ lerp: 0.09, wheelMultiplier: 0.95, touchMultiplier: 1.4 });
  lenis.on('scroll', ScrollTrigger.update);
  gsap.ticker.add((t) => lenis.raf(t * 1000));
  gsap.ticker.lagSmoothing(0);
  lenis.stop();
  if (import.meta.env.DEV) window.__lenis = lenis;
}
const scrollToEl = (target) => {
  const el = typeof target === 'string' ? $(target) : target;
  if (!el) return;
  if (lenis) lenis.scrollTo(el, { duration: 2, easing: (t) => 1 - Math.pow(1 - t, 4) });
  else el.scrollIntoView({ behavior: reduced ? 'auto' : 'smooth' });
};
const remix = (i) => {
  configurator.load({ ...PROJECTS[i].cfg });
  configurator.status(`Loaded “${PROJECTS[i].title}” — make it yours.`);
  scrollToEl('#pitstop');
};
document.addEventListener('click', (e) => {
  const a = e.target.closest('[data-scroll]');
  if (a) { e.preventDefault(); closeMenu(); scrollToEl(a.getAttribute('href')); return; }
  const r = e.target.closest('[data-remix]');
  if (r) { remix(+r.dataset.remix); return; }
  const media = e.target.closest('.frame__media, .step__card');
  if (media) { remix(+(media.closest('[data-i]').dataset.i)); return; }
  const rt = e.target.closest('[data-remix-type]');
  if (rt) {
    configurator.set({ type: rt.dataset.remixType });
    $(`#cfg input[name="type"][value="${rt.dataset.remixType}"]`).checked = true;
    scrollToEl('#pitstop');
  }
});
document.addEventListener('keydown', (e) => {
  if (e.key === 'Enter' && e.target.matches('.row')) remix(+e.target.dataset.remix);
  if (e.key === 'Escape') closeMenu();
});

// ------------------------------------------------------------------ menu
const burger = $('.nav__burger');
const menu = $('#menu');
function closeMenu() {
  if (menu.hidden) return;
  burger.setAttribute('aria-expanded', 'false');
  burger.setAttribute('aria-label', 'Open menu');
  html.classList.remove('menu-open');
  gsap.to(menu, { clipPath: 'circle(0% at 100% 0%)', duration: reduced ? 0 : 0.6, ease: 'expo.inOut', onComplete: () => (menu.hidden = true) });
  lenis?.start();
}
burger.addEventListener('click', () => {
  if (!menu.hidden) return closeMenu();
  menu.hidden = false;
  burger.setAttribute('aria-expanded', 'true');
  burger.setAttribute('aria-label', 'Close menu');
  html.classList.add('menu-open');
  lenis?.stop();
  gsap.fromTo(menu, { clipPath: 'circle(0% at 100% 0%)' }, { clipPath: 'circle(150% at 100% 0%)', duration: reduced ? 0 : 0.8, ease: 'expo.inOut' });
  gsap.from($$('a', menu), { xPercent: -30, opacity: 0, stagger: 0.04, duration: reduced ? 0 : 0.8, ease: 'expo.out', delay: 0.2 });
  $('a', menu).focus();
});

// ------------------------------------------------------------------ contour background (marching squares on fbm noise)
(function contours() {
  // rasterised once into a CSS mask: the GPU only moves a layer, the colour comes from --contour
  const layer = $('.contours');
  const W = 1600, H = 1000, cols = 80, rows = 50;
  let seed = 7;
  const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
  const grid = Array.from({ length: 9 * 7 }, rnd);
  const vn = (x, y) => {
    const ix = Math.floor(x), iy = Math.floor(y), fx = x - ix, fy = y - iy;
    const s = (t) => t * t * (3 - 2 * t);
    const g = (i, j) => grid[((j % 7) + 7) % 7 * 9 + ((i % 9) + 9) % 9];
    const a = g(ix, iy) + (g(ix + 1, iy) - g(ix, iy)) * s(fx);
    const b = g(ix, iy + 1) + (g(ix + 1, iy + 1) - g(ix, iy + 1)) * s(fx);
    return a + (b - a) * s(fy);
  };
  const f = (x, y) => vn(x * 0.09, y * 0.09) * 0.7 + vn(x * 0.2 + 3, y * 0.2 + 1) * 0.3;
  const field = [];
  for (let j = 0; j <= rows; j++) for (let i = 0; i <= cols; i++) field.push(f(i, j));
  const at = (i, j) => field[j * (cols + 1) + i];
  const sx = W / cols, sy = H / rows;
  let d = '';
  for (let lv = 0.18; lv < 0.95; lv += 0.055) {
    for (let j = 0; j < rows; j++) for (let i = 0; i < cols; i++) {
      const a = at(i, j), b = at(i + 1, j), c = at(i + 1, j + 1), e = at(i, j + 1);
      const pts = [];
      const edge = (v1, v2, x1, y1, x2, y2) => { if ((v1 < lv) !== (v2 < lv)) { const t = (lv - v1) / (v2 - v1); pts.push([(x1 + (x2 - x1) * t) * sx, (y1 + (y2 - y1) * t) * sy]); } };
      edge(a, b, i, j, i + 1, j); edge(b, c, i + 1, j, i + 1, j + 1); edge(e, c, i, j + 1, i + 1, j + 1); edge(a, e, i, j, i, j + 1);
      for (let k = 0; k + 1 < pts.length; k += 2) d += `M${pts[k][0].toFixed(1)} ${pts[k][1].toFixed(1)}L${pts[k + 1][0].toFixed(1)} ${pts[k + 1][1].toFixed(1)}`;
    }
  }
  const svgMarkup = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" preserveAspectRatio="xMidYMid slice"><path d="${d}" fill="none" stroke="#000" stroke-width="1.4"/></svg>`;
  const url = `url("${URL.createObjectURL(new Blob([svgMarkup], { type: 'image/svg+xml' }))}")`;
  layer.style.webkitMaskImage = url;
  layer.style.maskImage = url;
  if (!reduced) gsap.to(layer, { rotation: 5, scale: 1.08, xPercent: -2, duration: 40, ease: 'sine.inOut', yoyo: true, repeat: -1, transformOrigin: '50% 50%' });
})();

// ------------------------------------------------------------------ section themes (page colour shifts)
const THEMES = [
  { bg: '#0a0c10', nav: '#efebe3', contour: 'rgba(239,235,227,0.07)', ghost: 'rgba(239,235,227,0.16)' },
  { bg: '#efebe3', nav: '#0a0c10', contour: 'rgba(10,12,16,0.09)', ghost: 'rgba(10,12,16,0.18)' },
  { bg: '#0a0c10', nav: '#efebe3', contour: 'rgba(142,166,255,0.08)', ghost: 'rgba(239,235,227,0.16)' },
  { bg: '#e8e3d8', nav: '#0a0c10', contour: 'rgba(10,12,16,0.08)', ghost: 'rgba(10,12,16,0.18)' },
  { bg: '#2f5bff', nav: '#ffffff', contour: 'rgba(255,255,255,0.13)', ghost: 'rgba(255,255,255,0.3)' },
  { bg: '#efebe3', nav: '#0a0c10', contour: 'rgba(10,12,16,0.09)', ghost: 'rgba(10,12,16,0.18)' },
  { bg: '#0a0c10', nav: '#efebe3', contour: 'rgba(239,235,227,0.07)', ghost: 'rgba(239,235,227,0.16)' },
];
let themeIdx = -1;
function setTheme(i) {
  if (i === themeIdx) return;
  themeIdx = i;
  const t = THEMES[i];
  gsap.to(html, { '--page-bg': t.bg, '--nav-fg': t.nav, '--contour': t.contour, '--line-ghost': t.ghost, duration: reduced ? 0 : 0.8, ease: 'power2.out', overwrite: 'auto' });
  $('meta[name="theme-color"]').setAttribute('content', t.bg);
  html.dataset.sector = String(i);
}
setTheme(0);

// ------------------------------------------------------------------ loader: start lights
const pctEl = $('.loader__pct');
const lights = $$('.lights i');
const load = { p: 0, shown: 0 };
const setLoad = (p) => {
  load.p = Math.max(load.p, p);
  gsap.to(load, {
    shown: load.p, duration: 0.5, ease: 'power2.out', overwrite: true,
    onUpdate: () => {
      pctEl.textContent = String(Math.round(load.shown * 100)).padStart(3, '0');
      lights.forEach((l, i) => l.classList.toggle('on', load.shown >= (i + 1) / 5 - 0.001));
    },
  });
};

async function initStage() {
  if (reduced || !hasWebGL) { html.classList.add('no-stage'); return null; }
  try {
    const { Stage } = await import('./stage.js');
    setLoad(0.2);
    const s = new Stage($('#stage'), { previewCanvas: $('#preview-canvas'), mobile: isMobile(), onProgress: (p) => setLoad(0.2 + p * 0.7) });
    await s.load('/models/devices.glb');
    $('#stage').addEventListener('webglcontextlost', (e) => { e.preventDefault(); html.classList.add('no-stage'); html.classList.remove('has-stage'); });
    html.classList.add('has-stage');
    return s;
  } catch (err) {
    console.warn('3D stage unavailable, using poster', err);
    html.classList.add('no-stage');
    return null;
  }
}

const fontsReady = document.fonts ? Promise.race([document.fonts.ready, new Promise((r) => setTimeout(r, 2500))]) : Promise.resolve();
const minTime = new Promise((r) => setTimeout(r, reduced ? 0 : 1400));
Promise.all([
  initStage(),
  fontsReady.then(() => Promise.all(['900 40px "Archivo Variable"', 'italic 400 40px "Instrument Serif"', '500 20px "JetBrains Mono Variable"'].map((f) => document.fonts.load(f).catch(() => {})))),
  minTime,
]).then(([s]) => {
  stage = s;
  if (import.meta.env.DEV) window.__stage = s;
  configurator.paint(0);
  frameCanvases.forEach((k) => paintCanvas(k.c, k.cfg));
  stepCanvases.forEach((k) => paintCanvas(k.c, k.cfg));
  if (stage) stage.phonePainter = phonePainter;
  setLoad(1);
  setupScroll();
  intro();
});

// the phone shows the mobile version of whichever build is "live"
let phoneProject = 0;
function phonePainter(ctx, W, H, t) {
  const base = themeIdx === 4 ? configurator.state : PROJECTS[phoneProject].cfg;
  const cfg = { ...base, layout: 'centered' };
  paintSite(ctx, W, H, cfg, t, 1, { chrome: false });
}
if (!reduced) setInterval(() => { if (!inSpeedRun) phoneProject = (phoneProject + 1) % PROJECTS.length; }, 3200);
let inSpeedRun = false;

// ------------------------------------------------------------------ intro: lights out
let lapStart = 0;
function intro() {
  if (reduced) { document.body.classList.remove('is-loading'); $('.loader').remove(); return; }
  const heroWords = $$('#hero-title .wi');
  gsap.set(heroWords, { xPercent: -140, skewX: -24, opacity: 0 });
  gsap.set('.grid .reveal', { y: 40, opacity: 0 });
  gsap.set(['.nav', '.speedo'], { opacity: 0 });
  const tl = gsap.timeline({ delay: 0.35 });
  tl.add(() => lights.forEach((l) => l.classList.add('on')))
    .add(() => { lights.forEach((l) => l.classList.remove('on')); $('.loader__msg').textContent = 'Lights out'; }, '+=0.7')
    .to('.loader', { clipPath: 'inset(0 0 0 100%)', duration: 0.9, ease: 'expo.inOut' }, '+=0.12')
    .add(() => { document.body.classList.remove('is-loading'); lapStart = performance.now(); }, '<0.2')
    .add(() => stage && gsap.to(stage, { intro: 0, duration: 2.2, ease: 'expo.out' }), '<')
    .to(heroWords, { xPercent: 0, skewX: 0, opacity: 1, duration: 1.3, ease: 'expo.out', stagger: 0.08 }, '<0.15')
    .to('.grid .reveal', { y: 0, opacity: 1, duration: 1, ease: 'expo.out', stagger: 0.08 }, '<0.3')
    .to(['.nav', '.speedo'], { opacity: 1, duration: 0.8 }, '<0.2')
    .add(() => { $('.loader')?.remove(); lenis?.start(); });
}

// ------------------------------------------------------------------ scroll choreography
let s2ST = null;
const sectorTimes = {};
function setupScroll() {
  const vh = () => innerHeight;

  // GRID: start lights fill as you scroll, then go out — the race starts
  const gridLights = $$('.grid__lights i');
  ScrollTrigger.create({
    trigger: '#grid', start: 'top top', end: 'bottom top',
    onUpdate: (s) => {
      const p = s.progress;
      gridLights.forEach((l, i) => l.classList.toggle('on', p < 0.62 && p > (i + 1) * 0.1));
    },
  });
  if (!reduced) {
    gsap.to('.hero-title .line:first-child', { xPercent: -18, ease: 'none', scrollTrigger: { trigger: '#grid', start: 'top top', end: 'bottom top', scrub: true } });
    gsap.to('.hero-title .line--2', { xPercent: 14, ease: 'none', scrollTrigger: { trigger: '#grid', start: 'top top', end: 'bottom top', scrub: true } });
    gsap.to('.grid__foot', { y: -60, opacity: 0, ease: 'none', scrollTrigger: { trigger: '#grid', start: '35% top', end: '80% top', scrub: true } });
  }

  // headings race in from the side
  if (!reduced) {
    ['#s2-title', '#s3-title', '#pit-title', '#podium-title'].forEach((sel) => {
      const words = $$(`${sel} .wi`);
      gsap.from(words, { xPercent: -120, skewX: -20, opacity: 0, duration: 1.1, ease: 'expo.out', stagger: 0.07, scrollTrigger: { trigger: sel, start: 'top 82%', toggleActions: 'play none none reverse', ...(sel === '#s2-title' ? {} : {}) } });
    });
    $$('.sector-tag').forEach((t) => gsap.from(t, { x: -40, opacity: 0, duration: 0.9, ease: 'expo.out', scrollTrigger: { trigger: t, start: 'top 90%', toggleActions: 'play none none reverse' } }));
  }

  // S1: statement lights up, pit notes slide in from alternating sides
  if (!reduced) {
    gsap.fromTo('.statement .fw', { opacity: 0.14 }, { opacity: 1, stagger: 0.06, ease: 'none', scrollTrigger: { trigger: '.statement', start: 'top 78%', end: 'bottom 42%', scrub: true } });
    $$('.note').forEach((n, i) => gsap.from(n, { x: i % 2 ? 160 : -160, rotate: i % 2 ? 4 : -4, opacity: 0, duration: 1.2, ease: 'expo.out', scrollTrigger: { trigger: n, start: 'top 88%', toggleActions: 'play none none reverse' } }));
  }

  // S2: pinned horizontal speed run
  const track = $('.s2__track');
  const rail = $('.s2__rail');
  const frames = $$('.frame');
  if (!reduced) {
    const runTween = gsap.to(track, {
      x: () => -(track.scrollWidth - innerWidth),
      ease: 'none',
      scrollTrigger: {
        trigger: '#sector2', pin: true, start: 'top top',
        end: () => '+=' + (track.scrollWidth - innerWidth) * 1.15,
        scrub: 0.6, invalidateOnRefresh: true,
        onToggle: (s) => (inSpeedRun = s.isActive),
        onUpdate: (s) => {
          $('.s2__progress b').style.transform = `scaleX(${s.progress})`;
        },
      },
    });
    s2ST = runTween.scrollTrigger;
    gsap.fromTo(rail, { xPercent: 0 }, { xPercent: -55, ease: 'none', scrollTrigger: { trigger: '#sector2', start: 'top top', end: () => '+=' + (track.scrollWidth - innerWidth) * 1.15, scrub: 0.3, invalidateOnRefresh: true } });
    frames.forEach((f, i) => {
      gsap.from($('.frame__media', f), { yPercent: i % 2 ? 40 : -40, rotate: i % 2 ? 6 : -6, scale: 0.85, opacity: 0, ease: 'expo.out', duration: 1.2, scrollTrigger: { trigger: f, containerAnimation: runTween, start: 'left 92%', toggleActions: 'play none none reverse' } });
    });
  }

  // S3: code types itself, metrics count, trace draws, garage rolls in
  const CODE = [
    ['c', '// tuned for the fastest lap\n'],
    ['k', 'export default '], ['', 'defineSite({\n'],
    ['', '  name: '], ['s', "'your-brand'"], ['', ',\n'],
    ['', '  stack: ['], ['s', "'vite', 'gsap', 'three'"], ['', '],\n'],
    ['', '  store: '], ['s', "'shopify'"], ['', ',\n'],
    ['', '  budgets: { lcp: '], ['s', "'2.0s'"], ['', ', cls: '], ['s', '0.05'], ['', ' },\n'],
    ['', '  a11y: '], ['k', 'true'], ['', ',\n'],
    ['', '  motion: '], ['s', "'max'"], ['', ',\n'],
    ['', '});\n'],
  ];
  const codeEl = $('.code code');
  const total = CODE.reduce((n, [, t]) => n + t.length, 0);
  const esc = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;');
  const renderCode = (n) => {
    let out = '', left = n;
    for (const [cls, t] of CODE) {
      if (left <= 0) break;
      const part = esc(t.slice(0, left));
      out += cls ? `<span class="${cls}">${part}</span>` : part;
      left -= t.length;
    }
    codeEl.innerHTML = out + '<span class="caret"></span>';
  };
  renderCode(reduced ? total : 0);
  if (!reduced) {
    ScrollTrigger.create({ trigger: '.s3__top', start: 'top 70%', end: 'bottom 60%', onUpdate: (s) => renderCode(Math.round(s.progress * total)) });
    gsap.fromTo('.trace path', { strokeDasharray: 1600, strokeDashoffset: 1600 }, { strokeDashoffset: 0, ease: 'none', scrollTrigger: { trigger: '.telemetry', start: 'top 80%', end: 'bottom 50%', scrub: true } });
    gsap.from('.car-card', { y: 120, rotate: (i) => (i % 2 ? 3 : -3), opacity: 0, stagger: 0.08, duration: 1.1, ease: 'expo.out', scrollTrigger: { trigger: '.garage__grid', start: 'top 85%', toggleActions: 'play none none reverse' } });
  }
  $$('.metric b').forEach((b) => {
    const to = parseFloat(b.dataset.count), dec = +(b.dataset.dec || 0);
    if (reduced) { b.textContent = to.toFixed(dec); return; }
    const o = { v: 0 };
    gsap.to(o, { v: to, duration: 1.6, ease: 'power3.out', onUpdate: () => (b.textContent = o.v.toFixed(dec)), scrollTrigger: { trigger: '.telemetry', start: 'top 80%', toggleActions: 'play none none reverse' } });
  });

  // PIT: stopwatch while you configure
  const pitTimer = $('.pit__timer');
  let pitStart = 0, pitOn = false;
  ScrollTrigger.create({ trigger: '#pitstop', start: 'top 60%', end: 'bottom 40%', onToggle: (s) => { pitOn = s.isActive; if (pitOn) pitStart = performance.now(); } });
  gsap.ticker.add(() => { if (pitOn) pitTimer.textContent = `${((performance.now() - pitStart) / 1000).toFixed(1)}s`; });
  if (!reduced) gsap.from('.cfg > *', { y: 30, opacity: 0, stagger: 0.05, duration: 0.9, ease: 'expo.out', scrollTrigger: { trigger: '.cfg', start: 'top 85%', toggleActions: 'play none none reverse' } });

  // PODIUM: steps rise in finishing order (P1 first), rows slide in from the right
  if (!reduced) {
    const steps = $$('.step');
    gsap.from([steps[1], steps[0], steps[2]].map((s) => $('.step__block', s)), { scaleY: 0, transformOrigin: '50% 100%', duration: 1.1, ease: 'expo.out', stagger: 0.15, scrollTrigger: { trigger: '.podium__steps', start: 'top 75%', toggleActions: 'play none none reverse' } });
    gsap.from([steps[1], steps[0], steps[2]].map((s) => $('.step__card', s)), { y: 140, opacity: 0, duration: 1.2, ease: 'expo.out', stagger: 0.15, delay: 0.2, scrollTrigger: { trigger: '.podium__steps', start: 'top 75%', toggleActions: 'play none none reverse' } });
    gsap.from('.row', { xPercent: 30, opacity: 0, stagger: 0.06, duration: 1, ease: 'expo.out', scrollTrigger: { trigger: '.classification', start: 'top 85%', toggleActions: 'play none none reverse' } });
  }

  // FINISH: chequered flag sweeps, words slam in
  if (!reduced) {
    gsap.fromTo('.checker', { opacity: 0, scale: 2.2, rotate: -12 }, { opacity: 0.1, scale: 1.3, rotate: 0, ease: 'none', scrollTrigger: { trigger: '#finish', start: 'top bottom', end: 'center center', scrub: true } });
    gsap.from('#finish-title .wi', { yPercent: 120, skewY: 10, duration: 1.1, ease: 'expo.out', stagger: 0.07, scrollTrigger: { trigger: '#finish-title', start: 'top 80%', toggleActions: 'play none none reverse' } });
    gsap.from('.finish__lede, .finish__ctas', { y: 40, opacity: 0, duration: 1, ease: 'expo.out', stagger: 0.12, scrollTrigger: { trigger: '.finish__lede', start: 'top 92%', toggleActions: 'play none none reverse' } });
  }
  // footer marquee
  const mq = gsap.to('.footer__marquee span', { xPercent: -100, repeat: -1, duration: 16, ease: 'none' });

  // sector timing board
  const sectors = [['#sector1', 1], ['#sector2', 2], ['#sector3', 3]];
  sectors.forEach(([sel, n]) => {
    const li = $(`.timing__sectors li[data-s="${n}"]`);
    const bar = $('i', li);
    ScrollTrigger.create({
      trigger: sel, start: 'top 60%', end: n === 2 ? () => (s2ST ? s2ST.end : 0) : 'bottom 40%',
      onUpdate: (s) => { bar.style.transform = `scaleX(${s.progress})`; li.classList.toggle('is-live', s.isActive); },
      onLeave: () => {
        li.classList.add('is-done');
        if (!sectorTimes[n] && lapStart) {
          sectorTimes[n] = fmtLap(performance.now() - lapStart);
          $$(`[data-sector="${n}"] .sector-time`).forEach((el) => (el.textContent = `+${sectorTimes[n]}`));
        }
      },
    });
  });

  // page colour per section — created after the speed-run pin so their ranges include its spacing
  $$('[data-sector]').forEach((sec) => {
    const i = +sec.dataset.sector;
    ScrollTrigger.create({ trigger: sec, start: 'top 55%', end: 'bottom 55%', onToggle: (s) => s.isActive && setTheme(i) });
  });

  // ---------------------------------------------------------------- racing line + car
  buildRacingLine();
  ScrollTrigger.addEventListener('refresh', () => { buildRacingLine(); buildStageTracks(); });
  ScrollTrigger.refresh();
  buildStageTracks();

  // velocity-driven bits: skew the speed run, stretch the rails, speed the marquee
  let lastV = 0;
  const skewFrames = gsap.quickTo('.frame', 'skewX', { duration: 0.5, ease: 'power3' });
  lenis?.on('scroll', ({ velocity }) => {
    lastV = velocity;
    if (inSpeedRun) skewFrames(gsap.utils.clamp(-14, 14, -velocity * 0.5));
    mq.timeScale(1 + Math.min(Math.abs(velocity) * 0.2, 5));
  });
  gsap.ticker.add(() => {
    if (Math.abs(lastV) < 0.1) { skewFrames(0); mq.timeScale(gsap.utils.interpolate(mq.timeScale(), 1, 0.06)); }
    lastV *= 0.92;
    const w = 100 + Math.min(Math.abs(lenis?.velocity || 0) * 2.2, 25);
    rail.style.fontVariationSettings = `'wdth' ${w}`;
    $('.footer__marquee').style.fontVariationSettings = `'wdth' ${w}`;
    if (inSpeedRun) $('.speedlines').style.backgroundPosition = `${-(lenis?.animatedScroll || 0) * 1.6}px 0, ${-(lenis?.animatedScroll || 0) * 0.7}px 0`;
  });
}

// racing line: a smooth line that weaves down the page, skips the speed-run pin, and a car rides it
let linePath = null, lineLen = 0, lineSamples = [];
function buildRacingLine() {
  const svg = $('.racing-line');
  const H = document.documentElement.scrollHeight, W = innerWidth, vh = innerHeight;
  svg.setAttribute('viewBox', `0 0 ${W} ${H}`);
  svg.style.height = `${H}px`;
  const top = (el) => el.getBoundingClientRect().top + scrollY;
  const span = (el) => { const box = el.parentElement.classList.contains('pin-spacer') ? el.parentElement : el; const t = top(box); return [t, t + box.offsetHeight]; };
  // the line keeps to a margin "lane" inside each section and only swaps sides in the gaps between sections
  const lane = (side) => (side ? W - Math.max(18, W * 0.025) : Math.max(18, W * 0.025));
  const pts = [[W * 0.5, vh * 0.94]];
  const run = (el, side, padTop = 0.18, padBot = 0.14) => {
    const [a, b] = span(el);
    const y0 = a + vh * padTop, y1 = b - vh * padBot;
    const n = Math.max(1, Math.round((y1 - y0) / (vh * 0.7)));
    for (let k = 0; k <= n; k++) {
      const wobble = Math.sin(k * 1.7 + a * 0.001) * W * 0.012;
      pts.push([lane(side) + (side ? -1 : 1) * Math.abs(wobble), y0 + ((y1 - y0) * k) / n]);
    }
  };
  run($('#sector1'), false);
  const [s2a, s2b] = span($('#sector2'));
  pts.push([-80, s2a + vh * 0.2], [-80, s2b - vh * 0.2]); // through the speed run: off-screen, speedlines take over
  run($('#sector3'), true);
  run($('#pitstop'), false, 0.1, 0.1);
  run($('#podium'), true);
  run($('#finish'), false, 0.12, 0.3);
  pts.push([W * 0.5, H - 30]);
  // Catmull-Rom → cubic Bézier
  let d = `M${pts[0][0]} ${pts[0][1]}`;
  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = pts[i - 1] || pts[i], p1 = pts[i], p2 = pts[i + 1], p3 = pts[i + 2] || p2;
    const c1 = [p1[0] + (p2[0] - p0[0]) / 6, p1[1] + (p2[1] - p0[1]) / 6];
    const c2 = [p2[0] - (p3[0] - p1[0]) / 6, p2[1] - (p3[1] - p1[1]) / 6];
    d += ` C${c1[0].toFixed(1)} ${c1[1].toFixed(1)} ${c2[0].toFixed(1)} ${c2[1].toFixed(1)} ${p2[0].toFixed(1)} ${p2[1].toFixed(1)}`;
  }
  $('.racing-line__ghost').setAttribute('d', d);
  linePath = $('.racing-line__path');
  linePath.setAttribute('d', d);
  lineLen = linePath.getTotalLength();
  linePath.style.strokeDasharray = `${lineLen}`;
  lineSamples = [];
  for (let l = 0; l <= lineLen; l += 10) { const p = linePath.getPointAtLength(l); lineSamples.push([l, p.x, p.y]); }
}
function carAt(y) {
  // samples are (mostly) monotonic in y: find the furthest sample above y
  let lo = 0, hi = lineSamples.length - 1;
  while (lo < hi) { const mid = (lo + hi + 1) >> 1; if (lineSamples[mid][2] <= y) lo = mid; else hi = mid - 1; }
  return lineSamples[lo];
}

// device keyframes, rebuilt on every refresh from real section positions
function buildStageTracks() {
  if (!stage) return;
  const vh = innerHeight, W = innerWidth;
  const docTop = (el) => el.getBoundingClientRect().top + scrollY;
  const max = ScrollTrigger.maxScroll(window);
  const grid = $('#grid'), s1 = $('#sector1'), s3 = $('#sector3'), pit = $('#pitstop'), pod = $('#podium');
  const s2a = s2ST ? s2ST.start : docTop($('#sector2')), s2b = s2ST ? s2ST.end : s2a + vh;
  const dev = $('.s3__device').getBoundingClientRect();
  const devY = docTop($('.s3__device')) + dev.height / 2 - vh / 2;
  const devX = (dev.left + dev.width / 2) / W - 0.5;
  const pitY = docTop(pit);
  const S = (o) => ({ x: 0, y: 0, size: 0.5, rx: 0, ry: 0, rz: 0, lid: 0, o: 1, ...o });
  const mob = isMobile();
  const TAU = Math.PI * 2;

  stage.setTrack('phone', mob ? [
    { y: 0, s: S({ x: 0.05, y: 0.2, size: 0.42, rx: 0.1, ry: -0.4, rz: 0.08 }) },
    { y: docTop(s1), s: S({ x: 0.28, y: 0.32, size: 0.24, ry: Math.PI - 0.4, rz: -0.1 }) },
    { y: s2a, s: S({ x: -0.7, y: -0.36, size: 0.2, rx: 0.2, ry: TAU - 0.3, rz: -0.2 }) },
    { y: s2b, s: S({ x: 0.7, y: -0.36, size: 0.2, rx: 0.2, ry: TAU * 2, rz: -0.2 }) },
    { y: docTop(s3), s: S({ x: 0.6, y: 0.7, size: 0.2, o: 0 }) },
    { y: max - vh * 0.6, s: S({ x: 0.6, y: 0.7, size: 0.2, o: 0 }) },
    { y: max, s: S({ x: 0, y: 0.22, size: 0.3, ry: TAU * 3 - 0.3, rz: 0.1 }) },
  ] : [
    { y: 0, s: S({ x: 0.27, y: -0.02, size: 0.62, rx: 0.08, ry: -0.5, rz: 0.1 }) },
    { y: docTop(grid) + grid.offsetHeight - vh * 0.5, s: S({ x: 0.3, y: 0.04, size: 0.56, rx: 0.2, ry: -1.3, rz: 0.04 }) },
    { y: docTop(s1) + s1.offsetHeight / 2 - vh / 2, s: S({ x: 0.33, y: 0.02, size: 0.5, rx: 0.1, ry: Math.PI - 0.5, rz: -0.12 }) },
    { y: s2a, s: S({ x: -0.62, y: -0.3, size: 0.3, rx: 0.25, ry: TAU - 0.3, rz: -0.3 }) },
    { y: s2b, s: S({ x: 0.62, y: -0.3, size: 0.3, rx: 0.25, ry: TAU * 2.2, rz: -0.3 }) },
    { y: docTop(s3), s: S({ x: 0.55, y: 0.7, size: 0.3, ry: TAU * 2.4, o: 0 }) },
    { y: pitY - vh * 0.5, s: S({ x: 0.55, y: -0.6, size: 0.3, ry: TAU * 2.6, o: 0 }) },
    { y: pitY, s: S({ x: 0.43, y: -0.14, size: 0.36, rx: 0.06, ry: TAU * 3 - 0.28, rz: 0.03 }) },
    { y: pitY + pit.offsetHeight - vh, s: S({ x: 0.43, y: -0.14, size: 0.36, rx: 0.06, ry: TAU * 3 - 0.28, rz: 0.03 }) },
    { y: docTop(pod), s: S({ x: 0.62, y: -0.8, size: 0.3, o: 0 }) },
    { y: max - vh * 0.8, s: S({ x: 0.62, y: -0.8, size: 0.3, o: 0 }) },
    { y: max, s: S({ x: 0.36, y: -0.12, size: 0.4, rx: 0.15, ry: TAU * 4 - 0.6, rz: 0.12 }) },
  ]);

  stage.setTrack('laptop', [
    { y: 0, s: S({ x: devX, y: -1.2, size: 0.3, rx: 0.6, lid: 0, o: 0 }) },
    { y: docTop(s3) - vh * 0.6, s: S({ x: devX, y: -1.0, size: mob ? 0.7 : 0.38, rx: 0.7, ry: -0.6, lid: 0, o: 0 }) },
    { y: docTop(s3) - vh * 0.1, s: S({ x: devX, y: -0.75, size: mob ? 0.7 : 0.38, rx: 0.7, ry: -0.6, lid: 0 }) },
    { y: devY, s: S({ x: devX, y: mob ? 0.12 : 0, size: (dev.width / W) * (mob ? 0.9 : 0.92), rx: 0.32, ry: -0.42, lid: 1 }) },
    { y: devY + vh * 0.5, s: S({ x: devX, y: 0.05, size: (dev.width / W) * 0.92, rx: 0.3, ry: -0.2, lid: 1 }) },
    { y: devY + vh * 1.3, s: S({ x: 0.75, y: 0.7, size: 0.3, rx: 0.4, lid: 0.2, o: 0 }) },
    { y: pitY - vh * 0.7, s: S({ x: 0.6, y: -0.8, size: 0.36, rx: 0.5, ry: -0.6, lid: 0, o: mob ? 0 : 0 }) },
    { y: pitY - vh * 0.15, s: S({ x: 0.3, y: -0.2, size: 0.44, rx: 0.3, ry: -0.3, lid: 0.6, o: mob ? 0 : 1 }) },
    { y: pitY, s: S({ x: 0.17, y: 0.06, size: 0.44, rx: 0.1, ry: -0.12, lid: 1, o: mob ? 0 : 1 }) },
    { y: pitY + pit.offsetHeight - vh, s: S({ x: 0.17, y: 0.06, size: 0.44, rx: 0.1, ry: -0.12, lid: 1, o: mob ? 0 : 1 }) },
    { y: docTop(pod), s: S({ x: 0.7, y: -1, size: 0.4, rx: 0.4, lid: 0, o: 0 }) },
  ]);
}

// ------------------------------------------------------------------ cursor + magnetic + hover preview
const cursor = $('.cursor');
const ring = $('.cursor__ring');
const trail = $('.cursor__trail');
const label = $('.cursor__label');
const pointer = { x: innerWidth / 2, y: innerHeight / 2, nx: 0, ny: 0, px: 0, py: 0 };
if (!coarse && !reduced) {
  const rx = gsap.quickTo(ring, 'x', { duration: 0.45, ease: 'power3' });
  const ry = gsap.quickTo(ring, 'y', { duration: 0.45, ease: 'power3' });
  addEventListener('pointermove', (e) => {
    pointer.x = e.clientX; pointer.y = e.clientY;
    pointer.nx = (e.clientX / innerWidth) * 2 - 1;
    pointer.ny = -(e.clientY / innerHeight) * 2 + 1;
    rx(e.clientX); ry(e.clientY);
    cursor.classList.add('is-on');
  });
  document.addEventListener('pointerleave', () => cursor.classList.remove('is-on'));
  addEventListener('blur', () => cursor.classList.remove('is-on'));
  document.addEventListener('pointerover', (e) => {
    const t = e.target.closest('a, button, input, label, [data-cursor], .row');
    cursor.classList.toggle('is-hover', !!t);
    const l = t?.closest('[data-cursor]')?.dataset.cursor || (t?.classList.contains('row') ? 'Remix' : '');
    label.textContent = l;
    cursor.classList.toggle('has-label', !!l);
  });
  // speed trail: stretches behind the cursor in the direction of travel
  gsap.ticker.add(() => {
    const dx = pointer.x - pointer.px, dy = pointer.y - pointer.py;
    const sp = Math.min(Math.hypot(dx, dy), 60);
    pointer.px += dx * 0.35; pointer.py += dy * 0.35;
    trail.style.transform = `translate(${pointer.x}px, ${pointer.y}px) rotate(${Math.atan2(dy, dx)}rad) scaleX(${sp / 60})`;
  });
  $$('.magnetic').forEach((el) => {
    const xTo = gsap.quickTo(el, 'x', { duration: 0.6, ease: 'elastic.out(1, 0.4)' });
    const yTo = gsap.quickTo(el, 'y', { duration: 0.6, ease: 'elastic.out(1, 0.4)' });
    el.addEventListener('pointermove', (e) => { const r = el.getBoundingClientRect(); xTo((e.clientX - (r.left + r.width / 2)) * 0.3); yTo((e.clientY - (r.top + r.height / 2)) * 0.4); });
    el.addEventListener('pointerleave', () => { xTo(0); yTo(0); });
  });
  // classification hover preview follows the cursor
  const hp = $('.hover-preview');
  const hpc = $('canvas', hp);
  const hx = gsap.quickTo(hp, 'x', { duration: 0.5, ease: 'power3' });
  const hy = gsap.quickTo(hp, 'y', { duration: 0.5, ease: 'power3' });
  let hpCfg = null;
  $$('.row').forEach((row) => {
    row.addEventListener('pointerenter', () => { hpCfg = PROJECTS[+row.dataset.i].cfg; paintCanvas(hpc, hpCfg); gsap.to(hp, { opacity: 1, scale: 1, rotate: -4, duration: 0.5, ease: 'expo.out' }); });
    row.addEventListener('pointerleave', () => { hpCfg = null; gsap.to(hp, { opacity: 0, scale: 0.6, rotate: 0, duration: 0.4, ease: 'power3.in' }); });
  });
  addEventListener('pointermove', (e) => { hx(e.clientX + 24); hy(e.clientY - 120); });
  gsap.ticker.add((t) => { if (hpCfg) paintCanvas(hpc, hpCfg, t); });
} else {
  cursor.remove();
}

// ------------------------------------------------------------------ frame loop: devices, car, telemetry
const kmhEl = $('.speedo__kmh'), gearEl = $('.speedo__gear b'), fillEl = $('.speedo__fill'), lapEl = $('.timing__clock');
const car = $('.car');
const nearestFrame = () => {
  let best = 0, bestD = Infinity;
  $$('.frame').forEach((f, i) => { const r = f.getBoundingClientRect(); const d = Math.abs(r.left + r.width / 2 - innerWidth / 2); if (d < bestD) { bestD = d; best = i; } });
  return best;
};
function fmtLap(ms) {
  const m = Math.floor(ms / 60000), s = Math.floor((ms % 60000) / 1000), x = Math.floor(ms % 1000);
  return `${m}:${String(s).padStart(2, '0')}.${String(x).padStart(3, '0')}`;
}
let kmh = 0;
gsap.ticker.add((time, deltaMs) => {
  const dt = Math.min(deltaMs / 1000, 0.25);
  const y = lenis ? lenis.animatedScroll : scrollY;
  if (stage) {
    stage.scrollY = y;
    stage.pointer.set(pointer.nx, pointer.ny);
    if (inSpeedRun) phoneProject = nearestFrame();
    const pitVisible = themeIdx === 4 || themeIdx === 3;
    configurator.active = pitVisible;
    if (configurator.tick(time, dt)) stage.previewDirty = true;
    stage.frame(time, dt);
  } else {
    configurator.active = themeIdx === 4;
    configurator.tick(time, dt);
  }

  // car rides the racing line at ~60% of the viewport
  if (lineSamples.length && !reduced) {
    const target = y + innerHeight * 0.62;
    const s = carAt(target);
    car.style.transform = `translate(${s[1]}px, ${s[2]}px)`;
    linePath.style.strokeDashoffset = `${lineLen - s[0]}`;
  }

  // speedometer + lap clock
  const v = Math.abs(lenis?.velocity || 0);
  kmh += (Math.min(v * 9, 340) - kmh) * Math.min(1, dt * 6);
  kmhEl.textContent = String(Math.round(kmh)).padStart(3, '0');
  fillEl.style.strokeDashoffset = `${158 * (1 - kmh / 340)}`;
  gearEl.textContent = kmh < 4 ? 'N' : String(Math.min(8, Math.max(1, Math.ceil(kmh / 42))));
  if (lapStart) lapEl.textContent = fmtLap(performance.now() - lapStart);

  // speed-run frames tilt like cover flow around the centre
  if (inSpeedRun) {
    $$('.frame__media').forEach((m) => {
      const r = m.getBoundingClientRect();
      const d = (r.left + r.width / 2 - innerWidth / 2) / innerWidth;
      m.style.transform = `perspective(1000px) rotateY(${(-d * 22).toFixed(2)}deg) scale(${(1 - Math.min(Math.abs(d), 0.6) * 0.12).toFixed(3)})`;
    });
    $('.s2__idx').textContent = String(phoneProject + 1).padStart(2, '0');
  }
});

// ------------------------------------------------------------------ resize
let resizeT, lastW = innerWidth;
addEventListener('resize', () => {
  clearTimeout(resizeT);
  resizeT = setTimeout(() => {
    stage?.resize();
    if (innerWidth !== lastW || !coarse) ScrollTrigger.refresh();
    lastW = innerWidth;
  }, 150);
});
