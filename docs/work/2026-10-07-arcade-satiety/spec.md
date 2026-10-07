# Satiety in arcade

Slug: arcade-satiety
Stage: build
Next: /verify arcade-satiety
Track: full
Branch: feat/arcade-satiety
Started: 2026-10-07

## Problem

An arcade run costs the hero nothing to walk. Depth is the score, the clock is the only
pressure, and hearts are spent by exactly one thing — a siege — so a player who avoids
walled villages meets no attrition at all and a long run is a long sequence of free
choices. Nothing on the map is scarce, so there is no reason to go anywhere in
particular.

## Appetite

**A day or two.** A real mechanic, inside what already exists: new run state, a new
reading in the top row, a drain, a refill, and one new way to lose. No new tables, no
new screen. Arcade is behind the `arcade` feature already, so this lands without being
shown to anyone it is not ready for.

## Shape

**Satiety** (Czech _sytost_) is how fed the hero is: a bar that empties as the run walks
and fills when a village falls. Full is fed, empty is starving.

The run opens at the dawn card with the bar full, under the hearts in the top row — the
place a scored run keeps its score. The player dials a sum, a way lights, the hero walks
it, and on arrival the bar drops. How far it drops is the answer they just gave: a way
taken in par presses costs the smallest bite there is, and every press over par costs
more, on the accuracy curve the app already scores hits with. So the drain is not a tax
on playing, it is the price of being imprecise — and the first thing a player notices is
that a clean answer is cheaper than a scrambled one.

A strike costs one bite, not two. The crossroad a rocket passes through was never
answered, and the free leg is part of what being fast already buys.

A retreat — the pull back down the way behind when the clock runs out — costs a full
bite with no accuracy relief. There was no answer to be accurate about.

A siege does not drain: a fight is a place rather than a step, and the warriors coming
out of the gate are pressure enough. Taking the village fills the bar and still returns
the heart it returns today. A walled village is now the only food on the map, which
turns the one thing a careful player was avoiding into the thing they have to walk
toward.

At empty the bar goes red and pulses, and the hero starves: one heart every five
seconds, until the food arrives or the last heart goes — and the last heart going is
`overrun`, the end arcade already has. Starving does not stop the run, the clock or the
dial. A player on their last heart with an empty bar has fifteen seconds and a choice
about where to spend them.

Areas it touches:

- **The arcade rules** (`machines/arcade.ts`, or a small module beside it) — what a bite
  costs, how accuracy scales it, what a village gives back, how fast starving bites.
  Pure, tested, no clock.
- **The run** (`hooks/use-arcade-run.ts`) — satiety on `Run`, presses counted per leg,
  the drain on arrival, the refill on `taken`, and one more timer for the starve tick.
- **The screen** (`components/game/arcade-game.tsx` plus one new bar component) — the
  bar in the top row, the red, the pulse.
- **Constants** (`constants/arcade.ts` or a new `constants/satiety.ts`) — every number
  above, in one table.
- **Copy** — the bar's label and whatever the starving state says, extracted and
  translated; plus the How to Play arcade chapter, which currently promises that _"a
  siege is the only thing in the mode that spends them"_ about the hearts.
- **Domain language** — `satiety` into the CLAUDE.md table, beside _record_ / _medal_ /
  _achievement_ and the rest.

Not a mode's business and not the engine's: arcade runs on its own engine, so none of
this reaches `RunRules`, `traitsOf`, or anything the targets modes are governed by.
Nothing outside `modes/` learns a mode's name because of this work. No new feature key
either — `arcade` is the flag, and it is already in place.

## In

- Satiety on the arcade run: full at dawn, drained per crossroad walked, scaled by
  presses against par.
- The bar in the top row, under the hearts, in arcade's own amber until it is empty and
  red.
- A siege filling it, on top of the heart a siege already gives.
- Starving: red, pulsing, one heart per five seconds, into the `overrun` end that exists.
- A strike costing one bite; a retreat costing a full one.
- How to Play's arcade chapter made true again, and the domain word written down.

## Out

- **Food anywhere but a village.** No foraging, no bud that is a meal, no pickup on a
  way. One source keeps the mechanic legible and the map unchanged.
