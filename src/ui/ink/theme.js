// ─────────────────────────────────────────────────────────────────────────────
// Illuminated Codex — design tokens for the Ink TUI.
//
// Aesthetic: medieval illuminated manuscript × terminal hacker.
// Palette is built around aged parchment, antique gold leaf, oxblood, ink,
// and the deep midnight blue of cathedral stained glass.
// ─────────────────────────────────────────────────────────────────────────────

export const C = {
  // Surfaces
  parchment: '#f0dcb0',
  parchmentDim: '#cdb98a',
  vellum: '#e7cf9d',
  shadow: '#2b1e10',

  // Primary ink
  ink: '#1a0f08',
  inkSoft: '#3a261a',

  // Accents
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

  // Semantic
  health: '#c0392b',
  energy: '#d4a017',
  hunger: '#e08530',
  thirst: '#3c5a8a',
  sleep: '#6b4a8a',
  social: '#b83244',
  faith: '#d4a017',

  // Feedback
  good: '#4a8a5a',
  bad: '#c0392b',
  warn: '#e08530',
  info: '#5a8acc',
  mute: '#7a6a4a',
};

// Glyphs ─ symbols with medieval resonance. Kept narrow (1 cell) where possible
// so columns align in monospace layouts.
export const G = {
  crown: '♛',
  crownLight: '♕',
  castle: '⌂',
  tower: '⛫',
  shield: '◈',
  sword: '⚔',
  axe: '🪓',
  bow: '🏹',
  skull: '☠',
  cross: '☩',
  star: '✦',
  spark: '✧',
  star6: '✶',
  snow: '❄',
  leaf: '❦',
  flower: '❀',
  sun: '☀',
  moon: '☾',
  crescent: '☽',
  fire: '🜂',
  water: '🜄',
  air: '🜁',
  earth: '🜃',
  fleur: '⚜',
  iron: '⚒',
  hammer: '⚒',
  quill: '✒',
  scroll: '📜',
  book: '📖',
  crown2: '👑',
  bag: '🎒',
  coin: '⛁',
  heart: '♥',
  heartEmpty: '♡',
  bolt: '⚡',
  eye: '◉',
  eyeEmpty: '○',
  bullet: '◆',
  smallBullet: '▪',
  dash: '─',
  pipe: '│',
  crossPipe: '┼',
  arrowR: '▸',
  arrowL: '◂',
  arrowU: '▴',
  arrowD: '▾',
  check: '✓',
  x: '✗',
  hash: '#',
  at: '@',
  ellipsis: '…',
  em: '—',
  en: '–',
  swashOpen: '❮',
  swashClose: '❯',
  diamond: '◈',
  openBox: '┌',
  closeBox: '┐',
  // Mode glyphs
  realm: '◈',
  map: '✦',
  char: '☩',
  chronicle: '✒',
  // Weather
  weatherClear: '☀',
  weatherCloud: '☁',
  weatherRain: '☂',
  weatherStorm: '⚡',
  weatherSnow: '❄',
  weatherFog: '〰',
};

// Box-drawing ornament set ─ heavy + double for outer frames, single for inner.
export const BOX = {
  // Heavy outer frame
  h: '━', v: '┃', tl: '┏', tr: '┓', bl: '┗', br: '┛', x: '╋',
  // Double inner frame
  dh: '═', dv: '║', dtl: '╔', dtr: '╗', dbl: '╚', dbr: '╝',
  // Single thin frame
  sh: '─', sv: '│', stl: '┌', str: '┐', sbl: '└', sbr: '┘',
};

// Banner art ─ figlet "small" style hand-tuned for narrow terminals.
// Each line is 64 chars wide; the banner shrinks elegantly when the terminal is narrower.
export const BANNER_LINES = [
  '  ▄▄▄▄▄▄   ▄  ▄▄    ▄▄  ▄▄▄▄▄▄▄    ▄▄▄▄▄▄▄  ▄    ▄   ▄▄▄▄   ▄▄▄▄▄▄ ',
  '  ██▀▀▀██▄ ██ ██▄  ██  ██▀▀▀▀██  ██▀▀▀▀▀   ██   ██ ▄▀   ▀█▄ ██▀▀▀██',
  '  ██    ██ ██ ██▀█▄██  ██    ██  ██        ██▀▀▀██    ▄▀█▀▀  ██   ██',
  '  ██    ██ ██ ██  ▀██  ██    ██  ██        ██▀▀▀██   ▄▀ ██   ██   ██',
  '  ██▄▄▄██▀ ██ ██   ▀██ ██▄▄▄▄██  ██▄▄▄▄▄▄  ██   ██  █▀   ▀█  ██▄▄▄██',
  '   ▀▀▀▀▀   ▀▀ ▀▀    ▀▀ ▀▀▀▀▀▀▀    ▀▀▀▀▀▀▀  ▀▀   ▀▀  ▀     ▀  ▀▀▀▀▀ ',
];

