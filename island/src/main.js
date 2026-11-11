import '@fontsource-variable/bricolage-grotesque';
import '@fontsource/instrument-serif/400.css';
import '@fontsource/instrument-serif/400-italic.css';
import '@fontsource-variable/jetbrains-mono';
import 'iconify-icon';
import './style.css';

import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import Lenis from 'lenis';
import { SITE } from './config.js';
import { WORK } from '../../src/config.js'; // one list of real launches for both designs
import { Configurator } from './configurator.js';

gsap.registerPlugin(ScrollTrigger);

const $ = (s, el = document) => el.querySelector(s);
const $$ = (s, el = document) => [...el.querySelectorAll(s)];
const html = document.documentElement;
// Motion preference: the OS setting is the default; visitors can override it
// with the "Motion" toggle in the nav (stored per browser).
const osReduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
let motionPref = null;
try { motionPref = localStorage.getItem('motion'); } catch {}
const reduced = motionPref === 'off' || (motionPref !== 'on' && osReduced);
const coarse = matchMedia('(pointer: coarse)').matches;
const isMobile = () => innerWidth < 900;
const hasWebGL = (() => {
  try {
    const c = document.createElement('canvas');
    return !!(c.getContext('webgl2') || c.getContext('webgl'));
  } catch { return false; }
})();

if (reduced) html.classList.add('reduced');
if (coarse) html.classList.add('touch');

// ------------------------------------------------------------------ motion toggle
const motionBtn = $('.nav__motion');
const setMotionLabel = () => {
  motionBtn.setAttribute('aria-pressed', String(!reduced));
  $('.nav__motion-state', motionBtn).textContent = reduced ? 'Off' : 'On';
};
setMotionLabel();
const toggleMotion = (on) => {
  try { localStorage.setItem('motion', on ? 'on' : 'off'); } catch {}
  location.reload();
};
motionBtn.addEventListener('click', () => toggleMotion(reduced));
if (reduced && osReduced && motionPref !== 'off') {
  const note = $('.motion-note');
  note.hidden = false;
  $('[data-motion-on]', note).addEventListener('click', () => toggleMotion(true));
  $('[data-motion-dismiss]', note).addEventListener('click', () => { note.hidden = true; try { localStorage.setItem('motion', 'off'); } catch {} });
}

// ------------------------------------------------------------------ basics
$('.year').textContent = new Date().getFullYear();
const mailCta = $('#mail-cta');
mailCta.href = `mailto:${SITE.email}?subject=${encodeURIComponent('New project')}`;
const clock = $('.clock');
const tickClock = () => (clock.textContent = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }));
tickClock();
setInterval(tickClock, 15000);

// ------------------------------------------------------------------ split text (accessible)
function splitWords(el) {
  if (el.dataset.splitDone) return;
  el.dataset.splitDone = '1';
  el.setAttribute('aria-label', el.textContent.replace(/\s+/g, ' ').trim());
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
      } else if (n.nodeType === 1 && n.tagName !== 'BR') {
        n.setAttribute('aria-hidden', 'true');
        walk(n);
      }
    });
  };
  walk(el);
  // keep trailing punctuation glued to the word before it (never wraps alone)
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
$$('.split').forEach(splitWords);

function fillWords(el) {
  const words = el.innerHTML.split(/(<[^>]+>|\s+)/).filter(Boolean);
  el.innerHTML = words.map((w) => (w.startsWith('<') || /^\s+$/.test(w) ? w : `<span class="fw">${w}</span>`)).join('');
}
$$('.fill-text').forEach(fillWords);