- **Satiety on the pause and game-over screens.** The two run stats stay strikes and
  villages taken; whether the bar's history is worth a third figure is a question for
  after it has been played.
- **Satiety in any other mode.** Trainee, Accuracy and Speed are untouched. This is
  arcade's, and the engine has no opinion about it.
- **Tuning satiety across depth.** One bite size for the whole run. The clock already
  tightens with depth; two curves pulling at once is a balance problem, not a mechanic.
- **Persisting it.** A run is a run; nothing about satiety survives one.
- **A new end-of-run cause on screen.** Starving kills through hearts, so the run ends
  the way being overrun already ends it. No second death card.

## Rabbit holes

- **Counting presses per leg.** The grid carries across crossroads and a drag is several
  presses in one tick, so "how many presses did that answer take" is not a number the
  hook keeps today. The way around: count from the beat the crossroad opened, and take
  par from `computePar` against the grid the fan was opened with — which is exactly the
  grid the player started dialling from. Both halves already exist; the risk is only in
  being careless about `bloom`, where dialling is allowed before the clock starts.
- **Two clocks in one hook.** The run has one resumable timer, built so a pause can be
  resumed without a second clock. The starve tick is a second thing that has to stop on
  pause and on the blur hook, and bolting it on beside the beat timer rather than
  through the same `beatAt` / `heldMs` discipline is how a pause starts leaking hearts.
  The spec should say which of the two it is.
- **Starving mid-siege.** The player can arrive at a village already empty, and then the
  fight and the starve tick are spending the same three hearts at once. It is probably
  the right drama, but it is also the case where a run dies to something the player
  cannot see coming. Worth a deliberate answer in the spec rather than a discovered one.
- **The five seconds.** Three hearts at one per five seconds is a fifteen-second fuse,
  and the nearest village may be two crossroads away. If play says that is a death
  sentence rather than a scramble, the fix is the bite size or the siege refill — not a
  longer fuse, which would make starving mean nothing.
- **The bar in a crowded row.** The top row already holds ARCADE, the place name, NINE,
  the pause button and three hearts. A bar that pulses red is the loudest thing on the
  screen when it fires, and it has to not read as part of the hearts. One for the
  design-guide at spec.

---

## Contract

### Domain words

**Used, and used as `CLAUDE.md` defines them:** a **run** (one arcade climb, dawn to
`over`), the **grid** and the **dial** (`ARCADE_DIAL`, nine keys like everywhere else),
a **crossroad** and a **way** and a **siege** (`machines/arcade.ts`, `machines/siege.ts`),
a **strike** (a crossroad answered fast enough to rocket through the next one).

One word was loose in the shape and is pinned here: a **leg** is one way walked — the
unit satiety is charged by. A strike covers two legs and is charged for one; a retreat
is a leg walked backwards and is charged in full.

**Introduced:**

| Word         | Definition                                                                                                                           | Lives at                                    |
| ------------ | ------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------- |
| **satiety**  | How fed the hero is on an arcade run, nought to one. Full at dawn, spent by walking, filled by taking a village. Czech _sytost_.     | `satiety` on the run, `machines/satiety.ts` |
| **bite**     | What one leg takes out of it. The smallest bite is a leg answered in par presses; the largest is one answered with no accuracy left. | `biteFor`                                   |
| **starving** | Satiety at nought: the bar red and pulsing, and a heart going every five seconds until food arrives or the run ends.                 | `starving()`                                |

`CLAUDE.md`'s "Other key words" table gains a **satiety** row. **Bite** and **starving**
are satiety's own vocabulary and stay in the module's comments rather than the table —
a word earns a row when a second file has to know it.

**Collisions.** None near satiety itself. One worth stating because it is one letter
from a trap: a **bite** is what a leg costs the hero, and has nothing to do with a
**hit**, which everywhere else in this app is a target answered and scored. Arcade
scores nothing, so `hit` never appears in this work.

### Files

