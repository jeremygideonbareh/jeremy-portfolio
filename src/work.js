// ---------------------------------------------------------------------------
// Real-work displays: telemetry sheet (project detail), onboard cams (phone lane),
// classification filters and the speed-run hover filmstrips.
// ---------------------------------------------------------------------------
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { Flip } from 'gsap/Flip';
import { WORK, CATEGORIES } from './config.js';

gsap.registerPlugin(ScrollTrigger, Flip);

const $ = (s, el = document) => el.querySelector(s);
const $$ = (s, el = document) => [...el.querySelectorAll(s)];
const BASE = import.meta.env.BASE_URL;
const clamp = (a, b, v) => Math.min(b, Math.max(a, v));
const pad2 = (n) => String(n).padStart(2, '0');

export const FEATURED = WORK.filter((w) => w.featured);
export const shotUrl = (w, suffix = '') => `${BASE}images/work/${w.shot}${suffix}.webp`;
// filmstrips: one viewport per scroll step, stitched (tools/shoot-strips.mjs)
export const stripUrl = (w, phone = false) => `${BASE}images/work/strips/${w.shot}${phone ? '-m' : ''}.webp`;
export const catLabel = (c) => (CATEGORIES.find(([k]) => k === c) || [c, c])[1];
export const statusOf = (w) => (w.concept ? 'Concept' : 'Live');

const cache = new Map();
/** decoded image, cached by url; rejects on 404 so callers can fall back */
export function loadImage(url) {
  if (!cache.has(url)) {
    cache.set(url, new Promise((res, rej) => {
      const im = new Image();
      im.decoding = 'async';
      im.onload = () => res(im);
      im.onerror = () => { cache.delete(url); rej(new Error(url)); };
      im.src = url;
    }));
  }
  return cache.get(url);
}
export const loadStrip = (w, phone = false) => loadImage(stripUrl(w, phone)).catch(() => loadImage(phone && w.featured ? shotUrl(w, '-m') : shotUrl(w)));

// ------------------------------------------------------------------ telemetry sheet
/** a screen that auto-scrolls a filmstrip and lets you take over with wheel, drag or keys */
function makePlayer(screen, img, reduced) {
  const st = { y: 0, max: 0, auto: null, idle: 0, token: 0 };
  const setY = (y) => { st.y = clamp(0, st.max, y); gsap.set(img, { y: -st.y }); };
  const measure = () => { st.max = Math.max(0, img.offsetHeight - screen.clientHeight); setY(st.y); };
  const play = () => {
    st.auto?.kill();
    st.auto = null;
    if (reduced || st.max < 8 || !screen.offsetParent) return;
    const dur = Math.max(6, st.max / 150);
    st.auto = gsap.timeline({ repeat: -1, yoyo: true, repeatDelay: 1.4, delay: 1.1 })
      .to(st, { y: st.max, duration: dur * (1 - st.y / st.max) + 0.01, ease: 'sine.inOut', onUpdate: () => gsap.set(img, { y: -st.y }) });
  };
  const takeOver = () => { st.auto?.kill(); st.auto = null; clearTimeout(st.idle); st.idle = setTimeout(play, 4000); screen.classList.add('is-manual'); };
  screen.addEventListener('wheel', (e) => { e.preventDefault(); e.stopPropagation(); takeOver(); setY(st.y + e.deltaY); }, { passive: false });
  let drag = null;
  screen.addEventListener('pointerdown', (e) => { drag = { y: e.clientY, from: st.y }; screen.setPointerCapture(e.pointerId); takeOver(); });
  screen.addEventListener('pointermove', (e) => { if (drag) setY(drag.from - (e.clientY - drag.y) * 1.6); });
  const end = () => (drag = null);
  screen.addEventListener('pointerup', end);
  screen.addEventListener('pointercancel', end);
  screen.addEventListener('keydown', (e) => {
    const step = { ArrowDown: 120, ArrowUp: -120, PageDown: screen.clientHeight * 0.9, PageUp: -screen.clientHeight * 0.9, ' ': screen.clientHeight * 0.9, Home: -1e6, End: 1e6 }[e.key];
    if (step === undefined) return;
    e.preventDefault();
    takeOver();
    gsap.to(st, { y: clamp(0, st.max, st.y + step), duration: 0.5, ease: 'power3.out', onUpdate: () => gsap.set(img, { y: -st.y }) });
  });
  return {
    async show(src) {
      const token = ++st.token;
      st.auto?.kill();
      clearTimeout(st.idle);
      screen.classList.remove('is-manual', 'is-ready');
      st.y = 0;
      gsap.set(img, { y: 0 });
      try { img.src = (await src).src; await img.decode(); } catch { /* keep whatever loaded */ }
      if (token !== st.token) return;
      screen.classList.add('is-ready');
      measure();
      play();
    },
    measure,
    play,
    stop() { st.auto?.kill(); st.auto = null; clearTimeout(st.idle); },
  };
}

