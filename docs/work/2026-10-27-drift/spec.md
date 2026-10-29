# Drift

Slug: drift
Stage: review
Next: /ship drift
Track: full
Branch: feat/drift
Started: 2026-10-27

## Problem

Every target in the app holds still. Its number is the same from the moment it lands to
the moment it is hit or lost, so the only thing time does to a target is drain its
ring. There is no challenge about **reading a moving number**: aiming at where a target
is going rather than where it is, and being rewarded for catching it before it has
moved at all. The engine can't build one. A target's `value` is fixed at spawn, the
card draws a fixed number, the spawner deals from the whole range, and no streak rule
knows how old a target was when it fell. So a catalog entry asking for this would
typecheck, then play as an ordinary Accuracy Hard.

## Appetite

**A day or two.** That buys:

- one rules field, defaulted so every mode is unchanged
- a direction on each target
- one function giving a target's value at a moment, read by the machine, the card and
  the spawner
- a new streak rule
- the saved run carrying the direction
- the catalog entry with its Czech and claims, and the CLAUDE.md rows

No schema, no new screen. If it runs over, the card's arrow gets plainer and the shape
stays the same.

decided by advisor: NO SLIP and SIDEWAYS (a defaulted rules field, a machine change, the
catalog) are the size precedent; DRIFT adds a streak rule and the saved run.

## Shape

### What the player meets

1. An admin books a session of DRIFT. The card shows DRIFT and nine dots: "Every number
   drifts. Catch it before it moves."
2. The player starts. It is Accuracy Hard (the nine dial, a 16.5 s ring, three hearts,
   arrivals closing in), but each target's card carries a small ▲ or ▼, and its number
   moves by one every second in that direction for as long as it stands.
3. No target drifts off the dial. A rising target never spawns so high that it would
   pass the dial's top within its ring, and a falling one never so low that it would go
   below nought.
4. The player dials to a target. A hit counts if the sum equals the target's value
   **at the moment of the press**: chase a 147 that is now 149, and 149 is what hits.
5. A hit's points come from speed alone: the more ring left, the more it is worth.
   Accuracy isn't measured, so the route taken doesn't matter.
6. A hit while the target still shows the number it arrived with (its first second)
   builds the strike chain, ×2 → ×4 → ×8. Any hit after it has moved breaks the chain.
   A Speed-style burst fires on each strike.
7. Pausing stops the drift as it stops the ring. A run put away and restored comes back
   with every target where it was and still drifting the same way.
8. A target lost to its ring costs a heart, as on Accuracy.
9. Game over and the session board are as for any challenge. Its claims are about
   catching moving numbers.

### Areas

- **Rules** (`modes/`): `spawn.drift`, a step length in ms or null, null for every mode.
  A new `StreakTrigger` for the first-second hit, with its fact.
- **Machine** (`machines/game.ts`): `Target` gains a direction; `ADD_TARGET` carries it.
  The hit match reads the target's value at the press's `now`; `streakFactsOf` gains the
  first-second fact.
- **Target value** (`lib/`, beside `lib/target-value.ts`): the drifting range for a
  given ring and direction, and the value at an age. Pure, with tests.
- **Spawner** (`hooks/use-target-spawner.ts`): picks a direction and a value that stays
  on the dial for the target's ring.
- **The card** (`components/game/target-card.tsx` / `pie-countdown.tsx`): the number
  steps each second, ▲/▼ beside it. It stops while paused, like the ring.
- **Saved run** (`lib/saved-run.ts`): the direction survives a restore. Absent reads as
  none, so older saves are untouched.
- **Catalog**: DRIFT appended. Base `ACCURACY`, `fixedDifficulty: 'hard'`,
  `spawn: { drift: 1000 }`, `scoring: { weights: { acc: 0, spd: 1 }, streak: <the new
trigger> }`, `shot: 'burst'`.
- **Copy**: label, description, Czech. **CLAUDE.md**: rows for **drift** and the new
  streak rule.

decided by advisor: no feature flag. A challenge reaches players only through a booked
session.

## In

- `spawn.drift`, the target's direction, the value at an age, and the drifting range.
- The machine's hit match on the drifted value; the new streak rule.
- The card's stepping number and its arrow; the saved run's direction.
- The DRIFT entry, claims, Czech, CLAUDE.md rows.

