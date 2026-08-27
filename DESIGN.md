# Design

The person using Tray is an undergrad holding a phone in one hand, standing in
the serving line at Chase or Lenoir, deciding what goes on the tray. The screen
has one job: show what's out right now, let them tap to add it, show the running
total. Every decision below follows from that.

Tokens live in `src/app/globals.css`. Components use token names — no raw hex
anywhere outside that file.

## Color

One accent, and it is Carolina blue. It carries exactly four things: the active
tab, the add button's filled state, focus rings, and the tray total. If it
starts appearing anywhere else, that's a bug, not a style.

| Token | Light | Dark |
|---|---|---|
| `--bg` | `#f5f7f8` | `#0d1117` |
| `--surface` | `#ffffff` | `#151b23` |
| `--border` | `#e2e6e9` | `#232b35` |
| `--border-strong` | `#83909d` | `#5c6975` |
| `--text` | `#101418` | `#e6eaee` |
| `--text-muted` | `#5b6772` | `#97a3af` |
| `--accent` | `#3e95cc` | `#4b9cd3` |
| `--accent-fg` | `#0b1620` | `#08111a` |
| `--accent-text` | `#0b6fa8` | `#7fbee8` |
| `--danger` | `#a8221b` | `#f0897f` |
| `--danger-bg` | `#f7e5e3` | `#2c1513` |

Three of these need explaining.

**Why two border tokens.** One value cannot be both an invisible hairline
between list rows and the 3:1 boundary of a control that conveys state.
`--border` is decorative and deliberately faint; `--border-strong` is for
anything you can operate.

**Why two accent tokens.** Carolina blue at full strength is `#4b9cd3`, which
measures 2.6:1 on white — fine as a fill, unreadable as text. `--accent` is the
fill, `--accent-text` is the same hue pushed dark enough to read. Still one
accent hue.

**Why `--accent-fg` is near-black in both modes.** White text on light-mode
Carolina is 3.29:1, which fails. The alternative to dark text would be
darkening the fill until white works, and by then it isn't Carolina any more —
it's generic corporate navy. Dark-on-Carolina keeps the school colour actually
looking like the school colour.

Carolina also does **not** invert between modes. The previous palette flipped
its brand colour from near-black navy to pale blue depending on the OS setting,
which meant the primary button was a different colour in each mode.

### Verified, not eyeballed

`npm run check-contrast` checks all 26 foreground/background pairs against WCAG
AA in both modes and exits non-zero on failure. Run it after touching a token.

The lowest passing margins are `--border-strong` (3.03:1 light) and the accent
fill on `--bg` (3.07:1 light). Both are deliberately near the floor — pushing
them higher makes hairlines look like borders and Carolina look like navy. They
have no headroom, so re-run the check rather than nudging them by eye.

For reference, the token this replaced measured **2.67:1** and carried the
dietary tags on nearly every row.

## Type

**Geist** for everything, **Geist Mono** for every figure the reader compares to
another figure — calories, the tray total, dates, counts — with
`font-variant-numeric: tabular-nums` so a column of numbers lines up as the
digits change.

A third display face was considered and cut. Geist at 600 with −0.02em tracking
does the wordmark, and a third family is the accessory to take off before
leaving the house.

| Role | Size / line-height | Weight | Tracking |
|---|---|---|---|
| `wordmark` | 28 / 32 | 600 | −0.02em |
| `placard` | 12 / 16 | 600 | +0.08em, uppercase |
| `text-input` | 16 / 24 | 400–600 | — |
| `text-body` | 15 / 20 | 400–500 | — |
| `text-meta` | 12 / 16 | 400–500 | — |
| `text-data-lg` | 22 / 24 | 600 | tabular |
| `text-data-xl` | 34 / 36 | 600 | tabular |

Inputs are 16px because anything smaller makes iOS zoom the page when the field
takes focus.

The previous pass had **thirteen** distinct size utilities, six of them one-offs
like `text-[0.9375rem]` and `text-[13px]`. Components now use these names.

**The one exception is `nutrition-label.tsx`**, which deliberately opts out. An
FDA panel has its own typographic rules — 13px rows, an oversized calorie
figure, 8px and 4px rules — and the point is that it reads as the artifact
people already know how to scan. Matching our scale there would make it merely a
table.

## Layout

- **Container `max-w-[640px]`, centred**, on the masthead, list, and tray bar.
  Before this the list ran the full viewport, so an item name sat on the far
  left and its calorie count on the far right with nothing between them. This
  was the single worst problem in the old UI.
- **Rows are 56px**: `py-1.5` around a 44px button. The touch target sets the
  floor and is not negotiable; the padding is what got tightened.
- Spacing on a 4px scale. Radius: 4 small, 8 medium, 16 sheet, full on the add
  button.
