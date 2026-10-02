# Arcade: Fortified Villages — Design

Date: 2026-10-02

## Goal

The way works. A run climbs a tree of crossroads, each answered against a clock,
and depth is the score. What it has no shape for is a **fight** — every crossroad
asks the same question, and the only thing that ever happens to the player is
being dragged back down the way they came.

Give a village walls. About one crossroad in three offers a **fortified village**
among its ways; dial that one and the screen closes on it. Towers have to be
knocked down, warriors come out to meet you, and the run carries **hearts** that
a warrior can take.

This is still behind `arcade: 'developer'`. What needs judging is whether a siege
reads as a different kind of beat while being dialled exactly like every other.

## What this changes about arcade

`machines/arcade.ts` opens by saying a run of this "keeps no board, no lives and
no streak". One third of that stops being true: a run now carries **three
hearts**, and running out of them is a second way for a run to end — the first
being the fall into the mouth, which is untouched.

Everything else stands. The map is still a lazily-grown, permanently-kept tree.
Depth is still the score and still a high-water mark. The clock at a crossroad
still drags the hero back one place and costs nothing but depth. A fortified
village is an ordinary crossroad that happens to be walled; nothing in the map
changes shape for it.

## Which villages are fortified

A crossroad offers two to four ways, each with a village at its end. About **one
crossroad in three** has exactly one fortified village among them. Never two in
the same fan.

The roll has to survive a retreat. Walk back down and the fan you return to must
be the fan you left, walls and all — that is the promise the whole map rests on,
and a fortification rolled at arrival rather than at growth would break it. So it
is rolled inside `openCrossroad`, from the crossroad's own seed, at the moment the
fan is grown.

Each `Crossroad` carries a `dry` count: how many fans in a row up this branch
offered nothing. When `openCrossroad(at)` grows a fan:

- forced **off** if `at` is itself a fortified village — no siege straight out of
  a siege
- forced **on** if `at.dry >= 3` — so at most three quiet fans in a row before one
  is forced
- otherwise a **1-in-3** roll

If the fan is to carry one, exactly one of its destinations is marked
`fortified`. Every destination created by that call is given
`dry = offered ? 0 : at.dry + 1`.

Deterministic, stable on revisit, and it gives the distribution asked for. Two
crossroads in a row can each offer a fort — decline the first, walk to a quiet
village, and that village's own fan may be walled. What cannot happen is a siege
opening out of the village you just took. Three or four dry crossroads in a
stretch are normal.

## The siege

### Towers

Four to six, ringed on the wall, each carrying a number and taking three to five
hits. Both counts rise with depth — four towers at three hits near the start, six
at five deep in. A tower's number does not change as it is chipped: the walls are
something the player can learn over the length of one fight.

### Warriors

They come out of the gate and walk down at the hero. Each carries a number. Hit
it and the warrior is killed; let it reach the hero and a heart goes. At most
three alive at once — enough to crowd, few enough that the screen stays readable
and there are always spare numbers to draw from.

### The numbers

Every live number in a siege is **distinct**, towers and warriors together, so one
press can never resolve two things.

They are drawn the way a fan is drawn — `parTable` against the grid the hero is
holding — but from a **cheaper band, two to three presses** where a crossroad's
ways are three to four. A crossroad asks for one number; a siege asks for dozens,
and at the fan's band a siege would be nothing but dialling.

A warrior's number is drawn **at the moment it spawns**, against the grid as it
stands then, excluding everything already live. So a warrior is never something
the player cannot reach in time, however far the dial has wandered.

`wayValues` becomes a special case of one function rather than the only one:

```
parValues(grid, count, rng, { min, max, exclude }): readonly number[]
```

with the same stretch-the-band-until-it-fills fallback it already has, and
`wayValues` calling it with `{ min: 3, max: 4 }`. One function, not a copy.

### A hit is an arrival, not a residence

The dial's sum **carries** between hits in both engines — neither `applyGrid` nor
`applyMove` resets anything. So sitting on a tower's number does nothing at all;
a tower is chipped by dialling away from its number and coming back to it. That
rhythm falls out of the existing code for free.

