// ─────────────────────────────────────────────────────────────────────────────
// Illuminated Codex — shared theme tokens for the Blessed TUI.
//
// Parallels src/ui/ink/theme.js but exports plain JS values (no React, no
// terminal-specific escape codes). Blessed uses 256-color names / hex /
// RGB triples. We standardize on blessed's named colors where possible so
// the palette stays portable across terminals.
// ─────────────────────────────────────────────────────────────────────────────

export const C = {
  parchment: '#f0dcb0',
  parchmentDim: '#cdb98a',
  vellum: '#e7cf9d',
  shadow: '#2b1e10',

  ink: '#1a0f08',
  inkSoft: '#3a261a',

  gold: '#d4a017',
  goldBright: '#f5c542',
  goldDeep: '#8a6610',

  burgundy: '#7b1e2a',
  burgundyBright: '#b83244',
  oxblood: '#5a0f1a',

  forest: '#2d5a3a',
  forestBright: '#4a8a5a',
  moss: '#6b8e3d',

  midnight: '#1c2a4a',
  midnightBright: '#3c5a8a',
  sapphire: '#2a4a8a',

  crimson: '#c0392b',
  amber: '#e08530',
  bronze: '#a06a30',

  mute: '#7a6a4a',
  danger: '#c0392b',
  success: '#4a8a5a',
  warn: '#e08530',
  info: '#5a8acc',
};

// Border styles blessed understands. We pick round (parchment-friendly) by
// default and double for the welcome screen / overlays (more imposing).
export const BORDERS = {
  round: 'round',
  double: 'double',
  heavy: 'heavy',
  single: 'line',
  none: 'bg',
};

// Biome glyph + color used by the world map.
export const BIOME = {
  grass:        { glyph: ',', fg: '#4a8a5a', bg: '#1a2e1f' },
  forest:       { glyph: 'T', fg: '#2d5a3a', bg: '#0f1f14' },
  dense_forest: { glyph: '♣', fg: '#1a4029', bg: '#0a1a10' },
  jungle:       { glyph: '♝', fg: '#3a6a30', bg: '#102010' },
  taiga:        { glyph: 'τ', fg: '#5a8a4a', bg: '#1a2a1a' },
  water:        { glyph: '~', fg: '#3c5a8a', bg: '#10182a' },
  deep_water:   { glyph: '≈', fg: '#1c4a8a', bg: '#0a142a' },
  mountain:     { glyph: '^', fg: '#a0a0a0', bg: '#2a2a2a' },
  snow:         { glyph: '·', fg: '#e0e0e0', bg: '#3a3a4a' },
  desert:       { glyph: '.', fg: '#e0c070', bg: '#3a2810' },
  swamp:        { glyph: '≈', fg: '#4a6a4a', bg: '#1a201a' },
  tundra:       { glyph: '_', fg: '#b0b0b0', bg: '#2a2a2a' },
  beach:        { glyph: '·', fg: '#e0c898', bg: '#3a2818' },
  settlement:   { glyph: '#', fg: '#f5c542', bg: '#5a0f1a' },
  player:       { glyph: '@', fg: '#f5c542', bg: '#7b1e2a' },
  unknown:      { glyph: '?', fg: '#7a6a4a', bg: '#1a0f08' },
};

// Item category colors used by the inventory panel.
export const ITEM_CATEGORY = {
  food: '#4a8a5a',
  tool: '#5a8acc',
  weapon: '#c0392b',
  armor: '#b83244',
  clothing: '#b83244',
  material: '#cdb98a',
  consumable: '#6b4a8a',
  container: '#a06a30',
  document: '#d4a017',
  vehicle: '#a06a30',
  mount: '#a06a30',
};

// Slot glyphs used by the equipment panel.
export const SLOT_GLYPH = {
  weapon: '⚔',
  armor: '◈',
  helmet: '♔',
  boots: '✦',
  ring: '◯',
  amulet: '☩',
  cloak: '◑',
  gloves: '⊕',
};

