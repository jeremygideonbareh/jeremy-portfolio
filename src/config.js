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

// Palettes for the configurator.
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

// Real launches, all live on GitHub Pages. `repo` is the Pages path under PAGES_HOST;
// `shot` lives in public/images/work/<shot>.webp (and <shot>-m.webp for the featured phone shots).
// `featured` builds run in the speed run and on the podium; their `cfg` is the closest pit-stop
// setup, so visitors can start their own build from that style.
// `concept: true` marks self-initiated demos (per the repo description).
export const PAGES_HOST = 'https://jeremygideonbareh.github.io';

export const WORK = [
  { repo: 'the-ark-music-shillong', line: 'Music classes, Shillong', shot: 'the-ark-music-shillong', title: 'The ARK Music', kind: 'Music school', year: '2026', featured: true,
    summary: 'Motion-led site for a Shillong music school — singing, piano, guitar and violin, with admissions up front.',
    cfg: { type: 'website', name: 'The ARK', palette: 'stone', font: 'grotesk', layout: 'split', radius: 18, motion: 'max', headline: 'Inspiring musicians, one note at a time.' } },
  { repo: 'meghalaya-mun', line: 'Model UN conference', shot: 'meghalaya-mun', title: 'Meghalaya MUN', kind: 'Event site', year: '2026', featured: true,
    summary: 'Cinematic site for the 7th international Shillong edition of Meghalaya Model United Nations.',
    cfg: { type: 'website', name: 'MMUN', palette: 'night', font: 'grotesk', layout: 'split', radius: 14, motion: 'max', headline: 'Meghalaya Model United Nations.' } },
  { repo: 'robert-junior-patisserie', line: 'Pastries via WhatsApp', shot: 'robert-junior-patisserie', title: 'Robert Junior', kind: 'Pâtisserie', year: '2026', featured: true, concept: true,
    summary: 'Illustrated pâtisserie site with Three.js and Blender touches, and orders straight to WhatsApp.',
    cfg: { type: 'store', name: 'Robert Junior', palette: 'rose', font: 'serif', layout: 'split', radius: 6, motion: 'lively', headline: 'Good day? Pastries.' } },
  { repo: 'ri-and-last', line: 'Handwoven Eri silk', shot: 'ri-and-last', title: 'Ri & Last', kind: 'Online store', year: '2026', featured: true,
    summary: 'Handwoven Eri silk from Khweng, Meghalaya — slow, textile-first storytelling and a collection to shop.',
    cfg: { type: 'store', name: 'Ri & Last', palette: 'noir', font: 'serif', layout: 'editorial', radius: 22, motion: 'calm', headline: 'Woven slowly, in the hills of Khweng.' } },
  { repo: 'artha-equities', line: 'Portfolio diagnostics', shot: 'artha-equities', title: 'Artha Equities', kind: 'Fintech site', year: '2026', featured: true, concept: true,
    summary: 'Research-house site that turns a holdings statement into a clear, readable diagnostic.',
    cfg: { type: 'website', name: 'Artha', palette: 'night', font: 'serif', layout: 'split', radius: 8, motion: 'calm', headline: 'Know what you own.' } },
  { repo: 'dream_craft', line: 'Handmade invitations', shot: 'dream-craft', title: 'Mynséra', kind: 'Online store', year: '2026', featured: true,
    summary: 'Handmade invitations, florals and keepsakes from Shillong, with a quote in about two minutes.',
    cfg: { type: 'store', name: 'Mynséra', palette: 'rose', font: 'serif', layout: 'split', radius: 28, motion: 'lively', headline: 'Invitations, florals & keepsakes made by hand.' } },
  { repo: 'gb-the-baby-spot', line: 'Kids wear & toys', shot: 'gb-the-baby-spot', title: 'G.B The Baby Spot', kind: 'Online store', year: '2026', featured: true,
    summary: 'Kids wear, toys and accessories in Shillong, ordered over WhatsApp with home delivery.',
    cfg: { type: 'store', name: 'G.B The Baby Spot', palette: 'stone', font: 'serif', layout: 'split', radius: 24, motion: 'lively', headline: 'Everything your little one needs.' } },
  { repo: 'kiki-garod-portfolio', line: 'Filmmaker portfolio', shot: 'kiki-garod-portfolio', title: 'Kiki Garod', kind: 'Portfolio', year: '2026', featured: true,
    summary: 'Dark, cinematic portfolio for an award-winning filmmaker and storyteller.',
    cfg: { type: 'portfolio', name: 'Kiki Garod', palette: 'noir', font: 'grotesk', layout: 'editorial', radius: 2, motion: 'calm', headline: 'Filmmaker. Storyteller.' } },
  { repo: 'paws-for-change-india', shot: 'paws-for-change-india', title: 'Paws for Change', kind: 'NGO site', year: '2026', summary: 'Rescue & adoption NGO' },
  { repo: 'pet-grooming-website-', shot: 'pet-grooming-website', title: 'A-1 Enterprises', kind: 'Business site', year: '2026', summary: 'Pet care & grooming, Shillong' },
  { repo: '-gntschoolofphotography', shot: 'gntschoolofphotography', title: 'GNT School of Photography', kind: 'Course site', year: '2026', summary: 'Batches, fees, enrolment' },
  { repo: 'gntportraits', shot: 'gntportraits', title: 'Glorianatasha', kind: 'Portfolio', year: '2026', summary: 'Portrait photographer' },
  { repo: 'JMJ-Events-Interiors-', shot: 'jmj-events-interiors', title: 'JMJ Events & Interiors', kind: 'Business site', year: '2026', summary: 'Weddings & interiors, Bangalore' },
  { repo: 'beenabakehouse', shot: 'beenabakehouse', title: 'Beena’s Bake House', kind: 'Bakery site', year: '2026', summary: 'Homemade cakes since 2000' },
  { repo: 'irene-bakery', shot: 'irene-bakery', title: 'Irene Bakes', kind: 'Bakery site', year: '2026', summary: 'Cakes & pastries, Shillong' },
  { repo: 'chelsea-man-spa-mobile', shot: 'chelsea-man-spa-mobile', title: 'Chelsea Man Spa', kind: 'Mobile app', year: '2026', summary: 'Booking app · Google sign-in' },
  { repo: 'FLY-OUTLANDISH-TUITION-CENTRE-', shot: 'fly-outlandish-tuition-centre', title: 'Fly Outlandish', kind: 'Tuition site', year: '2026', summary: 'Maths & sciences, Tura' },
  { repo: 'virtual-tapes-acoustics', shot: 'virtual-tapes-acoustics', title: 'Virtual Tapes', kind: 'Business site', year: '2026', summary: 'Architectural acoustics' },
  { repo: 'aliquot-lab-manager', shot: 'aliquot-lab-manager', title: 'Aliquot', kind: 'Web app', year: '2026', summary: 'Chemistry lab manager' },
  { repo: 'resume-analyser', shot: 'resume-analyser', title: 'ResumeLab', kind: 'Web app', year: '2026', summary: 'In-browser ATS scoring' },
  { repo: 'buccaneer-dash', shot: 'buccaneer-dash', title: 'Buccaneer Dash', kind: 'Browser game', year: '2026', summary: 'Three.js pirate racer' },
  { repo: 'gym_website', shot: 'gym-website', title: 'FitForge Pro', kind: 'Website', year: '2026', summary: 'Fitness coaching' },
  { repo: 'barber-shop-demo', shot: 'barber-shop-demo', title: 'Orthon Barber House', kind: 'Website', year: '2026', concept: true, summary: 'Barber booking, Athens' },
].map((w) => ({ ...w, url: `${PAGES_HOST}/${w.repo}/` }));
