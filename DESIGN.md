# Design

The person using Tray is an undergrad holding a phone in one hand, standing in
the serving line at Chase or Lenoir, deciding what goes on the tray. The screen
has one job: show what's out right now, let them tap to add it, show the running
total. Every decision below follows from that.

**The shape language is rounded surfaces on a tinted ground.** The menu is a
stack of cards, one per station; the two things you touch most — the tray and
the nav — float as pills over them; and selection, everywhere it appears, is a
filled pill.

This replaced an earlier pass built the opposite way, on 0.5px hairlines and
near-zero radius, where almost nothing was a card and a 2px rule under a word
carried every active state. That pass is worth naming because most of the
arguments below were first written to defend it. The reason it changed: the
reader here is one-handed and standing up, and a filled pill is a bigger, more
obvious, more thumbable target than an underline. The hairline survives in one
role — the divider *between rows inside a card* — because there the card edge
is already doing the separating and a second heavy rule would be noise.

Tokens live in `src/app/globals.css`. Components use token names — no raw hex
anywhere outside that file.

## Color

One accent, and it is Carolina blue — `#4b9cd3`, the university colour, the
same value in both modes. It carries the selected pill in every segmented
control, the selected day in the week strip, the active nav tab, the quantity
stepper, focus rings, the "serving now" dot, and the log's Calories ring. If it
starts appearing anywhere else, that's a bug, not a style.

*(This list and the one in `globals.css` disagreed for a while — that file named
the add button's fill and the tray total, this one named the stepper and the
serving-now dot, and both said "exactly four things". They are one list now.)*

**`--deep` is the second fill, and it has exactly one job**: the large pill
CTAs and the tray bar. Carolina cannot do that job in light mode — it is 3.00:1
on white, so text on it has to be navy, and a navy-on-Carolina tray bar is not
the same object as the white-on-navy one the design wants. So `--deep` is navy
`#13294b` with white on it in light. In dark a navy pill would be a hole in the
ground rather than a button, so `--deep` resolves to Carolina and `--deep-fg`
flips to navy. Same role, inverted — which is why one token pair covers both
and `check-contrast` needs only one pairing for it.

**The macros are the one sanctioned exception.** `--macro-carb`,
`--macro-fat` and `--macro-protein` are three hues that exist for one card on
`/log`, and the argument for them is narrow: three rings the reader has to tell
apart is a **categorical encoding**, and that is the single job one hue
genuinely cannot do. Three identical rings are a legend you read rather than a
picture you glance at. They are confined to that card; anywhere else they are
the same bug the paragraph above describes.

| Token | Light | on card | Dark | on card |
|---|---|---|---|---|
| `--macro-carb` | `#0c7568` | 5.59 | `#3fd0bd` | 9.00 |
| `--macro-fat` | `#7b3fb5` | 6.52 | `#b98ae8` | 6.45 |
| `--macro-protein` | `#a85f10` | 4.87 | `#f0a44a` | 8.29 |

Checked at **4.5:1**, the text bar, not the 3:1 an arc alone would need — each
label is tinted to match its ring, so one value does both jobs. These are not
the reference design's own hues: its purple is 1.81:1 on our dark card and its
orange 2.11:1 on our light one. Same hue families, re-picked per mode.

Navy `#13294b` is the other half of the pair, and it is the body text. Every
grey below is mixed from that hue rather than being neutral. That hue shift is
what makes the app read as UNC without turning it blue.

