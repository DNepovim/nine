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

The clock itself is `BASE_CLOCK` decayed by depth on `decayed` — the same curve
Speed's clock and Accuracy's spawn gap ramp on, now exported from
`machines/modes.ts` rather than copied.

**No difficulty.** One pace, and depth is what moves it: a run tightens as it
climbs, toward 55% of where it started, which is a difficulty that happens rather
than one picked up front. The three-way choice was on the intro for a day and was
wrong there — it asked the player to set a dial before they had any idea what the
mode was, and arcade already sets it for them. `crossroadClock` takes a depth and
nothing else.

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

## The strike

A crossroad answered with more than `FAST_HIT_THRESHOLD` of its clock still full
is a **strike** — the same bar Speed's streak is measured against, because it is
the same claim about the same kind of answer, and a mode at the far end of the
spectrum should not move a goalpost the player already knows.

What it buys is a crossroad. The hero does not stop at the one it lands on: it
**rockets** straight through, takes the way closest to the heading it arrived on,
and lands one crossroad deeper. One answer, two crossroads, depth plus two.

The way through is the straightest rather than a random one, which is the only
answer that needs no explaining on screen — momentum. A random pick would read as
the game choosing for you; carrying straight on reads as what the player just
did.

It governs itself. Depth tightens the clock, so strikes make strikes harder: a run
that rockets climbs into a clock that is harder to beat, and the skipping stops
without a rule having to stop it.

The crossroad being passed through is opened at the moment the strike is called
rather than on arrival — the way out of it has to be a way the map already has,
because the rocket is taking it and nothing may be rolled mid-flight. It opens
against the same grid an arrival would have used, so the fan is the same either
way.

`STRIKE` rises over the crossroad that earned it. The rule needs saying once: a
depth jumping by two with no explanation reads as a bug, and the same jump with
the word over it is a rule explained in the only moment it is relevant.

Deliberately still one crossroad per strike. Consecutive strikes raising the skip
— the shape `streakMultiplier` already has — is the obvious next thing and not in
the POC.

### What the rocket looks like

One movement with two halves: out of the crossroad accelerating
(`Easing.in(cubic)` over the first 46% of `ROCKET_MS`) and settling into the
landing (`Easing.out(cubic)`). Two ways in 1180ms against a walk's 880 — that gap
is the whole effect, because what a player reads as speed is the canvas covering
twice the ground in not much more time.

The canvas keeps its single ease-in-out across the doubled distance, so the hero
runs ahead of its anchor mid-flight and catches up on landing. The mismatch is
deliberate: a rocket pinned to its anchor would not look like one.

Five sparks trail the bead, each sampling the same splines a fraction of the
movement behind it — so the tail bends along the curve instead of cutting the
corner — and the whole comet catches light and goes out on a 160ms fade rather
than appearing between two frames. The way ahead draws itself on as the rocket
crosses the first way, so the hero is always flying into a lit line.

The app already frames this. `MODE_SHOT` gives each mode's streak the shot it is
made of — Accuracy a single held beam, Speed a magazine. Arcade's strike fires the
hero itself.

## Stopping, and ending

Arcade wears the app's own screens for both.

The top row carries the same `PauseButton` every run has, in arcade's ink — and
only while the hero is standing on a crossroad. Mid-flight there is no beat to
stop: a movement is a second at most, and a screen that froze halfway along a way
would have to be resumed into an animation that had already finished without it.
The column keeps its width either way, so nothing in the row moves when the button
fades out.

A pause is resumable because every beat's timer is set to what is _left_ of that
beat rather than to the whole of it. The run stamps `beatAt` on each transition,
holds `heldMs` when it stops, and on resuming shifts `beatAt` forward by however
long the pause lasted — so what is left is what was left. The red creeping up the
way behind holds where it got to and carries on from there, which is why a way
stem takes a `creepFrom` as well as a duration.

Both screens are arcade's own, built from the standard pieces rather than from the
game's overlays: `PauseMark`'s two glass bars, `GameOverTitle`'s wordmark,
`ScoreReadout` for the depth and `StatCell` for the figures, with the CTA and the
quiet underlined way out underneath. `PausedOverlay` itself is thirty props of the
game machine's run — a score, lives, boards, medals, achievements, dial corners,
Trainee's sliders — and multiplayer already keeps its own pause screen for exactly
this reason. The two marks were widened from `Mode` to `Mode | 'arcade'`, which is
all they needed: both read nothing but `MODE_GRADIENT`.

The wordmark says `FELL BACK` — two four-letter words, which is the 4×2 grid its
colour ramp and entrance delays are indexed by, and what actually happened rather
than that something did.

`ArcadeStats` is the row both screens share, for the same reason `RunStats` is one
component: two screens, one answer. Strikes and time; depth is the score, so it
stands above in the readout instead.

## The map under the ways