## Out

decided by advisor: all five agreed.

- **Multiplayer:** challenges don't run there.
- ~~A target drifting onto the current sum is not a hit by itself.~~ Reversed by the user
  after review (2026-10-29): it is a hit the moment its number arrives. See AC 6.
- **Combining with GLIMPSE:** a hidden number that drifts is a different challenge.
- **A sound or haptic on each step.**
- **The How to Play:** the challenges chapter is generic.
- **Accuracy-based anything on DRIFT:** par and the wasteful bar are untouched in the
  engine. DRIFT simply weighs accuracy at nought, and challenges spend no heart on a
  wasteful hit anyway.

## Rabbit holes

- **The number between renders.** The machine decides a hit on `now` at the press, and
  the card draws the value from its own clock. If those two disagree by a frame at a step
  boundary, the player sees 148 and hits 149. Both must read one function of
  `now − spawnedAt`, and the card should show the step that the next press would match.
- **The first-second fact.** Read from the target's age at the hit, against the step
  length. A batch hitting two targets at once: the fact holds only if every target in the
  batch was fresh, as `fast` treats a batch.
- **The spawner's exclusions.** It avoids values already standing and the current sum.
  With drift, a new target's value now and the others' values now must be compared at the
  same moment.
- **Speed factor with no accuracy.** `{ acc: 0, spd: 1 }` makes the headline speed. Check
  the game-over stats and the run screen read sensibly when accuracy is weighed at nought
  (AVG SPD shown, not AVG ACC).
- **Saved runs.** `spawnedAt` is shifted on restore, as for the ring, so the drift
  resumes from where it was. The direction must be written and read back, or a restored
  target stops drifting.

## Contract

### Domain words

**Used:** **challenge**, **session**, **run**, **rules**, **dial**, **grid**,
**claim**, **streak** and **strike** (a strike is a hit made on the streak), **glimpse**
(a different rule, untouched), **drill** (spelled alike, no relation).

**Introduced:**

- **drift**: a target's number moving by one on a fixed step for as long as it stands,
  in a direction fixed when it arrived. The rules say how often
  (`spawn.drift: number | null`, ms per step, null for every mode but DRIFT). The target
  says which way (`Target.drift: 1 | -1 | 0`, 0 for every target that does not drift).
  A target's value at a moment is `driftedValue` (`lib/target-drift.ts`); the number on
  the card, the hit the machine finds and the values the spawner avoids are all read
  from it. CLAUDE.md gains a row.
- **fresh**: the streak trigger for a hit on a target still showing the number it
  arrived with, under its first step. `'fresh'` in `StreakTrigger`, the fact
  `allFresh`. It is named in the **drift** row rather than given one of its own, because
  it has no meaning without drift.

**Collisions:**

- **drift / drill:** a drill is which targets arrive; a drift is how a standing target's
  number moves. Unrelated, despite the spelling.
- **fresh / fast:** `fast` is about the ring left at the hit; `fresh` is about the
  number not having moved yet.
- **CLAUDE.md's "drift into one word":** that is plain English, not the domain word.

### Files

**Created**

| Path                       | Responsibility                                                                                                                                                           |
| -------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `lib/target-drift.ts`      | `driftedValue(target, now, step)`, and `driftRange(dial, direction, durationMs, step)`: the range a target may spawn in so it never leaves `0 … maxSum` within its ring. |
| `lib/target-drift.test.ts` | Both, at every edge.                                                                                                                                                     |

**Modified**

