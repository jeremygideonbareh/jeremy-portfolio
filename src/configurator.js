// "Build yours": a live site configurator. State → painter → preview canvas
// (which is also the texture on the island's 3D monitor).
import { PALETTES, FONTS, DEFAULT_CONFIG, DEFAULT_HEADLINES, SITE } from './config.js';
import { paintSite } from './sitepainter.js';

const TYPE_LABEL = { store: 'Online store', portfolio: 'Portfolio', app: 'App', website: 'Website' };

export class Configurator {
  constructor({ form, canvas, summaryEl, statusEl, onChange, onSend }) {
    this.onSend = onSend;
    this.form = form;
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.summaryEl = summaryEl;
    this.statusEl = statusEl;
    this.onChange = onChange || (() => {});
    const shared = readHash();
    this.state = { ...DEFAULT_CONFIG, ...shared };
    if (Object.keys(shared).length) delete this.state.photos; // a shared setup shows its own layout, not the demo photos
    this.enter = 1;
    this.enterStart = 0;
    this.active = true;
    this.acc = 0;
    this.time = 0;

    this.#buildSwatches();
    this.#syncForm();
    this.#bind();
    this.paint(0);
  }

  #buildSwatches() {
    const wrap = this.form.querySelector('.swatches');
    wrap.innerHTML = Object.entries(PALETTES)
      .map(([id, p]) => `
        <label class="swatch" title="${p.label}">
          <input type="radio" name="palette" value="${id}" />
          <span class="swatch__chip" style="--a:${p.bg};--b:${p.accent};--c:${p.ink}" aria-hidden="true"><i></i><i></i><i></i></span>
          <span class="swatch__name">${p.label}</span>
        </label>`)
      .join('');
  }

  #syncForm() {
    const f = this.form;
    for (const key of ['type', 'palette', 'font', 'layout', 'motion']) {
      const input = f.querySelector(`input[name="${key}"][value="${this.state[key]}"]`);
      if (input) input.checked = true;
    }
    f.elements.name.value = this.state.name;
    f.elements.headline.value = this.state.headline;
    f.elements.headline.placeholder = DEFAULT_HEADLINES[this.state.type];
    f.elements.radius.value = this.state.radius;
    f.elements.radiusOut.value = `${this.state.radius}px`;
    this.#summary();
  }

  #summary() {
    const s = this.state;
    if (this.summaryEl) this.summaryEl.textContent = `${TYPE_LABEL[s.type]} · ${PALETTES[s.palette].label} · ${FONTS[s.font].label} · ${s.layout}`;
  }

  #bind() {
    this.form.addEventListener('input', (e) => {
      const el = e.target;
      if (!el.name || el.name === 'radiusOut') return;
      const v = el.type === 'range' ? Number(el.value) : el.value;
      const structural = ['type', 'layout', 'palette', 'font'].includes(el.name);
      this.set({ [el.name]: v }, structural);
    });
    this.form.addEventListener('submit', (e) => e.preventDefault());
    this.form.querySelector('[data-action="random"]').addEventListener('click', () => this.randomize());
    this.form.querySelector('[data-action="share"]').addEventListener('click', () => this.share());
    this.form.querySelector('[data-action="send"]').addEventListener('click', (e) => {
      e.preventDefault();
      if (this.onSend) {
        this.onSend(this.briefText(), TYPE_LABEL[this.state.type]);
        this.status('Your brief is in the form below.');
      } else {
        window.location.href = this.mailto();
        this.status('Opening your email app with the brief…');
      }
    });
  }

  set(patch, replay = true) {
    const prevType = this.state.type;
    Object.assign(this.state, patch);
    // photography belongs to a specific concept; drop it when the visitor changes what they're building
    if (patch.type && patch.type !== prevType) delete this.state.photos;
    if (patch.type && patch.type !== prevType && !this.state.headline) {
      this.form.elements.headline.placeholder = DEFAULT_HEADLINES[this.state.type];
    }
    if (patch.radius !== undefined) this.form.elements.radiusOut.value = `${this.state.radius}px`;
    if (replay) this.enterStart = this.time;
    if (replay) this.enter = 0;
    this.#summary();
    this.paint(this.time);
    this.onChange(this.state);
  }

  load(cfg) {
    this.state = { ...DEFAULT_CONFIG, photos: undefined, ...cfg, headline: cfg.headline || '' };
    this.#syncForm();
    this.enter = 0;
    this.enterStart = this.time;
    this.paint(this.time);
    this.onChange(this.state);
  }

  randomize() {
    const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];
    const names = ['Fable Goods', 'Northline', 'Orbit Labs', 'Maison Vale', 'Pico Studio', 'Field Notes', 'Halo Fitness'];
    this.load({
      type: pick(['store', 'portfolio', 'app', 'website']),
      palette: pick(Object.keys(PALETTES)),
      font: pick(Object.keys(FONTS)),
      layout: pick(['split', 'centered', 'editorial']),
      radius: pick([0, 6, 14, 22, 30]),
      motion: pick(['calm', 'lively', 'max']),
      name: pick(names),
      headline: '',
    });
    this.status('Shuffled. Keep what you like.');
  }

  async share() {
    const url = `${location.origin}${location.pathname}#cfg=${encodeHash(this.state)}`;
    try {
      await navigator.clipboard.writeText(url);
      this.status('Link copied. Anyone who opens it sees this design.');
    } catch {
      history.replaceState(null, '', url);
      this.status('The link is in your address bar. Copy it from there.');
    }
  }

  mailto() {
    const s = this.state;
    const body = [
      `Hi ${SITE.name},`,
      '',
      `I'd like to build: ${TYPE_LABEL[s.type]}`,
      `Brand: ${s.name}`,
      `Headline idea: ${s.headline || DEFAULT_HEADLINES[s.type]}`,
      `Palette: ${PALETTES[s.palette].label} · Type: ${FONTS[s.font].label} · Layout: ${s.layout}`,
      `Corners: ${s.radius}px · Motion: ${s.motion}`,
      '',
      `Preview link: ${location.origin}${location.pathname}#cfg=${encodeHash(s)}`,
      '',
      'A bit about the project:',
      '',
    ].join('\n');
    return `mailto:${SITE.email}?subject=${encodeURIComponent(`New ${TYPE_LABEL[s.type].toLowerCase()} from ${s.name}`)}&body=${encodeURIComponent(body)}`;
  }

  briefText() {
    const s = this.state;
    return [
      `Setup from the pit stop:`,
      `• ${TYPE_LABEL[s.type]} for ${s.name || 'my brand'}`,
      `• Headline idea: ${s.headline || DEFAULT_HEADLINES[s.type]}`,
      `• ${PALETTES[s.palette].label} palette · ${FONTS[s.font].label} type · ${s.layout} layout · ${s.radius}px corners · ${s.motion} motion`,
      `• Preview: ${location.origin}${location.pathname}#cfg=${encodeHash(s)}`,
      '',
      '',
    ].join('\n');
  }

  status(msg) {
    this.statusEl.textContent = msg;
    clearTimeout(this._st);
    this._st = setTimeout(() => (this.statusEl.textContent = ''), 4000);
  }

  paint(t) {
    paintSite(this.ctx, this.canvas.width, this.canvas.height, this.state, t, this.enter, { chrome: true });
    this.dirty = true;
  }

  /** call every frame; paints ~30fps while active */
  tick(time, dt) {
    this.time = time;
    if (this.enter < 1) this.enter = Math.min(1, (time - this.enterStart) / 1.1);
    if (!this.active) return false;
    this.acc += dt;
    // full rate only while a change animates in; idle shimmer at 10fps keeps phones cool
    if (this.acc < (this.enter < 1 ? 1 / 30 : 1 / 10)) return false;
    this.acc = 0;
    this.paint(time);
    return true;
  }
}