| Token | Light | Dark |
|---|---|---|
| `--bg` | `#eaf0f7` | `#060a12` |
| `--surface` | `#ffffff` | `#131b2b` |
| `--surface-alt` | `#e6ecf4` | `#1b2436` |
| `--section-bg` | `#d8e1ed` | `#263148` |
| `--border` | `#e2e8f0` | `#222d42` |
| `--border-soft` | `#edf1f6` | `#1b2536` |
| `--border-strong` | `#c6d0de` | `#33405a` |
| `--text` | `#13294b` | `#eaf0f7` |
| `--text-mid` | `#3d5175` | `#c7d3e1` |
| `--text-muted` | `#4f6079` | `#93a3ba` |
| `--text-faint` | `#5a6b85` | `#7c8eab` |
| `--accent` | `#4b9cd3` | `#4b9cd3` |
| `--accent-fg` | `#13294b` | `#0a2b45` |
| `--accent-text` | `#2e7baf` | `#4b9cd3` |
| `--deep` | `#13294b` | `#4b9cd3` |
| `--deep-fg` | `#ffffff` | `#0a2b45` |
| `--on-deep-danger` | `#ffb4a8` | `#5c0f0a` |
| `--row-active` | `#f0f7fc` | `#16203a` |
| `--danger` | `#a8221b` | `#f0897f` |
| `--danger-bg` | `#f6e3e1` | `#2a1518` |

Five of these need explaining.

**Carolina is a fill, not a colour for text.** On white it measures 3.00:1 —
that is the ceiling, not a near miss, and against any off-white ground it is
lower. So in light mode it never carries text or a small label: it is the
stepper's background, the selected pill in every switcher, the focus ring and
the dot, and navy sits *on top* of it at 4.84:1. In dark mode it is 5.74:1 on
`--surface` and safe as text, which is why `--accent-text` differs between modes
when `--accent` does not.

That property is also what makes Carolina work as a selection pill: the pill is
a fill and its label is navy, which is exactly the arrangement Carolina is good
at. It is why selection is a pill and not, say, blue text.

**`--accent-text` is the readable blue.** It is the only blue light mode can
use as text: `#2e7baf` at 4.60:1 on `--surface`. It carries the tertiary text
buttons — Retry, Clear all, Back to sign in — and the station count.

It used to carry the tray total too, on `--surface-alt`, at 4.05:1. That was
the tightest pairing in the app and it only passed on the large-text exemption,
with a note warning that shrinking the total below 18px would break it. That
whole hazard is gone: the tray total now sits on `--deep` as `--deep-fg`, at
14.52:1 light and 4.84:1 dark. It has margin at any size.

`--accent-text` is 4.28:1 on `--bg`, which is why no such pairing exists — every
place it appears as text is a card or a bar, not the page ground.

**Why the station header has its own ground.** `--section-bg` is the one band
in the app whose entire job is to be distinguishable. It used to share
`--surface-alt`, which sits **1.13:1** from the rows in light and **1.05:1** in
dark — a step you cannot see, so the header read as floating text rather than a
band. It needs a separate token because darkening the shared one drags the tray
bar with it, and the tray total is `--accent-text`, which falls to 3.80:1 on a
ground that dark. At `#d8e1ed` / `#1e293f` the step is 1.32:1 in both modes and
the label still clears 11:1.

**Why `--surface` no longer equals `--bg` in dark.** It used to, and the
argument was that there is no lift to be had from a near-black on a near-black.
That argument only held while nothing was a card. Once the menu is a stack of
them, a surface equal to the ground is not a subtle card — it is no card at all.
So `--bg` dropped to `#060a12` and `--surface` rose to `#131b2b` to open a gap.

The gap is 1.15:1, in **both** modes. That is not a contrast pair in the WCAG
sense — a card fill conveys no state and carries no text of its own — but it is
also not enough to draw an edge by itself. So neither mode relies on it:

| | draws the card edge with |
|---|---|
| light | `--shadow-card`, an ambient navy-tinted shadow |
| dark | a 1px `--border`; a soft shadow on near-black is invisible |

Both live in the `.card` class in `globals.css`, so no call site has to know
which mode it is in. `--bg` is also more tinted than it was (`#eaf0f7`, from
`#f5f7fa`) for the same reason: a white card on the old ground measured 1.07:1,
which gave the shadow nothing to land against.

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
| `border-strong on surface` | 1.56 | 1.66 | the quantity-0 ghost button |

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