| Path                                                                   | Change                                                                                                                                                                  |
| ---------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `modes/types.ts`                                                       | `spawn.drift` on `TargetRules`, documented beside `glimpse`.                                                                                                            |
| `modes/rules.ts`                                                       | Base `spawn.drift: null`; `RunRules['spawn'].drift`; resolved through like `glimpse`.                                                                                   |
| `modes/streak.ts`                                                      | `'fresh'` in `StreakTrigger`; `allFresh` in `StreakFacts`; built by `allFresh`, broken by any hit (like `fast`).                                                        |
| `machines/game.ts`                                                     | `Target.drift`; `ADD_TARGET` takes an optional `drift`, absent meaning 0. `applyGrid` matches on `driftedValue` at the press's `now`. `streakFactsOf` gains `allFresh`. |
| `hooks/use-target-spawner.ts`                                          | On a drifting mode: a direction (½ up, ½ down), a value in `driftRange`, exclusions taken from the standing targets' values now. Sends `drift` with `ADD_TARGET`.       |
| `hooks/use-displayed-targets.ts`                                       | Carries `drift` onto the displayed target.                                                                                                                              |
| `app/(tabs)/index.tsx`                                                 | Hands the spawner the standing values as they are now, and each card the run's `spawn.drift`.                                                                           |
| `components/game/target-card.tsx`, `components/game/pie-countdown.tsx` | On a drifting target: the number is the drifted value, read off the ring's own progress, so it stops while the ring is frozen. A small ▲/▼ is drawn with it.            |
| `lib/saved-run.ts` (+ test)                                            | Writes and reads `drift`; absent reads 0. The key is unchanged: absent means what it meant.                                                                             |
| `lib/strike-rule.ts`                                                   | A line for `fresh`, with Czech.                                                                                                                                         |
| `modes/challenges/catalog.ts`                                          | `DRIFT` appended.                                                                                                                                                       |
| `modes/challenges/challenges.test.ts`                                  | DRIFT resolves; it is in the order pin.                                                                                                                                 |
| `machines/game.test.ts`, `modes/rules.test.ts`                         | Hit on the drifted value; `fresh` builds and breaks; no mode but DRIFT drifts.                                                                                          |
| `CLAUDE.md`                                                            | The **drift** row.                                                                                                                                                      |
| `locales/*.po`                                                         | Label, code, description and the strike line, with Czech.                                                                                                               |

### Data and types

```ts
// modes/types.ts — on TargetRules['spawn'], beside glimpse
drift: number | null   // ms per one-step move; null = numbers hold still

// machines/game.ts
type Target = { …; drift: 1 | -1 | 0 }
| { type: 'ADD_TARGET'; value: number; at: number; drift?: 1 | -1 }

// lib/target-drift.ts
driftedValue(target: Pick<Target, 'value' | 'drift' | 'spawnedAt'>, now: number, step: number | null): number
  // value + drift × floor((now − spawnedAt) / step); value itself when step is null or drift is 0
driftRange(dial: DialSpec, drift: 1 | -1, durationMs: number, step: number): TargetRange
  // up:   0 … maxSum − ceil(duration / step)
  // down: ceil(duration / step) … maxSum

// modes/streak.ts
StreakFacts.allFresh: boolean   // every target hit in the batch was under its first step
STREAK_TRIGGERED.fresh = anyHit && allFresh
STREAK_BROKEN.fresh   = anyHit
```

`spawnedAt` is already moved forward on RESUME and restored from a stored age, so a
target's age always excludes paused time; drift reads it as the ring does.

**Saved runs:** `SavedTarget.drift?: 1 | -1`, written only when non-zero. No new key: a
save without it is a run with no drifting targets, which is what every save so far was.

**Schema:** none.

### Copy and the gates

| Gate            | Answer                                                                                                                                                                                                                                                                                                                                                                                                                          |
| --------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Copy / i18n** | Label `DRIFT`, code `DRF`, description "Every number drifts. Catch it before it moves." Strike line for `fresh`: "Take every target before its number has moved." Czech: label `UNÁ­ŠENÍ` (soft hyphen: UNÁ / ŠENÍ in the dialog), code `UNÁ`, "Každé číslo se posouvá. Chyť ho, než se pohne.", strike line "Sejmi každý cíl dřív, než se jeho číslo pohne." The ▲/▼ is a glyph, not copy. Claims are wordmarks, untranslated. |
| **How to Play** | None. The challenges chapter is generic, and no permanent mode's rules move.                                                                                                                                                                                                                                                                                                                                                    |
| **Flag**        | None (decided by advisor in shape).                                                                                                                                                                                                                                                                                                                                                                                             |
| **Buttons**     | None.                                                                                                                                                                                                                                                                                                                                                                                                                           |

**Claims:**