// Compact fallback banner for terminals narrower than 70 columns.
export const BANNER_COMPACT = [
  '  ◆  M E D I E V A L   L I F E   S I M  ◆  ',
];

// Castle silhouette used as right-corner ornament in the header.
export const CASTLE = [
  '      ▄▄▄▄       ',
  '     ▟█████▙      ',
  '   ▟█████████▙    ',
  '  ▟███████████▙   ',
  ' ▟█████████████▙  ',
  ' █ █ █ █ █ █ █ █  ',
  '▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄▄',
];

// Drop-cap initial letters used to illuminate section headers.
export const DROP_CAP = {
  v: ['█   ', '█▄▄ ', '█  █', '█▄▄█'],
  r: ['█▄▄  ', '█  █ ', '█▄▄▄ ', '█  █ ', '█   █'],
  m: ['█   █', '██ ██', '█ █ █', '█   █', '█   █'],
  c: [' ▄▄▄ ', '█    █', '█     ', '█    █', ' ▀▀▀ '],
  h: ['█   █', '█   █', '█▄▄▄█', '█   █', '█   █'],
};

// Section dividers with ornamental caps.
export function ornamentRule(width = 60) {
  const cap = `${G.fleur}`;
  const tail = `${G.fleur}`;
  const inner = '─'.repeat(Math.max(2, width - cap.length * 2 - tail.length));
  return `${cap}${inner}${tail}`;
}

// Colorize a bar. pct in [0,1].
export function barColor(pct) {
  if (pct < 0.25) return C.crimson;
  if (pct < 0.5) return C.amber;
  if (pct < 0.8) return C.gold;
  return C.forestBright;
}

// Render a progress bar of given width. pct in [0,1], inverse=false means
// lower is better (e.g. hunger) — color goes red when high.
export function renderBar(pct, width = 14, { inverse = false } = {}) {
  const p = Math.max(0, Math.min(1, pct));
  const filled = Math.round(p * width);
  const empty = width - filled;
  const color = inverse ? barColor(1 - p) : barColor(p);
  return { filled, empty, color, pct: p };
}

// Strip ANSI for length calculation.
export function stripAnsi(s) {
  return String(s).replace(/\x1b\[[0-9;]*m/g, '');
}

export function visibleLen(s) {
  return stripAnsi(s).length;
}

// Pad a (possibly ANSI-colored) string to a visible width.
export function pad(s, width, align = 'left') {
  const len = visibleLen(s);
  if (len >= width) return s;
  const pad = ' '.repeat(width - len);
  return align === 'left' ? s + pad : pad + s;
}

// Truncate to visible width.
export function trunc(s, width) {
  if (visibleLen(s) <= width) return s;
  const stripped = stripAnsi(s);
  if (stripped.length <= width) return s;
  return stripped.slice(0, Math.max(0, width - 1)) + G.ellipsis;
}

// Format a number with commas.
export function fmt(n) {
  if (n === undefined || n === null) return '—';
  if (typeof n !== 'number') return String(n);
  if (Math.abs(n) >= 1) return n.toLocaleString('en-US', { maximumFractionDigits: 1 });
  return n.toFixed(2);
}

// Season / weather emoji picker.
export function weatherGlyph(w) {
  if (!w) return G.weatherClear;
  const map = {
    clear: G.weatherClear,
    cloudy: G.weatherCloud,
    rain: G.weatherRain,
    storm: G.weatherStorm,
    snow: G.weatherSnow,
    fog: G.weatherFog,
    thunder: G.weatherStorm,
  };
  return map[w] || G.weatherClear;
}

export function seasonGlyph(s) {
  const m = { Spring: '❀', Summer: '☀', Autumn: '❦', Winter: '❄' };
  return m[s] || G.leaf;
}