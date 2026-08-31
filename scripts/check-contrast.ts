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
  /**
   * Why this pair is allowed to sit below its threshold.
   *
   * An exempt pair still computes and prints its real ratio — it just doesn't
   * fail the build. This exists so a deliberate shortfall is recorded in the
   * output every time the script runs, rather than deleted from the list and
   * forgotten. Never add one without a reason a reader can weigh.
   */
  exempt?: string;
}

const LIGHT = {
  bg: '#f5f7fa',
  surface: '#ffffff',
  surfaceAlt: '#edf1f6',
  sectionBg: '#d8e1ed',
  border: '#e2e8f0',
  borderSoft: '#edf1f6',
  borderStrong: '#c6d0de',
  text: '#13294b',
  textMid: '#3d5175',
  textMuted: '#4f6079',
  textFaint: '#5a6b85',
  accent: '#4b9cd3',
  accentFg: '#13294b',
  accentText: '#2e7baf',
  rowActive: '#f0f7fc',
  macroCarb: '#0c7568',
  macroFat: '#7b3fb5',
  macroProtein: '#a85f10',
  danger: '#a8221b',
  dangerBg: '#f6e3e1',
};

const DARK = {
  bg: '#0a0f1a',
  surface: '#0a0f1a',
  surfaceAlt: '#0e1522',
  sectionBg: '#1e293f',
  border: '#1b2536',
  borderSoft: '#161f2e',
  borderStrong: '#28344a',
  text: '#eaf0f7',
  textMid: '#c7d3e1',
  textMuted: '#93a3ba',
  textFaint: '#7c8eab',
  accent: '#4b9cd3',
  accentFg: '#0a2b45',
  accentText: '#4b9cd3',
  rowActive: '#0e1725',
  macroCarb: '#3fd0bd',
  macroFat: '#b98ae8',
  macroProtein: '#f0a44a',
  danger: '#f0897f',
  dangerBg: '#2a1518',
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
    { name: 'text on row-active', fg: t.text, bg: t.rowActive, level: 'text' },
    { name: 'text-mid on surface', fg: t.textMid, bg: t.surface, level: 'text' },
    { name: 'text-mid on surface-alt', fg: t.textMid, bg: t.surfaceAlt, level: 'text' },
    // The station header band. The label and the count both sit on it, and it
    // is the one ground in the app whose whole job is to be distinguishable.
    { name: 'text on section-bg', fg: t.text, bg: t.sectionBg, level: 'text' },
    { name: 'text-mid on section-bg', fg: t.textMid, bg: t.sectionBg, level: 'text' },
    { name: 'text-muted on surface', fg: t.textMuted, bg: t.surface, level: 'text' },
    { name: 'text-faint on surface', fg: t.textFaint, bg: t.surface, level: 'text' },
    { name: 'text-faint on surface-alt', fg: t.textFaint, bg: t.surfaceAlt, level: 'text' },
    { name: 'text-faint on row-active', fg: t.textFaint, bg: t.rowActive, level: 'text' },
    // accent-text has two jobs: the active tab bar item and the tray total.
    // The tab bar is
    // --surface, so that is the pairing checked. On --bg it measures 4.28:1,
    // which is why the design confines blue text to the bar.
    { name: 'accent-text on surface', fg: t.accentText, bg: t.surface, level: 'text' },
    { name: 'accent-fg on accent', fg: t.accentFg, bg: t.accent, level: 'text' },
    // The macro rings and their labels, on the card they sit in. Checked at
    // the 4.5:1 text bar rather than the 3:1 arc bar, because each label is
    // tinted to match its ring — one value has to serve both jobs.
    { name: 'macro carb on surface', fg: t.macroCarb, bg: t.surface, level: 'text' },
    { name: 'macro fat on surface', fg: t.macroFat, bg: t.surface, level: 'text' },
    { name: 'macro protein on surface', fg: t.macroProtein, bg: t.surface, level: 'text' },
    { name: 'danger on bg', fg: t.danger, bg: t.bg, level: 'text' },
    { name: 'danger on danger-bg', fg: t.danger, bg: t.dangerBg, level: 'text' },

    // Control boundaries and fills: 3:1 against whatever sits behind them.
    { name: 'accent fill on surface', fg: t.accent, bg: t.surface, level: 'ui' },
    //
    // The tray bar's ground is --surface-alt, and two things sit on it there:
    // the plate ring's arc, and the calorie total itself.
    //
    // 'ui' at 3:1 is the right bar for the arc — it is a graphic. The total is
    // text, and at 4.05:1 light it clears 3:1 but not 4.5:1. It passes because
    // 20px at weight 600 falls in WCAG's large-text band, where 3:1 applies.
    // That is the whole margin: drop the tray total below ~18px, or lighten it
    // to a normal weight, and this pairing becomes a real failure.
    { name: 'accent-text on surface-alt', fg: t.accentText, bg: t.surfaceAlt, level: 'ui' },
    { name: 'danger on surface-alt', fg: t.danger, bg: t.surfaceAlt, level: 'ui' },

    //
    // The two deliberate shortfalls.
    //
    // Both are Carolina or a hairline failing against a light ground, and in
    // both cases the thing that actually identifies the control clears the bar
    // even though its fill or outline does not. The ratios print on every run
    // so the cost stays visible.
    //
    // Three more used to live here — the tags line and the muted labels, kept
    // at the reference's values. They were the ones with no such defence, and
    // they now pass outright rather than being excused.
    //
    {
      name: 'accent fill on row-active',
      fg: t.accent,
      bg: t.rowActive,
      level: 'ui',
      exempt:
        'the stepper pill on a logged row; Carolina cannot clear 3:1 on any light ground, and the navy count on top of it does at 4.84:1',
    },
    {
      name: 'border-strong on surface',
      fg: t.borderStrong,
      bg: t.surface,
      level: 'ui',
      exempt: "the quantity-0 ghost button; its + glyph is text-mid at 8:1, so the glyph identifies the control rather than the outline",
    },
  ];
}

let failed = 0;
let exempted = 0;

for (const [mode, tokens] of [
  ['light', LIGHT],
  ['dark', DARK],
] as const) {
  console.log(`\n${mode}`);
  for (const pair of pairs(tokens)) {
    const min = pair.level === 'text' ? 4.5 : 3;
    const value = ratio(pair.fg, pair.bg);
    const ok = value >= min;

    let verdict: string;
    if (ok) {
      verdict = 'pass';
    } else if (pair.exempt) {
      verdict = 'EXMT';
      exempted++;
    } else {
      verdict = 'FAIL';
      failed++;
    }

    console.log(
      `  ${verdict}  ${pair.name.padEnd(24)} ${value.toFixed(2)}:1  (needs ${min}:1)`,
    );
  }
}

if (exempted > 0) {
  // Counted per pairing rather than per mode-and-pairing: a shortfall in one
  // mode is the same decision as a shortfall in both.
  const reasons = pairs(LIGHT).filter((p) => p.exempt);
  console.log(`\n${reasons.length} exempt pairing(s), ${exempted} shortfall(s) across both modes:`);
  for (const pair of reasons) console.log(`  ${pair.name.padEnd(24)} ${pair.exempt}`);
}

if (failed > 0) {
  console.error(`\n${failed} pair(s) below threshold.`);
  process.exit(1);
}
console.log('\nAll non-exempt pairs pass.');