export function createSheet({ getLenis, onRemix, reduced }) {
  const el = $('#sheet');
  const panel = $('.sheet__panel', el);
  const stageEl = $('.sheet__stage', el);
  const browser = $('.sheet__browser', el);
  const screens = $$('.sheet__screen', el);
  const players = screens.map((s) => makePlayer(s, $('img', s), reduced));
  const html = document.documentElement;
  let idx = 0, opener = null, isOpen = false;

  const fill = (i) => {
    const w = WORK[i];
    idx = i;
    $('.sheet__pos', el).textContent = `#${pad2(i + 1)}`;
    $('.sheet__kind', el).textContent = w.kind;
    $('.sheet__status', el).textContent = `${statusOf(w)} ↗`;
    $('.sheet__status', el).classList.toggle('is-concept', !!w.concept);
    $('.sheet__title', el).textContent = w.title;
    $('.sheet__summary', el).textContent = w.summary;
    $('.sheet__cat', el).textContent = catLabel(w.cat);
    $('.sheet__year', el).textContent = w.year;
    const host = w.url.replace(/^https?:\/\//, '').replace(/\/$/, '');
    $('.sheet__url', el).textContent = host;
    $('.sheet__addr', el).textContent = host;
    $('.sheet__visit', el).href = w.url;
    $('.sheet__visit', el).setAttribute('aria-label', `Visit ${w.title} (opens in a new tab)`);
    $('.sheet__remix', el).hidden = !w.cfg;
    $('.sheet__count', el).textContent = `${pad2(i + 1)} / ${pad2(WORK.length)}`;
    players[0].show(loadStrip(w));
    players[1].show(loadStrip(w, true));
    // warm the neighbours so prev/next feel instant
    [i - 1, i + 1].forEach((n) => { const nw = WORK[(n + WORK.length) % WORK.length]; loadStrip(nw); loadStrip(nw, true); });
  };

  function open(i, from) {
    opener = from || document.activeElement;
    // phones open on the phone view — the build as their own customers would see it
    const view = innerWidth < 900 ? 'phone' : 'desktop';
    stageEl.dataset.view = view;
    $(`input[name="sheet-view"][value="${view}"]`, el).checked = true;
    el.hidden = false;
    fill(i);
    isOpen = true;
    html.classList.add('sheet-open');
    getLenis()?.stop();
    if (reduced) { $('.sheet__close', el).focus(); return; }
    gsap.fromTo($('.sheet__backdrop', el), { opacity: 0 }, { opacity: 1, duration: 0.5, ease: 'power2.out' });
    gsap.fromTo(panel, { opacity: 0 }, { opacity: 1, duration: 0.35 });
    // the screen zooms out of whatever thumbnail was clicked
    const o = from?.getBoundingClientRect?.();
    const b = browser.getBoundingClientRect();
    if (o && o.width > 20 && b.width > 0 && getComputedStyle(browser).display !== 'none') {
      gsap.fromTo(browser, { x: o.left - b.left, y: o.top - b.top, scale: o.width / b.width, transformOrigin: '0 0', borderRadius: 14 }, { x: 0, y: 0, scale: 1, duration: 0.95, ease: 'expo.inOut', clearProps: 'transform' });
    } else {
      gsap.fromTo(browser, { y: 60, opacity: 0 }, { y: 0, opacity: 1, duration: 0.9, ease: 'expo.out', clearProps: 'transform' });
    }
    gsap.fromTo('.sheet__phone', { y: 120, rotate: 8, opacity: 0 }, { y: 0, rotate: 0, opacity: 1, duration: 1, ease: 'expo.out', delay: 0.35, clearProps: 'transform' });
    gsap.fromTo($$('.sheet__info > *', el), { y: 26, opacity: 0 }, { y: 0, opacity: 1, duration: 0.8, ease: 'expo.out', stagger: 0.045, delay: 0.15 });
    $('.sheet__close', el).focus({ preventScroll: true });
  }

  function close() {
    if (!isOpen) return;
    isOpen = false;
    players.forEach((p) => p.stop());
    const done = () => {
      el.hidden = true;
      gsap.set([el, panel], { clearProps: 'opacity' });
      html.classList.remove('sheet-open');
      getLenis()?.start();
      opener?.focus?.({ preventScroll: true });
    };
    if (reduced) return done();
    gsap.to(el, { opacity: 0, duration: 0.35, ease: 'power2.in', onComplete: done });
  }

  function step(d) {
    const next = (idx + d + WORK.length) % WORK.length;
    if (reduced) return fill(next);
    gsap.timeline()
      .to([stageEl, $('.sheet__info', el)], { x: -d * 60, opacity: 0, duration: 0.28, ease: 'power2.in' })
      .add(() => fill(next))
      .fromTo([stageEl, $('.sheet__info', el)], { x: d * 60, opacity: 0 }, { x: 0, opacity: 1, duration: 0.6, ease: 'expo.out', clearProps: 'transform' });
  }

  el.addEventListener('click', (e) => {
    if (e.target.closest('[data-sheet-close]')) return close();
    const s = e.target.closest('[data-sheet-step]');
    if (s) return step(+s.dataset.sheetStep);
    if (e.target.closest('.sheet__remix')) {
      const w = WORK[idx];
      close();
      onRemix(FEATURED.indexOf(w));
    }
  });
  $$('input[name="sheet-view"]', el).forEach((r) => r.addEventListener('change', () => {
    stageEl.dataset.view = r.value;
    requestAnimationFrame(() => players.forEach((p) => { p.measure(); p.play(); }));
  }));
  document.addEventListener('keydown', (e) => {
    if (!isOpen) return;
    if (e.key === 'Escape') { e.preventDefault(); close(); return; }
    if ((e.key === 'ArrowRight' || e.key === 'ArrowLeft') && !e.target.matches('input')) { e.preventDefault(); step(e.key === 'ArrowRight' ? 1 : -1); return; }
    if (e.key === 'Tab') {
      // the view radios are visually hidden inputs: judge them by their label's visibility
      const items = $$('a[href], button:not([hidden]), input:checked, [tabindex="0"]', panel).filter((n) => (n.matches('input') ? n.closest('label') : n).offsetParent);
      const k = items.indexOf(document.activeElement);
      e.preventDefault();
      items[e.shiftKey ? (k <= 0 ? items.length - 1 : k - 1) : (k === items.length - 1 ? 0 : k + 1)]?.focus();
    }
  });
  addEventListener('resize', () => isOpen && players.forEach((p) => p.measure()));
  return { open, close, get isOpen() { return isOpen; } };
}

// ------------------------------------------------------------------ onboard cams: every launch on a phone
export function createOnboard({ reduced }) {
  const sec = $('#onboard');
  const lane = $('.onboard__lane', sec);
  const drift = $('.onboard__drift', sec);
  const list = $('.onboard__phones', sec);
  const bar = $('.onboard__foot b', sec);
  $('.onboard__count', sec).textContent = `${WORK.length} launches`;
  list.innerHTML = WORK.map((w, i) => `
    <li class="ob">
      <button class="ob__phone" type="button" data-sheet="${i}" data-cursor="Open" aria-label="${w.title}, ${w.kind}. See project details">
        <span class="ob__screen"><img alt="" width="300" decoding="async" /></span>
        <span class="ob__island" aria-hidden="true"></span>
        <span class="ob__badge mono" aria-hidden="true">${statusOf(w)}</span>
      </button>
      <p class="ob__meta"><b>${w.title}</b><span class="mono">${w.kind}</span></p>
    </li>`).join('');
  const items = $$('.ob', list).map((li, i) => ({ li, w: WORK[i], img: $('img', li), screen: $('.ob__screen', li), loaded: false, cx: 0 }));

  const load = (it) => {
    if (it.loaded) return;
    it.loaded = true;
    loadStrip(it.w, true).then((im) => {
      it.img.src = im.src;
      const fallback = !/strips/.test(im.src);
      it.screen.classList.toggle('is-fallback', fallback);
      requestAnimationFrame(() => {
        const ih = it.img.offsetHeight, sh = it.screen.clientHeight;
        if (!fallback && ih > sh) {
          it.img.style.setProperty('--dist', `${(-(1 - sh / ih) * 100).toFixed(2)}%`);
          it.img.style.setProperty('--dur', `${clamp(10, (ih / sh) * 3.4, 28).toFixed(1)}s`);
          it.img.style.animationDelay = `${(-Math.random() * 8).toFixed(2)}s`;
        }
        it.screen.classList.add('is-ready');
      });
    }).catch(() => {});
  };

  if (reduced) {
    // calm version: a native, swipeable row; images load as they come into view
    const io = new IntersectionObserver((es) => es.forEach((e) => e.isIntersecting && load(items[+e.target.dataset.k])), { root: lane, rootMargin: '0px 60% 0px 60%' });
    items.forEach((it, k) => { it.li.dataset.k = k; io.observe(it.li); });
    return { mount() {} };
  }

  const st = { drag: 0, vel: 0, p: 0, x: 0, max: 0, dragging: false, live: false, near: false };
  const measure = () => {
    st.max = Math.max(0, list.scrollWidth - lane.clientWidth);
    items.forEach((it) => (it.cx = it.li.offsetLeft + it.li.offsetWidth / 2));
  };
  measure();
  ScrollTrigger.addEventListener('refreshInit', measure);
  // triggers are created by mount(), after the speed-run pin exists, so their ranges include its spacing.
  // The section pins while scrolling slides the whole lane sideways, so every phone can be browsed
  // without the page carrying you past it (if the section is taller than the screen, it pins by its bottom
  // edge so the phones stay in view).
  const mount = () => {
    ScrollTrigger.create({
      trigger: sec, pin: true, anticipatePin: 1, invalidateOnRefresh: true,
      start: () => (sec.offsetHeight > innerHeight ? 'bottom bottom' : 'top top'),
      end: () => '+=' + Math.round(st.max * 0.55),
      onUpdate: (s) => (st.p = s.progress),
    });
    const spacer = sec.parentElement; // the pin spacer spans the whole pinned stretch
    ScrollTrigger.create({ trigger: spacer, start: 'top bottom', end: 'bottom top', onToggle: (s) => (st.near = s.isActive) });
    ScrollTrigger.create({ trigger: spacer, start: 'top 85%', end: 'bottom 15%', toggleClass: { targets: sec, className: 'is-live' }, onToggle: (s) => (st.live = s.isActive) });
  };

  // drag (mouse, pen, horizontal swipes) with momentum; vertical swipes still scroll the page
  let down = null, suppress = false;
  lane.addEventListener('pointerdown', (e) => {
    if (e.button !== 0) return;
    down = { x: e.clientX, y: e.clientY, from: st.drag, last: e.clientX, id: e.pointerId, moved: false };
    st.vel = 0;
  });
  addEventListener('pointermove', (e) => {
    if (!down || e.pointerId !== down.id) return;
    const dx = e.clientX - down.x;
    if (!down.moved && Math.abs(dx) > 6 && Math.abs(dx) > Math.abs(e.clientY - down.y)) {
      down.moved = true;
      st.dragging = true;
      lane.classList.add('is-dragging');
      try { lane.setPointerCapture(e.pointerId); } catch {}
    }
    if (!down.moved) return;
    st.drag = down.from + dx * 1.1;
    st.vel = (e.clientX - down.last) * 1.1;
    down.last = e.clientX;
  });
  const up = () => {
    if (!down) return;
    if (down.moved) { suppress = true; setTimeout(() => (suppress = false), 0); } // swallow only the click that ends this drag
    down = null;
    st.dragging = false;
    lane.classList.remove('is-dragging');
  };
  addEventListener('pointerup', up);
  addEventListener('pointercancel', up);
  lane.addEventListener('click', (e) => { if (suppress) { e.preventDefault(); e.stopPropagation(); suppress = false; } }, true);
  lane.addEventListener('pointerdown', () => (suppress = false));
  // trackpad sideways swipes drive the lane too
  lane.addEventListener('wheel', (e) => { if (Math.abs(e.deltaX) > Math.abs(e.deltaY)) { st.drag -= e.deltaX; st.vel = 0; } }, { passive: true });
  // keyboard: bring the focused phone into view
  lane.addEventListener('focusin', (e) => {
    const it = items.find((k) => k.li.contains(e.target));
    if (!it) return;
    const want = clamp(-st.max, 0, lane.clientWidth / 2 - it.cx);
    st.drag += want - st.x;
  });

  gsap.ticker.add(() => {
    if (!st.near) return;
    if (!st.dragging) { st.drag += st.vel; st.vel *= 0.92; }
    // while pinned, scroll slides the lane from the first phone to the last; drag offsets on top of that
    const base = -st.p * st.max;
    let target = base + st.drag;
    if (target > 0) { st.drag -= target; target = 0; st.vel = 0; }
    if (target < -st.max) { st.drag -= target + st.max; target = -st.max; st.vel = 0; }
    st.x += (target - st.x) * 0.14;
    drift.style.transform = `translate3d(${st.x.toFixed(2)}px,0,0)`;
    bar.style.transform = `scaleX(${st.max ? (-st.x / st.max).toFixed(4) : 0})`;
    // arc: phones dip and lean as they move away from the centre of the lane
    const W = lane.clientWidth;
    items.forEach((it) => {
      const rel = (it.cx + st.x - W / 2) / W;
      if (Math.abs(rel) < 1.3) load(it);
      if (Math.abs(rel) > 1.1) return;
      it.li.style.transform = `translate3d(0, ${(rel * rel * 90).toFixed(1)}px, 0) rotate(${(rel * 7).toFixed(2)}deg)`;
    });
  });
  return { mount };
}

// ------------------------------------------------------------------ classification filters
export function createFilters({ onFiltered, scrollTo }) {
  const wrap = $('.filters__chips');
  const status = $('.filters__status');
  const counts = Object.fromEntries(CATEGORIES.map(([k]) => [k, WORK.filter((w) => w.cat === k).length]));
  wrap.innerHTML = [['all', 'All'], ...CATEGORIES].map(([k, label]) => `<button class="chip${k === 'all' ? ' is-on' : ''}" type="button" data-cat="${k}" aria-pressed="${k === 'all'}">${label}<sup>${k === 'all' ? WORK.length : counts[k]}</sup></button>`).join('');
  wrap.addEventListener('click', (e) => {
    const chip = e.target.closest('[data-cat]');
    if (!chip || chip.classList.contains('is-on')) return;
    $$('.chip', wrap).forEach((c) => { const on = c === chip; c.classList.toggle('is-on', on); c.setAttribute('aria-pressed', String(on)); });
    const cat = chip.dataset.cat;
    const rows = $$('.classification__rows > li');
    const state = Flip.getState(rows);
    let shown = 0;
    rows.forEach((li, i) => { const on = cat === 'all' || WORK[i].cat === cat; li.hidden = !on; shown += on; });
    Flip.from(state, {
      duration: 0.6, ease: 'expo.out', stagger: 0.012,
      onEnter: (els) => gsap.fromTo(els, { opacity: 0, x: 80 }, { opacity: 1, x: 0, duration: 0.7, ease: 'expo.out', stagger: 0.035 }),
      onComplete: onFiltered,
    });
    const top = $('.filters').getBoundingClientRect().top;
    if (top < 60) scrollTo('.filters');
    status.textContent = cat === 'all' ? `Showing all ${WORK.length} launches` : `Showing ${shown} of ${WORK.length}: ${chip.firstChild.textContent}`;
  });
}

// ------------------------------------------------------------------ speed run: hover a build to watch its whole page scroll
export function frameFilmstrips() {
  $$('.frame__media').forEach((m) => {
    const w = WORK[+m.dataset.sheet];
    let img = null, tw = null;
    m.addEventListener('pointerenter', async (e) => {
      if (e.pointerType !== 'mouse') return;
      if (!img) {
        img = document.createElement('img');
        img.className = 'frame__strip';
        img.alt = '';
        m.insertBefore(img, m.firstChild.nextSibling);
      }
      try { img.src = (await loadImage(stripUrl(w))).src; await img.decode(); } catch { return; }
      if (!m.matches(':hover')) return;
      const dist = img.offsetHeight - m.clientHeight;
      if (dist < 10) return;
      m.classList.add('is-playing');
      tw?.kill();
      tw = gsap.fromTo(img, { y: 0 }, { y: -dist, duration: Math.max(5, dist / 240), ease: 'sine.inOut', delay: 0.3, yoyo: true, repeat: -1, repeatDelay: 0.9 });
    });
    m.addEventListener('pointerleave', () => {
      m.classList.remove('is-playing');
      tw?.kill();
      if (img) gsap.to(img, { y: 0, duration: 0.6, ease: 'power3.out' });
    });
  });
}
