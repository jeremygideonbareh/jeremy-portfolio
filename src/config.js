// ---------------------------------------------------------------------------
// Site content in one place. Edit these to make the portfolio yours.
// ---------------------------------------------------------------------------

export const SITE = {
  name: 'Jeremy',
  // TODO(owner): set your real inbox — used by "Start a project" and "Send this brief".
  email: 'hello@example.com',
  // TODO(owner): paste a form endpoint (e.g. https://formspree.io/f/xxxxxx) to receive entries
  // without the visitor's email app. Leave empty to fall back to a pre-filled email.
  formEndpoint: '',
  // TODO(owner): your profiles, e.g. [['Instagram', 'https://instagram.com/you'], ['LinkedIn', 'https://linkedin.com/in/you']]
  socials: [],
  timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
};

// Palettes for the configurator (and the concept builds in the reel).
export const PALETTES = {
  stone:   { label: 'Stone',   bg: '#ebe7e0', surface: '#dcd6cc', ink: '#16171a', muted: '#6f6a62', accent: '#2f3b4a', accent2: '#9fb0c2' },
  glacier: { label: 'Glacier', bg: '#eef3f6', surface: '#d9e3ea', ink: '#0d1620', muted: '#5b6b78', accent: '#3b5a78', accent2: '#a9c1d6' },
  moss:    { label: 'Moss',    bg: '#eceee6', surface: '#d9ddcd', ink: '#141a12', muted: '#646b5c', accent: '#3e5240', accent2: '#a7b39a' },
  noir:    { label: 'Noir',    bg: '#0c0d10', surface: '#181a1f', ink: '#e8e4dc', muted: '#8a8d96', accent: '#c9d4df', accent2: '#5d6b80' },
  rose:    { label: 'Rose',    bg: '#f2ebe8', surface: '#e3d5d0', ink: '#251718', muted: '#86706c', accent: '#6e3a3c', accent2: '#c7a7a3' },
  night:   { label: 'Night',   bg: '#11151d', surface: '#1c2330', ink: '#e8e4dc', muted: '#8d97a8', accent: '#e6d8bf', accent2: '#7f93ad' },
};

export const FONTS = {
  grotesk: { label: 'Grotesk', display: '"Bricolage Grotesque Variable", system-ui, sans-serif', body: '"Bricolage Grotesque Variable", system-ui, sans-serif', weight: 700, tracking: -0.04 },
  serif:   { label: 'Serif',   display: '"Instrument Serif", Georgia, serif', body: '"Bricolage Grotesque Variable", system-ui, sans-serif', weight: 400, tracking: -0.02 },
  mono:    { label: 'Mono',    display: '"JetBrains Mono Variable", ui-monospace, monospace', body: '"JetBrains Mono Variable", ui-monospace, monospace', weight: 700, tracking: -0.05 },
};

export const DEFAULT_HEADLINES = {
  store: 'Made slowly. Shipped fast.',
  portfolio: 'Work that speaks first.',
  app: 'Your day, beautifully sorted.',
  website: 'The coffee your street deserves.',
};

export const DEFAULT_CONFIG = {
  type: 'store',
  name: 'Kiln & Co.',
  headline: '',
  palette: 'stone',
  font: 'grotesk',
  layout: 'split',
  radius: 14,
  motion: 'lively',
  photos: ['/images/kiln-1.webp', '/images/kiln-2.webp', '/images/kiln-3.webp', '/images/kiln-4.webp'],
};

// Concept builds for the reel. Replace with real client launches as they ship:
// keep `concept: true` only for self-initiated work.
// Each concept has its own copy, products and personality so no two read alike.
export const PROJECTS = [
  { title: 'Kiln & Co.', kind: 'Online store', year: '2026', concept: true, summary: 'Ceramics shop with drop-day countdowns and a one-page checkout.',
    cfg: { type: 'store', name: 'Kiln & Co.', palette: 'stone', font: 'serif', layout: 'split', radius: 18, motion: 'lively', headline: 'Made slowly. Shipped fast.', photos: ['/images/kiln-1.webp', '/images/kiln-2.webp', '/images/kiln-3.webp', '/images/kiln-4.webp'] } },
  { title: 'Ines Duarte', kind: 'Portfolio', year: '2026', concept: true, summary: 'Photographer portfolio where every series opens like a book.',
    cfg: { type: 'portfolio', name: 'Ines Duarte', palette: 'noir', font: 'serif', layout: 'editorial', radius: 4, motion: 'calm', headline: 'Light, kept.', sub: 'Photographs from the Atlantic coast, 2019 — now.', tiles: ['Low Tide', 'The Pier', 'Coast Road', 'Under the Bridge'], btns: ['View series', 'Book a shoot'], photos: ['/images/ines-1.webp', '/images/ines-2.webp', '/images/ines-3.webp', '/images/ines-4.webp'] } },
  { title: 'Tidepool', kind: 'Mobile app', year: '2026', concept: true, summary: 'Habit app with streaks that grow a tiny reef as you go.',
    cfg: { type: 'app', name: 'Tidepool', palette: 'glacier', font: 'grotesk', layout: 'split', radius: 26, motion: 'max', headline: 'Grow a reef, one habit at a time.', cards: ['Reef level 4', '+12 min focus'] } },
  { title: 'Northline Coffee', kind: 'Website', year: '2026', concept: true, summary: 'Neighbourhood roaster site with live menu and map.',
    cfg: { type: 'website', name: 'Northline', palette: 'moss', font: 'grotesk', layout: 'centered', radius: 12, motion: 'lively', headline: 'The coffee your street deserves.', photos: ['/images/northline-1.webp'] } },
  { title: 'Studio Rhea', kind: 'Portfolio', year: '2026', concept: true, summary: 'Architecture studio site with plan-to-photo case studies.',
    cfg: { type: 'portfolio', name: 'Studio Rhea', palette: 'glacier', font: 'mono', layout: 'split', radius: 0, motion: 'calm', headline: 'Plans that become places.', sub: 'Architecture & interiors. Lisbon / Porto.', tiles: ['Concrete Passage', 'Hangar 7', 'The Brick Hall', 'Chapel Retrofit'], btns: ['Projects', 'Studio'], links: ['Projects', 'Studio', 'Contact'], photos: ['/images/rhea-1.webp', '/images/rhea-2.webp', '/images/rhea-3.webp', '/images/rhea-4.webp'] } },
  { title: 'Bloom Supply', kind: 'Online store', year: '2026', concept: true, summary: 'Plant shop with a care-guide quiz that builds your cart.',
    cfg: { type: 'store', name: 'Bloom Supply', palette: 'rose', font: 'grotesk', layout: 'centered', radius: 28, motion: 'max', headline: 'Plants that suit your light.', sub: 'Take the 30-second quiz. We’ll fill your cart.', items: [['Glasshouse kit', '$38'], ['Pilea', '$22'], ['Willow cuttings', '$45'], ['Olive tree', '$64']], btns: ['Take the quiz', 'Shop all'], photos: ['/images/bloom-1.webp', '/images/bloom-2.webp', '/images/bloom-3.webp', '/images/bloom-4.webp'] } },
];
