# Interactive Tutorial — Design

Date: 2026-08-05

## Goal

Teach a first-time player the game by doing, not by reading. A six-screen guided
tutorial with real dial buttons and real gestures, shown automatically after the
splash on first launch, resumable, skippable, and replayable from How to Play.

The existing How to Play guide stays as the reference document. The tutorial is
the hands-on onboarding that precedes it.

## Screens

Six screens. Three carry interactive gates; in the auto-opened run the Next
button stays disabled until the gate passes.

| #   | Id         | Screen            | Gate                                                                                                 |
| --- | ---------- | ----------------- | ---------------------------------------------------------------------------------------------------- |
| 1   | `goal`     | THE GOAL          | none — a full target ring over a worked example (`6×1 + 4×9 = 42`)                                   |
| 2   | `controls` | CONTROLS          | four gestures, in order, on one button: tap `+1`, swipe down `−1`, swipe right `→9`, swipe left `→0` |
| 3   | `weights`  | POSITION IS POWER | swipe the `×1` button right (sum → 9), then the `×9` button right (sum → 90)                         |
| 4   | `strategy` | COARSE, THEN FINE | hit target **21** — guided: `×9` to 2 (18), `×2` to 1 (20), `×1` to 1 (21)                           |
| 5   | `modes`    | MODES & LIVES     | none                                                                                                 |
| 6   | `tips`     | TIPS & TRICKS     | none — CTA **PLAY TRAINEE**                                                                          |

### Screen 2 — controls

One dial button, horizontally centred, instruction at the top of the screen, an
animated thumb looping the expected gesture immediately. The four sub-steps
advance in place on the same button and its value carries over, starting at 5:

`5 → tap → 6 → swipe down → 5 → swipe right → 9 → swipe left → 0`

Swipe up is deliberately not taught — tap already covers `+1`. Starting at 5
guarantees neither horizontal swipe hits `DialButton`'s "already 0/9" short
circuit, which would suppress the callback and stall the gate.

The four taught gestures map one-to-one onto the existing callbacks, so
`DialButton` is reused unchanged: `onDelta(1)` = tap, `onDelta(-1)` = swipe down,
`onSet(9)` = swipe right, `onSet(0)` = swipe left.

### Screen 3 — weights

The full 3×3 grid with `×weight` labels visible (the `trainee` prop) and a live
sum above it. Two sub-steps, both reusing the swipe just learned: maxing the
`×1` button moves the total to 9; maxing the `×9` button moves it to 90. Same
digit, nine times the effect.

### Screen 4 — strategy

A fresh zeroed grid and a real `PieCountdown` ring showing target 21. The thumb
points at the next move along a three-tier route — heavy (`×9` → 2 = 18), mid
(`×2` → 1 = 20), fine (`×1` → 1 = 21). The gate is `sum === 21` by any route;
overshooting swaps the prompt for "swipe a button left to clear it".

This route is deliberately **not** the par route. `computePar` treats a
swipe-to-9 as a single step, so 21 is reachable in two (`×2` cell → 9 = 18, plus
a `×3` cell → 1 = 3) and no small target makes a tap-by-tap coarse→fine route
move-optimal. The screen therefore teaches how to _steer_ toward a number and
avoids any "fewest moves" claim — that belongs to Accuracy mode, covered on
screen 5.

The ring runs on a generous duration. If it empties, the target respawns with a
short note and no penalty; nothing the user has dialled is lost.

## Dead-end guards

`DialButton` suppresses its `onSet` callback when a horizontal swipe wouldn't
change the value, so a gate that waits for the _gesture_ can be locked out by a
button that already sits on the destination — reachable by dialling through the
9 → 0 wrap first. Both affected lessons watch the resulting value instead:

- screen 2 counts a horizontal sub-step as done if the button already reads its
  destination (`arrivesAt`);
- screen 3's gate is "this button reads 9", however the player got it there — a
  nine-tap route teaches the same lesson.

No gate in the tutorial can be reached into an unrecoverable state.

## Modes

- **gated** — auto-opened on first launch. Next is disabled until the screen's
  gate passes. A passed gate stays passed for the session, so navigating back
  and forward again does not re-lock Next. Progress is persisted per step.
- **review** — opened from How to Play. Always starts at screen 1, Next is
  always enabled, free browsing, and nothing is persisted.

Prev is enabled on every screen except the first.

## Persistence

One new key, `TUTORIAL_KEY = 'nine.tutorial.v1'`, holding
`{ finished: boolean; step?: number }`:

| Stored state        | On app launch                                                      |
| ------------------- | ------------------------------------------------------------------ |
| no key              | first launch → gated run from screen 1                             |
| `{ step: n }`       | screen 1, plus a GO TO WHERE YOU LEFT OFF button above the nav row |
| `{ finished: true}` | nothing — the tutorial never auto-opens again                      |

A part-finished run always opens on **screen 1** — there is no separate
welcome-back screen. The stored step becomes an optional jump: `TutorialResumeButton`
sits directly under the stepper, tinted with that step's spectrum colour, and
disappears once the player leaves screen 1. `furthest` is seeded from the stored
step, so a returning player who reads forward from the start is never re-gated on
screens they already cleared.

Finishing **or** skipping writes `{ finished: true }` and drops the stored step.
The payload is parsed with zod, so a corrupt or stale value degrades to "never
started" instead of throwing.

## The Trainee par badge

In Trainee mode each target carries a grey badge — `computePar(grid, value)`, the
fewest moves needed to hit it from the board as it stands, recomputed as the
player dials. Both the tutorial's modes screen and How to Play's Trainee card
explain it; How to Play additionally notes that a swipe to 0 or 9 counts as one
move, which is why the number drops faster than a tap-counting player expects.

## Structure

Pure logic, hooks and components stay separated in line with the repo layout.

```
constants/storage.ts                     + TUTORIAL_KEY
constants/tutorial.ts                    step order, gate registry, tunable task values
constants/guide.ts                       ACCENT palette shared by guide + tutorial
lib/tutorial-grid.ts                     cell weights, sum, dial/set — pure, tested
lib/tutorial-progress.ts                 parse/serialize, launch decision, clamping — pure, tested
lib/spectrum.ts                          multi-stop gradient sampling — pure, tested
hooks/use-tutorial.ts                    hydrate, persist, visibility/mode/step, gate tracking
hooks/use-game-dial-size.ts              caps a lesson's dial to the game screen's own budget
components/guide/*                        blocks extracted from how-to-play-overlay
components/overlays/tutorial/*            shell, stepper, nav, resume button, thumb hint, live grid
components/overlays/tutorial/lessons/*     one file per screen
```

No new XState machine: the step cursor and gates are a handful of pure
functions plus a hook, and each lesson's dial state is local `useState`. The
pure modules carry Vitest coverage; the components do not need it.

Per the code guide, every named component gets its own file — including the
blocks currently inlined in `how-to-play-overlay.tsx` (`SectionHeader`, `Body`,
`Card`, `Bullet`, `ModeCard`, `WeightGrid`, `ControlsDiagram`), which screens 5
and 6 need. Extracting them into `components/guide/` is part of this work.

## Wiring

The splash lives in `app/_layout.tsx` at `zIndex: 100`, above everything. The
tutorial renders from `app/(tabs)/index.tsx` at `zIndex: 30`, so it is simply
revealed as the splash fades — no cross-file signalling and no new route.

`MenuOverlay` is suppressed while the tutorial is visible. How to Play gains a
REPLAY TUTORIAL button. The final CTA sends `SET_MODE trainee` then `START`,
dropping the user straight into a Trainee game; as a side effect the existing
`usePersistedMode` makes Trainee the default mode for the next launch.

## Layout

The overlay carries `px-4` like `Screen`, and navigation (BACK / NEXT / skip)
sits at the **top**, directly under the stepper. That leaves the bottom of every
lesson free for the dial, which is measured off `min(width, height)` and
bottom-aligned exactly as the game's dial pad is — so buttons are the same size,
in the same place, as the ones the player will use for real. Screen 2's single
button is one cell of that same footprint, positioned where the dial's centre
button sits.

## Stepper

Six thin segments across the top, no numeric label. Completed segments fill with
the app's blue → purple → pink → red → amber mode spectrum (`lerpColor`), the
current one pulses gently, future ones stay muted.

## Thumb hint

`ThumbHint` takes a `gesture: 'tap' | 'down' | 'right' | 'left'` prop and is
positioned by its parent — centred under the single button on screen 2, over a
given cell index on screens 3 and 4. Tap pulses with an expanding ring; the
directional gestures translate along their axis and fade. It appears immediately
and loops until the gate passes.

## Testing

- `lib/tutorial-grid.test.ts` — weights per index, sum, tap wrap `9 → 0`,
  absolute set, immutability.
- `lib/tutorial-progress.test.ts` — parse of missing / valid / corrupt payloads,
  the launch decision for each stored state, step clamping, and that finishing
  or skipping clears the step.

`pnpm check` (ESLint, Prettier, tsc, Knip, Vitest) is the gate.