| Path                                          | New? | Responsibility                                                                                                                 |
| --------------------------------------------- | ---- | ------------------------------------------------------------------------------------------------------------------------------ |
| `machines/satiety.ts`                         | new  | The numbers and the rules: what a bite costs, what spending one leaves, when the hero is starving. Pure, no clock.             |
| `machines/satiety.test.ts`                    | new  | Colocated, beside `machines/siege.test.ts`.                                                                                    |
| `components/game/satiety-bar.tsx`             | new  | The bar: a fraction, a colour, and the pulse at empty. One component, no run state inside it.                                  |
| `hooks/use-arcade-run.ts`                     | mod  | `satiety` on the run, presses counted per leg, the bite on an answer and on a retreat, the feast on `taken`, the starve clock. |
| `components/game/arcade-game.tsx`             | mod  | The bar into the top row, beside the hearts.                                                                                   |
| `dev/arcade-dev-state.ts`                     | mod  | `satiety` on the published state, `setSatiety` on the actions.                                                                 |
| `dev/arcade-section.tsx`                      | mod  | The slider for it, beside the hearts'.                                                                                         |
| `components/overlays/how-to-play-overlay.tsx` | mod  | The arcade chapter: satiety explained, and the hearts sentence made true again.                                                |
| `locales/*.po`                                | mod  | Czech, via `pnpm i18n:extract`.                                                                                                |
| `CLAUDE.md`                                   | mod  | The **satiety** row.                                                                                                           |

Two files fewer than the shape guessed. There is no `constants/satiety.ts`: the reason
`constants/siege.ts` and `constants/arcade.ts` exist is that the screen and the machine
have to agree about timings, and nothing on screen here needs a number the machine holds
— the bar is handed a fraction and a boolean. The numbers stay with the rules that use
them.

### Data and types

`machines/satiety.ts`:

```ts
export const FULL = 1
export const BITE_MIN = 0.1 // a leg answered in par presses
export const BITE_MAX = 0.2 // a leg answered with no accuracy left
export const RETREAT_BITE = BITE_MAX
export const STARVE_MS = 5000

// BITE_MIN + (BITE_MAX - BITE_MIN) * (1 - accuracyFactor(par, presses))
export function biteFor(par: number, presses: number): number
export function spent(satiety: number, bite: number): number // clamped to 0…FULL
export function starving(satiety: number): boolean // satiety <= 0
```

`biteFor` leans on `accuracyFactor` from `machines/scoring.ts` — the same curve a hit is
scored by, so "accurate" means in arcade exactly what it means everywhere else. Full bar
buys ten crossroads answered at par, five answered badly.

`Run` in `hooks/use-arcade-run.ts` gains four fields:

```ts
satiety: number // nought to one
legGrid: Grid // the grid the fan here was opened against — what par is measured from
legPresses: number // presses since the hero arrived, the landing one included
starvingAt: number | null // wall clock of the next heart to hunger; null while there is food
```

`legGrid` mirrors `refGrid` on the game machine's targets, and for the same reason: par
has to be measured from where the player started dialling, not from where the grid ended
up. It cannot be precomputed onto `ArcadeWay` — a retreat returns to a crossroad whose
ways were chosen against an older grid, and the player's grid has moved since.

`starvingAt` is an absolute stamp rather than a countdown, so `resume` shifts it by the
pause duration exactly as `shift(siege, away)` already shifts a siege's clocks.

The hook's return gains `satiety: number` and `starving: boolean`.

No storage key, no schema, no migration. A run is a run; nothing about satiety survives
one.

### Copy, and the gates

| Gate            | Answer                                                                                                                                                                                                                                                                                                                                      |
| --------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Copy / i18n** | **No new string on the game screen.** The bar carries no label — the hearts beside it carry none either, the row already holds five things, and a word that pulses red is louder than the bar. Two strings change, both in How to Play, both extracted and both Czech: one new paragraph on satiety, and the amended hearts sentence below. |
| **How to Play** | **Yes** — this touches lives. `components/overlays/how-to-play-overlay.tsx`, the `arcade` section. The siege paragraph currently reads _"Three hearts sit on the bar under ARCADE, and a siege is the only thing in the mode that spends them"_ — the second half is false the day this ships.                                              |
| **Flag**        | `arcade`, already in `constants/features.ts` and already the gate on the pill, the screen and the chapter. No new key, no floor to set.                                                                                                                                                                                                     |
| **Buttons**     | **None.** No new pressable. The dev slider is behind `__DEV__` and is not a `TrackedPressable`.                                                                                                                                                                                                                                             |