// ------------------------------------------------------------------ project reel
const reel = $('.work__reel');
// screenshots live in the site-root public/ folder: '/' on the dev server, '../' from the built /island/ page
const shotUrl = (w) => `${import.meta.env.DEV ? '/' : '../'}images/work/${w.shot}.webp`;
// Track Day palettes → the island's own palettes, so "start from this style" lands on a real option
const PALETTE_MAP = { stone: 'glacier', night: 'dusk', rose: 'candy', noir: 'noir', glacier: 'glacier', moss: 'moss' };
const FEATURED = WORK.filter((w) => w.featured);
const MORE = WORK.filter((w) => !w.featured);
reel.innerHTML = FEATURED.map((p, i) => `
  <li class="card">
    <a class="card__media" href="${p.url}" target="_blank" rel="noopener" data-cursor="Visit" aria-label="Visit ${p.title} — opens the live site in a new tab"><img src="${shotUrl(p)}" width="960" height="600" alt="" loading="lazy" decoding="async" /><span class="card__badge mono">${p.concept ? 'Concept' : 'Live'} · ${p.year}</span></a>
    <div class="card__meta">
      <span class="card__num mono">${String(i + 1).padStart(2, '0')}</span>
      <div><h3>${p.title}</h3><p>${p.summary}</p></div>
    </div>
    <div class="card__foot"><span class="mono">${p.kind}</span><button class="card__remix mono" data-remix="${i}" type="button">Start from this style <span aria-hidden="true">→</span></button></div>
  </li>`).join('') + `
  <li class="card card--more">
    <div class="card__more">
      <p class="mono card__more-eyebrow">+${MORE.length} more launches, all live</p>
      <ul>${MORE.map((p) => `<li><a href="${p.url}" target="_blank" rel="noopener"><span>${p.title}</span><span class="mono">${p.kind}</span></a></li>`).join('')}</ul>
    </div>
  </li>`;

// zone cards get a "configure one" shortcut
$$('.zone').forEach((z) => {
  const type = { store: 'store', gallery: 'portfolio', tower: 'app', monitor: 'website' }[z.dataset.zone];
  const label = { store: 'Configure a store', gallery: 'Configure a portfolio', tower: 'Configure an app', monitor: 'Configure a website' }[z.dataset.zone];
  const b = document.createElement('button');
  b.type = 'button';
  b.className = 'zone__cta mono';
  b.dataset.remixType = type;
  b.innerHTML = `${label} <span aria-hidden="true">→</span>`;
  $('.zone__card', z).append(b);
});

// ------------------------------------------------------------------ configurator
let world = null;
const configurator = new Configurator({
  form: $('#cfg'),
  canvas: $('#preview-canvas'),
  summaryEl: $('.build__summary'),
  statusEl: $('.cfg__status'),
  onChange: () => world && (world.previewDirty = true),
});

// ------------------------------------------------------------------ smooth scroll
let lenis = null;
if (!reduced) {
  lenis = new Lenis({ lerp: 0.085, wheelMultiplier: 0.9, touchMultiplier: 1.4 });
  lenis.on('scroll', ScrollTrigger.update);
  gsap.ticker.add((t) => lenis.raf(t * 1000));
  gsap.ticker.lagSmoothing(0);
  lenis.stop();
  if (import.meta.env.DEV) window.__lenis = lenis;
}
const scrollToEl = (target, opts = {}) => {
  const el = typeof target === 'string' ? $(target) : target;
  if (!el) return;
  if (lenis) lenis.scrollTo(el, { duration: 2.2, easing: (t) => 1 - Math.pow(1 - t, 4), ...opts });
  else el.scrollIntoView({ behavior: reduced ? 'auto' : 'smooth' });
};
document.addEventListener('click', (e) => {
  const a = e.target.closest('[data-scroll]');
  if (a) {
    e.preventDefault();
    closeMenu();
    scrollToEl(a.getAttribute('href'));
    return;
  }
  const remix = e.target.closest('[data-remix]');
  if (remix) {
    const p = FEATURED[+remix.dataset.remix];
    configurator.load({ ...p.cfg, palette: PALETTE_MAP[p.cfg.palette] || 'glacier' });
    configurator.status(`Loaded the ${p.title} setup — now make it yours.`);
    scrollToEl('#build');
    return;
  }
  const rt = e.target.closest('[data-remix-type]');
  if (rt) {
    configurator.set({ type: rt.dataset.remixType });
    $(`#cfg input[name="type"][value="${rt.dataset.remixType}"]`).checked = true;
    scrollToEl('#build');
  }
});

