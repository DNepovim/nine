# Trainee Coach Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Give Trainee a coach that reads the player's presses against the par DP already in the codebase and says, in the line under the stat row, when a move was wasted, when a habit is costing them, and what a hit cost.

**Architecture:** A pure reducer in `machines/coach.ts` holds every rule and threshold and returns at most one verdict per press. A pure word-pool in `lib/coach-lines.ts` turns a verdict into a short line and ranks the four kinds against each other. A thin hook, `hooks/use-trainee-coach.ts`, feeds the reducer presses, layers the on-hit debrief on top, and owns the dwell timer. The screen calls the hook beside its existing `send` and passes `celebration.message ?? coach.line` into the existing `HitPraiseLine`. No component renders anything new.

**Tech Stack:** TypeScript, XState v5, Vitest, React (Expo / React Native), NativeWind. No new dependency, no new storage key.

**Spec:** `docs/superpowers/specs/2026-08-11-trainee-coach-design.md`

## Global Constraints

- Follow the `code-guide` skill: no `any`, no `as` assertions, no `!` non-null assertions, **no `// eslint-disable` comments**, `type` over `interface`, `type` keyword on import-only lines, `@/` path alias never relative `../`, early returns over nesting.
- `noUncheckedIndexedAccess` is on. Guard indexed access or use `??`.
- Select a value from a known set with a module-level `as const satisfies Record<Union, Value>` map, never an `if`/ternary chain or `switch`.
- Use `narrowland` guards (`isNonEmptyArray`, `isOneOf`, `isNotNull`) instead of manual multi-part checks.
- Every pure function in `lib/` and every helper in `machines/` gets a colocated `<name>.test.ts`. Hooks and presentation are untested unless the behaviour is non-trivial.
- Every coach line is **at most 24 characters** — the cap `lib/hit-praise.test.ts` already enforces on praise. Sentence case, not the app's shouting caps.
- Thresholds are named module-level constants in `machines/coach.ts`: `LOST_PRESSES = 3`, `TAP_RUN = 4`, `COARSE_GAP = 12`, `FINE_WEIGHT = 2`, `HABIT_COOLDOWN_TARGETS = 8`. `COACH_MS = 3000` lives in the hook, because the reducer has no notion of time.
- The coach is Trainee-only and only while playing: `inRun && mode === 'trainee'`, the same gate as `useHitCelebration`.
- Nothing the coach says may name a key to press or a value to set. It coaches; it does not solve.
- Run one file's tests with `pnpm exec vitest run <path>`; the whole gate is `pnpm check`.

## File Structure

| File                                          | Responsibility                                                                        |
| --------------------------------------------- | ------------------------------------------------------------------------------------- |
| `machines/scoring.ts`                         | gains `cellWeight(index)` — the dial-key weight formula, currently duplicated         |
| `machines/game.ts`                            | `HitInfo` gains `steps` / `par`; `buildPressGrid` / `buildSetGrid` become exported    |
| `machines/coach.ts`                           | **new** — `CoachState`, `pressFacts`, `coachReducer`, `noteResolved`, every threshold |
| `lib/coach-lines.ts`                          | **new** — verdict → words, the debrief sentence, and the priority ranking             |
| `hooks/use-trainee-coach.ts`                  | **new** — press feed, debrief effect, board-change effect, dwell timer                |
| `app/(tabs)/index.tsx`                        | wiring: call the hook, notify it at the dial, merge its line with praise              |
| `components/overlays/how-to-play-overlay.tsx` | one fact on the Trainee `ModeCard`                                                    |

Task order is bottom-up, so each task's tests run against real dependencies rather than stand-ins: machine groundwork, then the rules, then the words that name them, then the hook, then the wiring.

---

### Task 1: Machine groundwork

Three small additions the coach needs from existing modules, in one commit because they share a test run and none is independently interesting: the key-weight helper, the route figures on `HitInfo`, and exporting the two grid builders.

**Files:**

- Modify: `machines/scoring.ts` (add `cellWeight` after the `WEIGHTS` constant, around line 7)
- Modify: `machines/game.ts:69-77` (`HitInfo`), `:147-164` (the two builders), `:210-215` and `:236` (`perTarget`), `:253-260` (`hitInfos`)
- Modify: `app/(tabs)/index.tsx:608` (use `cellWeight` instead of the inline formula)
- Test: `machines/scoring.test.ts`, `machines/game.test.ts`

**Interfaces:**

- Consumes: nothing.
- Produces:
  - `cellWeight(index: number): number` from `@/machines/scoring`
  - `buildPressGrid(grid: Grid, index: number, delta: 1 | -1): Grid` from `@/machines/game`
  - `buildSetGrid(grid: Grid, index: number, value: number): Grid` from `@/machines/game`
  - `HitInfo` gains `steps: number` and `par: number`

- [ ] **Step 1: Write the failing tests**

Append to `machines/scoring.test.ts`, adding `cellWeight` to its existing import from `./scoring`:

```ts
describe('cellWeight', () => {
  it('multiplies one-based row by one-based column', () => {
    expect(cellWeight(0)).toBe(1)
    expect(cellWeight(4)).toBe(4)
    expect(cellWeight(8)).toBe(9)
  })

  it('returns 0 outside the grid', () => {
    expect(cellWeight(9)).toBe(0)
  })
})
```

Append to `machines/game.test.ts`, changing its import line to
`import { buildPressGrid, buildSetGrid, effectiveTimeout, gameMachine, type Grid } from '@/machines/game'`:

```ts
describe('hit batch reports the route', () => {
  it('carries the steps taken and the par for an optimal hit', () => {
    const actor = start('trainee')
    actor.send({ type: 'ADD_TARGET', value: 9, at: 0 })
    // Index 8 carries weight 9, so one press from the empty grid lands 9 exactly.
    actor.send({ type: 'PRESS', index: 8, delta: 1, now: 0 })
    const [hit] = actor.getSnapshot().context.hitBatch.hits
    expect(hit?.steps).toBe(1)
    expect(hit?.par).toBe(1)
  })

  it('counts wasted presses in steps while par stays as it was', () => {
    const actor = start('trainee')
    actor.send({ type: 'ADD_TARGET', value: 9, at: 0 })
    // Up and back down on the ×1 key, then the ×9 key: three steps for a one-step
    // target, which is exactly what the debrief exists to name.
    actor.send({ type: 'PRESS', index: 0, delta: 1, now: 0 })
    actor.send({ type: 'PRESS', index: 0, delta: -1, now: 0 })
    actor.send({ type: 'PRESS', index: 8, delta: 1, now: 0 })
    const [hit] = actor.getSnapshot().context.hitBatch.hits
    expect(hit?.steps).toBe(3)
    expect(hit?.par).toBe(1)
  })
})

describe('grid builders', () => {
  const zeros: Grid = [
    [0, 0, 0],
    [0, 0, 0],
    [0, 0, 0],
  ]

  it('wraps a press up from 9 and down from 0', () => {
    const nines: Grid = [
      [9, 0, 0],
      [0, 0, 0],
      [0, 0, 0],
    ]
    expect(buildPressGrid(nines, 0, 1)[0][0]).toBe(0)
    expect(buildPressGrid(zeros, 0, -1)[0][0]).toBe(9)
  })

  it('leaves every other cell alone', () => {
    expect(buildPressGrid(zeros, 4, 1)).toEqual([
      [0, 0, 0],
      [0, 1, 0],
      [0, 0, 0],
    ])
  })

  it('sets a cell outright', () => {
    expect(buildSetGrid(zeros, 8, 9)[2][2]).toBe(9)
  })
})
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `pnpm exec vitest run machines/scoring.test.ts machines/game.test.ts`
Expected: FAIL — `cellWeight`, `buildPressGrid` and `buildSetGrid` are not exported, and `hit?.steps` / `hit?.par` are `undefined`.

- [ ] **Step 3: Add `cellWeight` to `machines/scoring.ts`**

Directly below the existing `WEIGHTS` constant:

```ts
// What one dial key multiplies its digit by. The dial needs it to label a button
// and the coach needs it to tell a fine key from a coarse one, so the formula lives
// here beside the weights it comes from rather than in three places.
export const cellWeight = (index: number): number => WEIGHTS[index] ?? 0
```

- [ ] **Step 4: Put the route figures on `HitInfo` in `machines/game.ts`**

Extend the type (line 69):

```ts
export type HitInfo = {
  points: number
  progress: number
  bonus: boolean
  multiplier: number
  accFactor: number
  spdFactor: number
  // What the hit cost and what it could have cost. The accuracy factor blends the
  // two into a fraction; Trainee's coach needs the figures themselves to be able to
  // say "4 would have done".
  steps: number
  par: number
}
```

Extend `perTarget`'s element type in `applyGrid` (line 210):

```ts
const perTarget: {
  points: number
  progress: number
  accFactor: number
  spdFactor: number
  steps: number
  par: number
}[] = []
```

Extend the `push` at the end of the `for (const t of matched)` loop (line 236):

```ts
perTarget.push({
  points: pts,
  progress,
  accFactor: acc,
  spdFactor: spd,
  steps: userSteps,
  par: t.par,
})
```

Extend `hitInfos` (line 253):

```ts
const hitInfos: HitInfo[] = perTarget.map((p) => ({
  points: Math.round(p.points * multiplier),
  progress: p.progress,
  bonus: multiplier > 1,
  multiplier,
  accFactor: p.accFactor,
  spdFactor: p.spdFactor,
  steps: p.steps,
  par: p.par,
}))
```

`hooks/use-floating-points.ts` spreads `HitInfo` into its own type, so the two new fields flow through it without a change there.

- [ ] **Step 5: Export the two grid builders**

Add `export` to both declarations (lines 147 and 158), with a line saying why they are public:

```ts
// Exported because Trainee's coach applies a press itself, to compare the route
// before against the route after while the machine's snapshot still holds the grid
// from before. A third copy of the wrap arithmetic was the alternative.
export function buildPressGrid(grid: Grid, index: number, delta: 1 | -1): Grid {
```

```ts
export function buildSetGrid(grid: Grid, index: number, value: number): Grid {
```

- [ ] **Step 6: Use `cellWeight` at the dial**

In `app/(tabs)/index.tsx`, replace line 608's inline formula:

```tsx
                weight={cellWeight(index)}
```

and add `cellWeight` to the existing `@/machines/scoring` import — the file already imports `computePar` from it.

- [ ] **Step 7: Run the tests to verify they pass**

Run: `pnpm exec vitest run machines/scoring.test.ts machines/game.test.ts`
Expected: PASS, including every test that was already there.

- [ ] **Step 8: Typecheck**

Run: `pnpm typecheck`
Expected: no errors.

- [ ] **Step 9: Commit**

```bash
git add machines/scoring.ts machines/scoring.test.ts machines/game.ts machines/game.test.ts "app/(tabs)/index.tsx"
git commit -m "feat(game): report a hit's steps and par, and share the key weight"
```

---

### Task 2: The rules

The pure reducer holding every rule and threshold, plus the fact-builder that turns the machine's grid and targets into the terms the rules are written in. All of the interesting behaviour lands here, and all of it is tested without React.

**Files:**

- Create: `machines/coach.ts`
- Test: `machines/coach.test.ts`

**Interfaces:**

- Consumes: `cellWeight`, `computePar` from `@/machines/scoring`; `computeSum`, `buildPressGrid`, `type Grid`, `type Target` from `@/machines/game` (all Task 1).
- Produces:
  - `type PressVerdict = 'lost' | 'tapping' | 'coarse'`
  - `type CoachState`, `initialCoachState(): CoachState`
  - `type PressFacts = { index: number; delta: 1 | -1 | null; improved: boolean; opening: boolean; gap: number; routing: boolean }`
  - `pressFacts(opts: { index: number; delta: 1 | -1 | null; gridBefore: Grid; gridAfter: Grid; targets: readonly Target[] }): PressFacts`
  - `coachReducer(state: CoachState, facts: PressFacts): { state: CoachState; verdict: PressVerdict | null }`
  - `noteResolved(state: CoachState, resolved: number): CoachState`

- [ ] **Step 1: Write the failing test**

Create `machines/coach.test.ts`. The par figures in the first two cases are verified against the real DP — target 1 goes from par 1 to par 2 while target 10 goes from par 2 to par 1, which is precisely the case the `any` rule exists for:

```ts
import { describe, expect, it } from 'vitest'

import {
  coachReducer,
  initialCoachState,
  noteResolved,
  pressFacts,
  type CoachState,
  type PressFacts,
} from './coach'
import { buildPressGrid, type Grid, type Target } from './game'
import { computePar } from './scoring'

const ZEROS: Grid = [
  [0, 0, 0],
  [0, 0, 0],
  [0, 0, 0],
]

const facts = (over: Partial<PressFacts> = {}): PressFacts => ({
  index: 0,
  delta: 1,
  improved: false,
  opening: false,
  gap: 0,
  routing: true,
  ...over,
})

const target = (over: Partial<Target> & { value: number }): Target => ({
  id: 0,
  spawnedAt: 0,
  duration: 10_000,
  refAt: 0,
  refGrid: ZEROS,
  par: 1,
  userSteps: 0,
  ...over,
})

// Feeds a sequence of presses through the reducer and reports every verdict it
// produced, so a test can say what a run of presses earned.
const run = (state: CoachState, sequence: readonly PressFacts[]) =>
  sequence.reduce<{ state: CoachState; verdicts: (string | null)[] }>(
    (acc, next) => {
      const result = coachReducer(acc.state, next)
      return { state: result.state, verdicts: [...acc.verdicts, result.verdict] }
    },
    { state, verdicts: [] },
  )

describe('pressFacts', () => {
  it('calls a press helpful when it advances any target, not just the nearest', () => {
    // The ×9 key up to 1 puts the sum at 9. The nearest target, 1, is now further
    // off — that key has to come back down — but 10 is one press closer than it was.
    // A press like this must not be called a mistake.
    const after = buildPressGrid(ZEROS, 8, 1)
    expect(computePar(ZEROS, 1)).toBe(1)
    expect(computePar(after, 1)).toBe(2)
    expect(computePar(ZEROS, 10)).toBe(2)
    expect(computePar(after, 10)).toBe(1)

    const result = pressFacts({
      index: 8,
      delta: 1,
      gridBefore: ZEROS,
      gridAfter: after,
      targets: [target({ id: 0, value: 1 }), target({ id: 1, value: 10 })],
    })
    expect(result.improved).toBe(true)
  })

  it('calls a press unhelpful when it advances nothing', () => {
    // The ×1 key up to 1 while the only target is 9: a swipe on the ×9 key still
    // lands it in one, so the route is no shorter than it was.
    const after = buildPressGrid(ZEROS, 0, 1)
    expect(computePar(ZEROS, 9)).toBe(1)
    expect(computePar(after, 9)).toBe(1)

    const result = pressFacts({
      index: 0,
      delta: 1,
      gridBefore: ZEROS,
      gridAfter: after,
      targets: [target({ value: 9 })],
    })
    expect(result.improved).toBe(false)
  })

  it('measures the gap to the nearest target by value', () => {
    const result = pressFacts({
      index: 0,
      delta: 1,
      gridBefore: ZEROS,
      gridAfter: buildPressGrid(ZEROS, 0, 1),
      targets: [target({ id: 0, value: 40 }), target({ id: 1, value: 7 })],
    })
    expect(result.gap).toBe(7)
  })

  it('calls a press an opening only while the nearest target has taken none', () => {
    const opening = pressFacts({
      index: 0,
      delta: 1,
      gridBefore: ZEROS,
      gridAfter: buildPressGrid(ZEROS, 0, 1),
      targets: [target({ value: 40, userSteps: 0 })],
    })
    expect(opening.opening).toBe(true)

    const midRoute = pressFacts({
      index: 0,
      delta: 1,
      gridBefore: ZEROS,
      gridAfter: buildPressGrid(ZEROS, 0, 1),
      targets: [target({ value: 40, userSteps: 2 })],
    })
    expect(midRoute.opening).toBe(false)
  })

  it('reports nothing to route toward on an empty board', () => {
    const result = pressFacts({
      index: 0,
      delta: 1,
      gridBefore: ZEROS,
      gridAfter: buildPressGrid(ZEROS, 0, 1),
      targets: [],
    })
    expect(result.routing).toBe(false)
    expect(result.improved).toBe(false)
  })
})

describe('lost', () => {
  it('says nothing after two presses that helped nothing', () => {
    expect(run(initialCoachState(), [facts(), facts()]).verdicts).toEqual([null, null])
  })

  it('speaks on the third', () => {
    expect(run(initialCoachState(), [facts(), facts(), facts()]).verdicts).toEqual([
      null,
      null,
      'lost',
    ])
  })

  it('says it once, not again on the fourth', () => {
    const { verdicts } = run(initialCoachState(), [facts(), facts(), facts(), facts()])
    expect(verdicts[3]).toBeNull()
  })

  it('is reset by a press that helped', () => {
    const { verdicts } = run(initialCoachState(), [
      facts(),
      facts(),
      facts({ improved: true }),
      facts(),
      facts(),
    ])
    expect(verdicts).toEqual([null, null, null, null, null])
  })

  it('is reset by a target leaving the board', () => {
    const twoIn = run(initialCoachState(), [facts(), facts()])
    expect(run(noteResolved(twoIn.state, 1), [facts(), facts()]).verdicts).toEqual([
      null,
      null,
    ])
  })
})

describe('tapping', () => {
  const tap = () => facts({ index: 4, delta: 1 })
  const tapped = (sequence: readonly PressFacts[]) =>
    run(initialCoachState(), sequence).verdicts.filter((verdict) => verdict === 'tapping')

  it('speaks on the fourth press of a run on one key', () => {
    expect(run(initialCoachState(), [tap(), tap(), tap(), tap()]).verdicts).toEqual([
      null,
      null,
      null,
      'tapping',
    ])
  })

  it('is broken by a swipe', () => {
    expect(
      tapped([tap(), tap(), facts({ index: 4, delta: null }), tap(), tap()]),
    ).toEqual([])
  })

  it('is broken by another key', () => {
    expect(tapped([tap(), tap(), facts({ index: 0, delta: 1 }), tap(), tap()])).toEqual(
      [],
    )
  })

  it('is broken by reversing direction on the same key', () => {
    expect(tapped([tap(), tap(), tap(), facts({ index: 4, delta: -1 }), tap()])).toEqual(
      [],
    )
  })
})

describe('coarse', () => {
  // Index 0 carries weight 1 — a fine key. Index 8 carries weight 9.
  const opener = (over: Partial<PressFacts> = {}) =>
    facts({ index: 0, opening: true, gap: 40, ...over })

  it('speaks when a fine key opens a route across a wide gap', () => {
    expect(coachReducer(initialCoachState(), opener()).verdict).toBe('coarse')
  })

  it('stays quiet below the gap that makes a fine key wrong', () => {
    expect(coachReducer(initialCoachState(), opener({ gap: 11 })).verdict).toBeNull()
  })

  it('speaks exactly at the threshold', () => {
    expect(coachReducer(initialCoachState(), opener({ gap: 12 })).verdict).toBe('coarse')
  })

  it('stays quiet when a coarse key opens the route', () => {
    expect(coachReducer(initialCoachState(), opener({ index: 8 })).verdict).toBeNull()
  })

  it('stays quiet mid-route, where a fine key is the right call', () => {
    expect(
      coachReducer(initialCoachState(), opener({ opening: false })).verdict,
    ).toBeNull()
  })
})

describe('habit cool-down', () => {
  const openFine = () => facts({ index: 0, opening: true, gap: 40 })

  it('does not name the same habit twice inside eight resolved targets', () => {
    const first = coachReducer(initialCoachState(), openFine())
    expect(first.verdict).toBe('coarse')
    expect(coachReducer(noteResolved(first.state, 7), openFine()).verdict).toBeNull()
  })

  it('names it again once eight targets have gone', () => {
    const first = coachReducer(initialCoachState(), openFine())
    expect(coachReducer(noteResolved(first.state, 8), openFine()).verdict).toBe('coarse')
  })
})

describe('one verdict per press', () => {
  it('prefers the tapping habit when a tap run reaches an opening press', () => {
    // A run of taps can survive a hit and land on the next target's opening press,
    // so both habits qualify at once. Several presses of evidence beat one.
    const tapping = run(initialCoachState(), [
      facts({ index: 0, delta: 1 }),
      facts({ index: 0, delta: 1 }),
      facts({ index: 0, delta: 1 }),
    ])
    expect(
      coachReducer(tapping.state, facts({ index: 0, delta: 1, opening: true, gap: 40 }))
        .verdict,
    ).toBe('tapping')
  })

  it('prefers a habit to lost', () => {
    const twoUnhelpful = run(initialCoachState(), [facts(), facts()])
    expect(
      coachReducer(twoUnhelpful.state, facts({ index: 0, opening: true, gap: 40 }))
        .verdict,
    ).toBe('coarse')
  })
})

describe('an empty board', () => {
  it('judges nothing', () => {
    const idle = facts({ routing: false })
    expect(run(initialCoachState(), [idle, idle, idle, idle]).verdicts).toEqual([
      null,
      null,
      null,
      null,
    ])
  })

  it('drops a tap run rather than letting it span the gap', () => {
    const { verdicts } = run(initialCoachState(), [
      facts({ index: 4, delta: 1 }),
      facts({ index: 4, delta: 1 }),
      facts({ index: 4, delta: 1, routing: false }),
      facts({ index: 4, delta: 1 }),
      facts({ index: 4, delta: 1 }),
    ])
    expect(verdicts.filter((verdict) => verdict === 'tapping')).toEqual([])
  })
})
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `pnpm exec vitest run machines/coach.test.ts`
Expected: FAIL — `Failed to resolve import "./coach"`.

- [ ] **Step 3: Write the implementation**

Create `machines/coach.ts`:

```ts
import { isNonEmptyArray } from 'narrowland'

import { computeSum, type Grid, type Target } from './game'
import { cellWeight, computePar } from './scoring'

// How many presses in a row must fail to shorten the route before the coach says
// so. One is a fumble the player already knows about; three in a row means the route
// is lost, and that is the teachable moment. Speaking on every unhelpful press would
// have the line talking through a beginner's first targets, and a line that always
// talks stops being read.
const LOST_PRESSES = 3

// Presses in a row on one key, one direction, before the coach suggests a swipe.
// Four is past the point where a swipe to 0 or 9 was the cheaper gesture.
const TAP_RUN = 4

// A gap this wide makes a fine key the wrong opener: at ×1 it is a dozen presses
// where a ×9 covers most of it in one. Below it a fine key can be the right call and
// the coach would be wrong to say otherwise. The one figure here tuned by feel.
const COARSE_GAP = 12

// Which keys count as fine. Weights run 1, 2, 3, 2, 4, 6, 3, 6, 9.
const FINE_WEIGHT = 2

// Targets that must leave the board before the same habit may be named again.
// Trainee has infinite lives, so a run ends only when the player does — once per run
// would leave a long run uncoached, and once per occurrence would nag.
const HABIT_COOLDOWN_TARGETS = 8

// The verdicts a single press can earn. `lib/coach-lines.ts` holds their words.
export type PressVerdict = 'lost' | 'tapping' | 'coarse'

// A run of presses on one key in one direction. Broken by any other key, by a
// reversal, and by a swipe — which is what makes the tapping habit detectable at
// all: the run only grows while the player is doing the thing being named.
type TapRun = { index: number; delta: 1 | -1; count: number }

export type CoachState = {
  // Presses in a row that got the player no closer to anything.
  unhelpful: number
  // Whether `lost` has already been said for the current run of them.
  lostSaid: boolean
  tapRun: TapRun | null
  // Targets resolved since each habit was last named.
  sinceTapping: number
  sinceCoarse: number
}

// The cool-downs start already satisfied, so the first occurrence of a habit is
// named at once rather than after the eighth target of the run.
export const initialCoachState = (): CoachState => ({
  unhelpful: 0,
  lostSaid: false,
  tapRun: null,
  sinceTapping: HABIT_COOLDOWN_TARGETS,
  sinceCoarse: HABIT_COOLDOWN_TARGETS,
})

// What one press did, in the terms the rules are written in.
export type PressFacts = {
  index: number
  // Which way a press moved the key, or null for a swipe. A swipe sets an absolute
  // value, and it is what breaks a tap run.
  delta: 1 | -1 | null
  // Whether the press got the player closer to any live target.
  improved: boolean
  // Whether this was the first press toward the nearest target since its reference
  // was last set — the moment at which a coarse key is the right opener or not.
  opening: boolean
  // |value − sum| for the nearest target, measured before the press.
  gap: number
  // False when the board is empty: nothing to route toward, so nothing to judge.
  routing: boolean
}

// Turns the machine's own grid and targets into facts. This is where the analysis
// happens: `computePar` twice per live target, once for the grid before the press
// and once for the grid after.
export function pressFacts(opts: {
  index: number
  delta: 1 | -1 | null
  gridBefore: Grid
  gridAfter: Grid
  targets: readonly Target[]
}): PressFacts {
  const { index, delta, gridBefore, gridAfter, targets } = opts
  if (!isNonEmptyArray(targets)) {
    return { index, delta, improved: false, opening: false, gap: 0, routing: false }
  }

  const sum = computeSum(gridBefore)
  const nearest = targets.reduce((best, candidate) =>
    Math.abs(candidate.value - sum) < Math.abs(best.value - sum) ? candidate : best,
  )

  return {
    index,
    delta,
    // Any target, not the nearest: up to four can be in the air and there is no way
    // to know which one the player is working toward, so a press that advanced the
    // second-nearest must not be called a mistake.
    improved: targets.some(
      (candidate) =>
        computePar(gridAfter, candidate.value) < computePar(gridBefore, candidate.value),
    ),
    // The machine's own bookkeeping answers this: `userSteps` counts presses since
    // the target's reference was set, so zero means this press is the first.
    opening: nearest.userSteps === 0,
    // By raw value, not by par. What a coarse key answers is how much sum there is
    // left to cover; par answers a different question.
    gap: Math.abs(nearest.value - sum),
    routing: true,
  }
}

type CoachResult = { state: CoachState; verdict: PressVerdict | null }

// Same key, same direction extends the run; any other press starts a new one; a
// swipe ends it.
function nextTapRun(current: TapRun | null, facts: PressFacts): TapRun | null {
  const { delta, index } = facts
  if (delta === null) return null
  if (current !== null && current.index === index && current.delta === delta) {
    return { ...current, count: current.count + 1 }
  }
  return { index, delta, count: 1 }
}

// One press in, at most one verdict out. Every rule and every threshold lives here,
// which is what makes the coach's whole behaviour testable without React.
export function coachReducer(state: CoachState, facts: PressFacts): CoachResult {
  // Presses with an empty board are idle fiddling. Nothing is judged, and the tap
  // run is dropped so it cannot span the gap and surface against the next target.
  if (!facts.routing) return { state: { ...state, tapRun: null }, verdict: null }

  const tapRun = nextTapRun(state.tapRun, facts)
  const unhelpful = facts.improved ? 0 : state.unhelpful + 1
  const lostSaid = facts.improved ? false : state.lostSaid
  const advanced: CoachState = { ...state, tapRun, unhelpful, lostSaid }

  // A tap run can carry into an opening press — tap a key up five times, land a hit,
  // and the survivors re-reference — so both habits can qualify at once. Tapping
  // wins: several presses of evidence beat one.
  if (
    tapRun !== null &&
    tapRun.count >= TAP_RUN &&
    state.sinceTapping >= HABIT_COOLDOWN_TARGETS
  ) {
    return { state: { ...advanced, sinceTapping: 0 }, verdict: 'tapping' }
  }

  if (
    facts.opening &&
    cellWeight(facts.index) <= FINE_WEIGHT &&
    facts.gap >= COARSE_GAP &&
    state.sinceCoarse >= HABIT_COOLDOWN_TARGETS
  ) {
    return { state: { ...advanced, sinceCoarse: 0 }, verdict: 'coarse' }
  }

  // Said once per run of unhelpful presses rather than again on every press past the
  // third: the counter has to clear before it can be said again.
  if (unhelpful >= LOST_PRESSES && !advanced.lostSaid) {
    return { state: { ...advanced, lostSaid: true }, verdict: 'lost' }
  }

  return { state: advanced, verdict: null }
}

// Targets left the board — hit, or run out. Whatever the player was working toward
// is gone, so the route counters clear; the habit cool-downs advance by however many
// went.
export function noteResolved(state: CoachState, resolved: number): CoachState {
  return {
    unhelpful: 0,
    lostSaid: false,
    tapRun: null,
    sinceTapping: state.sinceTapping + resolved,
    sinceCoarse: state.sinceCoarse + resolved,
  }
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `pnpm exec vitest run machines/coach.test.ts`
Expected: PASS, 24 tests.

- [ ] **Step 5: Typecheck**

Run: `pnpm typecheck`
Expected: no errors.

- [ ] **Step 6: Commit**

```bash
git add machines/coach.ts machines/coach.test.ts
git commit -m "feat(trainee): analyse each press against the route"
```

---

### Task 3: The coach's words

The word pools, the debrief sentence, and the ranking that decides who gets the line when two things want it.

**Files:**

- Create: `lib/coach-lines.ts`
- Test: `lib/coach-lines.test.ts`

**Interfaces:**

- Consumes: `type PressVerdict` from `@/machines/coach` (Task 2). `lib/hit-praise.ts` already imports `CleanReason` from `machines/scoring`, so a `lib/` module taking a type from `machines/` is the established direction.
- Produces:
  - `type CoachKind = PressVerdict | 'debrief'`
  - `pressPool(verdict: PressVerdict): readonly string[]`
  - `pressLine(verdict: PressVerdict, roll: number): string`
  - `debriefLine(steps: number, par: number): string`
  - `outranks(next: CoachKind, current: CoachKind): boolean`

- [ ] **Step 1: Write the failing test**

Create `lib/coach-lines.test.ts`:

```ts
import { describe, expect, it } from 'vitest'

import { debriefLine, outranks, pressLine, pressPool } from './coach-lines'

const VERDICTS = ['lost', 'tapping', 'coarse'] as const

// The cap the praise lines already keep: one row of 10px mono under the stat row,
// read at a glance mid-run.
const MAX_LENGTH = 24

describe('pressLine', () => {
  it('picks the first line at the bottom of the roll', () => {
    expect(pressLine('lost', 0)).toBe(pressPool('lost')[0])
  })

  it('picks the last line at the top of the roll', () => {
    const pool = pressPool('tapping')
    expect(pressLine('tapping', 0.999)).toBe(pool[pool.length - 1])
  })

  it('stays inside the pool for a roll of exactly 1', () => {
    expect(pressPool('coarse')).toContain(pressLine('coarse', 1))
  })

  it('draws only from its own verdict', () => {
    for (const verdict of VERDICTS) {
      for (const roll of [0, 0.3, 0.7, 0.99]) {
        expect(pressPool(verdict)).toContain(pressLine(verdict, roll))
      }
    }
  })
})

describe('coach pools', () => {
  it('keeps every line short enough for the bar', () => {
    for (const verdict of VERDICTS) {
      for (const line of pressPool(verdict)) {
        expect(line.length).toBeLessThanOrEqual(MAX_LENGTH)
      }
    }
  })

  it('offers more than one line per verdict, so the coach varies', () => {
    for (const verdict of VERDICTS) {
      expect(pressPool(verdict).length).toBeGreaterThan(1)
    }
  })

  it('never tells the player which key to press', () => {
    // It coaches; it does not solve. "The big keys" is a class of key, which is
    // advice — a bare index would be the answer.
    for (const verdict of VERDICTS) {
      for (const line of pressPool(verdict)) {
        expect(line).not.toMatch(/\bkey [1-9]\b/i)
      }
    }
  })
})

describe('debriefLine', () => {
  it('names what the hit cost and what it could have cost', () => {
    expect(debriefLine(12, 4)).toBe('12 steps — 4 would do')
  })

  it('stays inside the bar at its longest figures', () => {
    expect(debriefLine(99, 15).length).toBeLessThanOrEqual(MAX_LENGTH)
  })

  it('drops the figures past 99 steps rather than overflowing the bar', () => {
    expect(debriefLine(100, 4)).toBe('Way too many steps')
  })
})

describe('outranks', () => {
  it('lets a habit take the line from a debrief', () => {
    expect(outranks('tapping', 'debrief')).toBe(true)
    expect(outranks('coarse', 'debrief')).toBe(true)
  })

  it('does not let a debrief take the line from a habit', () => {
    expect(outranks('debrief', 'coarse')).toBe(false)
  })

  it('lets anything take the line from lost', () => {
    expect(outranks('debrief', 'lost')).toBe(true)
    expect(outranks('tapping', 'lost')).toBe(true)
  })

  it('does not let lost take the line from a debrief', () => {
    expect(outranks('lost', 'debrief')).toBe(false)
  })

  it('lets a fresh habit replace one already showing', () => {
    // Equal ranks replace: the newer observation is about the press just made.
    expect(outranks('coarse', 'tapping')).toBe(true)
  })
})
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `pnpm exec vitest run lib/coach-lines.test.ts`
Expected: FAIL — `Failed to resolve import "./coach-lines"`.

- [ ] **Step 3: Write the implementation**

Create `lib/coach-lines.ts`:

```ts
import type { PressVerdict } from '@/machines/coach'

// What Trainee's coach says, and who gets to say it.
//
// The line under the stat row is one line, and four things want it. Praise for a
// clean hit wins outright — it arrives with a confetti shower, and the coach must
// not talk over a celebration — so praise is resolved at the call site and does not
// appear here. What is left ranks among itself.
//
// Sentence case rather than the app's usual shouting caps, matching the praise lines
// and the announcement bar: this is the game talking to you, not a label.

export type CoachKind = PressVerdict | 'debrief'

// Each line says what the player did, never what to do instead — naming the key
// would be solving the target for them, which is the one thing a practice mode must
// not do. "The big keys" is a class of key, and that is advice.
const LINES = {
  lost: ['Going the wrong way', 'That’s not closer', 'Try a different key'],
  tapping: ['Swipe instead of tapping', 'A swipe gets there', 'Swipe to 0 or 9'],
  coarse: ['Start with the big keys', 'Big keys first', 'Try ×9 or ×6 first'],
} as const satisfies Record<PressVerdict, readonly [string, ...string[]]>

export const pressPool = (verdict: PressVerdict): readonly string[] => LINES[verdict]

// Which line to use, given a roll in [0, 1). The roll is a parameter rather than a
// Math.random() call inside, so the choice stays pure and testable and the randomness
// lives at the call site — the same shape as `praiseFor` and `messageFor`.
export function pressLine(verdict: PressVerdict, roll: number): string {
  const pool = LINES[verdict]
  const index = Math.min(pool.length - 1, Math.max(0, Math.floor(roll * pool.length)))
  return pool[index] ?? pool[0]
}

// Past this the figures stop fitting the bar, and a hit this wasteful does not need a
// number to make its point.
const MAX_STEPS = 99

// What a hit cost against what it could have cost. The stat row above already shows
// the accuracy percentage; what a percentage cannot say is what it was made of.
export function debriefLine(steps: number, par: number): string {
  if (steps > MAX_STEPS) return 'Way too many steps'
  return `${steps} steps — ${par} would do`
}

// Where each kind sits when two want the line at once. A habit is the most actionable
// thing the coach has, so it outranks the debrief; `lost` is the quietest observation
// and yields to both.
const RANK = {
  tapping: 0,
  coarse: 0,
  debrief: 1,
  lost: 2,
} as const satisfies Record<CoachKind, number>

// Whether an arriving line may take the bar from the one already showing. Equal ranks
// replace, so a second habit supersedes the first rather than being dropped — the
// newer observation is about the press the player just made.
export const outranks = (next: CoachKind, current: CoachKind): boolean =>
  RANK[next] <= RANK[current]
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `pnpm exec vitest run lib/coach-lines.test.ts`
Expected: PASS, 15 tests.

- [ ] **Step 5: Commit**

```bash
git add lib/coach-lines.ts lib/coach-lines.test.ts
git commit -m "feat(trainee): write the coach's lines and rank them"
```

---

### Task 4: The hook

Feeds the reducer presses, layers the on-hit debrief on top of its verdicts, notices targets leaving the board, and owns the dwell timer. Presentation and wiring, so no test file — every rule it drives is already covered by Task 2.

**Files:**

- Create: `hooks/use-trainee-coach.ts`

**Interfaces:**

- Consumes: `coachReducer`, `initialCoachState`, `noteResolved`, `pressFacts`, `type PressFacts` from `@/machines/coach`; `type CoachKind`, `debriefLine`, `outranks`, `pressLine` from `@/lib/coach-lines`; `buildPressGrid`, `buildSetGrid`, `type Grid`, `type HitBatch`, `type Mode`, `type Target` from `@/machines/game`; `cleanHitReason` from `@/machines/scoring`.
- Produces:

```ts
useTraineeCoach(opts: {
  inRun: boolean
  mode: Mode
  grid: Grid
  targets: readonly Target[]
  batch: HitBatch
}): {
  line: string | null
  notePress: (index: number, delta: 1 | -1) => void
  noteSet: (index: number, value: number) => void
}
```

- [ ] **Step 1: Write the implementation**

Create `hooks/use-trainee-coach.ts`:

```ts
import { useEffect, useRef, useState } from 'react'

import { debriefLine, outranks, pressLine, type CoachKind } from '@/lib/coach-lines'
import {
  coachReducer,
  initialCoachState,
  noteResolved,
  pressFacts,
  type PressFacts,
} from '@/machines/coach'
import {
  buildPressGrid,
  buildSetGrid,
  type Grid,
  type HitBatch,
  type Mode,
  type Target,
} from '@/machines/game'
import { cleanHitReason } from '@/machines/scoring'

// How long a coach line holds. Shorter than the four seconds a praise line keeps:
// praise is tied to the length of its confetti shower, where a mid-route hint wants
// to be gone before the next press makes it stale.
const COACH_MS = 3000

type Showing = { kind: CoachKind; text: string }

// Trainee's coach. Watches what the player does and says something about it in the
// line under the stat row — never which key to press, only what the last press or
// the last hit actually did.
export function useTraineeCoach({
  inRun,
  mode,
  grid,
  targets,
  batch,
}: {
  inRun: boolean
  mode: Mode
  grid: Grid
  targets: readonly Target[]
  batch: HitBatch
}) {
  // Trainee only, and only while playing — the same gate the celebration keeps. The
  // other modes celebrate the run, and coaching mid-run there would talk over the
  // thing they are actually about.
  const active = inRun && mode === 'trainee'

  const [showing, setShowing] = useState<Showing | null>(null)
  const coachRef = useRef(initialCoachState())
  const lastSeqRef = useRef(batch.seq)
  const liveIdsRef = useRef<readonly number[]>([])

  // Lower-ranked lines are dropped rather than queued: a correction held back three
  // seconds would arrive attached to the wrong press.
  const say = (kind: CoachKind, text: string) => {
    setShowing((current) =>
      current === null || outranks(kind, current.kind) ? { kind, text } : current,
    )
  }

  const judge = (facts: PressFacts) => {
    const result = coachReducer(coachRef.current, facts)
    coachRef.current = result.state
    if (result.verdict === null) return
    // Rolled here rather than at render, so a re-render cannot reword the line while
    // the player is reading it.
    say(result.verdict, pressLine(result.verdict, Math.random()))
  }

  // Called at the dial beside the machine's PRESS and SET_CELL, and before them,
  // while the snapshot still holds the grid from before the press. These close over
  // this render's grid and targets rather than reading refs, because the dial builds
  // fresh handlers every render anyway.
  const notePress = (index: number, delta: 1 | -1) => {
    if (!active) return
    judge(
      pressFacts({
        index,
        delta,
        gridBefore: grid,
        gridAfter: buildPressGrid(grid, index, delta),
        targets,
      }),
    )
  }

  const noteSet = (index: number, value: number) => {
    if (!active) return
    judge(
      pressFacts({
        index,
        delta: null,
        gridBefore: grid,
        gridAfter: buildSetGrid(grid, index, value),
        targets,
      }),
    )
  }

  // What the hit cost. The figures are the machine's to report, so this comes off the
  // batch rather than from a press.
  useEffect(() => {
    if (!active) return
    if (batch.seq === lastSeqRef.current) return
    lastSeqRef.current = batch.seq
    // A clean hit gets confetti and praise, and a celebration is not the moment to
    // correct someone — the debrief is dropped rather than held.
    if (cleanHitReason(batch.hits) !== null) return
    // The last hit of the batch, the same one the stat row reports: a batch is every
    // target one press cleared, and it is that press the player is asking about.
    const last = batch.hits[batch.hits.length - 1]
    if (last === undefined) return
    say('debrief', debriefLine(last.steps, last.par))
  }, [active, batch])

  // Targets leaving the board — hit or expired — clear the route counters and advance
  // the habit cool-downs. Watching the id list catches both without the machine
  // having to report them separately, and comparing against the ids held from last
  // time makes a re-render with an unchanged board a no-op.
  useEffect(() => {
    const live = targets.map((target) => target.id)
    const resolved = liveIdsRef.current.filter((id) => !live.includes(id)).length
    liveIdsRef.current = live
    if (resolved > 0) coachRef.current = noteResolved(coachRef.current, resolved)
  }, [targets])

  // Leaving Trainee, or leaving a run, starts the next one with a clean slate.
  useEffect(() => {
    if (active) return
    coachRef.current = initialCoachState()
    liveIdsRef.current = []
    setShowing(null)
  }, [active])

  useEffect(() => {
    if (showing === null) return
    const timer = setTimeout(() => {
      setShowing(null)
    }, COACH_MS)
    return () => {
      clearTimeout(timer)
    }
  }, [showing])

  return { line: showing?.text ?? null, notePress, noteSet }
}
```

- [ ] **Step 2: Lint and typecheck**

Run: `pnpm lint && pnpm typecheck`
Expected: no errors, and no `eslint-disable` anywhere in the file.

If `react-hooks/exhaustive-deps` complains about the board-change effect, satisfy it rather than silencing it — the effect already depends on `targets` and its body is a no-op when the id list has not changed, so any complaint is about something else in the file.

- [ ] **Step 3: Commit**

```bash
git add hooks/use-trainee-coach.ts
git commit -m "feat(trainee): drive the coach from presses and hits"
```

---

### Task 5: Wire it into the screen

Three edits in `GameScreen`, and one on the Trainee mode card in the guide. The screen is at its cognitive-complexity ceiling, so every edit here is deliberately a single expression.

**Files:**

- Modify: `app/(tabs)/index.tsx:194` (call the hook), `:459` (merge the line), `:613-618` (notify at the dial)
- Modify: `components/overlays/how-to-play-overlay.tsx:304-310` (the Trainee `ModeCard`)

**Interfaces:**

- Consumes: `useTraineeCoach` from Task 4.
- Produces: nothing.

- [ ] **Step 1: Call the hook**

Directly below `const celebration = useHitCelebration(inRun, mode, hitBatch)` (line 194):

```tsx
const coach = useTraineeCoach({ inRun, mode, grid, targets, batch: hitBatch })
```

Add the import beside the other hook imports:

```tsx
import { useTraineeCoach } from '@/hooks/use-trainee-coach'
```

`grid`, `targets` and `hitBatch` all come off `state.context` at lines 135–146, and `inRun` is defined at line 185, so everything is in scope.

- [ ] **Step 2: Merge the coach's line with praise**

At line 459 — praise keeps the line whenever it has one:

```tsx
{
  mode === 'trainee' && (
    <TraineeStats
      hits={hits}
      batch={hitBatch}
      praise={celebration.message ?? coach.line}
    />
  )
}
```

`HitPraiseLine` already takes `string | null`, already reserves its height, and already holds its last words through the fade, so nothing below this prop changes.

- [ ] **Step 3: Notify the coach at the dial**

At lines 613–618, call the coach **before** `send` in both handlers. It reads the grid from before the press, and calling it first keeps that true by construction rather than by relying on how React batches the machine's update:

```tsx
                onDelta={(delta) => {
                  coach.notePress(index, delta)
                  send({ type: 'PRESS', index, delta, now: Date.now() })
                }}
                onSet={(cellValue) => {
                  coach.noteSet(index, cellValue)
                  send({ type: 'SET_CELL', index, value: cellValue, now: Date.now() })
                }}
```

- [ ] **Step 4: Update the How to Play guide**

CLAUDE.md requires the guide to stay current whenever a change touches what the player sees. Add a third fact to the Trainee `ModeCard` at line 304:

```tsx
<ModeCard
  mode="trainee"
  facts={[
    'Pure practice — no lives, no score, and a relaxed clock.',
    'Buttons show their weight and max, so you can learn the math.',
    'A coach line under the stat row says when a move was wasted, and what a hit cost.',
  ]}
/>
```

Controls, targets, timers, difficulty, scoring, streaks and lives are all unchanged, so no other section of the guide moves. The TIPS & TRICKS list stays as it is — the coach restates two of those tips at the moment they apply, which is the point of it.

- [ ] **Step 5: Run the full gate**

Run: `pnpm check`
Expected: ESLint, Prettier, TypeScript, Knip and Vitest all clean.

Knip is the one to watch. `pressPool` is used only by its own test, which is the same shape as the existing `praisePool` and so is already accepted. If Knip flags anything else as an unused export, remove the `export` rather than adding an ignore.

- [ ] **Step 6: Play it**

Run: `pnpm start`, open Trainee, and confirm by eye:

1. A competent route draws no line at all — the coach is silent when it has nothing to say.
2. Tapping one key up four times draws "Swipe instead of tapping" or a sibling, on the fourth tap.
3. Opening a route with the ×1 key while a target sits far off draws "Start with the big keys".
4. Three presses that get you no closer draws "Going the wrong way" once, not again on every press after.
5. A wasteful hit draws "N steps — M would do", with M matching the number on that target's card.
6. A clean hit draws confetti and its praise line, with no coaching over the top.
7. The board never shifts vertically as lines come and go.

- [ ] **Step 7: Commit**

```bash
git add "app/(tabs)/index.tsx" components/overlays/how-to-play-overlay.tsx
git commit -m "feat(trainee): coach the player as they dial"
```

---

## Verification

Done when `pnpm check` is clean and all seven by-eye checks in Task 5 Step 6 hold. The spec's own by-eye list is the same set, worded from the player's side.