The ways no longer run through empty space. Implemented from the atlas design, and the
shape of it is one decision: **the land is a function of where you are**, not a thing
the run keeps.

`lib/atlas-field.ts` is a hashed value-noise elevation field at three octaves, sampled
in the map's own pitch coordinates — so it is the same answer for the same place whoever
asks, in whatever order, and a taller canvas draws the same country bigger rather than a
different one.

`machines/arcade-land.ts` puts **one feature in each lattice cell**, and a cell's answer
depends on nothing but its own coordinates and the run's seed. That is what makes the
country infinite and seamless: there are no patches to stitch, no tiles to keep and
nothing to prune, because two cells never have to agree about anything. Depth chooses the
region and the region chooses the lattice — so the regions are bands in world space, and
`regionAtPosition` reads one off a `y`.

Four regions, three crossroads each, cycling: farmland that is mostly room, a forest that
closes over at a 26pt lattice, hills of rises, and mountains that are 80% ranges. The
coast, the archipelago and the open sea are designed and wait on the hydrology — a region
with a sea level and no water drawn in it would be a promise the screen does not keep.

### Marks that knock out

`lib/map-marks.ts` turns a feature into path strings: a closed `body` filled with the
_surface_ colour before it is inked, and an open `detail` of hachures and shading that is
only stroked. The fill is the ground's own colour, so it is invisible except where it
covers something — which is what lets a range of mountains be drawn the way ranges are,
peak overlapping peak, instead of as a thicket of outlines.

Order is the other half of it. A feature's elements are generated back to front, and each
mark's own hachures go on immediately after its body rather than after every body on the
feature — drawing all the bodies and then all the shading puts the far peak's hachures
back on top of the near peak's face.

A wood is the exception: one mark however many trees are in it. Within a wood the canopies
are inked flat over each other, which is how a mass of trees is drawn anyway, and it is
the difference between a forest costing two paths and costing four hundred.

### Safezones

Terrain is the only thing that yields. `use-arcade-land` builds the keep-out from the run:
every way in sight as a segment at 0.22 pitches, every settlement at 0.3, and a candidate
inside either is dropped rather than moved. Nudging it is how a generator ends up with
suspicious rows of things that were all pushed out of the same spot.

Terrain against terrain is deliberately _not_ fenced. With every mark knocking out the one
behind it, two ranges meeting across a cell boundary read as one massif, and two canopies
that touch read as one wood.

### Kept, not stored

The answers are cached by cell for two reasons. Generating a cell twice a frame would be
waste; but more importantly a cell asked again later would be asked with more ways in the
way, and the land would change behind the player as they walked.

### The hero is a flame

`lib/flame.ts` is a path that leans, built on the UI thread from the screen's frame clock.
Two shapes on two sines that do not share a period, so the flicker never repeats and never
reads as a loop. It is the only mark that can be the brightest thing on a sheet of grey ink
without a second colour, and the only one that can move while standing still — which is
what says a run is waiting for an answer rather than stopped.

### Villages have names

`lib/place-names.ts`: curated morphemes, never generated phonotactics. A proper
onset-nucleus-coda grammar was tried first and it produces _Grarsh_ and _Crorghbridge_ —
sounds rather than names. Every crossroad is named when it is created, from its own id, so
a place keeps its name for the whole run; and being proper nouns, none of it is ever
translated. The bud it replaces is still underneath: the number stays the most legible
thing on the sheet, because it is the thing the player is dialling.

### A target is a town

The number a player dials has always sat in a disc. It is now that disc with the map's own
hand put to it: a wall around it, merlons along the top of the wall, towers at the quarters
and a gate at the foot. The face is the ground's own colour — the same knockout every mark
on this sheet fills itself with — so a town covers the country behind it and the sheet shows
through its walls, which is how a map draws one.

The amber stays, as the ring the number sits in: the game speaking inside the map's wall. A
town's seed decides how many merlons its wall has and whether its towers are capped, which
is enough that no two in sight are the same wall and not so much that one stops reading as a
town. The separate row of roofs under each target is gone — it was saying the same thing
twice, and a target that _is_ a settlement says it better.

The town turns upright with the number rather than with the sheet. A wall whose gate had
swung to the top would be a wall nobody drew.

### The lettering

`mapLabel` in `constants/theme.ts`: the platform's own serif, and the only place in the app
that is not mono.

Everything else the player reads here is a readout, and a screen of digits wants a face whose
digits line up. A drawn map is the one thing that is not: its labels are lettering on a
sheet, and a serif is what five hundred years of maps have set them in. The village names
and the arrival label take it, upper case and tracked; the numbers do not, because they are
still numbers. Nothing on any other screen changes, which is the whole reason it is its own
export rather than a change to `mono`.

### Which way is up

The rose in the bottom-right corner is the one control on this screen that is not the dial,
and it switches between the two ways a map like this can be read.

