// Paints a small, believable website into a 2D canvas from a config object.
// The same painter feeds: the configurator preview, the 3D monitor screen,
// and the concept-build thumbnails in the reel. Everything here is interface
// layout (type, blocks, UI chrome) — no illustration.
import { PALETTES, FONTS, DEFAULT_HEADLINES } from './config.js';

const MOTION_AMP = { calm: 0.35, lively: 1, max: 2.2 };

function luminance(hex) {
  const n = parseInt(hex.slice(1), 16);
  return (0.299 * ((n >> 16) & 255) + 0.587 * ((n >> 8) & 255) + 0.114 * (n & 255)) / 255;
}

const ease = (t) => 1 - Math.pow(1 - Math.min(Math.max(t, 0), 1), 3);

function rr(ctx, x, y, w, h, r, fill) {
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, Math.max(0, Math.min(r, h / 2, w / 2)));
  ctx.fillStyle = fill;
  ctx.fill();
}

function wrap(ctx, text, maxW) {
  const words = text.split(/\s+/);
  const lines = [];
  let line = '';
  for (const w of words) {
    const test = line ? line + ' ' + w : w;
    if (ctx.measureText(test).width > maxW && line) {
      lines.push(line);
      line = w;
    } else line = test;
  }
  if (line) lines.push(line);
  return lines;
}

function fitHeadline(ctx, text, font, maxW, maxLines, startSize) {
  let size = startSize;
  let lines;
  for (; size > 28; size -= 4) {
    ctx.font = `${font.weight} ${size}px ${font.display}`;
    ctx.letterSpacing = `${font.tracking * size}px`;
    lines = wrap(ctx, text, maxW);
    if (lines.length <= maxLines) break;
  }
  return { size, lines };
}

export function resolve(cfg) {
  const pal = PALETTES[cfg.palette] || PALETTES.stone;
  const font = FONTS[cfg.font] || FONTS.grotesk;
  const headline = (cfg.headline && cfg.headline.trim()) || DEFAULT_HEADLINES[cfg.type];
  return { pal, font, headline, amp: MOTION_AMP[cfg.motion] ?? 1, r: Number(cfg.radius) || 0 };
}

/**
 * @param ctx 2D context
 * @param W,H logical size (ctx is expected to be pre-scaled)
 * @param cfg configurator state
 * @param t   seconds (drives idle motion)
 * @param enter 0..1 entrance progress after a config change
 */
