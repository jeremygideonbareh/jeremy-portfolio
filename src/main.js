import '@fontsource-variable/archivo/wdth.css';
import '@fontsource-variable/bricolage-grotesque'; // configurator "Grotesk" option
import '@fontsource/instrument-serif/400.css';
import '@fontsource/instrument-serif/400-italic.css';
import '@fontsource-variable/jetbrains-mono';
import 'iconify-icon';
import './style.css';

import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import Lenis from 'lenis';
import { SITE, WORK } from './config.js';
import { Configurator } from './configurator.js';
import { paintSite } from './sitepainter.js';
import { FEATURED, shotUrl, statusOf, loadStrip, createSheet, createOnboard, createFilters, frameFilmstrips } from './work.js';

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
$('.footer__socials').innerHTML = (SITE.socials || []).map(([label, href]) => `<a href="${href}" target="_blank" rel="noopener">${label}</a>`).join('');
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
['#hero-title', '#s2-title', '#s3-title', '#pit-title', '#podium-title', '#finish-title', '#onboard-title'].forEach((s) => splitWords($(s)));
// statement: words light up as you read
(() => {
  const el = $('.statement');
  el.innerHTML = el.innerHTML.split(/(<[^>]+>|\s+)/).filter(Boolean).map((w) => (w.startsWith('<') || /^\s+$/.test(w) ? w : `<span class="fw">${w}</span>`)).join('');
})();

// ------------------------------------------------------------------ content: real launches (speed run, podium, classification)
const pad2 = (n) => String(n).padStart(2, '0');
const sheetLabel = (w) => `${w.title}, ${w.kind}. Open the telemetry sheet`;
$('.s2__frames').innerHTML = FEATURED.map((p, i) => `
  <li class="frame" data-i="${i}">
    <span class="frame__num" aria-hidden="true">${pad2(i + 1)}</span>
    <div class="frame__tilt"><button class="frame__media" type="button" data-sheet="${WORK.indexOf(p)}" data-cursor="Open" aria-label="${sheetLabel(p)}"><img src="${shotUrl(p)}" width="960" height="600" alt="" decoding="async" /><span class="frame__badge mono">${statusOf(p)} · ${p.year}</span><span class="frame__hint mono" aria-hidden="true">Hover to scroll · click for details</span></button></div>
    <div class="frame__meta"><h3>${p.title}</h3><span class="mono">${p.kind}</span></div>
    <p class="frame__summary">${p.summary}</p>
    <button class="frame__remix mono" type="button" data-remix="${i}">Start a build in this style →</button>
  </li>`).join('');
$('.s2__total').textContent = pad2(FEATURED.length);

const podiumOrder = [1, 0, 2]; // 2nd · 1st · 3rd
$('.podium__steps').innerHTML = podiumOrder.map((idx) => {
  const p = FEATURED[idx];
  return `<div class="step" data-i="${idx}">
    <button class="step__card" type="button" data-sheet="${WORK.indexOf(p)}" data-cursor="Open" aria-label="${sheetLabel(p)}"><img src="${shotUrl(p)}" width="960" height="600" alt="" loading="lazy" decoding="async" /></button>
    <div class="step__name"><h3>${p.title}</h3><span class="mono">${p.kind}</span></div>
    <div class="step__block" aria-hidden="true">${idx + 1}</div>
  </div>`;
}).join('');
$('.classification__rows').innerHTML = WORK.map((p, i) => `
  <li><a class="row" href="${p.url}" target="_blank" rel="noopener" data-i="${i}" data-cursor="Open" aria-haspopup="dialog" aria-label="${p.title}, ${p.kind}, ${statusOf(p)}. Open the telemetry sheet">
    <span class="row__pos">#${pad2(i + 1)}</span><span class="row__name">${p.title}</span><span class="mono">${p.kind}</span><span class="mono">${p.line || p.summary}</span><span class="row__status mono">${statusOf(p)} ↗</span>
  </a></li>`).join('');
// warm the classification thumbnails once the line-up is close, so hover previews never flash empty
new IntersectionObserver((entries, io) => {
  if (!entries.some((e) => e.isIntersecting)) return;
  io.disconnect();
  WORK.forEach((w) => { const im = new Image(); im.src = shotUrl(w); });
}, { rootMargin: '100% 0px' }).observe($('#podium'));

// ------------------------------------------------------------------ configurator
let stage = null;
if (isMobile()) { const pc = $('#preview-canvas'); pc.width = 1000; pc.height = 625; }
const configurator = new Configurator({
  form: $('#cfg'),
  canvas: $('#preview-canvas'),
  summaryEl: $('.build__summary'),
  statusEl: $('.cfg__status'),
  onChange: () => stage && (stage.previewDirty = true),
  onSend: (brief, typeLabel) => {
    const form = $('#contact');
    form.elements.message.value = brief + (form.elements.message.value.replace(/^Setup from the pit stop:[\s\S]*?\n\n\n?/, '') || '');
    if ([...form.elements.type.options].some((o) => o.value === typeLabel)) form.elements.type.value = typeLabel;
    if (lenis) lenis.scrollTo('#contact', { offset: -110, duration: 1.8, easing: (t) => 1 - Math.pow(1 - t, 4) });
    else $('#contact').scrollIntoView({ behavior: reduced ? 'auto' : 'smooth' });
    setTimeout(() => form.elements.name.focus({ preventScroll: true }), 1600);
  },
});