| Tier     | Lines                                  |
| -------- | -------------------------------------- |
| `board`  | QUICK DRAW · CAUGHT EARLY · HELD STILL |
| `medal`  | NEAR CATCH · LATE GRAB                 |
| `strong` | FIRST LOOK · SNAP SHOT                 |
| `cold`   | DRIFTED OFF · ALL ADRIFT               |

## Acceptance criteria

1. `runRules(challengeId('drift'), 'easy')`:
   - difficulty `hard`, the nine dial
   - `spawn.drift` 1000
   - weights `{ acc: 0, spd: 1 }`, headline `spd`
   - streak `'fresh'`
   - three lives
   - clock equal to Accuracy Hard's

   The shot is `burst`.

2. Every other mode resolves `spawn.drift` to null, and every target they deal has
   `drift: 0`. Their numbers never move, and the existing tests pass unchanged.
3. `driftedValue` returns the spawn value for ages under one step, then moves one per
   step in the target's direction. It returns the value itself when the step is null or
   the direction is 0.
4. `driftRange` for a 16.5 s ring at 1 s steps is `0 … 307` for a rising target and
   `17 … 324` for a falling one. A target dealt in it never reads outside `0 … 324`
   before its ring runs out.
5. In the machine, a press that makes the sum equal a target's drifted value at that
   `now` hits it. A press equal to its spawn value after it has moved does not.
6. A target drifting onto the sum already dialled is hit **the moment its number arrives**,
   without a press (amended 2026-10-29, decided by the user). The machine checks on a
   `TICK` at each step boundary; such a hit counts no press and is never `fresh`.
7. `fresh`: a hit on a target under its first step builds the streak (×2, ×4, ×8). A
   hit on one that has moved breaks it. A batch counts as fresh only if every target in
   it is.
8. Pausing stops the drift: a target's number reads the same on CONTINUE as when MENU
   was pressed, and its next step comes a full step's remainder later. A run put away and
   restored brings every target back at its drifted value, still moving the same way.
9. On DRIFT, each card draws its current value and a ▲ or ▼. The number steps once a
   second, stops while paused, and on a hit shows the value it was hit at.
10. A DRIFT hit scores on speed alone. Two hits with the same ring left and different
    routes score the same, and the game-over stats show AVG SPD.
11. The challenge dialog draws DRIFT, its strike line reads "Take every target before its
    number has moved.", and a game over draws claims from DRIFT's pools.
12. `pnpm check` is green, Czech included.

## Tests

- `lib/target-drift.test.ts`: `driftedValue` and `driftRange` at the edges, including
  step boundaries, null step, direction 0, and the range's ends (AC 3, 4).
- `machines/game.test.ts`:
  - a hit on the drifted value
  - no hit on the stale value
  - no hit from drifting onto the sum
  - `fresh` builds, breaks, and treats a batch as all-or-nothing

  (AC 5–7)

- `modes/rules.test.ts`: `spawn.drift` is null for every mode but DRIFT (AC 2).
- `modes/challenges/challenges.test.ts`: DRIFT resolves as AC 1; it is appended.
- `lib/saved-run.test.ts`: `drift` round-trips, and absent reads 0 (AC 8).

## Review focus

- **Task 3 (machine):** every reader of `target.value` that means "the number now" must
  go through `driftedValue`:
  - the hit match
  - `remaining`
  - the spawner's exclusions

  The ones that mean "what it arrived as" must not: `par`, the drill index and saved
  runs. Grep every `.value` on a target and sort each.

- **Task 5 (card):** the card reads its step off the ring's progress; the machine reads
  `now − spawnedAt`. At a step boundary they can disagree for a frame. Check that the
  displayed value is the one a press at that instant would hit, and that the card's
  first step comes exactly one step after it arrived, not after its entrance animation.
- **Task 4 (spawner):** the range is worked out from the clock the target **will** get
  (`rampedTimeout` at the current hits, as `ADD_TARGET` sets it). A range from a
  different clock lets a long-lived target drift off the dial.
- **Task 2 (streak):** `allFresh` has to be false on a mode with no drift, or `fresh`
  would build on every hit if a later mode named it without `spawn.drift`.
- **Task 6 (saved run):** `drift` is written only when non-zero, and read with a default.
  A save from before this ships must restore unchanged.