**North at the top** is how it has always been: the sheet is fixed, the hero turns under it,
and the rose never moves. **Ahead at the top** turns the sheet instead — the camera takes
`UP − heading` so the hero's own direction is always up the screen, and the rose turns with
the land, which makes it the one mark that says which way the country is lying.

The turn rides the same beat the canvas drifts on, so a walk and a rotation are one
movement rather than two. A mode switch has no beat to borrow, so it takes `TURN_MS` of its
own.

The camera transform is anchor, then turn, then focus. With no turn it is exactly the
translation it always was, so the usual case pays nothing for the sheet being able to
rotate.

What is drawn on the map turns with it — mountains, woods, the houses of a village, the
ways themselves. What is _read_ does not: the target disc, the village name, the arrival
label, `STRIKE`, and the flame, which burns upward whichever way the land is lying. Each of
those takes the turn back out about its own centre, which for a zero-size anchor is the
point it stands on, so turning one back leaves it exactly where it was.

This is the Bloom direction from the first design, which lost to the Climb on the grounds
that rotation costs every numeral a counter-rotation. It does — but as a mode the player
chooses rather than the only way the screen works, that cost buys something: the two
readings of a map, and a reason to look at the rose.

### Still to come

The hydrology — rivers that find lakes, lakes that drain to the sea, coastlines by
marching squares, walled towns on islands, voyages and the things drawn in open water — is
designed and measured but not built. It is a second system rather than more of this one,
and it brings the three water regions with it.

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

| Beat    | Shape                                                                 | Timing                                  |
| ------- | --------------------------------------------------------------------- | --------------------------------------- |
| Bloom   | each way draws on out of the crossroad, its bud landing on a spring   | 520ms `Easing.out(cubic)`, 90ms stagger |
| Sway    | a sine on the control points, perpendicular to the way                | 2.6–3.4s, amplitude 6% of length        |
| Walk    | hero along the curve while the canvas drifts the same distance        | 880ms `Easing.inOut(cubic)`             |
| Wither  | refused ways trim from the tip back into the crossroad                | 520ms `Easing.in(quad)`                 |
| Absorb  | the chosen bud shrinks into the crossroad as the hero lands           | over the walk, `Easing.in(quad)`        |
| Rocket  | two ways in one movement: accelerating out, settling into the landing | 1180ms, `Easing.in` then `Easing.out`   |
| Retreat | faster than the walk and in one motion — being pulled, not moving     | 620ms `Easing.in(cubic)`                |
| Fall    | the hero rides the stub into the mouth                                | 620ms                                   |

The sway runs off one `useFrameCallback` clock for the whole screen, read by each
way's `animatedProps` — so the path string is built on the UI thread and a way
sways whatever React is doing.

## Where it lives

| File                                  | What it holds                                                |
| ------------------------------------- | ------------------------------------------------------------ |
| `constants/features.ts`               | `arcade: 'developer'`                                        |
| `constants/storage.ts`                | `ARCADE_FOCUS_KEY`, the pill remembered across launches      |
| `constants/arcade.ts`                 | the timings and sizes every piece has to agree about         |
| `machines/arcade.ts`                  | the map, the fan, the par band, the clock — pure, and tested |
| `lib/arcade-layout.ts`                | pitches into points; the worklets that draw and ride a curve |
| `hooks/use-arcade-run.ts`             | the run: phases, the clock, the grid, walking and retreating |
| `components/game/arcade-game.tsx`     | the screen — top bar, canvas, sum row, dial                  |
| `components/game/way-stem.tsx`        | one way, drawn                                               |
| `components/game/way-bud.tsx`         | one bud                                                      |
| `components/game/arcade-hero.tsx`     | the hero, and the comet a strike gives it                    |
| `components/game/arcade-strike.tsx`   | the word, over the crossroad that earned it                  |
| `components/game/arcade-mouth.tsx`    | the ring a lost run falls into                               |
| `components/game/arcade-over.tsx`     | the end: the wordmark, the depth, the two ways out           |
| `components/game/arcade-paused.tsx`   | a run stopped, and the way back into it                      |
| `components/game/arcade-stats.tsx`    | the figures both of those screens show                       |
| `hooks/use-persisted-arcade-focus.ts` | whether the intro was last left on ARCADE                    |

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
- **A run resumed across launches.** Pausing holds a run; closing the app still
  ends it.
- **A tapering stroke.** The design called for a way thicker at the hero end;
  SVG gives a path one width, so a lit way is a core plus a wider soft glow.
- **Strikes that compound.** One strike, one crossroad skipped, however many came
  before it.
- **Levels, bonuses, sidequests.** The teaser's promise. The way is the thing to
  get right first.

## How to Play

The guide gains an ARCADE chapter gated on the same flag, exactly as
multiplayer's is — so it never explains a mode the reader cannot reach.