// ------------------------------------------------------------------ entry form (contact)
(function contactForm() {
  const form = $('#contact');
  const status = $('.contact__status', form);
  const submit = $('button[type="submit"]', form);
  $$('.contact__err', form).forEach((el, i) => { el.id = `contact-err-${i}`; el.closest('label').querySelector('input, textarea').setAttribute('aria-describedby', el.id); });
  const err = (input, msg) => {
    input.setAttribute('aria-invalid', msg ? 'true' : 'false');
    const slot = input.closest('label').querySelector('.contact__err');
    if (slot) slot.textContent = msg || '';
  };
  const validate = () => {
    const { name, email, message } = form.elements;
    let ok = true;
    if (!name.value.trim()) { err(name, 'Tell me what to call you.'); ok = false; } else err(name, '');
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email.value.trim())) { err(email, 'That email doesn’t look right.'); ok = false; } else err(email, '');
    if (message.value.trim().length < 10) { err(message, 'A sentence or two about the project, please.'); ok = false; } else err(message, '');
    return ok;
  };
  form.addEventListener('input', (e) => { if (e.target.getAttribute('aria-invalid') === 'true') validate(); });
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    if (!validate()) { form.querySelector('[aria-invalid="true"]')?.focus(); status.textContent = 'A couple of fields need a look.'; return; }
    const data = Object.fromEntries(new FormData(form));
    submit.disabled = true;
    status.textContent = 'Sending your entry…';
    if (SITE.formEndpoint) {
      try {
        const res = await fetch(SITE.formEndpoint, { method: 'POST', headers: { 'Content-Type': 'application/json', Accept: 'application/json' }, body: JSON.stringify(data) });
        if (!res.ok) throw new Error(res.status);
        status.textContent = `Entry received — thanks ${data.name.split(' ')[0]}. I’ll reply within two working days.`;
        form.reset();
        gsap.fromTo('.checker', { opacity: 0.1 }, { opacity: 0.3, yoyo: true, repeat: 3, duration: 0.25 });
      } catch {
        status.textContent = 'Couldn’t send just now — opening your email app instead.';
        location.href = mailtoFrom(data);
      }
    } else {
      status.textContent = 'Opening your email app with everything filled in…';
      location.href = mailtoFrom(data);
    }
    submit.disabled = false;
  });
  const mailtoFrom = (d) => `mailto:${SITE.email}?subject=${encodeURIComponent(`New ${d.type.toLowerCase()} project — ${d.name}`)}&body=${encodeURIComponent(`${d.message}\n\nBudget: ${d.budget}\nFrom: ${d.name} <${d.email}>`)}`;
  $('[data-copy-email]', form).addEventListener('click', async (e) => {
    try { await navigator.clipboard.writeText(SITE.email); e.target.textContent = 'Copied ✓'; } catch { e.target.textContent = SITE.email; }
  });
})();

