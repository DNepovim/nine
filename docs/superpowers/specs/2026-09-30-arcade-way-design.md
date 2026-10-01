# Arcade: The Way — Design

Date: 2026-09-30

## Goal

Arcade has been a locked pill on the intro since the modes were built: a colour
pair in `MODE_GRADIENT`, a SOON badge, and a promise of "levels, bonuses,
sidequests". Nothing behind it.

Give it a mechanic. The dial stays exactly as it is — nine keys, the same
weights, the same swipes — and what changes is where the targets stand. Not
scattered over the canvas, but hung at the ends of ways that leave a crossroad.

This is a proof of concept behind `arcade: 'developer'`. It is the movement that
needs judging, not the economy; everything the teaser promises hangs off the way
once the way is right.

## The way

A run is a tree grown one crossroad at a time. The hero stands on a crossroad;
two to four **ways** leave it, each tipped by a **bud** holding one target.

Dial a bud's value and the hero walks that way to the crossroad at its end. The
ways it refused wither back into the crossroad behind it. Dial nothing before the
clock runs out and the way behind lights up red and drags the hero back one
crossroad. Retreat from the first crossroad and the hero falls into **the mouth**
— the ring hanging below where the run began — and the run is over.

**Depth** is the score: how many crossroads from the start the hero stands, kept
as a high-water mark.

The map is grown lazily and then kept. A crossroad reached a second time offers
the same ways with the same numbers, plus the one the hero just failed at. A
retreat gives back a place, not a re-roll — which is what makes a way something
the player can know.

## The layout — the Climb

Chosen from three directions (the Bloom, radial with a rotating canvas; the
Current, a left-to-right delta). The Climb won on three counts: it fits a canvas
that is about 390 × 330 above the dial, it keeps every bud numeral upright, and
it gives loss a direction — retreat is falling.

The way grows up out of the dial. Ways fan upward from the crossroad, each angle
drawn back halfway toward vertical so the map stays upright, and the canvas
drifts down as the hero climbs so the hero never leaves its anchor at 70% of the
canvas height.

Geometry is kept in **pitches** — one pitch is 40% of the canvas height — so the
map itself has no pixels in it. `lib/arcade-layout.ts` is what turns a crossroad
and its ways into points and cubic curves.

The world is measured from the start crossroad and never re-based. That is a
deliberate choice, not an oversight: the camera is a shared value and the map is
React state, and if positions were relative to wherever the hero is now, every
arrival would have to shift the map and reset the camera by the same vector in
the same frame. In one absolute frame nothing an arrival commits moves anything
already drawn, so the two can never tear.

## Where the clock goes

One clock per crossroad, drawn on the way _behind_ the hero: it cools from amber
to red from the far end inward, and when the red arrives, it pulls. Nothing new
appears on screen, and the threat has a direction — the player can see where they
are about to be sent.

The alternatives were a ring around the hero, which says nothing about the
consequence and puts a second clock-shaped thing beside the buds, and a
countdown pie per bud, which reuses `PieCountdown` but raises a question the rule
does not answer: what happens when one of four expires. The rule is collective,
so the clock is too.

At the first crossroad there is no way behind for the clock to cool. So the mouth
hangs below on a **stub** — a short way down into the ring — and the stub carries
that clock. It is also what the hero falls down when the clock wins there, so the
one place the model was short is the one place the clock says exactly what it
costs.

The clock itself is `BASE_CLOCK` × the difficulty's `timeoutScale`, decayed by
depth on `decayed` — the same curve Speed's clock and Accuracy's spawn gap ramp
on, now exported from `machines/modes.ts` rather than copied.

## What a crossroad offers

Two to four ways, weighted toward three.

Every way at a crossroad sits in the same par band — three or four steps from the
grid as it stands when the crossroad opens — so the choice is free, and the mode
can be judged on its movement rather than on arithmetic. `parTable` in
`machines/scoring.ts` is new for this: it is the DP `computePar` already ran, with
its last line left off, because a crossroad asks the question the other way round
— not "what does this target cost" but "which targets cost three or four".

Par-weighted rewards — a dearer way paying more — are the obvious first thing to
add after this lands. Deliberately not in the POC.

