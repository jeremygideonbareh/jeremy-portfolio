// ---------------------------------------------------------------------------
// Site content in one place. Edit these to make the portfolio yours.
// ---------------------------------------------------------------------------

export const SITE = {
  name: 'Jeremy',
  // Inbox for "Start a project", "Send this brief" and "Copy the address".
  email: 'cloudlyconfusing@gmail.com',
  timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
};

// Palettes for the configurator.
export const PALETTES = {
  ember:   { label: 'Ember',   bg: '#fff4ec', surface: '#ffe3d1', ink: '#1d130e', muted: '#8a6a5a', accent: '#ff5a1f', accent2: '#ffb38a' },
  glacier: { label: 'Glacier', bg: '#eef6fb', surface: '#d6e9f5', ink: '#0d1b2a', muted: '#5b7387', accent: '#2f7cf6', accent2: '#9fd8ff' },
  moss:    { label: 'Moss',    bg: '#f1f3ea', surface: '#dfe6cf', ink: '#17200f', muted: '#66705a', accent: '#3c7a4a', accent2: '#c8d96f' },
  noir:    { label: 'Noir',    bg: '#0e0d12', surface: '#1c1a24', ink: '#f3eee6', muted: '#8f8a9c', accent: '#d7ff3a', accent2: '#6d5cff' },
  candy:   { label: 'Candy',   bg: '#fff0f6', surface: '#ffd6ea', ink: '#2a0f22', muted: '#9a5f84', accent: '#ff3d9a', accent2: '#7a5cff' },
  dusk:    { label: 'Dusk',    bg: '#1a1630', surface: '#2a2350', ink: '#f6efe6', muted: '#a49ccc', accent: '#ff8a5c', accent2: '#9fd8ff' },
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
  palette: 'ember',
  font: 'grotesk',
  layout: 'split',
  radius: 14,
  motion: 'lively',
};

// The reel lists real launches from WORK in ../../src/config.js (shared with Track Day).
