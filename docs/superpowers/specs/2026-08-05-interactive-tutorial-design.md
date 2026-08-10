# Interactive Tutorial — Design

Date: 2026-08-05

## Goal

Teach a first-time player the game by doing, not by reading. A six-screen guided
tutorial with real dial buttons and real gestures, shown automatically after the
splash on first launch, resumable, skippable, and replayable from How to Play.

The existing How to Play guide stays as the reference document. The tutorial is
the hands-on onboarding that precedes it.

## Screens

Six screens. Three carry interactive gates; in the auto-opened run finishing a
gate carries the player to the next screen by itself.

| #   | Id         | Screen            | Gate                                                                                                 |
| --- | ---------- | ----------------- | ---------------------------------------------------------------------------------------------------- |
| 1   | `goal`     | THE GOAL          | none — a live game screen; ends when its five-second target expires or is hit                        |
| 2   | `controls` | CONTROLS          | four gestures, in order, on one button: tap `+1`, swipe down `−1`, swipe right `→9`, swipe left `→0` |
| 3   | `weights`  | POSITION IS POWER | three taps on `×1` (3), board clears, three on `×2` (6), clears, three on `×9` (27)                  |
| 4   | `strategy` | COARSE, THEN FINE | hit target **21** — guided: `×9` to 2 (18), `×2` to 1 (20), `×1` to 1 (21)                           |
| 5   | `modes`    | MODES & LIVES     | none — the three modes as a horizontal carousel                                                      |
| 6   | `tips`     | TIPS & TRICKS     | none — CTA **PLAY TRAINEE**                                                                          |

### Screen 1 — the goal

The real game screen with the tutorial's own top bar in place of the HUD: one
target in the targets area, the board total in its slot, the full dial beneath,
all live. Above it, the whole game in one sentence — _"The board must equal the
target. That's the whole game."_ — and after `GOAL_HOW_DELAY_MS`, fading in under
the target, _"But how?"_

The target carries a three-digit number and `GOAL_RING_MS` (five seconds) on its
ring. Nobody dials 137 in five seconds, which is the point — but the screen ends
on either outcome: the ring emptying, or the board actually reaching the target.
Whichever happens, it reports itself done and the tutorial moves on to answer the
question.

There is no forward button here, in any mode. That is why auto-advance is not
restricted to the gated run: a replay would otherwise sit on this screen with
nothing to press once its target resolved.

The countdown must not start until the splash clears. The tutorial is mounted
beneath it, so an ungated ring would burn down while the player is still looking
at the splash and the screen would be gone before they saw it. `SplashProvider`
publishes that moment; the ring is keyed on it so it mounts — and starts — only
once the screen is actually visible.

### Screen 2 — controls

One dial button, horizontally centred, instruction at the top of the screen, an
animated thumb looping the expected gesture immediately. The four sub-steps
advance in place on the same button and its value carries over, starting at 5:

`5 → tap → 6 → swipe down → 5 → swipe right → 9 → swipe left → 0`

Swipe up is deliberately not taught — tap already covers `+1`. Because only the
asked-for gesture is applied, that path is fixed: the button can never reach 0 or
9 early and hit `DialButton`'s "already 0/9" short circuit, which would suppress
the callback and stall the gate.

The four taught gestures map one-to-one onto the existing callbacks, so
`DialButton` is reused unchanged: `onDelta(1)` = tap, `onDelta(-1)` = swipe down,
`onSet(9)` = swipe right, `onSet(0)` = swipe left.

### Screen 3 — weights

The full 3×3 grid showing each button's factor — `showMax={false}`, so the
trainee ceiling stays out of the way while the factor is the lesson — and the
live total in its usual slot.

Three rounds of the same `WEIGHTS_TAPS` taps on a different button each time:
`×1` → 3, `×2` → 6, `×9` → 27. Nothing varies but position, so the total does
the teaching. The board clears on the first tap of each new round rather than
the last tap of the old one, leaving the finished figure on screen to be read.

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

## Moving between screens

Three ways forward, no Next button in the top bar — that carries Back and the
dismiss link only. Screens are not swipeable: the dial owns horizontal drags on
half the screens and the modes carousel owns them on another, so paging by swipe
fought the content more than it helped.

1. **A screen reporting itself done** carries the player on after
   `AUTO_ADVANCE_MS`, a beat long enough for the result to register — the task
   completed, or on screen 1 the countdown running out (`STEP_SELF_ADVANCES`).
   Completion is tracked per visit (`goTo` clears the step from `doneSteps`), so
   this holds even on a screen already cleared and come back to — without that,
   an old completion would fire on arrival and bounce them straight off again.