export function paintSite(ctx, W, H, cfg, t = 0, enter = 1, { chrome = true } = {}) {
  const { pal, font, headline, amp, r } = resolve(cfg);
  ctx.save();
  ctx.clearRect(0, 0, W, H);
  ctx.fillStyle = pal.bg;
  ctx.fillRect(0, 0, W, H);
  ctx.textBaseline = 'alphabetic';

  let top = 0;
  const pad = W * 0.055;

  // ---- browser chrome
  if (chrome) {
    const ch = H * 0.055;
    ctx.fillStyle = pal.surface;
    ctx.fillRect(0, 0, W, ch);
    ['#ff5f57', '#febc2e', '#28c840'].forEach((c, i) => {
      ctx.beginPath();
      ctx.arc(pad * 0.45 + i * ch * 0.42, ch / 2, ch * 0.13, 0, Math.PI * 2);
      ctx.fillStyle = c;
      ctx.fill();
    });
    rr(ctx, W * 0.3, ch * 0.2, W * 0.4, ch * 0.6, ch * 0.3, pal.bg);
    ctx.fillStyle = pal.muted;
    ctx.font = `500 ${ch * 0.32}px "JetBrains Mono Variable", monospace`;
    ctx.letterSpacing = '0px';
    ctx.textAlign = 'center';
    const slug = (cfg.name || 'yourbrand').toLowerCase().replace(/[^a-z0-9]+/g, '') || 'yourbrand';
    ctx.fillText(`${slug}.com`, W / 2, ch * 0.61);
    ctx.textAlign = 'left';
    top = ch;
  }

  const e = (delay) => ease((enter - delay) / 0.55); // staggered entrance
  const rise = (delay) => (1 - e(delay)) * H * 0.06;

  // ---- nav
  const navY = top + H * 0.085;
  ctx.globalAlpha = e(0);
  ctx.fillStyle = pal.ink;
  ctx.font = `${font.weight} ${H * 0.034}px ${font.display}`;
  ctx.letterSpacing = `${font.tracking * H * 0.034}px`;
  ctx.fillText(cfg.name || 'Your brand', pad, navY);
  const narrow = W < 700 || W / H < 0.9; // phone-sized canvas: mobile nav + stacked buttons
  if (narrow) {
    // burger instead of links
    ctx.fillStyle = pal.ink;
    for (let i = 0; i < 3; i++) rr(ctx, W - pad - W * 0.07, navY - H * 0.024 + i * H * 0.011, W * 0.07, H * 0.004, 2, pal.ink);
  } else {
    const links = cfg.links || { store: ['Shop', 'Journal', 'About'], portfolio: ['Work', 'Info', 'Press'], app: ['Features', 'Pricing', 'Help'], website: ['Menu', 'Visit', 'Story'] }[cfg.type];
    ctx.font = `500 ${H * 0.022}px ${font.body}`;
    ctx.letterSpacing = '0px';
    ctx.fillStyle = pal.muted;
    links.forEach((l, i) => ctx.fillText(l, W * 0.42 + i * W * 0.085, navY - H * 0.004));
    const ctaLabel = { store: 'Cart · 2', portfolio: 'Contact', app: 'Get the app', website: 'Find us' }[cfg.type];
    const cw = W * 0.12, chh = H * 0.05;
    rr(ctx, W - pad - cw, navY - chh * 0.72, cw, chh, r * 0.8, pal.ink);
    ctx.fillStyle = pal.bg;
    ctx.textAlign = 'center';
    ctx.fillText(ctaLabel, W - pad - cw / 2, navY - chh * 0.72 + chh * 0.64);
    ctx.textAlign = 'left';
  }
  ctx.globalAlpha = 1;

  // ---- hero text
  const layout = cfg.layout;
  const heroTop = navY + H * 0.1;
  const textW = layout === 'split' ? W * 0.44 : layout === 'centered' ? W * 0.72 : W - pad * 2;
  const startSize = layout === 'editorial' ? H * 0.16 : layout === 'centered' ? H * 0.11 : H * 0.1;
  const { size, lines } = fitHeadline(ctx, headline, font, textW, layout === 'editorial' ? 2 : 3, startSize);
  const tx = layout === 'centered' ? W / 2 : pad;
  ctx.textAlign = layout === 'centered' ? 'center' : 'left';
  ctx.fillStyle = pal.ink;
  lines.forEach((ln, i) => {
    ctx.globalAlpha = e(0.08 + i * 0.07);
    ctx.font = `${font.weight} ${size}px ${font.display}`;
    ctx.letterSpacing = `${font.tracking * size}px`;
    ctx.fillText(ln, tx, heroTop + size * 0.85 + i * size * 0.98 + rise(0.08 + i * 0.07));
  });
  let y = heroTop + lines.length * size * 0.98 + H * 0.03;

  // sub copy
  const sub = cfg.sub || {
    store: 'Small-batch goods, made by hand. Free shipping over $60.',
    portfolio: 'Selected work, 2019 — now. Available for commissions.',
    app: 'Plan, track and celebrate the small wins. Free on iOS & Android.',
    website: 'Roasted on site every morning. Open 7am – 4pm, every day.',
  }[cfg.type];
  ctx.globalAlpha = e(0.25);
  ctx.font = `400 ${H * 0.026}px ${font.body}`;
  ctx.letterSpacing = '0px';
  ctx.fillStyle = pal.muted;
  const subLines = wrap(ctx, sub, layout === 'split' ? W * 0.38 : W * 0.5);
  subLines.forEach((ln, i) => ctx.fillText(ln, tx, y + H * 0.03 + i * H * 0.036 + rise(0.25)));
  y += H * 0.03 + subLines.length * H * 0.036 + H * 0.03;

  // buttons
  const btnLabels = cfg.btns || { store: ['Shop the drop', 'Our story'], portfolio: ['See the work', 'Get in touch'], app: ['Download', 'See features'], website: ['View menu', 'Directions'] }[cfg.type];
  if (narrow) {
    // stacked, full-width mobile buttons
    const bh2 = H * 0.045, bw2 = W - pad * 2;
    ctx.globalAlpha = e(0.32);
    rr(ctx, pad, y + rise(0.32), bw2, bh2, Math.min(r, bh2 / 2), pal.accent);
    ctx.strokeStyle = pal.ink; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.roundRect(pad, y + bh2 + H * 0.012 + rise(0.32), bw2, bh2, Math.min(r, bh2 / 2)); ctx.stroke();
    ctx.font = `600 ${H * 0.019}px ${font.body}`;
    ctx.letterSpacing = '0px';
    ctx.textAlign = 'center';
    ctx.fillStyle = luminance(pal.accent) > 0.5 ? (luminance(pal.bg) < 0.5 ? pal.bg : pal.ink) : '#ffffff';
    ctx.fillText(btnLabels[0], W / 2, y + bh2 * 0.64 + rise(0.32));
    ctx.fillStyle = pal.ink;
    ctx.fillText(btnLabels[1], W / 2, y + bh2 * 1.64 + H * 0.012 + rise(0.32));
    ctx.textAlign = 'left';
    ctx.globalAlpha = 1;
    y += bh2 * 2 + H * 0.05;
    paintVisual(ctx, cfg, { x: pad, y: Math.min(y, H * 0.72), w: W - pad * 2, h: H - Math.min(y, H * 0.72) - H * 0.03 }, pal, font, r, t, amp, e, 'centered');
    ctx.restore();
    return;
  }
  const bh = H * 0.065, bw = W * 0.15;
  const bx = layout === 'centered' ? W / 2 - bw - W * 0.008 : pad;
  ctx.globalAlpha = e(0.32);
  const pulse = 1 + Math.sin(t * 2.2) * 0.012 * amp;
  ctx.save();
  ctx.translate(bx + bw / 2, y + bh / 2 + rise(0.32));
  ctx.scale(pulse, pulse);
  rr(ctx, -bw / 2, -bh / 2, bw, bh, r, pal.accent);
  ctx.restore();
  ctx.strokeStyle = pal.ink;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.roundRect(bx + bw + W * 0.016, y + rise(0.32), bw, bh, Math.min(r, bh / 2));
  ctx.stroke();
  ctx.font = `600 ${H * 0.024}px ${font.body}`;
  ctx.textAlign = 'center';
  ctx.fillStyle = luminance(pal.accent) > 0.5 ? (luminance(pal.bg) < 0.5 ? pal.bg : pal.ink) : '#ffffff';
  ctx.fillText(btnLabels[0], bx + bw / 2, y + bh * 0.62 + rise(0.32));
  ctx.fillStyle = pal.ink;
  ctx.fillText(btnLabels[1], bx + bw * 1.5 + W * 0.016, y + bh * 0.62 + rise(0.32));
  ctx.textAlign = 'left';
  ctx.globalAlpha = 1;
  y += bh + H * 0.05;

  // ---- visual block
  let vx, vy, vw, vh;
  if (layout === 'split') {
    vx = W * 0.54; vy = navY + H * 0.07; vw = W - vx - pad; vh = H - vy - H * 0.06;
  } else {
    vx = pad; vy = Math.min(y, H * 0.7); vw = W - pad * 2; vh = H - vy - H * 0.04;
  }
  paintVisual(ctx, cfg, { x: vx, y: vy, w: vw, h: vh }, pal, font, r, t, amp, e, layout);

  ctx.restore();
}