**Plus Jakarta Sans, and nothing else.** A geometric sans with near-circular
bowls and a tall x-height — the same family of shape as the rounded surfaces it
sits on, which is the whole reason it replaced Geist. Weights 500/600/700/800
are loaded; nothing references anything outside that range.

**There is no second face for figures.** Geist Mono used to carry every number
the reader compares — calories, the tray total, dates, counts. It doesn't any
more, and the reasoning is worth recording because it looks like a regression:

- What actually aligns a column of calories is not the face. It is
  `font-variant-numeric: tabular-nums` plus the **fixed-width, right-aligned
  box** each figure sits in — `w-[34px]` on the menu row, `w-10` on the tray
  sheet. Both survive.
- `tabular-nums` is also what stops the tray total and the stepper count from
  reflowing as they change under your thumb. That is the failure a proportional
  face would actually cause, and it is the thing to check first if numbers
  start jittering.
- What the mono was *costing* was that every number in the app read as terminal
  output. In a design whose loudest object is a number on a pill, that is the
  wrong voice.

`.data` is therefore now just the numeric feature settings and the tracking. If
figures ever do jitter in place, pointing `.data` back at a mono is a one-line
revert and nothing else in this document depends on it.

| Role | Size / line-height | Weight | Tracking |
|---|---|---|---|
| `wordmark` | 28 / 32 | 700 | −0.02em |
| `placard` | 12 / 16 | 600 | +0.08em, uppercase |
| `section-label` | 11 / 15 | 700 | +0.07em, uppercase |
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
buys real room: `1940` — the largest calorie count UNC publishes — has to fit
the 34px column, and the tracking is what keeps it there.

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

**One station, one card.** The menu is a stack of them on a tinted ground, and
the `.card` class carries fill, radius and the per-mode edge treatment so no
call site has to think about it. The two panels on `/log` use the same class.

This inverts what this section used to say, which was "two cards, and only
two". The old argument was that a card is a container you have to justify and
rules do the job more cheaply. What it under-weighted is that a station *is* a
container — the whole menu is a list of groups — and drawing that grouping with
a sticky band and a hairline meant the reader had to infer from typography
what a card states outright.

**One detail here is load-bearing and silent if you get it wrong.** The card
needs `overflow-hidden` so the last row's active tint clips into the rounded
corner. `overflow-hidden` on an ancestor also kills `position: sticky`, and the
station header **is** sticky. So the clip goes on the `<ul>`, never on the
`<section>`:

```
<section class="card">
  <StationHead />                                    ← sticky top-0
  <ul class="overflow-hidden rounded-b-[…]"> rows </ul>
</section>
```

Put it one level up and nothing errors — the placard just quietly stops
pinning.

A collapsed station is a card containing only its header, so the header rounds
on all four corners and drops the divider it would otherwise draw against row
one. That is the `collapsed ?` branch in `StationHead`.


- **Container `max-w-[640px]`, centred**, on the masthead, list, tray bar and
  tab bar. Before this the list ran the full viewport, so an item name sat on
  the far left and its calorie count on the far right with nothing between
  them. This was the single worst problem in the old UI.
- **The two bottom bars are floating pills, 608px wide.** 608 is the content
  column's *inner* width (640 minus its 16px padding), so each pill lines up
  with the cards above it rather than with the window. They used to be
  full-bleed bars capped with hairlines; stacked, the two of them read as one
  110px slab of chrome across the bottom of the screen. Floating them lets the
  list show through between and around. Before *that* they were a bare
  `grid-cols-2` across the whole viewport, so on a wide screen the two labels
  sat at 25% and 75%, nowhere near the content they navigate.
