# Design

The person using Tray is an undergrad holding a phone in one hand, standing in
the serving line at Chase or Lenoir, deciding what goes on the tray. The screen
has one job: show what's out right now, let them tap to add it, show the running
total. Every decision below follows from that.

Tokens live in `src/app/globals.css`. Components use token names — no raw hex
anywhere outside that file.

## Color

One accent, and it is Carolina blue — `#4b9cd3`, the university colour, the
same value in both modes. It carries exactly four things: the active tab
underline, the quantity stepper, focus rings, and the "serving now" dot. If it
starts appearing anywhere else, that's a bug, not a style.

Navy `#13294b` is the other half of the pair, and it is the body text. Every
grey below is mixed from that hue rather than being neutral. That hue shift is
what makes the app read as UNC without turning it blue.

| Token | Light | Dark |
|---|---|---|
| `--bg` | `#f5f7fa` | `#0a0f1a` |
| `--surface` | `#ffffff` | `#0a0f1a` |
| `--surface-alt` | `#edf1f6` | `#0e1522` |
| `--border` | `#e2e8f0` | `#1b2536` |
| `--border-soft` | `#edf1f6` | `#161f2e` |
| `--border-strong` | `#c6d0de` | `#28344a` |
| `--text` | `#13294b` | `#eaf0f7` |
| `--text-mid` | `#3d5175` | `#c7d3e1` |
| `--text-muted` | `#4f6079` | `#93a3ba` |
| `--text-faint` | `#5a6b85` | `#7c8eab` |
| `--accent` | `#4b9cd3` | `#4b9cd3` |
| `--accent-fg` | `#13294b` | `#0a2b45` |
| `--accent-text` | `#2e7baf` | `#4b9cd3` |
| `--row-active` | `#f0f7fc` | `#0e1725` |
| `--danger` | `#a8221b` | `#f0897f` |
| `--danger-bg` | `#f6e3e1` | `#2a1518` |

Four of these need explaining.

**Carolina is a fill, not a colour for text.** On white it measures 3.00:1 —
that is the ceiling, not a near miss, and against any off-white ground it is
lower. So in light mode it never carries text or a small label: it is the
stepper's background, the tab underline, the focus ring and the dot, and navy
sits *on top* of it at 4.84:1. In dark mode it is 6.38:1 on the ground and is
safe as text, which is why `--accent-text` differs between modes when `--accent`
does not.

**`--accent-text` has exactly one job**, the active tab bar item, and it is the
one place light mode needs blue text. `#2e7baf` is 4.60:1 on `--surface`. It is
4.28:1 on `--bg`, which is why that pairing does not exist — the tab bar is a
surface.

**Why `--surface` equals `--bg` in dark.** There is no lift to be had from a
near-black on a near-black. What separates the list from the bars in dark mode
is `--surface-alt` plus a hairline, not a surface colour. In light mode the
distinction is real: rows are white, the page and the section bands are tinted.

**Four greys, not two.** `--text` is the item name, `--text-mid` is a quiet
control, `--text-muted` is a secondary line, `--text-faint` is the dietary tags
and the section counts.

**All four clear 4.5:1**, which puts them closer together than a grey ladder
usually is — 7.98 / 6.40 / 5.42 on white. That is the point. The row's hierarchy
used to be carried by fading text out until it stopped being readable; it is now
carried by **weight and size**, and the greys only have to say "secondary", not
"ignore me". The tags line in particular went from 2.82:1 to 5.42:1, and it says
Vegan / Halal / No gluten — information people choose food by.

### Verified, not eyeballed

`npm run check-contrast` checks every foreground/background pair against WCAG AA
in both modes and exits non-zero on failure. Run it after touching a token.

**Two pairings are deliberately below threshold**, and the script prints their
real ratios on every run rather than omitting them:

| Pairing | Light | Dark | Why |
|---|---|---|---|
| `accent fill on row-active` | 2.78 | passes | the stepper pill |
| `border-strong on surface` | 1.56 | 1.53 | the quantity-0 ghost button |

Both have the same defence: the thing that identifies the control clears the bar
even though its fill or outline does not. The stepper pill carries its count in
navy at 4.84:1, and the ghost button's `+` glyph is `--text-mid` at 8:1.

**Three more used to sit in this table** — the tags line and the muted labels, at
2.49–4.03:1, kept because the screens were being matched to a reference. They
were the ones with no such defence, and they now pass outright. A passing pair
left listed as exempt is worse than no exemption at all: it hides that the
shortfall was fixed. Delete them when they pass.