function paintVisual(ctx, cfg, b, pal, font, r, t, amp, e, layout) {
  const type = cfg.type;
  const float = (i) => Math.sin(t * 1.4 + i * 1.3) * 6 * amp;
  const horizontal = layout !== 'split';

  if (type === 'store') {
    const n = 3;
    const gap = b.w * 0.04;
    const cols = horizontal ? n : 2;
    const cw = (b.w - gap * (cols - 1)) / cols;
    const ch = horizontal ? b.h : (b.h - gap) / 2;
    const items = cfg.items || [['Ash vase', '$48'], ['Dune mug', '$26'], ['Tide bowl', '$34'], ['Moon plate', '$30']];
    const count = horizontal ? 3 : 4;
    for (let i = 0; i < count; i++) {
      const cx = b.x + (i % cols) * (cw + gap);
      const cy = b.y + Math.floor(i / cols) * (ch + gap) + (1 - e(0.3 + i * 0.08)) * 60;
      ctx.globalAlpha = e(0.3 + i * 0.08);
      rr(ctx, cx, cy, cw, ch, r, pal.surface);
      // product form (simple ceramic silhouettes = UI product shots)
      const px = cx + cw / 2, py = cy + ch * 0.42 + float(i);
      const s = Math.min(cw, ch) * 0.22;
      ctx.fillStyle = i % 2 ? pal.accent : pal.ink;
      ctx.beginPath();
      if (i === 0) { ctx.ellipse(px, py + s * 0.3, s * 0.75, s, 0, 0, Math.PI * 2); ctx.fill(); rr(ctx, px - s * 0.25, py - s * 1.2, s * 0.5, s * 0.6, s * 0.1, ctx.fillStyle); }
      else if (i === 1) { rr(ctx, px - s * 0.7, py - s * 0.7, s * 1.4, s * 1.5, s * 0.25, ctx.fillStyle); ctx.lineWidth = s * 0.18; ctx.strokeStyle = ctx.fillStyle; ctx.beginPath(); ctx.arc(px + s * 0.8, py, s * 0.42, -1.2, 1.2); ctx.stroke(); }
      else if (i === 2) { ctx.ellipse(px, py, s * 1.1, s * 0.55, 0, 0, Math.PI); ctx.fill(); rr(ctx, px - s * 1.1, py - s * 0.08, s * 2.2, s * 0.16, 4, ctx.fillStyle); }
      else { ctx.ellipse(px, py, s * 1.05, s * 0.32, 0, 0, Math.PI * 2); ctx.fill(); }
      ctx.fillStyle = pal.ink;
      ctx.font = `600 ${Math.max(14, ch * 0.075)}px ${font.body}`;
      ctx.letterSpacing = '0px';
      ctx.fillText(items[i][0], cx + cw * 0.08, cy + ch * 0.86);
      ctx.fillStyle = pal.muted;
      ctx.textAlign = 'right';
      ctx.fillText(items[i][1], cx + cw * 0.92, cy + ch * 0.86);
      ctx.textAlign = 'left';
      if (i === 0) {
        rr(ctx, cx + cw * 0.08, cy + ch * 0.08, cw * 0.32, ch * 0.09, r * 0.6, pal.accent);
        ctx.fillStyle = '#fff';
        ctx.font = `700 ${Math.max(11, ch * 0.05)}px ${font.body}`;
        ctx.fillText('NEW DROP', cx + cw * 0.11, cy + ch * 0.145);
      }
    }
    ctx.globalAlpha = 1;
    return;
  }

  if (type === 'portfolio') {
    const tiles = horizontal ? [[0, 0, 0.42, 1], [0.44, 0, 0.27, 1], [0.73, 0, 0.27, 1]] : [[0, 0, 0.58, 0.58], [0.6, 0, 0.4, 0.58], [0, 0.6, 0.4, 0.4], [0.42, 0.6, 0.58, 0.4]];
    const labels = cfg.tiles || ['Salt Flats', 'Night Market', 'Concrete Bloom', 'Northern Light'];
    tiles.forEach(([x, y, w, h], i) => {
      const tx = b.x + x * b.w, ty = b.y + y * b.h + (1 - e(0.3 + i * 0.08)) * 50;
      const tw = w * b.w, th = h * b.h;
      ctx.globalAlpha = e(0.3 + i * 0.08);
      const g = ctx.createLinearGradient(tx, ty, tx + tw, ty + th);
      const shift = (Math.sin(t * 0.6 + i) * 0.5 + 0.5) * 0.25 * amp;
      g.addColorStop(0, i % 2 ? pal.accent2 : pal.accent);
      g.addColorStop(Math.min(0.95, 0.55 + shift), pal.surface);
      g.addColorStop(1, pal.ink);
      rr(ctx, tx, ty, tw, th, r, g);
      ctx.fillStyle = '#ffffff';
      ctx.font = `${font.weight} ${Math.max(14, th * 0.09)}px ${font.display}`;
      ctx.fillText(labels[i], tx + tw * 0.06, ty + th - th * 0.08);
    });
    ctx.globalAlpha = 1;
    return;
  }

  if (type === 'app') {
    // phone mock
    const ph = Math.min(b.h, horizontal ? b.h : b.h * 1.0);
    const pw = ph * 0.5;
    const px = horizontal ? b.x + b.w / 2 - pw / 2 : b.x + b.w / 2 - pw / 2;
    const py = b.y + float(0) + (1 - e(0.3)) * 80;
    ctx.globalAlpha = e(0.3);
    rr(ctx, px, py, pw, ph * (horizontal ? 1.6 : 1), pw * 0.16, pal.ink);
    const sx = px + pw * 0.05, sy = py + pw * 0.05, sw = pw * 0.9, sh = ph * (horizontal ? 1.6 : 1) - pw * 0.1;
    rr(ctx, sx, sy, sw, sh, pw * 0.12, pal.bg);
    // ring
    const cx = sx + sw / 2, cy = sy + sh * 0.2, rad = sw * 0.22;
    ctx.lineWidth = sw * 0.06;
    ctx.strokeStyle = pal.surface;
    ctx.beginPath(); ctx.arc(cx, cy, rad, 0, Math.PI * 2); ctx.stroke();
    ctx.strokeStyle = pal.accent;
    ctx.lineCap = 'round';
    const prog = 0.62 + Math.sin(t * 0.9) * 0.08 * amp;
    ctx.beginPath(); ctx.arc(cx, cy, rad, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * prog); ctx.stroke();
    ctx.fillStyle = pal.ink;
    ctx.textAlign = 'center';
    ctx.font = `${font.weight} ${sw * 0.12}px ${font.display}`;
    ctx.fillText(`${Math.round(prog * 100)}%`, cx, cy + sw * 0.04);
    ctx.textAlign = 'left';
    for (let i = 0; i < 4; i++) {
      const ry = sy + sh * 0.4 + i * sh * 0.13 + (1 - e(0.4 + i * 0.07)) * 30;
      ctx.globalAlpha = e(0.4 + i * 0.07);
      rr(ctx, sx + sw * 0.08, ry, sw * 0.84, sh * 0.1, Math.min(r, 18), pal.surface);
      rr(ctx, sx + sw * 0.13, ry + sh * 0.025, sh * 0.05, sh * 0.05, sh * 0.025, [pal.accent, pal.accent2, pal.ink, pal.muted][i]);
      rr(ctx, sx + sw * 0.13 + sh * 0.07, ry + sh * 0.035, sw * (0.3 + (i % 2) * 0.15), sh * 0.03, 6, pal.muted);
    }
    // side cards when wide
    if (!horizontal || true) {
      const cards = (cfg.cards || ['7-day streak', '+12 min focus']).map((l, i) => [l, i ? pal.accent2 : pal.accent]);
      cards.forEach(([label, c], i) => {
        const cxp = i === 0 ? px - pw * 0.75 : px + pw * 0.95;
        const cyp = py + ph * (0.25 + i * 0.35) + float(i + 2);
        ctx.globalAlpha = e(0.55 + i * 0.1);
        rr(ctx, cxp, cyp, pw * 0.8, ph * 0.12, Math.min(r, 20), pal.surface);
        rr(ctx, cxp + pw * 0.06, cyp + ph * 0.03, ph * 0.06, ph * 0.06, ph * 0.03, c);
        ctx.fillStyle = pal.ink;
        ctx.font = `600 ${ph * 0.035}px ${font.body}`;
        ctx.fillText(label, cxp + pw * 0.06 + ph * 0.08, cyp + ph * 0.073);
      });
    }
    ctx.globalAlpha = 1;
    return;
  }

  // website (local business / landing)
  const feats = cfg.feats || [['Today’s roast', 'Ethiopia Guji, washed'], ['Open now', 'Until 4pm · 2 min walk'], ['Order ahead', 'Skip the line']];
  const cols = horizontal ? 3 : 1;
  const gap = b.w * 0.03;
  const cw = (b.w - gap * (cols - 1)) / cols;
  const ch = horizontal ? b.h : (b.h - gap * 2) / 3;
  feats.forEach(([h1, h2], i) => {
    const cx = b.x + (horizontal ? i * (cw + gap) : 0);
    const cy = b.y + (horizontal ? 0 : i * (ch + gap)) + (1 - e(0.3 + i * 0.08)) * 50 + float(i) * 0.5;
    ctx.globalAlpha = e(0.3 + i * 0.08);
    rr(ctx, cx, cy, cw, ch, r, i === 0 ? pal.accent : pal.surface);
    const ink = i === 0 ? '#ffffff' : pal.ink;
    ctx.fillStyle = ink;
    const fs = Math.max(16, Math.min(ch * 0.2, cw * 0.09));
    ctx.font = `${font.weight} ${fs}px ${font.display}`;
    ctx.fillText(h1, cx + cw * 0.07, cy + ch * 0.45);
    ctx.font = `400 ${fs * 0.62}px ${font.body}`;
    ctx.globalAlpha *= 0.8;
    ctx.fillText(h2, cx + cw * 0.07, cy + ch * 0.45 + fs * 1.1);
    // little arrow
    ctx.globalAlpha = e(0.3 + i * 0.08);
    ctx.beginPath();
    ctx.arc(cx + cw * 0.88, cy + ch * 0.32, fs * 0.6, 0, Math.PI * 2);
    ctx.strokeStyle = ink;
    ctx.lineWidth = 2;
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(cx + cw * 0.88 - fs * 0.22, cy + ch * 0.32 + fs * 0.22);
    ctx.lineTo(cx + cw * 0.88 + fs * 0.22, cy + ch * 0.32 - fs * 0.22);
    ctx.moveTo(cx + cw * 0.88 - fs * 0.05, cy + ch * 0.32 - fs * 0.22);
    ctx.lineTo(cx + cw * 0.88 + fs * 0.22, cy + ch * 0.32 - fs * 0.22);
    ctx.lineTo(cx + cw * 0.88 + fs * 0.22, cy + ch * 0.32 + fs * 0.05);
    ctx.stroke();
  });
  ctx.globalAlpha = 1;
}