- One breakpoint, `sm:`, for centring sheets on wide screens.

Three fixed zones per row, left to right: name, dietary glyphs, then calories
and the add button in a column that never moves.

Dietary properties are `VG` / `GF` / `H` glyphs in a muted neutral, not four
full words in a coloured gray. The full word still reaches screen readers
through `aria-label`. Vegan suppresses vegetarian — the scraper tags both, and
`VG V` on one row is the kind of redundancy that teaches people to stop reading
badges entirely.

## The tray bar

**This is the signature element, and the one place the design is allowed to be
loud.** Everything around it is hairlines and a single accent.

It's a slim sticky bar above the tab bar carrying what's on the tray right now —
`3 items · 720 cal` — that expands in place to show the day's items. It's
grounded in the literal object the student is holding, and it's what makes this
a tracker rather than a menu page.

Two consequences worth recording:

**The tab bar gave up its calorie count.** It used to carry the day's total as a
10px subtitle on the Log tab, in the faintest grey in the palette — least
prominent exactly when you were on the menu screen and most needed it. Two
running totals on one screen is one too many, so the number now lives in exactly
one place, at a size you can read while walking.

**`quickAdd` must call `router.refresh()`.** The total is resolved in
`layout.tsx`, so without it the tray bar keeps showing the pre-add number until
you navigate. This was a latent bug before; the tray bar makes it fatal, because
displaying that number is the element's whole job.

## Motion

150–200ms, `cubic-bezier(0.2, 0, 0, 1)`, transform and opacity only, so nothing
triggers layout. Four moments, all earning their place: the segmented-control
indicator translating between tabs, the add button's pop on confirm, sheets
sliding up, the tray expanding.

**framer-motion was not added.** The indicator is a translated element and the
rest are CSS transitions. The brief said to add it only if genuinely used, and
this app otherwise has no UI dependencies at all.

Everything animated is behind `motion-safe:`, on top of the global
`prefers-reduced-motion` block — which now also zeroes `animation-delay` and
`transition-delay`, which it previously missed.

## Theming

`next-themes` on the `class` strategy, with a two-state toggle: light or dark,
nothing else.

**The toggle shows its destination, not its state.** A sun while you're dark, a
moon while you're light. The three-state cycle it replaced had to show the
current mode instead — with light → dark → system you couldn't predict a tap
without knowing the order — and it made getting from light to system a two-tap
trip through a mode you didn't want. Two states need no such knowledge.

**`defaultTheme="system"` stays anyway.** System isn't a mode here, it's the
value before a choice exists: a first-time visitor gets the theme their OS is
set to, and the first tap pins light or dark for good. Removing `enableSystem`
would land everyone on light regardless of how their machine is configured. The
toggle therefore reads `resolvedTheme`, never `theme` — the latter is still the
string `"system"` until that first tap.

Two traps, both handled:

**`viewport.themeColor` follows the OS, not the class.** Media-query
`themeColor` is right before hydration and wrong the moment someone uses the
toggle. `ThemeColorMeta` in `theme-provider.tsx` renders the tag itself, so it
re-renders with the theme like any other component. Two earlier attempts to
patch Next's own tags from an effect both failed — the reasons are recorded in
the comment above that component.

**`color-scheme` was never set.** Without it, native scrollbars, number
spinners, and the search field's clear button render in light chrome on a dark
page. It's now set per mode on `<html>`.

The no-flash script lands 77 characters into `<body>`, before any content.

## Conventions

- **Client-only reads go through `useSyncExternalStore`**, not a `setState` in a
  mount effect — see `use-hydrated.ts` and `station-prefs.ts`. React's lint
  rules reject the effect version, and the store version has a real server
  snapshot instead of a guess.
- **Search and filters live in the URL**, mirrored with
  `window.history.replaceState` so they're shareable and refresh-safe without a
  server round-trip on every keystroke. Filtering itself stays client-side and
  instant.
- **Station collapse is stored as overrides**, not as the full closed set, so
  `stationsToCollapse()` keeps making the call for stations the user has never
  touched — including ones that appear on a menu for the first time.
- **Icons are hand-rolled SVG** in `ui/icons.tsx`. Ten glyphs, one stroke
  width, one grid. An icon package would be the largest dependency in the
  project.
- **There is one `Sheet`.** It owns focus trap, Escape, scroll-lock, and the
  safe-area inset. The two dialogs it replaced each implemented some of that and
  neither trapped focus.

## What has no test coverage

All 69 tests are pure logic in `src/lib`, and `vitest.config.mts` uses
`environment: 'node'` with a `*.test.ts` glob — `.tsx` isn't matched. **Nothing
in this document is protected by a test.** The suite staying green proves the
data layer is untouched; it proves nothing about the UI. Check visually, in both
modes, at 375px and on desktop.