// ------------------------------------------------------------------ mobile menu
const burger = $('.nav__burger');
const menu = $('#mobile-menu');
function closeMenu() {
  if (menu.hidden) return;
  burger.setAttribute('aria-expanded', 'false');
  burger.setAttribute('aria-label', 'Open menu');
  html.classList.remove('menu-open');
  gsap.to(menu, { clipPath: 'inset(0 0 100% 0)', duration: reduced ? 0 : 0.5, ease: 'expo.inOut', onComplete: () => (menu.hidden = true) });
  lenis?.start();
}
burger.addEventListener('click', () => {
  if (!menu.hidden) return closeMenu();
  menu.hidden = false;
  burger.setAttribute('aria-expanded', 'true');
  burger.setAttribute('aria-label', 'Close menu');
  html.classList.add('menu-open');
  lenis?.stop();
  gsap.fromTo(menu, { clipPath: 'inset(0 0 100% 0)' }, { clipPath: 'inset(0 0 0% 0)', duration: reduced ? 0 : 0.6, ease: 'expo.inOut' });
  gsap.from($$('a', menu), { yPercent: 120, opacity: 0, stagger: 0.05, duration: reduced ? 0 : 0.7, ease: 'expo.out', delay: 0.15 });
  $('a', menu).focus();
});
document.addEventListener('keydown', (e) => e.key === 'Escape' && closeMenu());

// ------------------------------------------------------------------ chapters + HUD
const CHAPTERS = ['Sky', 'Arrival', 'The Store', 'The Gallery', 'The Tower', 'The Monitor', 'Builds', 'Process', 'Build yours', 'Launch'];
const hudDots = $('.hud__dots');
hudDots.innerHTML = CHAPTERS.map((c) => `<li><span>${c}</span></li>`).join('');
const chapterNum = $('.nav__chapter-num');
const chapterName = $('.nav__chapter-name');
let currentChapter = -1;
let chapterTl = null;
const KEY_CHAPTER = { hero: 'Sky', arrive: 'Arrival', store: 'The Store', gallery: 'The Gallery', tower: 'The Tower', monitor: 'The Monitor', work: 'Builds', work2: 'Builds', process: 'Process', build: 'Build yours', launch: 'Launch' };
function setChapter(name, fromWorld = false) {
  // with a live world the camera's position is the single source of truth
  if (world && !fromWorld) return;
  const i = CHAPTERS.indexOf(name);
  if (i === currentChapter || i < 0) return;
  currentChapter = i;
  $$('li', hudDots).forEach((li, j) => li.classList.toggle('is-active', j === i));
  chapterTl?.progress(1).kill();
  const tl = (chapterTl = gsap.timeline());
  tl.to([chapterNum, chapterName], { yPercent: -110, opacity: 0, duration: 0.25, ease: 'power2.in' })
    .add(() => { chapterNum.textContent = String(i).padStart(2, '0'); chapterName.textContent = name; })
    .fromTo([chapterNum, chapterName], { yPercent: 110, opacity: 0 }, { yPercent: 0, opacity: 1, duration: 0.45, ease: 'expo.out', stagger: 0.04, immediateRender: false });
}
setChapter('Sky');

// ------------------------------------------------------------------ WORLD
const loaderNum = $('.loader__num');
const loaderBar = $('.loader__bar i');
const loadState = { p: 0, shown: 0 };
const setLoad = (p) => {
  loadState.p = Math.max(loadState.p, p);
  gsap.to(loadState, {
    shown: loadState.p, duration: 0.6, ease: 'power2.out', overwrite: true,
    onUpdate: () => { loaderNum.textContent = Math.round(loadState.shown * 100); loaderBar.style.transform = `scaleX(${loadState.shown})`; },
  });
};

async function initWorld() {
  if (reduced || !hasWebGL) { html.classList.add('no-world'); return null; }
  try {
    const { World } = await import('./world.js');
    setLoad(0.15);
    const w = new World($('#world-canvas'), { previewCanvas: $('#preview-canvas'), mobile: isMobile(), onProgress: (p) => setLoad(0.15 + p * 0.75) });
    await w.load(new URL('../assets/island.glb', import.meta.url).href);
    $('#world-canvas').addEventListener('webglcontextlost', (e) => { e.preventDefault(); html.classList.add('no-world'); });
    html.classList.add('has-world');
    return w;
  } catch (err) {
    console.warn('World unavailable, using poster', err);
    html.classList.add('no-world');
    return null;
  }
}

