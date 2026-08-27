/**
 * Verifies every foreground/background pair in the palette, both modes.
 *
 * The palette in globals.css was derived by running this, not by eye. If you
 * change a token, run `npm run check-contrast` before you commit — a value
 * that looks fine on your monitor is not the same as one that passes.
 *
 * Thresholds are WCAG 2.1 AA: 4.5:1 for body text, 3:1 for large text and for
 * the boundary of a control that conveys state.
 */

type Level = 'text' | 'ui';

interface Pair {
  name: string;
  fg: string;
  bg: string;
  level: Level;
}

const LIGHT = {
  bg: '#f5f7f8',
  surface: '#ffffff',
  border: '#e2e6e9',
  borderStrong: '#83909d',
  text: '#101418',
  textMuted: '#5b6772',
  accent: '#3e95cc',
  accentFg: '#0b1620',
  accentText: '#0b6fa8',
  danger: '#a8221b',
  dangerBg: '#f7e5e3',
};

const DARK = {
  bg: '#0d1117',
  surface: '#151b23',
  border: '#232b35',
  borderStrong: '#5c6975',
  text: '#e6eaee',
  textMuted: '#97a3af',
  accent: '#4b9cd3',
  accentFg: '#08111a',
  accentText: '#7fbee8',
  danger: '#f0897f',
  dangerBg: '#2c1513',
};

function luminance(hex: string): number {
  const h = hex.replace('#', '');
  const channels = [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16) / 255);
  const [r, g, b] = channels.map((c) =>
    c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4,
  );
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

function ratio(a: string, b: string): number {
  const [x, y] = [luminance(a), luminance(b)];
  return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05);
}

function pairs(t: typeof LIGHT): Pair[] {
  return [
    { name: 'text on bg', fg: t.text, bg: t.bg, level: 'text' },
    { name: 'text on surface', fg: t.text, bg: t.surface, level: 'text' },
    { name: 'muted on bg', fg: t.textMuted, bg: t.bg, level: 'text' },
    { name: 'muted on surface', fg: t.textMuted, bg: t.surface, level: 'text' },
    { name: 'accent-text on bg', fg: t.accentText, bg: t.bg, level: 'text' },
    { name: 'accent-text on surface', fg: t.accentText, bg: t.surface, level: 'text' },
    { name: 'accent-fg on accent', fg: t.accentFg, bg: t.accent, level: 'text' },
    { name: 'danger on bg', fg: t.danger, bg: t.bg, level: 'text' },
    { name: 'danger on danger-bg', fg: t.danger, bg: t.dangerBg, level: 'text' },
    // Control boundaries and fills: 3:1 against whatever sits behind them.
    { name: 'border-strong on bg', fg: t.borderStrong, bg: t.bg, level: 'ui' },
    { name: 'border-strong on surface', fg: t.borderStrong, bg: t.surface, level: 'ui' },
    { name: 'accent fill on bg', fg: t.accent, bg: t.bg, level: 'ui' },
    { name: 'accent fill on surface', fg: t.accent, bg: t.surface, level: 'ui' },
  ];
}

let failed = 0;

for (const [mode, tokens] of [
  ['light', LIGHT],
  ['dark', DARK],
] as const) {
  console.log(`\n${mode}`);
  for (const pair of pairs(tokens)) {
    const min = pair.level === 'text' ? 4.5 : 3;
    const value = ratio(pair.fg, pair.bg);
    const ok = value >= min;
    if (!ok) failed++;
    console.log(
      `  ${ok ? 'pass' : 'FAIL'}  ${pair.name.padEnd(24)} ${value.toFixed(2)}:1  (needs ${min}:1)`,
    );
  }
}

if (failed > 0) {
  console.error(`\n${failed} pair(s) below threshold.`);
  process.exit(1);
}
console.log('\nAll pairs pass.');