// Ornamental glyphs reused across headers, dividers, and icons.
export const G = {
  fleur: '⚜',
  spark: '✦',
  star: '✧',
  cross: '☩',
  flower: '❀',
  leaf: '❦',
  crown: '♕',
  crownHeavy: '♛',
  sword: '⚔',
  shield: '◈',
  sun: '☀',
  moon: '☾',
  snow: '❄',
  fire: '🜂',
  water: '🜄',
  air: '🜁',
  earth: '🜃',
  skull: '☠',
  bolt: '⚡',
  eye: '◉',
  heart: '♥',
  heartEmpty: '♡',
  bag: '🎒',
  coin: '⛁',
  quill: '✒',
  scroll: '📜',
  book: '📖',
  castle: '⌂',
  tower: '⛫',
  hammer: '⚒',
  arrowR: '▸',
  arrowL: '◂',
  arrowU: '▴',
  arrowD: '▾',
  check: '✓',
  x: '✗',
  bullet: '◆',
  smallBullet: '▪',
  ellipsis: '…',
  em: '—',
  en: '–',
  at: '@',
  hash: '#',
  diamond: '◈',
};

// ASCII progress bar. value in [0,1], len in cells. Returns a string with no
// ANSI codes so the caller can wrap it in blessed tags (e.g. {green-fg}...).
export function bar(value, len = 15, fill = '█', empty = '░') {
  const v = Math.max(0, Math.min(1, Number.isFinite(value) ? value : 0));
  const filled = Math.floor(v * len);
  return '[' + fill.repeat(filled) + empty.repeat(len - filled) + ']';
}

export function barUnfilled(value, len = 15) {
  const v = Math.max(0, Math.min(1, Number.isFinite(value) ? value : 0));
  const filled = Math.floor(v * len);
  const empty = len - filled;
  return { filled, empty };
}

// Pick a color tag for a normalized value. >0.6 green, 0.3-0.6 yellow, <0.3 red.
// (inverse=true flips: low value = red, high value = green.)
export function colorTagFor(value, { inverse = false } = {}) {
  const v = inverse ? 1 - value : value;
  if (v > 0.6) return 'good';
  if (v > 0.3) return 'warn';
  return 'bad';
}

export const COLOR_TAG = {
  good: '{#4a8a5a-fg}',
  bad: '{#c0392b-fg}',
  warn: '{#e08530-fg}',
  info: '{#5a8acc-fg}',
  mute: '{#7a6a4a-fg}',
  gold: '{#f5c542-fg}',
  goldDeep: '{#8a6610-fg}',
  burgundy: '{#b83244-fg}',
  parchment: '{#f0dcb0-fg}',
  parchmentDim: '{#cdb98a-fg}',
  ink: '{#1a0f08-fg}',
};

export function tagFor(name) {
  return COLOR_TAG[name] || '';
}

// ASCII art title block used by the welcome screen. 7 lines, centered.
// Sized to fit within ~46 columns (bordered by ╔/╚).
export const WELCOME_ART = [
  '╔════════════════════════════════════════════╗',
  '║                                            ║',
  '║   ⚜  M E D I E V A L   L I F E  ⚜         ║',
  '║                                            ║',
  '║        A Chronicle of an Age               ║',
  '║                                            ║',
  '╚════════════════════════════════════════════╝',
];

export const WELCOME_LORE = [
  'In an age of sword and superstition, your story begins.',
  'A single life — birth, love, hunger, faith, war, death, heir.',
  'Will your line endure?',
];

// Compact, narrow-terminal fallback (≤70 cols).
export const WELCOME_ART_COMPACT = [
  '┌──────────────────────────────────────┐',
  '│  ◆  M E D I E V A L   L I F E   ◆   │',
  '│       A Chronicle of an Age          │',
  '└──────────────────────────────────────┘',
];

// Format in-game turn as HH:MM (24h). kernel.turn counts hours.
export function formatGameTime(turn) {
  const hoursPerDay = 24;
  const day = Math.floor(turn / hoursPerDay) + 1;
  const hour = ((turn % hoursPerDay) + hoursPerDay) % hoursPerDay;
  const hh = String(hour).padStart(2, '0');
  const mm = String(0).padStart(2, '0');
  return { hh, mm, day, hour };
}

// Build a timestamp prefix for log lines.
export function timestamp(turn) {
  const t = formatGameTime(turn);
  return `{${C.mute}-fg}${t.hh}:${t.mm}{/}`;
}