- **`--tab-bar-h` and `--tray-bar-h` are hand-maintained**, with the arithmetic
  written out in `globals.css`. Nothing measures the bars — the list's bottom
  padding is `calc(--tab-bar-h + --tray-bar-h + 2rem)`, so getting one wrong
  either clips the last row or leaves a gap under it. Currently 76px and 58px;
  the rendered nav measures 76px exactly. The safe-area inset is deliberately
  *not* in either number, because the bar and everything offsetting against it
  both add it separately.
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
- Spacing on a 4px scale. **Radius is `--radius-sm` 8 / `--radius-md` 14 /
  `--radius-lg` 20 / `--radius-xl` 24**, plus `rounded-full` on everything that
  is a control. Every step moved up from the old 4/8/16 by re-valuing the
  existing token names rather than adding a parallel scale, so the thirty-odd
  `rounded-md` call sites softened without being touched. If a control's radius
  looks wrong, check whether it should just be `rounded-full` — most should.
- **Elevation is two steps.** `--shadow-card` for things resting on the ground,
  `--shadow-float` for the two bars that genuinely hover over scrolling
  content. Both are navy-tinted, not black: a neutral shadow under a
  navy-tinted card reads as grime. Dark mode flattens both nearly to nothing
  and draws its edges with `--border` instead — see the card table above.
- **Hairlines are 0.5px** (`.hairline-t` / `.hairline-b` / `.hairline-row`) and
  now have exactly one job: the divider **between rows inside a card**. The
  card edge separates stations; the hairline separates items within one. A true
  hairline on a 2× screen, rounding to 1px on a 1× one.
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

**A row with something on it tints edge to edge**, and the calorie figure
changes colour. That row-level state is what makes "what's already on my tray"
scannable while you're still browsing, without reading a single number. The
tint used to bleed past the list padding with `-mx-4 px-4`, back when the list
was one flat sheet and a band across the whole screen was the only way to make
it read as more than an inset chip. Now it runs the card's full width and stops
at its edge, which is what a card is for.

**The masthead is a hall switcher, a date stepper and a period switcher.** The
two switchers are the same `SegmentedControl`. The hall row used to be an
`<h1>` with the other venue beside it as an underlined link — which made the
venue you were on and the venue you could reach two different kinds of object,
so you had to read the heading to work out what the link was an alternative to.
As one pill switcher with one selected item they are what they always were.

Dropping the painted venue name removes the page's only `<h1>`, so there is an
`sr-only` one. Do not delete it thinking it is dead markup.

Service hours live in the status line under the meal tabs, which also says
whether the period you're looking at is the one being served.

## The tray bar

**This is the signature element, and the one place the design is allowed to be
loud.** Everything around it is hairlines and a single accent.

It's a floating pill above the nav carrying what's on the tray right now, that
opens the day's items as a sheet. It's grounded in the literal object the
student is holding, and it's what makes this a tracker rather than a menu page.

**It is the one solid block of colour in the app** — `--deep`, at 50px tall,
the full width of the content column. Nothing else uses that fill at that size.

Two lines on the left — `4 items on tray`, then **which meal period the tray
belongs to** — and the total on the right at 20px mono. The period line is not
decoration: adds go to the period you are browsing, so without it the number is
ambiguous the moment you step to another tab. You cannot tell whether 840 is
lunch or the whole day. It's derived from the entries already in hand via
`groupByMealPeriod`, so it costs no query.

Everything on it is `--deep-fg` or a transparency of it, which means the whole
bar inverts with the mode in one step rather than each element resolving its own
colour. The one thing that doesn't is the over-goal state, which needs
`--on-deep-danger`: `--danger` is a dark red built for a light ground, and on
navy it is nearly invisible.

It used to be a full-bleed `--surface-alt` strip with a hairline over it —
`--surface-alt` specifically because `--surface` equalled `--bg` in dark and a
plain surface would have left it floating on nothing. Neither of those
constraints exists any more.

### The plate

Leading the bar is a 28px ring — `ui/plate-ring.tsx` — that fills clockwise from
twelve o'clock as the day's calories approach the goal, with a filled dot in the
middle. A plate seen from above. It closes at the goal, and past it the ring and
the number both turn `--on-deep-danger`: the arc cannot say "130%", so the
colour does, and the exact figure is right beside it.