// ------------------------------------------------------------------ boot
const fontsReady = document.fonts ? Promise.race([document.fonts.ready, new Promise((r) => setTimeout(r, 2500))]) : Promise.resolve();
const minTime = new Promise((r) => setTimeout(r, reduced ? 0 : 1300));

Promise.all([initWorld(), fontsReady.then(() => Promise.all(['700 20px "Bricolage Grotesque Variable"', '400 20px "Instrument Serif"', '700 20px "JetBrains Mono Variable"'].map((f) => document.fonts.load(f).catch(() => {})))), minTime]).then(([w]) => {
  world = w;
  if (import.meta.env.DEV) window.__world = w;
  configurator.paint(0);
  world?.paintGallery();
  setLoad(1);
  setupScroll();
  intro();
});

function intro() {
  const heroWords = $$('.hero__title .wi');
  if (reduced) {
    document.body.classList.remove('is-loading');
    $('.loader').remove();
    return;
  }
  const tl = gsap.timeline({ delay: 0.5 });
  gsap.set(heroWords, { yPercent: 115, rotate: 6 });
  gsap.set('.hero .reveal-up', { y: 40, opacity: 0 });
  gsap.set(['.nav', '.hud'], { opacity: 0 });
  tl.to('.loader__count, .loader__top, .loader__bar', { yPercent: -60, opacity: 0, duration: 0.7, ease: 'power3.in' })
    .to('.loader__curtain--a', { yPercent: -100, duration: 1.3, ease: 'expo.inOut' }, '-=0.15')
    .to('.loader__curtain--b', { yPercent: 100, duration: 1.3, ease: 'expo.inOut' }, '<')
    .add(() => { document.body.classList.remove('is-loading'); }, '<0.3')
    .add(() => world && gsap.to(world, { intro: 0, duration: 3.2, ease: 'expo.out' }), '<')
    .to(heroWords, { yPercent: 0, rotate: 0, duration: 1.4, ease: 'expo.out', stagger: 0.06 }, '<0.45')
    .to('.hero .reveal-up', { y: 0, opacity: 1, duration: 1.1, ease: 'expo.out', stagger: 0.1 }, '<0.35')
    .to(['.nav', '.hud'], { opacity: 1, duration: 1, ease: 'power2.out' }, '<0.2')
    .add(() => { $('.loader').remove(); lenis?.start(); });
}