// ------------------------------------------------------------------ smooth scroll
let lenis = null;
if (!reduced) {
  lenis = new Lenis({
    lerp: 0.09, wheelMultiplier: 0.9, touchMultiplier: 1.4,
    virtualScroll: (d) => wheelGate(d),
  });
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
const sheet = createSheet({ getLenis: () => lenis, onRemix: (i) => remix(i), reduced });
const onboard = createOnboard({ reduced });
createFilters({ onFiltered: () => ScrollTrigger.refresh(), scrollTo: (sel) => (lenis ? lenis.scrollTo(sel, { offset: -110, duration: 1 }) : $(sel).scrollIntoView()) });
if (!coarse) frameFilmstrips();
const remix = (i) => {
  const { type, name, headline, palette, font, layout, radius, motion } = FEATURED[i].cfg;
  configurator.load({ type, name, headline, palette, font, layout, radius, motion });
  configurator.status(`Loaded the ${FEATURED[i].title} setup — now make it yours.`);
  scrollToEl('#pitstop');
};
document.addEventListener('click', (e) => {
  const a = e.target.closest('[data-scroll]');
  if (a) { e.preventDefault(); closeMenu(); scrollToEl(a.getAttribute('href')); return; }
  const r = e.target.closest('[data-remix]');
  if (r) { remix(+r.dataset.remix); return; }
  const jump = e.target.closest('[data-jump]');
  if (jump) { scrollToEl(jump.dataset.jump); return; }
  const op = e.target.closest('[data-sheet]');
  if (op && !op.closest('#sheet')) { sheet.open(+op.dataset.sheet, op.closest('.frame__media, .step__card, .ob__phone') || op); return; }
  // rows stay real links (middle-click / ⌘-click opens the live site); a plain click opens the sheet
  const row = e.target.closest('a.row');
  if (row && e.button === 0 && !e.metaKey && !e.ctrlKey && !e.shiftKey && !e.altKey) { e.preventDefault(); sheet.open(+row.dataset.i, row); return; }
  if (e.target.closest('[data-random]')) { sheet.open(Math.floor(Math.random() * WORK.length), e.target.closest('[data-random]')); return; }
  const rt = e.target.closest('[data-remix-type]');
  if (rt) {
    configurator.set({ type: rt.dataset.remixType });
    $(`#cfg input[name="type"][value="${rt.dataset.remixType}"]`).checked = true;
    scrollToEl('#pitstop');
  }
});
document.addEventListener('keydown', (e) => {
  // keep keyboard focus inside the open menu (burger ↔ links)
  if (e.key === 'Tab' && !menu.hidden) {
    const items = [burger, ...$$('a, button', menu)];
    const i = items.indexOf(document.activeElement);
    const next = e.shiftKey ? (i <= 0 ? items.length - 1 : i - 1) : (i === items.length - 1 ? 0 : i + 1);
    e.preventDefault();
    items[next].focus();
  }
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
  // draw the iso-lines once into a bitmap; a bitmap mask is cheap to move on any GPU
  const cv = document.createElement('canvas');
  cv.width = W; cv.height = H;
  const cx = cv.getContext('2d');
  cx.strokeStyle = '#000';
  cx.lineWidth = 1.4;
  cx.beginPath();
  for (let lv = 0.18; lv < 0.95; lv += 0.055) {
    for (let j = 0; j < rows; j++) for (let i = 0; i < cols; i++) {
      const a = at(i, j), b = at(i + 1, j), c = at(i + 1, j + 1), e = at(i, j + 1);
      const pts = [];
      const edge = (v1, v2, x1, y1, x2, y2) => { if ((v1 < lv) !== (v2 < lv)) { const t = (lv - v1) / (v2 - v1); pts.push([(x1 + (x2 - x1) * t) * sx, (y1 + (y2 - y1) * t) * sy]); } };
      edge(a, b, i, j, i + 1, j); edge(b, c, i + 1, j, i + 1, j + 1); edge(e, c, i, j + 1, i + 1, j + 1); edge(a, e, i, j, i, j + 1);
      for (let k = 0; k + 1 < pts.length; k += 2) { cx.moveTo(pts[k][0], pts[k][1]); cx.lineTo(pts[k + 1][0], pts[k + 1][1]); }
    }
  }
  cx.stroke();
  cv.toBlob((blob) => {
    const url = `url("${URL.createObjectURL(blob)}")`;
    layer.style.webkitMaskImage = url;
    layer.style.maskImage = url;
  }, 'image/png');
  if (!reduced && !isMobile()) gsap.to(layer, { rotation: 5, scale: 1.08, xPercent: -2, duration: 40, ease: 'sine.inOut', yoyo: true, repeat: -1, transformOrigin: '50% 50%' });
})();

// ------------------------------------------------------------------ section themes (page colour shifts)
const DARK_PILL = 'rgba(10,12,16,0.62)', LIGHT_PILL = 'rgba(239,235,227,0.78)', BLUE_PILL = 'rgba(22,52,214,0.7)';
const THEMES = [
  { bg: '#0a0c10', nav: '#efebe3', pill: DARK_PILL, contour: 'rgba(239,235,227,0.055)', ghost: 'rgba(239,235,227,0.16)' },
  { bg: '#efebe3', nav: '#0a0c10', pill: LIGHT_PILL, contour: 'rgba(10,12,16,0.065)', ghost: 'rgba(10,12,16,0.18)' },
  { bg: '#0a0c10', nav: '#efebe3', pill: DARK_PILL, contour: 'rgba(142,166,255,0.08)', ghost: 'rgba(239,235,227,0.16)' },
  { bg: '#e8e3d8', nav: '#0a0c10', pill: 'rgba(232,227,216,0.8)', contour: 'rgba(10,12,16,0.06)', ghost: 'rgba(10,12,16,0.18)' },
  { bg: '#2f5bff', nav: '#ffffff', pill: BLUE_PILL, contour: 'rgba(255,255,255,0.13)', ghost: 'rgba(255,255,255,0.3)' },
  { bg: '#efebe3', nav: '#0a0c10', pill: LIGHT_PILL, contour: 'rgba(10,12,16,0.065)', ghost: 'rgba(10,12,16,0.18)' },
  { bg: '#0a0c10', nav: '#efebe3', pill: DARK_PILL, contour: 'rgba(239,235,227,0.055)', ghost: 'rgba(239,235,227,0.16)' },
  { bg: '#0d1017', nav: '#efebe3', pill: DARK_PILL, contour: 'rgba(142,166,255,0.08)', ghost: 'rgba(239,235,227,0.16)' }, // 7 onboard
];
let themeIdx = -1;
function setTheme(i) {
  if (i === themeIdx) return;
  themeIdx = i;
  const t = THEMES[i];
  gsap.to(html, { '--page-bg': t.bg, '--nav-fg': t.nav, '--nav-pill': t.pill, duration: reduced ? 0 : 0.8, ease: 'power2.out', overwrite: 'auto' });
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
    await s.load(`${import.meta.env.BASE_URL}models/devices.glb`);
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
// first visit gets the full start-light ceremony; repeat visits go green almost at once
let returning = false;
try { returning = sessionStorage.getItem('lap') === '1'; sessionStorage.setItem('lap', '1'); } catch {}
const minTime = new Promise((r) => setTimeout(r, reduced ? 0 : returning ? 300 : 900));
// the page never waits long for WebGL: give the 3D model ~1.8s, otherwise start and let it glide in
const stagePromise = initStage();
const attachStage = (s) => {
  if (!s || stage) return;
  stage = s;
  if (import.meta.env.DEV) window.__stage = s;
  stage.phonePainter = phonePainter;
  stage.laptopPainter = laptopPainter;
  stage.previewDirty = true;
  buildStageTracks();
};
Promise.all([
  Promise.race([stagePromise, new Promise((r) => setTimeout(() => r(null), reduced ? 0 : 1800))]),
  fontsReady.then(() => Promise.all(['900 40px "Archivo Variable"', 'italic 400 40px "Instrument Serif"', '400 40px "Instrument Serif"', '500 20px "JetBrains Mono Variable"', '700 40px "Bricolage Grotesque Variable"'].map((f) => document.fonts.load(f).catch(() => {})))),
  minTime,
]).then(([s]) => {
  attachStage(s);
  configurator.paint(0);
  setLoad(1);
  setupScroll();
  intro();
  if (!s) stagePromise.then((late) => { attachStage(late); if (late) gsap.to(late, { intro: 0, duration: 2, ease: 'expo.out' }); });
});

// the phone shows the real mobile build of whichever launch is in focus (its filmstrip scrolls); in the pit stop, your build
let phoneProject = 0;
const phoneShots = FEATURED.map((w) => { const im = new Image(); im.decoding = 'async'; im.src = shotUrl(w, '-m'); return im; });
const phoneStrips = [], benchStrips = [];
const warmStrips = (arr, phone) => { if (!arr.length) FEATURED.forEach((w, i) => loadStrip(w, phone).then((im) => (arr[i] = im)).catch(() => {})); };
const pingpong = (x) => { const f = x % 2; return f < 1 ? f : 2 - f; };
const easeIO = (x) => 0.5 - Math.cos(Math.PI * Math.min(1, Math.max(0, x))) / 2;
// draws a tall filmstrip into a screen, scrolled to `y` (0..1 of its travel)
function drawStrip(ctx, W, H, im, y) {
  const k = W / im.naturalWidth;
  const travel = Math.max(0, im.naturalHeight * k - H);
  ctx.drawImage(im, 0, (travel * y) / k, im.naturalWidth, H / k, 0, 0, W, H);
}
function phonePainter(ctx, W, H, t) {
  const strip = phoneStrips[phoneProject];
  if (themeIdx !== 4 && strip) { drawStrip(ctx, W, H, strip, easeIO(pingpong(t / 7))); return; }
  const im = phoneShots[phoneProject];
  if (themeIdx !== 4 && im.complete && im.naturalWidth) {
    const k = Math.max(W / im.naturalWidth, H / im.naturalHeight);
    ctx.drawImage(im, (W - im.naturalWidth * k) / 2, 0, im.naturalWidth * k, im.naturalHeight * k);
    return;
  }
  const base = themeIdx === 4 ? configurator.state : FEATURED[phoneProject].cfg;
  paintSite(ctx, W, H, { ...base, layout: 'centered' }, t, 1, { chrome: false });
}
if (!reduced) setInterval(() => { if (!inSpeedRun) phoneProject = (phoneProject + 1) % FEATURED.length; }, 3200);
let inSpeedRun = false;

// the laptop in the Build sector plays one launch after another, scrolling top to bottom
let benchIdx = 0, benchT0 = -1;
const BENCH_LAP = 9;
const benchName = $('.bench__name'), benchCount = $('.bench__count');
const setBench = (i) => {
  benchIdx = i;
  const w = FEATURED[i];
  benchName.textContent = w.title;
  benchName.dataset.sheet = String(WORK.indexOf(w));
  benchName.setAttribute('aria-label', `${w.title} is on the laptop. Open its telemetry sheet`);
  benchCount.textContent = `${pad2(i + 1)} / ${pad2(FEATURED.length)}`;
  if (!reduced) gsap.fromTo(benchName, { yPercent: 100, opacity: 0 }, { yPercent: 0, opacity: 1, duration: 0.6, ease: 'expo.out' });
};
function laptopPainter(ctx, W, H, t) {
  if (benchT0 < 0) benchT0 = t;
  if (t - benchT0 > BENCH_LAP) { benchT0 = t; setBench((benchIdx + 1) % FEATURED.length); }
  const local = t - benchT0;
  const strip = benchStrips[benchIdx];
  if (strip) drawStrip(ctx, W, H, strip, easeIO((local - 0.9) / (BENCH_LAP - 2)));
  else { ctx.fillStyle = '#0a0c10'; ctx.fillRect(0, 0, W, H); }
}

// ------------------------------------------------------------------ intro: lights out
let lapStart = 0;
function intro() {
  if (reduced) { document.body.classList.remove('is-loading'); $('.loader').remove(); return; }
  const heroWords = $$('#hero-title .wi');
  gsap.set(heroWords, { xPercent: -140, skewX: -24, opacity: 0 });
  gsap.set('.grid .reveal', { y: 40, opacity: 0 });
  gsap.set(['.nav', '.speedo'], { opacity: 0 });
  const tl = gsap.timeline({ delay: returning ? 0.05 : 0.3 });
  tl.add(() => lights.forEach((l) => l.classList.add('on')))
    .add(() => { lights.forEach((l) => l.classList.remove('on')); $('.loader__msg').textContent = 'Lights out'; }, returning ? '+=0.2' : '+=0.6')
    .to('.loader', { clipPath: 'inset(0 0 0 100%)', duration: 0.9, ease: 'expo.inOut' }, '+=0.12')
    .add(() => { document.body.classList.remove('is-loading'); lapStart = performance.now(); }, '<0.2')
    .add(() => stage && gsap.to(stage, { intro: 0, duration: 2.2, ease: 'expo.out' }), '<')
    .to(heroWords, { xPercent: 0, skewX: 0, opacity: 1, duration: 1.3, ease: 'expo.out', stagger: 0.08 }, '<0.15')
    .to('.grid .reveal', { y: 0, opacity: 1, duration: 1, ease: 'expo.out', stagger: 0.08 }, '<0.3')
    .to(['.nav', '.speedo'], { opacity: 1, duration: 0.8, clearProps: 'opacity' }, '<0.2')
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
    gsap.to('.grid__foot', { y: -60, opacity: 0, ease: 'none', scrollTrigger: { trigger: '#grid', start: '22% top', end: '62% top', scrub: true } });
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
        end: () => '+=' + (track.scrollWidth - innerWidth) * 1.45,
        scrub: 0.6, invalidateOnRefresh: true,
        onToggle: (s) => (inSpeedRun = s.isActive),
        onUpdate: (s) => {
          $('.s2__progress b').style.transform = `scaleX(${s.progress})`;
        },
      },
    });
    s2ST = runTween.scrollTrigger;
    gsap.fromTo(rail, { xPercent: 0 }, { xPercent: -55, ease: 'none', scrollTrigger: { trigger: '#sector2', start: 'top top', end: () => '+=' + (track.scrollWidth - innerWidth) * 1.45, scrub: 0.3, invalidateOnRefresh: true } });
    frames.forEach((f, i) => {
      gsap.from($('.frame__media', f), { yPercent: i % 2 ? 40 : -40, rotate: i % 2 ? 6 : -6, scale: 0.85, opacity: 0, ease: 'expo.out', duration: 1.2, scrollTrigger: { trigger: f, containerAnimation: runTween, start: 'left 92%', toggleActions: 'play none none reverse' } });
    });
  }

  ScrollTrigger.create({ trigger: '#sector2', start: 'top 300%', once: true, onEnter: () => warmStrips(phoneStrips, true) });
  ScrollTrigger.create({ trigger: '#sector3', start: 'top 250%', once: true, onEnter: () => warmStrips(benchStrips, false) });
  onboard.mount();
  // onboard: headline races in, phones rise
  if (!reduced) {
    gsap.from('#onboard-title .wi', { xPercent: -120, skewX: -20, opacity: 0, duration: 1.1, ease: 'expo.out', stagger: 0.07, scrollTrigger: { trigger: '#onboard-title', start: 'top 82%', toggleActions: 'play none none reverse' } });
    gsap.from('.ob', { y: 160, opacity: 0, duration: 1.2, ease: 'expo.out', stagger: 0.05, scrollTrigger: { trigger: '.onboard__lane', start: 'top 88%', toggleActions: 'play none none reverse' }, clearProps: 'opacity' });
    gsap.from('.bench', { y: 20, opacity: 0, duration: 0.9, ease: 'expo.out', scrollTrigger: { trigger: '.bench', start: 'top 92%', toggleActions: 'play none none reverse' } });
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
    gsap.from([steps[1], steps[0], steps[2]].map((s) => $('.step__card', s)), { y: 140, opacity: 0, duration: 1.2, ease: 'expo.out', stagger: 0.15, delay: 0.2, clearProps: 'transform,opacity', scrollTrigger: { trigger: '.podium__steps', start: 'top 75%', toggleActions: 'play none none reverse' } });
    gsap.from('.row', { xPercent: 30, opacity: 0, stagger: 0.06, duration: 1, ease: 'expo.out', scrollTrigger: { trigger: '.classification', start: 'top 85%', toggleActions: 'play none none reverse' } });
  }

  // FINISH: chequered flag sweeps, words slam in
  if (!reduced) {
    gsap.fromTo('.checker', { opacity: 0, yPercent: -12 }, { opacity: 0.1, yPercent: 0, ease: 'none', scrollTrigger: { trigger: '#finish', start: 'top bottom', end: 'center center', scrub: true } });
    gsap.from('#finish-title .wi', { yPercent: 120, skewY: 10, duration: 1.1, ease: 'expo.out', stagger: 0.07, scrollTrigger: { trigger: '#finish-title', start: 'top 80%', toggleActions: 'play none none reverse' } });
    gsap.from('.finish__lede, .contact', { y: 40, opacity: 0, duration: 1, ease: 'expo.out', stagger: 0.12, scrollTrigger: { trigger: '.finish__lede', start: 'top 92%', toggleActions: 'play none none reverse' } });
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

  // keyboard users tabbing into the speed run get carried to the focused build
  $('.s2__track').addEventListener('focusin', (e) => {
    if (!s2ST || !lenis) return;
    const f = e.target.closest('.frame');
    if (!f) return;
    $('#sector2').scrollLeft = 0;
    const track = $('.s2__track');
    const maxX = track.scrollWidth - innerWidth;
    const want = Math.min(maxX, Math.max(0, f.offsetLeft + f.offsetWidth / 2 - innerWidth / 2));
    lenis.scrollTo(s2ST.start + (want / maxX) * (s2ST.end - s2ST.start), { duration: 0.8 });
  });
  // sticky mobile CTA after the hero
  ScrollTrigger.create({ trigger: '#grid', start: 'bottom 40%', onToggle: (s) => html.classList.toggle('show-mcta', s.isActive), end: () => ScrollTrigger.maxScroll(window) + innerHeight });

  // page colour per section — created after the speed-run pin so their ranges include its spacing
  $$('section[data-sector]').forEach((sec) => {
    const i = +sec.dataset.sector;
    // enter/enterBack fire even when an instant jump lands exactly on a boundary
    ScrollTrigger.create({ trigger: sec, start: 'top 50%', end: 'bottom 50%', onEnter: () => setTheme(i), onEnterBack: () => setTheme(i) });
  });

  // ---------------------------------------------------------------- racing line + car
  buildRacingLine();
  ScrollTrigger.addEventListener('refresh', () => { buildBands(); buildRacingLine(); buildStageTracks(); buildStops(); });
  ScrollTrigger.refresh();
  buildBands();
  buildStageTracks();
  buildStops();

  // velocity-driven bits: skew the speed run, stretch the rails, speed the marquee
  let lastV = 0, lastW = 0;
  const footMq = $('.footer__marquee');
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
    const wr = Math.round(w);
    if (wr !== lastW) { lastW = wr; rail.style.fontVariationSettings = `'wdth' ${wr}`; footMq.style.fontVariationSettings = `'wdth' ${wr}`; }
    if (inSpeedRun) $('.speedlines').style.backgroundPosition = `${-(lenis?.animatedScroll || 0) * 1.6}px 0, ${-(lenis?.animatedScroll || 0) * 0.7}px 0`;
  });
}