// ---------------------------------------------------------------------------
// Small screens that live on the island (store sign, gallery frames, phone).
// ---------------------------------------------------------------------------
export function paintStoreSign(ctx, W, H, t) {
  ctx.fillStyle = '#07090c';
  ctx.fillRect(0, 0, W, H);
  ctx.font = `500 ${H * 0.58}px "JetBrains Mono Variable", monospace`;
  ctx.letterSpacing = `${H * 0.08}px`;
  ctx.textBaseline = 'middle';
  const msg = 'NEW COLLECTION — AUTUMN EDIT — FREE SHIPPING — ';
  const mw = ctx.measureText(msg).width;
  const off = (t * 70) % mw;
  ctx.fillStyle = '#efe6d4';
  for (let x = -off; x < W; x += mw) ctx.fillText(msg, x, H * 0.54);
  // LED grid
  ctx.fillStyle = 'rgba(0,0,0,0.35)';
  for (let x = 0; x < W; x += 6) ctx.fillRect(x, 0, 2, H);
  for (let y = 0; y < H; y += 6) ctx.fillRect(0, y, W, 2);
}

export function paintPhoneApp(ctx, W, H, t) {
  const pal = PALETTES.glacier;
  ctx.fillStyle = pal.bg;
  ctx.fillRect(0, 0, W, H);
  ctx.fillStyle = pal.ink;
  ctx.font = `700 ${W * 0.1}px "Bricolage Grotesque Variable", sans-serif`;
  ctx.letterSpacing = `${-W * 0.004}px`;
  ctx.textBaseline = 'alphabetic';
  ctx.fillText('Today', W * 0.08, H * 0.1);
  const scroll = (t * 40) % (H * 0.14);
  for (let i = 0; i < 9; i++) {
    const y = H * 0.15 + i * H * 0.14 - scroll;
    if (y > H) break;
    rr(ctx, W * 0.07, y, W * 0.86, H * 0.115, W * 0.06, i % 3 === 0 ? pal.accent : pal.surface);
    rr(ctx, W * 0.12, y + H * 0.03, H * 0.055, H * 0.055, H * 0.028, i % 3 === 0 ? '#fff' : pal.accent2);
    rr(ctx, W * 0.12 + H * 0.075, y + H * 0.035, W * (0.35 + (i % 2) * 0.15), H * 0.018, 6, i % 3 === 0 ? 'rgba(255,255,255,.85)' : pal.ink);
    rr(ctx, W * 0.12 + H * 0.075, y + H * 0.065, W * 0.28, H * 0.014, 6, i % 3 === 0 ? 'rgba(255,255,255,.55)' : pal.muted);
  }
  // tab bar
  rr(ctx, W * 0.07, H * 0.9, W * 0.86, H * 0.07, H * 0.035, pal.ink);
  for (let i = 0; i < 4; i++) rr(ctx, W * (0.18 + i * 0.2), H * 0.925, H * 0.02, H * 0.02, H * 0.01, i === 0 ? pal.accent2 : '#fff');
}