// ------------------------------------------------------------------ scroll choreography
function setupScroll() {
  const mm = gsap.matchMedia();

  // hero exits upward as you descend
  if (!reduced) {
    gsap.to('.hero__title', { yPercent: -35, opacity: 0, ease: 'none', scrollTrigger: { trigger: '.hero', start: 'top top', end: 'bottom top', scrub: true } });
    gsap.to('.hero__foot, .hero__scroll', { y: -80, opacity: 0, ease: 'none', scrollTrigger: { trigger: '.hero', start: '20% top', end: '70% top', scrub: true } });
  }

  // generic heading reveals (outside horizontal tracks)
  $$('.split').forEach((el) => {
    if (el.closest('.hero') || el.closest('.zone') || reduced) return;
    gsap.from($$('.wi', el), {
      yPercent: 115, rotate: 5, duration: 1.2, ease: 'expo.out', stagger: 0.05,
      scrollTrigger: { trigger: el, start: 'top 85%', toggleActions: 'play none none reverse' },
    });
  });
  if (!reduced) {
    $$('.eyebrow').forEach((el) => {
      if (el.closest('.hero')) return;
      gsap.from(el, { x: -30, opacity: 0, duration: 1, ease: 'expo.out', scrollTrigger: { trigger: el, start: 'top 88%', toggleActions: 'play none none reverse' } });
    });
  }

  // manifesto: words light up as you read
  const arriveST = ScrollTrigger.create({ trigger: '#arrive', start: 'top bottom', end: 'bottom top' });
  if (!reduced) {
    gsap.fromTo('.arrive .fw', { opacity: 0.14 }, { opacity: 1, stagger: 0.08, ease: 'none', scrollTrigger: { trigger: '.arrive__text', start: 'top 80%', end: 'bottom 45%', scrub: true } });
    gsap.from('.arrive__legend li', { y: 30, opacity: 0, stagger: 0.08, duration: 1, ease: 'expo.out', scrollTrigger: { trigger: '.arrive__legend', start: 'top 90%', toggleActions: 'play none none reverse' } });
  }
  ScrollTrigger.create({ trigger: '#hero', start: 'top top', end: 'bottom 40%', onToggle: (s) => s.isActive && setChapter('Sky') });
  ScrollTrigger.create({ trigger: '#arrive', start: 'top 60%', end: 'bottom 40%', onToggle: (s) => s.isActive && setChapter('Arrival') });

  // ---- ZONES: pinned horizontal journey; camera flies zone to zone in sync
  const zones = $$('.zone');
  const zoneNames = zones.map((z) => z.dataset.chapter);
  const track = $('.zones__track');
  const zIdx = $('.zones__idx');
  const zBar = $('.zones__progress b');
  let zonesST = null;
  let zonesTween = null;
  if (!reduced) {
    zonesTween = gsap.to(track, {
      x: () => -(track.scrollWidth - innerWidth),
      ease: 'none',
      scrollTrigger: {
        trigger: '#zones',
        pin: true,
        start: 'top top',
        end: () => '+=' + (track.scrollWidth - innerWidth) * 1.35,
        scrub: 0.8,
        invalidateOnRefresh: true,
        onUpdate: (s) => {
          const i = Math.round(s.progress * (zones.length - 1));
          setChapter(zoneNames[i]);
          zIdx.textContent = String(i + 1).padStart(2, '0');
          zBar.style.transform = `scaleX(${s.progress})`;
        },
        onToggle: (s) => s.isActive && setChapter(zoneNames[Math.round(s.progress * (zones.length - 1))]),
      },
    });
    zonesST = zonesTween.scrollTrigger;
    zones.forEach((z, i) => {
      const card = $('.zone__card', z);
      const parts = [$('.zone__num', card), ...$$('.wi', card), $('p:not(.zone__num)', card), ...$$('.chips li', card), $('.zone__cta', card)];
      const tl = gsap.timeline({ paused: true });
      tl.from(card, { clipPath: 'inset(0 100% 0 0 round 28px)', duration: 1.1, ease: 'expo.inOut' })
        .from(parts, { y: 40, opacity: 0, duration: 0.9, ease: 'expo.out', stagger: 0.035 }, '-=0.6');
      if (i === 0) {
        ScrollTrigger.create({ trigger: '#zones', start: 'top 70%', onEnter: () => tl.play(), onLeaveBack: () => tl.reverse() });
      } else {
        ScrollTrigger.create({ trigger: z, containerAnimation: zonesTween, start: 'left 65%', onEnter: () => tl.play(), onLeaveBack: () => tl.reverse() });
      }
      // depth: cards drift slower than the track
      if (i > 0) gsap.fromTo(card, { xPercent: 30 }, { xPercent: 0, ease: 'none', scrollTrigger: { trigger: z, containerAnimation: zonesTween, start: 'left right', end: 'left left', scrub: true } });
    });
  } else {
    zones.forEach((z) => new IntersectionObserver(([e]) => e.isIntersecting && setChapter(z.dataset.chapter), { threshold: 0.5 }).observe(z));
  }

  // ---- WORK: pinned horizontal reel with velocity skew + marquee
  const reelEl = $('.work__reel');
  let workST = null;
  if (!reduced) {
    const workTween = gsap.to(reelEl, {
      x: () => -(reelEl.scrollWidth - innerWidth + parseFloat(getComputedStyle(reelEl).paddingLeft)),
      ease: 'none',
      scrollTrigger: {
        trigger: '.work',
        pin: true,
        start: 'top top',
        end: () => '+=' + (reelEl.scrollWidth - innerWidth) * 1.1,
        scrub: 0.8,
        invalidateOnRefresh: true,
        onToggle: (s) => s.isActive && setChapter('Builds'),
      },
    });
    workST = workTween.scrollTrigger;
    const skew = gsap.quickTo('.card', 'skewX', { duration: 0.5, ease: 'power3' });
    const marquee = gsap.to('.marquee__inner', { xPercent: -50, repeat: -1, duration: 22, ease: 'none' });
    let lastV = 0;
    lenis?.on('scroll', ({ velocity }) => {
      if (world) world.velocity = velocity;
      const v = gsap.utils.clamp(-12, 12, velocity);
      if (workST?.isActive) skew(-v * 0.45);
      marquee.timeScale(1 + Math.abs(v) * 0.25 * (v >= 0 ? 1 : -1));
      lastV = v;
    });
    gsap.ticker.add(() => { if (Math.abs(lastV) < 0.05) { skew(0); marquee.timeScale(gsap.utils.interpolate(marquee.timeScale(), 1, 0.05)); } lastV *= 0.9; });
    // cards rise in as the section arrives; the horizontal track then carries the rest in
    gsap.from($$('.card', reelEl), { y: 140, rotate: 4, opacity: 0, duration: 1.3, ease: 'expo.out', stagger: 0.09, scrollTrigger: { trigger: '.work', start: 'top 65%', toggleActions: 'play none none reverse' } });
    $$('.card', reelEl).forEach((card) => {
      gsap.fromTo($('canvas', card), { scale: 1.18 }, { scale: 1, ease: 'none', scrollTrigger: { trigger: card, containerAnimation: workTween, start: 'left right', end: 'right left', scrub: true } });
    });
  } else {
    ScrollTrigger.create({ trigger: '#work', start: 'top 60%', end: 'bottom 40%', onToggle: (s) => s.isActive && setChapter('Builds') });
  }
  // keyboard on reel
  reelEl.addEventListener('keydown', (e) => {
    if (!['ArrowRight', 'ArrowLeft'].includes(e.key)) return;
    e.preventDefault();
    const card = reelEl.querySelector('.card').offsetWidth;
    const dir = e.key === 'ArrowRight' ? 1 : -1;
    if (lenis && workST) lenis.scrollTo(lenis.scroll + dir * card * 1.1 * ((workST.end - workST.start) / (reelEl.scrollWidth - innerWidth)), { duration: 0.9 });
    else reelEl.scrollBy({ left: dir * card, behavior: 'smooth' });
  });

  // ---- PROCESS
  const processST = ScrollTrigger.create({ trigger: '#process', start: 'top 55%', end: 'bottom 45%', onToggle: (s) => s.isActive && setChapter('Process') });
  if (!reduced) {
    const path = $('.process__line path');
    const len = path.getTotalLength();
    gsap.fromTo(path, { strokeDasharray: len, strokeDashoffset: len }, { strokeDashoffset: 0, ease: 'none', scrollTrigger: { trigger: '.process__steps', start: 'top 70%', end: 'bottom 60%', scrub: true } });
    $$('.step').forEach((s) => {
      gsap.from(s, { x: 80, opacity: 0, duration: 1.1, ease: 'expo.out', scrollTrigger: { trigger: s, start: 'top 82%', toggleActions: 'play none none reverse' } });
      gsap.from($('.step__num', s), { scale: 0, rotate: -90, duration: 1, ease: 'back.out(2)', scrollTrigger: { trigger: s, start: 'top 82%', toggleActions: 'play none none reverse' } });
    });
  }

  // ---- BUILD
  const buildST = ScrollTrigger.create({
    trigger: '#build', start: 'top 55%', end: 'bottom 45%',
    onToggle: (s) => s.isActive && setChapter('Build yours'),
  });
  if (!reduced) {
    gsap.from('.cfg > *', { y: 40, opacity: 0, stagger: 0.06, duration: 1, ease: 'expo.out', scrollTrigger: { trigger: '.cfg', start: 'top 85%', toggleActions: 'play none none reverse' } });
    mm.add('(max-width: 899px)', () => {
      gsap.from('.build__preview', { y: 80, rotateX: 18, opacity: 0, duration: 1.3, ease: 'expo.out', scrollTrigger: { trigger: '.build__preview', start: 'top 85%', toggleActions: 'play none none reverse' } });
    });
  }

  // ---- LAUNCH + footer
  ScrollTrigger.create({ trigger: '#launch', start: 'top 55%', end: 'bottom top', onToggle: (s) => s.isActive && setChapter('Launch') });
  if (!reduced) {
    gsap.from('.launch__lede, .launch__ctas', { y: 50, opacity: 0, stagger: 0.12, duration: 1.2, ease: 'expo.out', scrollTrigger: { trigger: '.launch__lede', start: 'top 90%', toggleActions: 'play none none reverse' } });
    gsap.fromTo('.footer__big', { yPercent: 60, scaleY: 1.6 }, { yPercent: 0, scaleY: 1, ease: 'none', scrollTrigger: { trigger: '.footer', start: 'top bottom', end: 'bottom bottom', scrub: true } });
  }

  // ---- camera flight path, rebuilt on every refresh
  const buildTrack = () => {
    if (!world) return;
    world.computeKeys();
    const max = ScrollTrigger.maxScroll(window);
    const pts = [{ y: 0, key: 'hero' }];
    pts.push({ y: (arriveST.start + arriveST.end) / 2, key: 'arrive' });
    if (zonesST) {
      const { start, end } = zonesST;
      ['store', 'gallery', 'tower', 'monitor'].forEach((k, i) => pts.push({ y: start + ((end - start) * i) / 3, key: k }));
    }
    if (workST) {
      pts.push({ y: workST.start, key: 'work' });
      pts.push({ y: workST.end, key: 'work2' });
    } else {
      const w = $('#work');
      pts.push({ y: w.offsetTop, key: 'work' });
    }
    pts.push({ y: (processST.start + processST.end) / 2, key: 'process' });
    const b = $('#build');
    const bTop = b.getBoundingClientRect().top + window.scrollY;
    pts.push({ y: Math.min(bTop, max - 10), key: 'build' });
    pts.push({ y: Math.min(bTop + b.offsetHeight - innerHeight * 0.85, max - 5), key: 'build' });
    pts.push({ y: max, key: 'launch' });
    world.setTrack(pts);
  };
  ScrollTrigger.addEventListener('refresh', buildTrack);
  ScrollTrigger.refresh();
  buildTrack();

  // HUD progress
  const hudFill = $('.hud__fill');
  ScrollTrigger.create({ start: 0, end: 'max', onUpdate: (s) => (hudFill.style.transform = `scaleY(${s.progress})`) });
}