The one guard needed: a move that leaves the sum unchanged resolves nothing.
`pressGrid` always changes the sum, but `setGrid` can write a digit's existing
value, and without the guard that would re-hit whatever is standing on the sum.

### Escalation

Both of the two asked for, on one curve — arcade's own `decayed`, the same
decelerating squeeze the crossroad clock uses:

- **Within a siege.** Warriors spawn faster the longer this fight has run.
- **By depth.** A deeper siege starts faster, its warriors walk faster, and it
  has more towers with more hits in them.

One counter feeding one curve: warriors-spawned plus depth. A siege tightens on
how long it has lasted and how far up the way it is, and nothing else.

### How long a siege takes — the first thing to tune

Four to six towers at three to five hits is **12 to 30 tower hits**. At two to
three presses each that is roughly 30 presses for a shallow siege and 75 for a
deep one, before a single warrior is dealt with — call it half a minute at the
shallow end and a minute and a half at the deep one, against a mode whose every
other beat is about a second.

The shallow end is right. The deep end may be a slog, and it is the first number
to move after one play: the tower count, the hits per tower and the press band
are all single constants in `constants/siege.ts` for exactly that reason.

## The beats

Four new entries on `ArcadePhase`, beside `dawn`, `bloom`, `open`, `walk`,
`rocket`, `retreat`, `falling` and `over`.

| Beat | What it is |
| --- | --- |
| `closing` | The walled village's number was dialled and the hero walked, but stops short of the gate. The camera closes on the walls. The dial is dead. |
| `siege` | The fight. **Dialable**, and the only new beat that is. |
| `taken` | The last tower falls. A heart comes back, the camera opens out, the hero walks in. Then `bloom` — the village's own fan, like any crossroad. |
| `overrun` | The last heart goes. A moment for it, then `over`. |

`overrun` rather than `falling`: the fall is the mouth, which is a picture of
running out of way. Being overrun at the walls is a different end and deserves
its own.

### Entering

Dialling a fortified village's number starts an ordinary `walk`. The hero holds
at `SIEGE_STANDOFF` — about 0.82 of the way — which is where it stands for the
whole fight, outside the gate, below the walls.

The siege itself is generated when `closing` begins, not when the crossroad was
grown: its numbers have to be measured against the grid the hero actually
arrives holding, exactly as a fan is.

### Leaving early

A **RETREAT** button on the siege screen, and it costs a heart. Not a fourth kind
of number — the screen already carries towers, warriors and the sum, and a number
that means *leave* among numbers that mean *hit* is a trap.

It drops the hero back one crossroad down the existing `retreat` beat. If it
takes the last heart, the run ends. A village that was fled **resets** when it is
walked to again: towers back to full, fresh numbers. Keeping the damage would
make chip-and-flee the cheapest way through a siege.

### Strikes

A strike cannot skip a siege. If the way answered leads to a fortified village,
the strike degrades to a plain `walk` and the hero stops at the walls. The
strike still counts as a strike — it was answered fast — it simply has nowhere to
rocket to.

## Hearts

Three, for the whole run, and only a siege ever touches them:

- a warrior reaching the hero takes one
- fleeing a siege takes one
- taking a village gives one back, capped at three
- zero ends the run, wherever the hero is standing

A retreat at an ordinary crossroad still costs only depth, exactly as it does
today. Arcade's existing failure rule is untouched.

The top bar gets the same `HeartIcon` row the game screen draws at
`app/(tabs)/index.tsx`, and `FloatingLifeLoss` plays when one goes — the same
HUD-float family, nothing new invented for it.

### The hole this leaves, named

Nothing yet makes a player **choose** the walled village. Its number is drawn
from the same band as its neighbours and it pays only a heart it first put at
risk, so as specced a cautious player never sieges, never loses a heart, and
never meets any of this.

That is deliberate and deferred: the reward for taking a village is the loot and
progression work that has not been designed. Whoever picks that up should treat
this paragraph as the brief — the lure is the missing half, and until it exists
sieges are opt-in content with no economic reason to opt in.