## Colour

Arcade's own pair, the far end of the spectrum past Speed, with a job each.

| Element                 | Colour                                    |
| ----------------------- | ----------------------------------------- |
| Hero, lit way, bud edge | `#FF8C00` — amber is life and progress    |
| The cooling clock       | `#E5534B` — red is the clock and the fall |
| Ways not yet walked     | the `muted` token, as `WAY_INK`           |
| Bud face                | the `card` token, numeral in `pie` ink    |
| PLAY / PLAY AGAIN       | `DARK_MODE_GRADIENT.arcade`               |

Two contrast notes. Amber on the parchment surface is about 2:1, so it is a
stroke and a fill but never a numeral — the buds carry their target on `card`,
exactly as the countdown does today. And the ARCADE label, which _is_ amber text,
takes a themed pair of its own — `ARCADE_INK`, the same shape as `GOLD_INK` and
for the same reason.

## Motion

| Beat    | Shape                                                               | Timing                                  |
| ------- | ------------------------------------------------------------------- | --------------------------------------- |
| Bloom   | each way draws on out of the crossroad, its bud landing on a spring | 520ms `Easing.out(cubic)`, 90ms stagger |
| Sway    | a sine on the control points, perpendicular to the way              | 2.6–3.4s, amplitude 6% of length        |
| Walk    | hero along the curve while the canvas drifts the same distance      | 880ms `Easing.inOut(cubic)`             |
| Wither  | refused ways trim from the tip back into the crossroad              | 520ms `Easing.in(quad)`                 |
| Absorb  | the chosen bud shrinks into the crossroad as the hero lands         | over the walk, `Easing.in(quad)`        |
| Retreat | faster than the walk and in one motion — being pulled, not moving   | 620ms `Easing.in(cubic)`                |
| Fall    | the hero rides the stub into the mouth                              | 620ms                                   |

The sway runs off one `useFrameCallback` clock for the whole screen, read by each
way's `animatedProps` — so the path string is built on the UI thread and a way
sways whatever React is doing.

## Where it lives

| File                               | What it holds                                                |
| ---------------------------------- | ------------------------------------------------------------ |
| `constants/features.ts`            | `arcade: 'developer'`                                        |
| `constants/arcade.ts`              | the timings and sizes every piece has to agree about         |
| `machines/arcade.ts`               | the map, the fan, the par band, the clock — pure, and tested |
| `lib/arcade-layout.ts`             | pitches into points; the worklets that draw and ride a curve |
| `hooks/use-arcade-run.ts`          | the run: phases, the clock, the grid, walking and retreating |
| `components/game/arcade-game.tsx`  | the screen — top bar, canvas, sum row, dial                  |
| `components/game/way-stem.tsx`     | one way, drawn                                               |
| `components/game/way-bud.tsx`      | one bud                                                      |
| `components/game/arcade-hero.tsx`  | the hero                                                     |
| `components/game/arcade-mouth.tsx` | the ring a lost run falls into                               |
| `components/game/arcade-over.tsx`  | depth reached, and the two ways out                          |

The screen mounts the way multiplayer's does — an absolute view over the intro,
rather than a branch inside the game screen. Arcade is not the game machine's
run, and a fourth `Mode` would have reached `Board`, the leaderboards, the saved
run, the career and the achievements.

## What the POC leaves out

- **Leaderboards, medals, fortune.** No board, no submission, no career effect.
- **Achievements.** Nothing measured against arcade until the rules settle.
- **Multiplayer and the tutorial.** Arcade is alone and unexplained for now.
- **A resumed arcade run.** `saved-run` keeps its three modes; closing the app
  ends an arcade run.
- **Pause.** END leaves, and leaving ends the run.
- **A tapering stroke.** The design called for a way thicker at the hero end;
  SVG gives a path one width, so a lit way is a core plus a wider soft glow.
- **Levels, bonuses, sidequests.** The teaser's promise. The way is the thing to
  get right first.

## How to Play

The guide gains an ARCADE chapter gated on the same flag, exactly as
multiplayer's is — so it never explains a mode the reader cannot reach.