// ------------------------------------------------------------------ cursor + magnetic
const cursor = $('.cursor');
const ring = $('.cursor__ring');
const dot = $('.cursor__dot');
const label = $('.cursor__label');
const pointer = { x: innerWidth / 2, y: innerHeight / 2, nx: 0, ny: 0, moved: false };
if (!coarse && !reduced) {
  const rx = gsap.quickTo(ring, 'x', { duration: 0.55, ease: 'power3' });
  const ry = gsap.quickTo(ring, 'y', { duration: 0.55, ease: 'power3' });
  const dx = gsap.quickTo(dot, 'x', { duration: 0.12, ease: 'power3' });
  const dy = gsap.quickTo(dot, 'y', { duration: 0.12, ease: 'power3' });
  addEventListener('pointermove', (e) => {
    pointer.x = e.clientX; pointer.y = e.clientY; pointer.moved = true;
    pointer.nx = (e.clientX / innerWidth) * 2 - 1;
    pointer.ny = -(e.clientY / innerHeight) * 2 + 1;
    rx(e.clientX); ry(e.clientY); dx(e.clientX); dy(e.clientY);
    cursor.classList.add('is-on');
  });
  document.addEventListener('pointerleave', () => cursor.classList.remove('is-on'));
  addEventListener('blur', () => cursor.classList.remove('is-on'));
  document.addEventListener('pointerover', (e) => {
    const t = e.target.closest('a, button, input, label, [data-cursor], .card');
    cursor.classList.toggle('is-hover', !!t);
    const l = t?.closest('[data-cursor]')?.dataset.cursor || '';
    label.textContent = l;
    cursor.classList.toggle('has-label', !!l);
  });

  $$('.magnetic').forEach((el) => {
    const xTo = gsap.quickTo(el, 'x', { duration: 0.6, ease: 'elastic.out(1, 0.4)' });
    const yTo = gsap.quickTo(el, 'y', { duration: 0.6, ease: 'elastic.out(1, 0.4)' });
    el.addEventListener('pointermove', (e) => {
      const r = el.getBoundingClientRect();
      xTo((e.clientX - (r.left + r.width / 2)) * 0.35);
      yTo((e.clientY - (r.top + r.height / 2)) * 0.45);
    });
    el.addEventListener('pointerleave', () => { xTo(0); yTo(0); });
  });
} else {
  cursor.remove();
}