## The screen

The canvas already draws in one fixed frame with `camX` and `camY` as shared
values. A `camScale` joins them, going 1 → about 2.4 over roughly 760ms while the
country and the ways behind dim to about a quarter. Nothing about the fixed frame
changes — the whole reason it is fixed is that an arrival moves nothing already
drawn, and a zoom is the same promise.

The hero holds where it always holds, at `ANCHOR`. The village fills the top of
the zoomed frame. Warriors leave the gate on fanned lanes, one angle apiece from
their own seed, so two never walk the same line.

Towers use `components/game/town-mark.tsx`'s existing wall-and-merlon vocabulary
rather than a new shape, and **lose height as they are chipped** — damage needs no
gauge of its own, and a half-knocked wall says it better than a bar would.

Numerals on towers and warriors are **read, not drawn**: counter-rotated against
the sheet's turn, like every other numeral on the canvas.

### Warriors never tick in React

Each warrior carries `spawnedAt` and `travelMs`. Its position is derived on the
UI thread from the frame clock already running there, and the only state events
are **spawn**, **kill** and **arrival** — one timeout per warrior, cleared when it
dies. The same shape every other arcade beat has.

This is also what makes a pause correct. On pause, every live warrior's
`spawnedAt` shifts forward by the length of the pause, exactly as `beatAt` does,
so what is left of each walk is what was left of it. `usePauseOnBlur` learns the
`siege` phase, which is dialable and therefore a beat where going away costs
something.

## Where it lives

| File | Change |
| --- | --- |
| `machines/siege.ts` + `siege.test.ts` | **New, pure.** What a siege is made of, generating one, resolving a hit, the warrior schedule and its escalation. No React and no clock — the `machines/arcade.ts` half of the split. |
| `constants/siege.ts` | **New.** Its timings, counts and sizes, mirroring `constants/arcade.ts` for the same reason: the zoom, the stand-off and the warrior walk have to agree or they read as three things happening at once. |
| `machines/arcade.ts` | `fortified` and `dry` on `Crossroad`; the roll inside `openCrossroad`; `wayValues` generalised to `parValues`. |
| `hooks/use-arcade-run.ts` | The four phases, `siege` and `hearts` on `Run`, the flee, and the pause shift. |
| `components/game/siege-field.tsx`, `siege-tower.tsx`, `siege-warrior.tsx` | **New.** The zoomed fight, kept out of `arcade-game.tsx`, which is already 717 lines. |
| `components/game/arcade-game.tsx` | The zoom, mounting the field, the hearts row, the retreat button. |
| `components/game/arcade-over.tsx` | "Villages taken" beside depth and strikes. |
| `components/overlays/how-to-play-overlay.tsx` | Required by CLAUDE.md. The guide already names arcade in fourteen places and must say what a siege is. |

Randomness follows the existing `rngFor(seed, key)` pattern: a siege is keyed on
`siege:${crossroadId}`, its nth warrior on `siege:${crossroadId}:w${n}`. A run is
still one seed and nothing else, and a bug report is still one number.

## What is tested

`machines/siege.ts` is pure, so it is unit-tested the way `machines/arcade.ts` is:

- a generated siege has distinct numbers across every tower and warrior
- a warrior spawned against a moved grid is still inside the press band
- a hit resolves exactly one thing, and a sum that did not change resolves nothing
- tower count, hits per tower and spawn cadence are monotonic in depth
- spawn cadence is monotonic in warriors-spawned within one siege

`machines/arcade.ts` gains:

- a fan is never fortified out of a fortified crossroad
- `dry` reaching three forces one
- growing the same crossroad twice gives the same walls
- over a long branch, the share of fans offering a fort is about a third

## Open questions

1. **The lure.** Named above. Nothing makes a siege worth entering until the
   reward work exists.
2. **Siege length at depth.** 30 tower hits may be too long. First thing to move.
3. **Whether a fled village should stay fled.** Specced as a reset. If flight
   turns out to be the common outcome, a village the player has already bled
   might deserve to remember it.