## Acceptance criteria

1. A fresh arcade run opens fed: `startRun` sets `satiety` to `FULL`, and the bar in the
   top row — right of the hearts, same row — is drawn full in arcade's amber.
2. `biteFor(3, 3)` is `BITE_MIN`. `biteFor(3, 20)` is `BITE_MAX`. Between them it rises
   with every press over par and never leaves `[BITE_MIN, BITE_MAX]`.
3. Answering a crossroad spends one bite, measured from the grid the fan was opened
   against and the presses made since the hero arrived, the landing press included. The
   bar animates down over the walk rather than snapping when the key is pressed.
4. A strike spends one bite, not two: a run that rockets through a crossroad ends the
   movement with the same satiety as one that walked a single leg of the same accuracy.
5. The clock running out spends `RETREAT_BITE` with no accuracy relief, charged as the
   retreat begins.
6. A siege spends nothing: pressing at towers through a whole fight leaves `satiety`
   exactly where it stood when the camera closed.
7. Taking a village sets `satiety` to `FULL` **and** still returns a heart, capped at
   `HEARTS` — both, not one or the other.
8. At nought the bar is the hearts' own red (`#E5534B`) and pulsing, and one heart goes
   every five seconds. Nothing else stops: the crossroad's clock, the dial and the map
   all keep working, in a siege included.
9. The last heart lost to hunger ends the run through `overrun` into `over` — the end
   arcade already has. No second death card, and `playedMs` stops the same way it does
   when a siege overruns.
10. Pausing holds the starve clock: a run paused with four seconds to the next bite and
    resumed still has four. True for the pause button and for backgrounding the app.
11. How to Play's arcade chapter explains satiety, and no longer claims a siege is the
    only thing that spends hearts. `CLAUDE.md` has the **satiety** row.
12. `pnpm check` is green, Czech included.

## Tests

**`machines/satiety.test.ts`** (new) — `biteFor` at par, one over, many over, and that it
is monotonic and bounded by `BITE_MIN`/`BITE_MAX`; `biteFor` with a par of nought, which
`computePar` returns for an unreachable sum, not dividing by anything; `spent` clamping at
both ends; `starving` true at nought and at a negative, false at a crumb.

**`machines/arcade.test.ts`** (extend) — nothing. The map does not know about satiety and
should not start.

No test for the bar. It is a fraction and a colour; criterion 1 and 8 are what check it.

## Review focus

1. **The second timer.** The hook runs _one_ `timer.current`, re-armed by a beat effect
   keyed on `[phase, seq, paused, beatAt, clockMs]`, and the starve clock has to tick
   across every one of those beats rather than within one. It needs its own ref and its
   own effect — and that effect's cleanup must not be the thing that clears the beat
   timer, nor the beat effect the thing that clears this one. Check it is disarmed on
   `overrun`, `falling` and `over`, or a run that has ended keeps eating hearts.
2. **Backgrounding mid-flight.** `usePauseOnBlur` is armed only while `DIALABLE`, so a
   walk or a rocket keeps running on wall clock while the app is away — deliberately, and
   stated in the hook. A starve bite can therefore land with the screen gone. Check it
   cannot take the _last_ heart there, leaving `overrun` to fire into a screen that was
   never watching.
3. **`legPresses` reset.** It must go back to nought on every arrival — after a walk,
   after a rocket, after a retreat, and after `taken` — or a siege's dozens of presses
   are billed to the next leg and the first crossroad out of every village costs
   `BITE_MAX`.
4. **The grid par is measured from.** `openCrossroad` grows the fan against the grid the
   hero arrives holding; `legGrid` has to be that same snapshot, stamped at the same
   moment. Taking it at the landing press instead would price the leg against a grid the
   player's own presses moved, and par would read as nought waste every time.
5. **The dev actions.** `deepenBy` walks a couple of dozen crossroads in one call —
   decide whether it charges nothing (it dials nothing, so nothing) and say so, rather
   than leaving it to charge twenty bites and starve a run the moment the tool is used.
   `setSatiety` must not be able to end a run outside the beats, the way `setHearts` is
   floored at one for exactly that reason.