Its colours are the pill's, not the page's — arc `--deep-fg`, track
`--deep-fg/25` — because it only ever appears there. It used `--accent-text` and
`--border-strong` back when the bar was a light strip; on navy the first is
muddy and the second is a grey line on a dark ground.

Three things about it are deliberate.

**No goal, no ring.** `calorieGoal` reaches `TrayBar` as an optional, never
defaulted to 2000. `calorie_goal` is `not null default 2000` and a trigger
backfills a row per user, but `getProfile` still returns `ProfileRow | null` —
the trigger only covers users created after that migration, and the settings page
already has a "profile not ready" screen for the gap. A ring drawn against an
invented goal would be showing progress toward a number nobody set.

**It is `aria-hidden`, and the goal is spoken by the bar.** The whole tray bar is
one `<button>` whose `aria-label` is its accessible name; a `role="progressbar"`
nested inside would corrupt that computation. The label carries the goal instead:
*"…840 of 2,000 calories."*

**The one place the transform-and-opacity rule is broken.** The arc animates
`stroke-dashoffset`, which is neither. It earns the exception — there is no
transform that draws an arc — and the reason behind the rule still holds, because
`stroke-dashoffset` is paint-only and triggers no layout. The global
`prefers-reduced-motion` block zeroes it with `!important`, so no `motion-safe:`
prefix is needed at the call site.

The percentage rule itself is `goalProgress` in `lib/log.ts`, shared with the
macro hairlines on the log screen — two visualisations of one idea, so it is
written once. Its `goal > 0` guard is what stops an unset goal producing
`Infinity`, and an arc drawn from `Infinity` disappears silently rather than
erroring.

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
pill translating between tabs, the add button's pop on confirm, sheets sliding
up, the tray expanding.

**The pill is one element that moves, not a background redrawn per item.** It is
absolutely positioned and placed from the active segment's `offsetLeft` /
`offsetWidth` in a `useLayoutEffect`, with a `ResizeObserver` to re-measure on
font swap and container resize. That is what makes it read as the same object
sliding rather than one highlight going out and another coming on. Segments stay
`<Link>`s — every one is a real URL and has to remain shareable and
middle-clickable.

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
- **There is one `Button`**, in `ui/button.tsx`, with `primary` / `secondary` /
  `ghost` variants and a `ButtonLink` twin for when the action is a navigation.
  There was no such component before, and the same three className strings were
  retyped at about ten call sites — where they had already drifted: two
  different heights for the same primary action, `rounded-md` in some places
  and `rounded-full` in others, and every tertiary button carrying `underline
  underline-offset-2`, which made it read as body copy someone had linked
  rather than as a control.
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
- **There is one undo, and it guards the destructive gesture.** Swiping a row
  away on the log screen deletes a whole line, so it gets a toast; `restoreLog`
  puts the entry back with its *original* snapshots, because re-logging would
  take a fresh reading UNC may have revised since.

  Adding used to get one too. It doesn't any more: the quantity stepper's `−`
  undoes an add directly, in place, for as long as the row exists. A toast is a
  worse version of that — it covers content, it expires after six seconds, and
  it only ever reaches the most recent add. The rule this leaves behind is that
  **a transient undo is for actions with no permanent affordance**, not for
  every action.

## What has no test coverage

All 104 tests are pure logic in `src/lib`, and `vitest.config.mts` uses
`environment: 'node'` with a `*.test.ts` glob — `.tsx` isn't matched. **Nothing
in this document is protected by a test.** The suite staying green proves the
data layer is untouched; it proves nothing about the UI. Check visually, in both
modes, at 375px and on desktop.

Four things in particular have no automated guard and fail quietly:

- the sticky station placard, if `overflow-hidden` lands on the `<section>`
  instead of the `<ul>`;
- `--tab-bar-h` / `--tray-bar-h`, if either drifts from the bars' real padding
  — check against a long menu, not a short one;
- number jitter, if `tabular-nums` ever stops applying to the tray total or the
  stepper count;
- the card edge in **dark** mode, which is a border rather than a shadow, so a
  card that reads fine in light can be invisible there.