// ------------------------------------------------------------------ speed bumps (wheel pacing)
// One burst of wheel input can't carry you past the next stop (a sector start or a speed-run frame).
// Keep pushing into a bump and it lets go after a beat. Nothing ever pulls the page backwards.
const bump = { stops: [], frames: [], anchor: 0, last: 0, held: 0, blockedAt: -1e9, settleAt: Infinity, dir: 1, spacing: 800 };
const BUMP_HOLD = 700; // ms of continued input before a bump releases
function wheelGate(d) {
  const e = d.event;
  if (e.type !== 'wheel' || !lenis) return true;
  const now = e.timeStamp || performance.now();
  const t = lenis.targetScroll;
  // a new gesture starts where the last one aimed — but only after a real pause if we were just holding at a bump
  // (a janky frame between wheel events must not count as letting go)
  if (now - bump.last > 260 && now - bump.blockedAt > 350) { bump.anchor = t; bump.held = 0; }
  bump.last = now;
  const cap = inSpeedRun ? 110 : 180; // free-spinning wheels send huge deltas
  let dy = Math.max(-cap, Math.min(cap, d.deltaY));
  if (!dy) return true;
  bump.dir = Math.sign(dy);
  bump.settleAt = now + 280;
  const s = bump.stops;
  const next = dy > 0 ? s.find((v) => v > bump.anchor + 2) : s.findLast((v) => v < bump.anchor - 2);
  if (next !== undefined && (dy > 0 ? t + dy > next : t + dy < next)) {
    if (Math.abs(t - next) < 1) {
      if (!bump.held) bump.held = now;
      if (now - bump.held < BUMP_HOLD) { bump.blockedAt = now; if (e.cancelable) e.preventDefault(); return false; }
      bump.anchor = next; // pushed through: aim for the stop after this one
      bump.held = 0;
    } else dy = next - t;
  }
  d.deltaY = dy;
  return true;
}
function buildStops() {
  if (!lenis) return;
  const docTop = (el) => el.getBoundingClientRect().top + scrollY;
  const pts = ['#sector1', '#sector3', '#onboard', '#pitstop', '#podium', '#finish'].map((sel) => docTop($(sel)));
  bump.frames = [];
  if (s2ST) {
    const track = $('.s2__track');
    const maxX = Math.max(1, track.scrollWidth - innerWidth);
    bump.frames.push(s2ST.start);
    $$('.frame').forEach((f) => {
      const want = Math.min(maxX, Math.max(0, f.offsetLeft + f.offsetWidth / 2 - innerWidth / 2));
      bump.frames.push(s2ST.start + (want / maxX) * (s2ST.end - s2ST.start));
    });
    bump.spacing = (s2ST.end - s2ST.start) / Math.max(1, $$('.frame').length);
  }
  bump.stops = [...new Set([...pts, ...bump.frames].map((v) => Math.round(v)))].filter((v) => v > 10).sort((a, b) => a - b);
  bump.frames = bump.frames.map((v) => Math.round(v));
}
// once a wheel scroll comes to rest: if it stopped just short of a stop, carry it on; in the speed run,
// ease onto the frame ahead (or nudge back a little)
gsap.ticker.add(() => {
  if (!lenis || lenis.isStopped || performance.now() < bump.settleAt || Math.abs(lenis.velocity) > 0.3) return;
  bump.settleAt = Infinity;
  const y = lenis.targetScroll;
  if (!inSpeedRun) {
    const ahead = bump.dir > 0 ? bump.stops.find((v) => v > y + 1) : bump.stops.findLast((v) => v < y - 1);
    if (ahead !== undefined && Math.abs(ahead - y) < innerHeight * 0.15) lenis.scrollTo(ahead, { duration: 0.6, easing: (x) => 1 - Math.pow(1 - x, 3) });
    return;
  }
  if (coarse) return;
  // only ever forward in the direction you scrolled: one notch pages on to the next build, never back
  if (bump.frames.some((v) => Math.abs(v - y) < 2)) return;
  const ahead = bump.dir > 0 ? bump.frames.find((v) => v > y + 1) : bump.frames.findLast((v) => v < y - 1);
  if (ahead === undefined || Math.abs(ahead - y) > bump.spacing * 1.05) return;
  lenis.scrollTo(ahead, { duration: 0.7, easing: (x) => 1 - Math.pow(1 - x, 3) });
});