// short, readable share links: #cfg=store.noir.serif.split.14.max~Brand%20Name~Headline
function encodeHash(s) {
  return `${s.type}.${s.palette}.${s.font}.${s.layout}.${s.radius}.${s.motion}~${encodeURIComponent(s.name || '')}~${encodeURIComponent(s.headline || '')}`;
}

function parseHash(v) {
  const compact = v.match(/^(\w+)\.(\w+)\.(\w+)\.(\w+)\.(\d+)\.(\w+)~([^~]*)~?(.*)$/);
  if (compact) {
    const [, type, palette, font, layout, radius, motion, name, headline] = compact;
    return { type, palette, font, layout, radius: +radius, motion, name: decodeURIComponent(name), headline: decodeURIComponent(headline) };
  }
  return JSON.parse(decodeURIComponent(escape(atob(v)))); // older base64 links keep working
}

function readHash() {
  const m = location.hash.match(/cfg=([^&]+)/);
  if (!m) return {};
  try {
    const obj = parseHash(m[1]);
    const clean = {};
    if (['store', 'portfolio', 'app', 'website'].includes(obj.type)) clean.type = obj.type;
    if (PALETTES[obj.palette]) clean.palette = obj.palette;
    if (FONTS[obj.font]) clean.font = obj.font;
    if (['split', 'centered', 'editorial'].includes(obj.layout)) clean.layout = obj.layout;
    if (['calm', 'lively', 'max'].includes(obj.motion)) clean.motion = obj.motion;
    if (Number.isFinite(obj.radius)) clean.radius = Math.max(0, Math.min(32, obj.radius));
    if (typeof obj.name === 'string') clean.name = obj.name.slice(0, 22);
    if (typeof obj.headline === 'string') clean.headline = obj.headline.slice(0, 42);
    return clean;
  } catch {
    return {};
  }
}