// clicking a zone on the island jumps to its chapter
const ZONE_CHAPTER = { store: 0, gallery: 1, tower: 2, monitor: 3 };
const ZONE_LABEL = { store: 'Visit the store', gallery: 'Visit the gallery', tower: 'Visit the tower', monitor: 'Visit the monitor' };
addEventListener('click', (e) => {
  if (!world?.hovered || e.target.closest('a, button, input, label, .zone__card, .card, .cfg')) return;
  const st = ScrollTrigger.getAll().find((s) => s.pin && s.trigger?.id === 'zones');
  if (!st) return;
  const y = st.start + ((st.end - st.start) * ZONE_CHAPTER[world.hovered]) / 3;
  lenis ? lenis.scrollTo(y, { duration: 2 }) : scrollTo(0, y);
});

// ------------------------------------------------------------------ frame loop
const altEl = $('.hud__alt');
const hdgEl = $('.hud__hdg');
const coordEl = $('.loader__coords');
let pickAcc = 0;
let lastHover = null;
gsap.ticker.add((time, deltaMs) => {
  const dt = Math.min(deltaMs / 1000, 0.25);
  if (world) {
    world.scrollY = lenis ? lenis.animatedScroll : scrollY;
    world.setPointer(pointer.nx, pointer.ny);
    const key = world.state.chapterKey;
    setChapter(KEY_CHAPTER[key], true);
    configurator.active = key === 'monitor' || key === 'build' || key === 'process' || isMobile();
    if (configurator.tick(time, dt)) world.previewDirty = true;
    world.frame(time, dt);

    // zone hover picking (throttled; only while the island is the subject)
    pickAcc += dt;
    if (pointer.moved && pickAcc > 0.08 && !coarse) {
      pickAcc = 0;
      const over = document.elementFromPoint(pointer.x, pointer.y);
      const free = !over?.closest('a, button, input, label, .zone__card, .card, .cfg, .build__panel, .nav, .hero__title, .work');
      const allowed = ['hero', 'arrive', 'store', 'gallery', 'tower', 'monitor', 'process', 'launch'].includes(key);
      world.hovered = free && allowed ? world.pick(pointer.nx, pointer.ny) : null;
      if (world.hovered !== lastHover) {
        lastHover = world.hovered;
        if (cursor.isConnected) {
          label.textContent = world.hovered ? ZONE_LABEL[world.hovered] : '';
          cursor.classList.toggle('has-label', !!world.hovered);
          cursor.classList.toggle('is-hover', !!world.hovered);
        }
        document.body.style.cursor = world.hovered ? 'pointer' : '';
      }
    }

    const cam = world.camera.position;
    altEl.textContent = String(Math.max(0, Math.round((cam.y + 8) * 62))).padStart(4, '0');
    hdgEl.textContent = String(Math.round(((Math.atan2(cam.x, cam.z) * 180) / Math.PI + 360) % 360)).padStart(3, '0');
  } else {
    if (configurator.tick(time, dt)) {/* preview only */}
  }
  if (coordEl?.isConnected) coordEl.textContent = `N ${(45 + Math.sin(time) * 0.5).toFixed(3)}° · E ${(12 + time * 0.37).toFixed(3)}°`;
});

let resizeT;
let lastW = innerWidth;
addEventListener('resize', () => {
  clearTimeout(resizeT);
  resizeT = setTimeout(() => {
    world?.resize();
    // ignore mobile URL-bar height jitter
    if (innerWidth !== lastW || !coarse) ScrollTrigger.refresh();
    lastW = innerWidth;
  }, 150);
});