// section colour bands: one slab of colour per section, each overlapping the one above with a
// slanted leading edge — colour changes travel with the content instead of flipping mid-screen
function buildBands() {
  const wrap = $('.bands');
  const H = document.documentElement.scrollHeight;
  wrap.style.height = `${H}px`;
  const slant = Math.min(innerHeight * 0.09, 96);
  const parts = $$('section[data-sector]').map((sec) => {
    const box = sec.parentElement.classList.contains('pin-spacer') ? sec.parentElement : sec;
    const top = box.getBoundingClientRect().top + scrollY;
    return { i: +sec.dataset.sector, top, bottom: top + box.offsetHeight };
  });
  // plain rectangles + a small slanted wedge at each boundary (cheap to composite, no giant clip masks)
  wrap.innerHTML = parts.map((p, k) => {
    const t = k === 0 ? 0 : p.top;
    const h = (k === parts.length - 1 ? H : parts[k + 1].top + 1) - t;
    const bg = THEMES[p.i].bg;
    const wedge = k === 0 ? '' : `<div class="band band--wedge" style="top:${p.top - slant + 1}px;height:${slant}px;background:${bg}"></div>`;
    return `<div class="band" style="top:${t}px;height:${h}px;background:${bg}"></div>${wedge}`;
  }).join('');
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
  const m = W < 900 ? 7 : Math.max(18, W * 0.025); // phones: hug the edge so the line never brushes text
  const lane = (side) => (side ? W - m : m);
  const pts = [[lane(false), vh * 1.02]];
  const run = (el, side, padTop = 0.07, padBot = 0.05) => {
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
  pts.push([lane(false) * 0.4, s2a], [-80, s2a + vh * 0.2], [-80, s2b - vh * 0.2], [lane(false) * 0.4, s2b]); // through the speed run: off-screen, speedlines take over
  run($('#sector3'), false);
  run($('#onboard'), false, 0.05, 0.05);
  run($('#pitstop'), true);
  run($('#podium'), false);
  run($('#finish'), true, 0.12, 0.3);
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

  // the phone's screen faces the camera at every resting keyframe (ry ≈ n·2π); full spins happen in between
  const fin = $('#finish'), footH = $('.footer').offsetHeight;
  const notesTop = docTop($('.notes'));
  stage.setTrack('phone', mob ? [
    // phones: the device lives in the empty band above the headline, then bows out before body copy
    { y: 0, s: S({ x: 0.04, y: 0.27, size: 0.3, rx: 0.1, ry: -0.4, rz: 0.08 }) },
    { y: docTop(grid) + grid.offsetHeight * 0.45, s: S({ x: 0.3, y: 0.55, size: 0.24, ry: -1.2, o: 0 }) },
    { y: s2a - vh * 0.3, s: S({ x: -0.7, y: -0.36, size: 0.2, rx: 0.2, ry: TAU * 2 - 0.3, rz: -0.2, o: 0 }) },
    { y: s2a, s: S({ x: -0.3, y: -0.3, size: 0.2, rx: 0.15, ry: TAU * 2 - 0.2, rz: -0.12, o: 0 }) },
    { y: s2b, s: S({ x: -0.3, y: -0.3, size: 0.2, rx: 0.15, ry: TAU * 2 - 0.2, rz: -0.08, o: 0 }) },
    { y: docTop(s3), s: S({ x: 0.6, y: 0.7, size: 0.2, o: 0 }) },
  ] : [
    { y: 0, s: S({ x: 0.27, y: 0.0, size: 0.56, rx: 0.08, ry: -0.5, rz: 0.1 }) },
    { y: docTop(grid) + grid.offsetHeight - vh * 0.5, s: S({ x: 0.34, y: 0.08, size: 0.52, rx: 0.2, ry: -1.1, rz: 0.04 }) },
    // beside the statement, then up and out before the note cards arrive; it sits the speed run out
    { y: notesTop - vh * 0.95, s: S({ x: 0.34, y: 0.02, size: 0.5, rx: 0.1, ry: TAU - 0.55, rz: -0.1 }) },
    { y: notesTop - vh * 0.5, s: S({ x: 0.68, y: 0.1, size: 0.42, rx: 0.2, ry: TAU * 1.3, rz: -0.2, o: 0 }) },
    { y: s2a, s: S({ x: -0.37, y: -0.22, size: 0.24, rx: 0.12, ry: TAU * 2 - 0.22, rz: -0.12, o: 0 }) },
    { y: s2b, s: S({ x: -0.35, y: -0.2, size: 0.24, rx: 0.12, ry: TAU * 2 - 0.22, rz: -0.06, o: 0 }) },
    { y: docTop(s3), s: S({ x: 0.55, y: 0.7, size: 0.3, ry: TAU * 3.2, o: 0 }) },
    { y: pitY - vh * 0.5, s: S({ x: 0.55, y: -0.6, size: 0.3, ry: TAU * 3.6, o: 0 }) },
    { y: pitY, s: S({ x: 0.43, y: -0.14, size: 0.36, rx: 0.06, ry: TAU * 4 - 0.28, rz: 0.03 }) },
    { y: pitY + pit.offsetHeight - vh, s: S({ x: 0.43, y: -0.14, size: 0.36, rx: 0.06, ry: TAU * 4 - 0.28, rz: 0.03 }) },
    { y: docTop(pod), s: S({ x: 0.62, y: -0.8, size: 0.3, o: 0 }) },
    { y: docTop(fin) - vh * 0.3, s: S({ x: 0.55, y: -0.7, size: 0.36, ry: TAU * 4.5, o: 0 }) },
    { y: docTop(fin) + vh * 0.35, s: S({ x: 0.31, y: -0.04, size: 0.4, rx: 0.12, ry: TAU * 5 - 0.6, rz: 0.12 }) },
    { y: max - footH - vh * 0.2, s: S({ x: 0.31, y: -0.04, size: 0.4, rx: 0.12, ry: TAU * 5 - 0.6, rz: 0.12 }) },
    { y: max - footH * 0.4, s: S({ x: 0.45, y: 0.75, size: 0.3, ry: TAU * 5.4, o: 0 }) },
  ]);

  stage.setTrack('laptop', [
    { y: 0, s: S({ x: devX, y: -1.2, size: 0.3, rx: 0.6, lid: 0, o: 0 }) },
    { y: docTop(s3) - vh * 0.6, s: S({ x: devX, y: -1.0, size: mob ? 0.7 : 0.38, rx: 0.7, ry: -0.6, lid: 0, o: 0 }) },
    // desktop: rises from below; phones: fades in already in its slot above the copy
    mob
      ? { y: devY - vh * 0.25, s: S({ x: devX, y: 0.12, size: (dev.width / W) * 0.82, rx: 0.32, ry: -0.42, lid: 0.2, o: 0 }) }
      : { y: docTop(s3) - vh * 0.1, s: S({ x: devX, y: -0.75, size: 0.38, rx: 0.7, ry: -0.6, lid: 0 }) },
    { y: devY, s: S({ x: devX, y: mob ? 0.12 : 0, size: (dev.width / W) * (mob ? 0.82 : 0.84), rx: 0.32, ry: -0.42, lid: 1 }) },
    // phones: scroll up with its slot, then bow out; desktop: brief hold, gone before telemetry
    mob
      ? { y: devY + vh * 0.5, s: S({ x: devX, y: 0.62, size: (dev.width / W) * 0.82, rx: 0.32, ry: -0.42, lid: 1 }) }
      : { y: devY + vh * 0.5, s: S({ x: devX, y: 0.05, size: (dev.width / W) * 0.84, rx: 0.3, ry: -0.2, lid: 1 }) },
    mob
      ? { y: devY + vh * 0.8, s: S({ x: devX, y: 0.92, size: (dev.width / W) * 0.82, rx: 0.32, ry: -0.42, lid: 1, o: 0 }) }
      : { y: devY + vh * 0.9, s: S({ x: 0.7, y: -0.9, size: 0.3, rx: 0.5, lid: 0.2, o: 0 }) },
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
    const l = t?.closest('[data-cursor]')?.dataset.cursor || '';
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
  const hpImg = $('img', hp);
  const hx = gsap.quickTo(hp, 'x', { duration: 0.5, ease: 'power3' });
  const hy = gsap.quickTo(hp, 'y', { duration: 0.5, ease: 'power3' });
  $$('.row').forEach((row) => {
    row.addEventListener('pointerenter', () => { hpImg.src = shotUrl(WORK[+row.dataset.i]); gsap.to(hp, { opacity: 1, scale: 1, rotate: -4, duration: 0.5, ease: 'expo.out' }); });
    row.addEventListener('pointerleave', () => { gsap.to(hp, { opacity: 0, scale: 0.6, rotate: 0, duration: 0.4, ease: 'power3.in' }); });
  });
  addEventListener('pointermove', (e) => { hx(Math.min(e.clientX + 48, innerWidth - 340)); hy(Math.max(96, e.clientY - 200)); });
  // a jump (menu, brief, sector pill) can carry the page away from the list without a pointerleave
  addEventListener('scroll', () => {
    if (+getComputedStyle(hp).opacity > 0 && !document.querySelector('.row:hover')) gsap.to(hp, { opacity: 0, scale: 0.6, rotate: 0, duration: 0.3, overwrite: 'auto' });
  }, { passive: true });
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
    stage.laptopMode = themeIdx === 3 ? 'show' : 'preview';
    stage.pointer.set(pointer.nx, pointer.ny);
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
    // read every rect first, then write (no layout thrash); tilt lives on a wrapper so entrances survive
    const tilts = $$('.frame__tilt');
    const ds = tilts.map((m) => { const r = m.getBoundingClientRect(); return (r.left + r.width / 2 - innerWidth / 2) / innerWidth; });
    let near = 0;
    ds.forEach((d, i) => { if (Math.abs(d) < Math.abs(ds[near])) near = i; });
    if (s2ST && s2ST.progress > 0.97) near = ds.length - 1; // the last build can't be centred; at the end it is the one in view
    phoneProject = near;
    tilts.forEach((m, i) => {
      const d = ds[i];
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