2. **Tapping a stepper segment** jumps straight to that screen — and doubles as
   the way past a screen whose task the player would rather not do. The bars are
   6px, so each sits in a padded pressable to give it a thumb-sized target.
3. **The CTA button**, where nothing carries the player on by itself: a screen
   outside `STEP_SELF_ADVANCES`, a revisit, or a free-browse replay. Each lesson places it where it reads
   naturally — at the end of the copy, or in the targets area on a dial screen —
   and it is labelled with what comes next (`STEP_CTA`: "LET'S TRY THE
   CONTROLS", "MEET THE MODES"), never a bare "next".

## Only the taught gesture counts

Screens 2 and 3 accept exactly the input they are asking for and ignore
everything else — buttons still animate, they just don't change anything.

- **Screen 2** applies a gesture only if it matches the current sub-step, so each
  of the four works exactly once and the value walks a fixed path
  (`5 → 6 → 5 → 9 → 0`). This also removes the horizontal-swipe dead-end
  described below: the button can never already be sitting on its destination.
- **Screen 3** accepts only taps on the button the thumb is pointing at. Any
  other button, and any other gesture, is a no-op.

Both check the gesture **inside** the state updater, with the sub-step and the
board value held in one piece of state. Checking against a value read during
render lets two gestures landing in the same frame advance the sub-step twice off
a stale read — on screen 3 that skipped the `×9` button entirely.

Screen 4 is deliberately left unrestricted: it is the "now you try" screen, and
its gate is `sum === 21` by any route.

## Dead-end guards

`DialButton` suppresses its `onSet` callback when a horizontal swipe wouldn't
change the value, so a gate waiting on that gesture could be locked out by a
button already sitting on the destination — reachable by dialling through the
9 → 0 wrap. Restricting each screen to its taught input closes this off at the
source: the board can now only ever move along the scripted path, so no button
can arrive at its destination early. No gate can be reached into an
unrecoverable state.

## Modes

- **gated** — auto-opened on first launch. Completing a screen's task advances
  it. A revisit additionally offers the CTA, so the player can move on without
  redoing the task, but doing it again advances just the same. Progress is
  persisted per step.
- **review** — opened from How to Play. Always starts at screen 1, every screen
  shows Next, free browsing, and nothing is persisted.

Back is enabled on every screen except the first.

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

### Screen 5 — modes

The three modes ride a horizontal carousel, one card per mode with the next
peeking so the row reads as swipeable. There is no separate hearts section:
lives and streaks belong to the mode that owns them, so each card carries its
own rather than making the reader cross-reference a block underneath.

The carousel is also why tutorial screens aren't swipeable. A horizontal
`ScrollView` and a screen-paging pan want the same drag, and on react-native-web
the pan won even with the ScrollView wrapped in `Gesture.Native()` — dragging a
card paged the tutorial instead of scrolling the cards. With paging gone the
carousel keeps the gesture to itself.

## The thumb hint

An outlined thumb pad with four fingerprint ridges, drawn as SVG
(`ThumbPrint`) at roughly life size — 0.7 of a dial button wide, `THUMB_ASPECT`
taller than wide, which lands near a real 16 × 21mm thumb print. Outline rather
than a solid glyph, at 0.65 opacity, so the button's value stays readable
underneath. The shape is nudged down by `CONTACT_OFFSET` of its height to put
the contact point — near the top of the pad — on whatever it is pointing at.

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

## Layout — everything where the game puts it

The overlay carries `px-4` like `Screen`, and Back / dismiss sit at the top under
the stepper, leaving the whole lower half for the game's own furniture.

`DialStage` reproduces the game screen's lower half as three bands, and every
dial lesson composes into them:

| Band         | Height              | Holds                                         |
| ------------ | ------------------- | --------------------------------------------- |
| targets area | `flex-1`            | the target ring (screen 4), reveal copy, Next |
| sum readout  | `SUM_ROW_HEIGHT`    | the board total — reserved even when empty    |
| dial pad     | `useGameDialSize()` | the dial, at the game's own size              |

So the total is centred directly above the dial, exactly as in a real game,
rather than parked beside the target; and the target ring floats in the targets
area where targets actually appear. Screen 2's single button is the centre cell
of that same footprint.

`useGameDialSize` derives the square from the window rather than measuring
whatever space a lesson happens to leave — measuring would hand a text-light
screen a bigger dial than a text-heavy one, and both bigger than the game's on
short displays. Verified against the live game rendered behind the overlay:
tutorial 91px buttons at rows 519/630/741 vs the game's 89px at 526/635/744.

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