Never add an exemption without a reason a reader can weigh.

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
| `wordmark` | 28 / 32 | 700 | −0.03em |
| `placard` | 12 / 16 | 600 | +0.08em, uppercase |
| `section-label` | 11 / 15 | 600 | +0.07em, uppercase |
| `text-input` | 16 / 24 | 400–600 | — |
| `text-body` | 15 / 20 | 400–500 | — |
| `text-row` | 14 / 20 | 400 | — |
| `text-sm` | 13 / 18 | 400 | — |
| `text-meta` | 12 / 16 | 400–500 | — |
| `text-micro` | 11 / 15 | 400–600 | — |
| `text-total` | 20 / 24 | 500 | tabular |
| `text-data-lg` | 22 / 24 | 600 | tabular |
| `text-data-xl` | 34 / 36 | 600 | tabular |

The menu row is `text-row` for the name and the calories, `text-micro` for the
tags beneath. **The name and the calories are 600; the tags are 400.** Both used
to be 400 — the two things you actually look at were the lightest text in the
row, while the section label above them was 600, and the list read thin as a
result.

Weight is the hierarchy now, not contrast. That let every grey move up to clear
4.5:1 without the row losing its shape.

Weight is *not* used to signal state. The calorie figure used to go 600 when
logged, but only in light mode, so the same state looked different in the two
themes. Logged is the row tint plus the accent colour, in both.

`.data` carries `letter-spacing: -0.01em`. Tabular figures are wide by
construction and a column of them reads as a row of glyphs otherwise. It also
buys real room: `1940` — the largest calorie count UNC publishes — measures
exactly 34px, which is the width of the column it has to fit in.

Inputs are 16px because anything smaller makes iOS zoom the page when the field
takes focus. **The search field is the one place that breaks the row's 14px
rhythm for that reason**, and it is deliberate: a page that jumps on focus is a
worse defect than one control a pixel larger than its neighbours.

`.section-label` exists alongside `.placard` rather than replacing it: the
station header is 11px at 0.07em, while the tray sheet and the log's meal
headings are still 12px at 0.08em.

The previous pass had **thirteen** distinct size utilities, six of them one-offs
like `text-[0.9375rem]` and `text-[13px]`. Components now use these names.

**The one exception is `nutrition-label.tsx`**, which deliberately opts out. An
FDA panel has its own typographic rules — 13px rows, an oversized calorie
figure, 8px and 4px rules — and the point is that it reads as the artifact
people already know how to scan. Matching our scale there would make it merely a
table.

## Layout

- **Container `max-w-[640px]`, centred**, on the masthead, list, tray bar and
  tab bar. Before this the list ran the full viewport, so an item name sat on
  the far left and its calorie count on the far right with nothing between
  them. This was the single worst problem in the old UI.
- **Fixed bars are full-bleed outside, centred inside.** The rule and the
  surface span the window; the content sits in the same 640px column as
  everything above it. The tab bar used to be a bare `grid-cols-2` across the
  viewport, so on a wide screen its two labels sat at 25% and 75% — nowhere
  near the content they navigate.
- **`scrollbar-gutter: stable` on `html`.** Without it a classic scrollbar
  takes ~15px off the layout viewport, `mx-auto` recentres the column in what's
  left, and the centred content drifts ~7px left of the fixed bars — which
  position against the initial containing block and don't move. The drift
  appeared and vanished with the length of the menu.
- **Optical margins are symmetric.** Edge controls pull out by `-ml-2` and
  `-mr-2`. They used to be `-ml-2.5` against `-mr-2`, so every row with a
  control at both ends sat 2px further left than right.
- **Rows are 11px of padding around their content**, which lands at 60px with a
  tags line and 42px without. The row no longer sizes itself around a 44px
  button, because the button is 27px — see below.
- Spacing on a 4px scale. Radius: 4 small, 8 medium, 14 stepper pill, 16 sheet.
- **Hairlines are 0.5px** (`.hairline-t` / `.hairline-b` / `.hairline-row`). A
  true hairline on a 2× screen, rounding to 1px on a 1× one. A 1px rule between
  every row is visibly heavy on the phone this is designed for.
- One breakpoint, `sm:`, and it only centres sheets on wide screens. The search
  field used to collapse below it; it doesn't any more.

Three fixed zones per row, left to right: name with its tags underneath, then
calories in a fixed 34px column so `15` and `480` line up, then the stepper.

**The tags are a line, not badges.** `Vegan · Halal · No gluten` at 11px in
`--text-faint`, omitted entirely when an item has none. They were bordered
`VG` / `GF` / `H` boxes, and because nearly every UNC item carries at least one,
a boxed glyph on every row became the loudest thing on screen while telling you
almost nothing — the signal is the rare item that *lacks* a tag. Spelled out,
too: `V` and `VG` differ by one character and mean quite different things.

**A row with something on it tints edge to edge.** `--row-active`, bled past the
list's own padding with `-mx-4 px-4`, and the calorie figure changes colour. That
row-level state is what makes "what's already on my tray" scannable while you're
still browsing, without reading a single number.

**The masthead is three rows, not five.** The venue is the `<h1>` and the other
venue sits beside it as a link, so the switcher costs nothing. Service hours
live in the status line under the meal tabs, which also says whether the period
you're looking at is the one being served.

## The tray bar

**This is the signature element, and the one place the design is allowed to be
loud.** Everything around it is hairlines and a single accent.

It's a slim sticky bar above the tab bar carrying what's on the tray right now,
that opens the day's items as a sheet. It's grounded in the literal object the
student is holding, and it's what makes this a tracker rather than a menu page.

Two lines on the left — `4 items on tray`, then **which meal period the tray
belongs to** — and the total on the right at 20px mono. The period line is not
decoration: adds go to the period you are browsing, so without it the number is
ambiguous the moment you step to another tab. You cannot tell whether 840 is
lunch or the whole day. It's derived from the entries already in hand via
`groupByMealPeriod`, so it costs no query.

In dark mode the bar is `--surface-alt`, because `--surface` equals `--bg` there
and a plain surface would leave it floating on a hairline.

**It expands into the real `Sheet`, at the peek snap point.** It used to be a
bare `div` with `max-h-[45vh] overflow-y-auto` and no scrim, no rounded top, no
handle and no title — so whatever row landed on the boundary was sliced in half
and the whole thing read as a rendering bug rather than a panel. Peek shows the
total; a drag brings up the list.

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
  mount effect — see `use-hydrated.ts` and `station-prefs.ts`. React's lint rules reject the effect version, and the
  store version has a real server snapshot instead of a guess.
- **Search, filters and sort live in the URL**, mirrored with
  `window.history.replaceState` so they're shareable and refresh-safe without a
  server round-trip on every keystroke. Filtering and sorting stay client-side
  and instant.
- **Sorting by calories flattens the stations.** `applySort` collapses
  everything into one list, because once you are ranking by a number, station
  boundaries stop meaning anything — keeping them would give you twenty-two
  separately-sorted lists rather than one answer to "what's light here".
  Unknown calories sort last in both directions: an unknown is not a low
  number, and treating null as zero would bury the actual lightest things.
- **Station collapse is stored as overrides**, not as the full closed set, so
  `stationsToCollapse()` keeps making the call for stations the user has never
  touched — including ones that appear on a menu for the first time.
- **Icons are hand-rolled SVG** in `ui/icons.tsx`. Fifteen glyphs, one stroke
  width, one grid. An icon package would be the largest dependency in the
  project.
- **Touch targets are 44px even where controls are 27px.** `QuantityStepper`
  gets there with a `before:` inset overlay, not padding — padding would widen
  the control and shove the calorie column sideways as rows change state.
  Verified by hit-testing ±21px from the centre, not by reading the CSS.
- **Meal-period times are normalised at the boundary.** `menu_periods.start_time`
  is a Postgres `time`, so Supabase returns `"15:00:00"` while everything here
  compares against `campusTimeOfDay()`, which is `"15:00"`. `"15:00" >=
  "15:00:00"` is *false* as a string comparison, so a period read straight from
  the database didn't count as started until a minute after it started. `toHHMM`
  in `dates.ts` fixes it once, in `getMealPeriods`. The unit tests never caught
  it because their fixtures were already in `HH:MM` — there are now cases in
  the database's own shape.
- **There is one `Sheet`, and now that is literally true.** It owns focus trap,
  Escape, scroll-lock, the safe-area inset, the scrim, the handle and the two
  snap points. The tray was the last surface still hand-rolling a panel; it
  isn't any more.
- **`Sheet` holds `onClose` in a ref.** Every call site passes an inline arrow,
  so it changes identity on every render. When the effect depended on it, a
  `router.refresh()` after logging food tore the effect down, re-ran it, and
  yanked focus back to the close button mid-interaction.
- **One line per tray slot.** `(user, service_date, recipe, meal_period, hall)`
  is unique in the database, and `logFood` increments the matching row rather
  than inserting. Quick-add used to INSERT on every tap, so eating fourteen of
  something wrote fourteen rows. `servings` had been on the table since the
  first migration the whole time.
- **Undo restores, it doesn't delete.** An add increments an existing line, so
  deleting the row would take back every helping logged earlier rather than the
  one tap being undone. `logFood` returns `previousServings` for exactly this,
  and `restoreLog` puts a swiped-away entry back with its original snapshots —
  re-logging would take a fresh reading UNC may have revised since.

## What has no test coverage

All 103 tests are pure logic in `src/lib`, and `vitest.config.mts` uses
`environment: 'node'` with a `*.test.ts` glob — `.tsx` isn't matched. **Nothing
in this document is protected by a test.** The suite staying green proves the
data layer is untouched; it proves nothing about the UI. Check visually, in both
modes, at 375px and on desktop.
