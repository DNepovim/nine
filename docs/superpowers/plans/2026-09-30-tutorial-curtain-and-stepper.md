# Tutorial Curtain and Stepper Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A first launch pauses on a `LET'S LEARN THE GAME` curtain between the splash and the tutorial, and every tutorial run carries a five-number stepper that can put the player back on a board they have already played.

**Architecture:** Two pure helpers (`lib/tutorial-board.ts`, `lib/tutorial-stepper.ts`) carry everything testable — the canonical grid each tutorial board is entered on, and the enable/lock rules the stepper draws from. A new `REWIND` event on the game machine, guarded to tutorial runs, puts `hits`, `grid` and `targets` back together. Two new components — a full-viewport curtain and a stepper row — are wired into `app/(tabs)/index.tsx`, which already owns both the welcome state and the lesson.

**Tech Stack:** Expo / React Native, NativeWind v4 (`className`), XState v5, Reanimated v4, Lingui (`msg` / `<Trans>`), Vitest.

**Spec:** `docs/superpowers/specs/2026-09-30-tutorial-stepper-design.md`

## Global Constraints

- **Board numbers are zero-based.** `board` throughout the code is the hit count — the stepper's ① is board 0, ⑤ is board 4. The same index addresses `TUTORIAL_TARGETS`, `scriptedTarget` and `LESSON_AFTER_HIT`.
- **Five steps, derived.** The stepper's count is `TUTORIAL_TARGETS.length`, never a literal `5`.
- **Imports use the `@/` alias.** Never relative `../`.
- **Vitest only runs `**/*.test.ts`** — not `.tsx`. Every rule worth a test must live in a pure `.ts` module under `lib/`; components are verified by `pnpm typecheck` and `pnpm lint`.
- **`pnpm knip` is part of `pnpm check`.** An exported symbol with no consumer fails the build — so never land a component in one commit and its caller in the next.
- **Player-facing copy goes through Lingui** (`msg` in `.ts`, `<Trans>` in `.tsx`) and is written in the app's mono caps.
- **The tutorial's colour is `MODE_GRADIENT.trainee[0]`**, the same blue `components/game/tutorial-card.tsx` wears.
- **Comments explain why, not what**, matching the density of the files being edited — this codebase comments heavily and in prose.
- Run `pnpm check` before the final commit. Individual tasks run `pnpm exec vitest run <file>`.

---

### Task 1: The canonical entry grid per board

The grid a rewound board stands on, derived from the lesson's own script rather than recorded as the player goes. Board 0 is the opening grid; every board after it is where the optimal route to the previous target lands.

**Files:**

- Create: `lib/tutorial-board.ts`
- Create: `lib/tutorial-board.test.ts`
- Modify: `constants/tutorial.ts` — `TUTORIAL_OPENING_GRID` moves here
- Modify: `machines/game.ts` — imports it from there instead of declaring it

**Interfaces:**

- Consumes: `TUTORIAL_OPENING_GRID` and `TUTORIAL_TARGETS` from `@/constants/tutorial`, `computeKeyPlan` from `@/machines/scoring`, `type Grid` from `@/machines/game`.
- Produces: `tutorialBoardEntry(board: number): Grid` — used by Task 3.

**Why the grid moves to `constants/`, not into the new file:** Task 3 makes
`machines/game.ts` import `tutorialBoardEntry`. If `lib/tutorial-board.ts` owned
the opening grid, `game.ts` and `tutorial-board.ts` would each import a *value*
from the other — a real runtime cycle. Parked in `constants/tutorial.ts`, which
imports nothing but Lingui, the only edge pointing back at `game.ts` from either
file is `import type { Grid }`, which erases at build time. It is also where the
rest of the tutorial's fixed numbers already live.

- [ ] **Step 1: Write the failing test**

Create `lib/tutorial-board.test.ts`:

```ts
import { describe, expect, it } from 'vitest'

import { TUTORIAL_OPENING_GRID, TUTORIAL_TARGETS } from '@/constants/tutorial'
import { tutorialBoardEntry } from '@/lib/tutorial-board'
import { computeSum } from '@/machines/game'

describe('the board each tutorial step is entered on', () => {
  it('opens on the lesson’s own board', () => {
    expect(tutorialBoardEntry(0)).toEqual(TUTORIAL_OPENING_GRID)
  })

  // The whole invariant, and the reason the grids can be derived at all: hitting a
  // target leaves its value dialled, so the board every step after the first is
  // entered on weighs exactly the target of the step before it.
  it('enters every later step on a board weighing the target just cleared', () => {
    TUTORIAL_TARGETS.forEach((target, index) => {
      expect(computeSum(tutorialBoardEntry(index + 1))).toBe(target)
    })
  })

  // Pinned rather than merely checked against the invariant above: many grids weigh
  // 204, and the lesson's words are true of this one. A change to the opening grid or
  // to the route planner that moves these fails here rather than in front of a player.
  it('walks the script’s own route', () => {
    expect(tutorialBoardEntry(1)).toEqual([
      [6, 2, 8],
      [2, 7, 2],
      [5, 5, 9],
    ])
    expect(tutorialBoardEntry(2)).toEqual([
      [7, 2, 8],
      [2, 7, 2],
      [5, 6, 9],
    ])
    expect(tutorialBoardEntry(3)).toEqual([
      [7, 2, 8],
      [2, 7, 2],
      [5, 6, 8],
    ])
    expect(tutorialBoardEntry(4)).toEqual([
      [7, 2, 0],
      [2, 0, 0],
      [0, 0, 1],
    ])
  })

  // Past the script there is no scripted board to go back to, and the stepper never
  // asks — but a helper that threw here would turn a stepper bug into a crash.
  it('holds at the last scripted board past the end of the script', () => {
    expect(tutorialBoardEntry(TUTORIAL_TARGETS.length + 3)).toEqual(
      tutorialBoardEntry(TUTORIAL_TARGETS.length),
    )
  })

  it('treats a negative board as the opening', () => {
    expect(tutorialBoardEntry(-1)).toEqual(TUTORIAL_OPENING_GRID)
  })
})
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `pnpm exec vitest run lib/tutorial-board.test.ts`
Expected: FAIL — `Failed to load url @/lib/tutorial-board`.

- [ ] **Step 3: Move the opening grid into the tutorial's constants**

In `machines/game.ts`, cut the `TUTORIAL_OPENING_GRID` declaration (line 135) together with the whole comment block above it (lines 116–134, beginning `// The board every tutorial opens on,`). Add to the existing `@/constants/tutorial` import at the top of the file:

```ts
import {
  TUTORIAL_MAX_TARGETS,
  TUTORIAL_OPENING_GRID,
  TUTORIAL_OPENING_TARGET,
} from '@/constants/tutorial'
```

Leave every use of `TUTORIAL_OPENING_GRID` in `machines/game.ts` exactly as it is — `openingTargets` (line 150–151) and `freshGame` (line 291) both read it and neither changes.

Then paste the declaration and its comment into `constants/tutorial.ts`, directly above `TUTORIAL_TARGETS` — whose own comment already refers to it by name — and export it. It needs the `Grid` type, so add to the top of that file:

```ts
import type { Grid } from '@/machines/game'
```

Type-only, so it erases at build time and adds no runtime edge back to the machine.

- [ ] **Step 4: Write the implementation**

Create `lib/tutorial-board.ts`:

```ts
import { TUTORIAL_OPENING_GRID, TUTORIAL_TARGETS } from '@/constants/tutorial'
import type { Grid } from '@/machines/game'
import { computeKeyPlan } from '@/machines/scoring'

// The board every later step of the lesson is entered on. The first one is
// TUTORIAL_OPENING_GRID, beside the rest of the tutorial's fixed numbers.

// The grid one optimal route later. Every key the plan names is set outright to the value
// it was owed, which is what the route the lesson walks arrives at — the plan is the same
// one `useTutorialLesson` lights a key at a time.
const walk = (grid: Grid, target: number): Grid => {
  const flat = grid.flat()
  for (const step of computeKeyPlan(grid, target)) flat[step.index] = step.to
  return [
    [flat[0] ?? 0, flat[1] ?? 0, flat[2] ?? 0],
    [flat[3] ?? 0, flat[4] ?? 0, flat[5] ?? 0],
    [flat[6] ?? 0, flat[7] ?? 0, flat[8] ?? 0],
  ]
}

// The board the lesson's nth step stands on, counted from nought — so step `board` is the
// one standing when the run's hit count is `board`, and `TUTORIAL_TARGETS[board]` is the
// target on it.
//
// Derived rather than recorded. The alternative was a ledger snapshotting the grid each
// board was actually entered on, which is faithful to the player's own route but is new
// state that has to ride along in the saved run — and a restored run could then be put
// back only as far as its ledger happened to reach. Deriving costs the player's particular
// route and buys a rewind that is pure, identical on every device, and unaffected by a
// restore. It also puts them on exactly the board each lesson was written against, which
// is the board that lesson's words are true of.
//
// Walked from the opening every time rather than cached: five boards of nine keys is
// nothing, and a rewind happens when a thumb moves.
export function tutorialBoardEntry(board: number): Grid {
  let grid = TUTORIAL_OPENING_GRID
  // Clamped at both ends. Below nought there is no board but the opening; past the script
  // there is no scripted board at all, and holding at the last one keeps a stepper bug
  // from becoming a crash.
  const steps = Math.min(Math.max(board, 0), TUTORIAL_TARGETS.length)
  for (let i = 0; i < steps; i++) grid = walk(grid, TUTORIAL_TARGETS[i] ?? 0)
  return grid
}
```

- [ ] **Step 5: Run the tests to verify they pass**

Run: `pnpm exec vitest run lib/tutorial-board.test.ts machines/game.test.ts machines/tutorial-lesson.test.ts`
Expected: PASS. The two machine suites must stay green — they already pin the opening route, and moving the grid must not have changed it.

- [ ] **Step 6: Typecheck and commit**

```bash
pnpm typecheck
git add lib/tutorial-board.ts lib/tutorial-board.test.ts machines/game.ts constants/tutorial.ts
git commit -m "feat(tutorial): derive the board each step of the lesson stands on"
```

---

### Task 2: The stepper's rules

What the stepper may be tapped on, given where the player is and how far they have been. Pure, so it can be tested — the component that draws it cannot.

**Files:**

- Create: `lib/tutorial-stepper.ts`
- Create: `lib/tutorial-stepper.test.ts`

**Interfaces:**

- Consumes: `TUTORIAL_TARGETS` from `@/constants/tutorial`.
- Produces:
  - `TUTORIAL_STEPS: number` — how many numbers the stepper draws.
  - `type StepState = 'current' | 'visited' | 'locked'`
  - `stepState(board: number, current: number, furthest: number): StepState`
  - `canGoBack(current: number): boolean`
  - `canGoForward(current: number, furthest: number): boolean`
    All four are used by Task 5.

- [ ] **Step 1: Write the failing test**

Create `lib/tutorial-stepper.test.ts`:

```ts
import { describe, expect, it } from 'vitest'

import { TUTORIAL_TARGETS } from '@/constants/tutorial'
import {
  canGoBack,
  canGoForward,
  stepState,
  TUTORIAL_STEPS,
} from '@/lib/tutorial-stepper'

describe('the stepper', () => {
  // The same pin the lesson's own list carries: a board added to the script without a
  // number to reach it by is a board the stepper cannot go back to.
  it('draws one number per scripted board', () => {
    expect(TUTORIAL_STEPS).toBe(TUTORIAL_TARGETS.length)
  })

  it('fills the board the player is standing on', () => {
    expect(stepState(2, 2, 4)).toBe('current')
  })

  it('opens every board already behind the furthest reached', () => {
    expect(stepState(0, 2, 4)).toBe('visited')
    expect(stepState(1, 2, 4)).toBe('visited')
    expect(stepState(3, 2, 4)).toBe('visited')
    expect(stepState(4, 2, 4)).toBe('visited')
  })

  // The no-skipping rule, seen from the numbers: a board nobody has reached cannot be
  // tapped to, however far along the row it sits.
  it('locks every board past the furthest reached', () => {
    expect(stepState(3, 2, 2)).toBe('locked')
    expect(stepState(4, 2, 2)).toBe('locked')
  })

  it('lets the player back from anywhere but the first board', () => {
    expect(canGoBack(0)).toBe(false)
    expect(canGoBack(1)).toBe(true)
    expect(canGoBack(TUTORIAL_TARGETS.length - 1)).toBe(true)
  })

  // Forward only for somebody who went back. A player who has never used the stepper
  // stands at their own furthest, and NEXT is dark for them the whole way through.
  it('only lets the player forward over ground they have covered', () => {
    expect(canGoForward(2, 2)).toBe(false)
    expect(canGoForward(1, 2)).toBe(true)
    expect(canGoForward(0, 4)).toBe(true)
  })

  // Past the script the run is a plain tutorial run, and `furthest` walks past the last
  // number. Every number is behind the player then, and only PREV is left.
  it('leaves the whole row open once the script has run out', () => {
    const past = TUTORIAL_TARGETS.length
    expect(stepState(past - 1, past, past)).toBe('visited')
    expect(canGoForward(past, past)).toBe(false)
    expect(canGoBack(past)).toBe(true)
  })
})
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `pnpm exec vitest run lib/tutorial-stepper.test.ts`
Expected: FAIL — `Failed to load url @/lib/tutorial-stepper`.

- [ ] **Step 3: Write the implementation**

Create `lib/tutorial-stepper.ts`:

```ts
import { TUTORIAL_TARGETS } from '@/constants/tutorial'

// The stepper's rules: which of its numbers may be tapped, and which way the arrows go.
//
// Separate from the row that draws them for the reason every rule in lib/ is: this is the
// half worth a test, and the row is nine lines of NativeWind. The words for it are in the
// domain table — a *step* here is one of the tutorial's five scripted boards, counted from
// nought, so step `n` is the board standing when the run's hit count is `n`.
//
// Two numbers describe where the player is. `current` is the board under them now, and
// `furthest` is the highest they have ever reached in this run — which only play raises,
// never the stepper. Everything below is those two compared.

// One number per scripted board. Derived rather than written down, so a board added to
// TUTORIAL_TARGETS arrives with a number to reach it by.
export const TUTORIAL_STEPS = TUTORIAL_TARGETS.length

// How a number is drawn, and whether it answers a tap. `visited` is the only one that
// does — `current` is where the player already is, and `locked` is ground they have not
// covered.
export type StepState = 'current' | 'visited' | 'locked'

export const stepState = (
  board: number,
  current: number,
  furthest: number,
): StepState => {
  if (board === current) return 'current'
  return board <= furthest ? 'visited' : 'locked'
}

// PREV, live anywhere but the opening board.
export const canGoBack = (current: number): boolean => current > 0

// NEXT, live only for a player standing behind their own furthest — which is to say,
// only for one who went back. This is the whole of the no-skipping rule: the stepper can
// return ground it gave up and can never hand out ground the player has not played.
export const canGoForward = (current: number, furthest: number): boolean =>
  current < furthest
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `pnpm exec vitest run lib/tutorial-stepper.test.ts`
Expected: PASS (8 tests).

- [ ] **Step 5: Commit**

```bash
git add lib/tutorial-stepper.ts lib/tutorial-stepper.test.ts
git commit -m "feat(tutorial): rule which of the stepper's numbers answer a tap"
```

> Note: `pnpm knip` will flag these exports until Task 5 consumes them. Do not run the full `pnpm check` gate until Task 5 is in.

---

### Task 3: `REWIND` on the game machine

Puts `hits`, `grid` and `targets` back together at a scripted board. Guarded to tutorial runs, so it is inert everywhere else.

**Files:**

- Modify: `machines/game.ts` — the `Event` union (~line 246) and the `playing` state's `on` block (after `ADD_TARGET`, which ends ~line 960)
- Modify: `machines/game.test.ts`

**Interfaces:**

- Consumes: `tutorialBoardEntry` from `@/lib/tutorial-board` (Task 1), `scriptedTarget` and `TUTORIAL_TARGETS` from `@/constants/tutorial`.
- Produces: the event `{ type: 'REWIND'; board: number; now: number }` on `GameSend` — used by Task 5.

- [ ] **Step 1: Write the failing test**

Append to `machines/game.test.ts`. It already has `createActor`, `gameMachine` and `nextRunId`-style helpers in scope — reuse whatever the file already defines rather than adding a second copy; add only the imports the block below needs that are missing.

```ts
describe('rewinding a tutorial', () => {
  // A tutorial run standing on the board `hits` says, started fresh.
  const tutorialAt = (hits: number) => {
    const actor = createActor(gameMachine).start()
    actor.send({ type: 'SET_MODE', mode: 'trainee' })
    actor.send({ type: 'SET_DIFFICULTY', difficulty: 'easy' })
    actor.send({ type: 'START', now: 0, tutorial: true })
    actor.send({ type: 'REWIND', board: hits, now: 1 })
    return actor
  }

  it('puts the run back on that board’s grid, target and hit count', () => {
    const { context } = tutorialAt(3).getSnapshot()
    expect(context.hits).toBe(3)
    expect(context.grid).toEqual(tutorialBoardEntry(3))
    expect(context.targets).toHaveLength(1)
    expect(context.targets[0]?.value).toBe(TUTORIAL_TARGETS[3])
  })

  it('goes back to the opening board too', () => {
    const { context } = tutorialAt(0).getSnapshot()
    expect(context.hits).toBe(0)
    expect(context.grid).toEqual(tutorialBoardEntry(0))
    expect(context.targets[0]?.value).toBe(TUTORIAL_TARGETS[0])
  })

  // The target has to arrive under an id nothing on screen is still animating out under,
  // for the same reason a fresh run spends one: the display list keys a target's
  // animations on it, and an id dealt twice reads as the departing target.
  it('deals the target a fresh id', () => {
    const actor = createActor(gameMachine).start()
    actor.send({ type: 'SET_MODE', mode: 'trainee' })
    actor.send({ type: 'SET_DIFFICULTY', difficulty: 'easy' })
    actor.send({ type: 'START', now: 0, tutorial: true })
    const before = actor.getSnapshot().context.targets[0]?.id
    actor.send({ type: 'REWIND', board: 2, now: 1 })
    expect(actor.getSnapshot().context.targets[0]?.id).not.toBe(before)
  })

  it('stays in play', () => {
    expect(tutorialAt(2).getSnapshot().value).toBe('playing')
  })

  // The guard, and the reason the event can be sent from a screen that does not check
  // first: a run that is not a tutorial has no scripted board to be put back to.
  it('is ignored in a run that is not a tutorial', () => {
    const actor = createActor(gameMachine).start()
    actor.send({ type: 'SET_MODE', mode: 'accuracy' })
    actor.send({ type: 'SET_DIFFICULTY', difficulty: 'hard' })
    actor.send({ type: 'START', now: 0 })
    const before = actor.getSnapshot().context.grid
    actor.send({ type: 'REWIND', board: 2, now: 1 })
    const { context } = actor.getSnapshot()
    expect(context.hits).toBe(0)
    expect(context.grid).toEqual(before)
  })

  // Past the script there is no board to go back to. Nothing asks, but a rewind that
  // dealt an undefined target would put a blank card on the board.
  it('is ignored past the end of the script', () => {
    const actor = createActor(gameMachine).start()
    actor.send({ type: 'SET_MODE', mode: 'trainee' })
    actor.send({ type: 'SET_DIFFICULTY', difficulty: 'easy' })
    actor.send({ type: 'START', now: 0, tutorial: true })
    actor.send({ type: 'REWIND', board: TUTORIAL_TARGETS.length, now: 1 })
    expect(actor.getSnapshot().context.hits).toBe(0)
  })
})
```

Add these imports to the top of `machines/game.test.ts` if they are not already there:

```ts
import { TUTORIAL_TARGETS } from '@/constants/tutorial'
import { tutorialBoardEntry } from '@/lib/tutorial-board'
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `pnpm exec vitest run machines/game.test.ts -t 'rewinding a tutorial'`
Expected: FAIL — `hits` stays 0 and the grid never moves, because nothing handles `REWIND` yet.

- [ ] **Step 3: Add the event to the union**

In `machines/game.ts`, add to the `Event` union directly beneath the `ADD_TARGET` line:

```ts
  // Puts a tutorial back on a board the player has already played — the stepper's one
  // event. `board` is the hit count being returned to, counted from nought, so it is the
  // same index that addresses TUTORIAL_TARGETS and LESSON_AFTER_HIT.
  | { type: 'REWIND'; board: number; now: number }
```

- [ ] **Step 4: Add the imports**

At the top of `machines/game.ts`, extend the existing `@/constants/tutorial` import to include `scriptedTarget` and `TUTORIAL_TARGETS`, and the `@/lib/tutorial-board` import added in Task 1 to include `tutorialBoardEntry`:

```ts
import {
  scriptedTarget,
  TUTORIAL_MAX_TARGETS,
  TUTORIAL_OPENING_TARGET,
  TUTORIAL_TARGETS,
} from '@/constants/tutorial'
import { TUTORIAL_OPENING_GRID, tutorialBoardEntry } from '@/lib/tutorial-board'
```

- [ ] **Step 5: Add the handler**

In `machines/game.ts`, inside the `playing` state's `on` block, immediately after the `ADD_TARGET` entry closes (line ~960, the `},` before the block's own `},`):

```ts
        // The stepper going back, or forward over ground already covered — see
        // lib/tutorial-stepper.ts for which of those it will offer.
        //
        // A whole board at once: the hit count, the grid and the target standing on it
        // move together, because any two of them apart is a board the lesson's words are
        // not true of. The grid is derived rather than remembered — see
        // lib/tutorial-board.ts.
        //
        // The target is dealt here rather than left to the spawner, which only ever deals
        // into a cleared board and so stays quiet with this one standing.
        //
        // Score, streak and the run clock are deliberately untouched. A tutorial submits
        // nothing and shows no score, so there is nothing here for a rewind to inflate,
        // and stopping the clock would be a second rule to keep in step for no gain.
        REWIND: {
          guard: ({
            context,
            event,
          }: {
            context: Context
            event: Extract<Event, { type: 'REWIND' }>
          }) =>
            context.tutorial &&
            event.board >= 0 &&
            event.board < TUTORIAL_TARGETS.length,
          actions: assign(
            ({
              context,
              event,
            }: {
              context: Context
              event: Extract<Event, { type: 'REWIND' }>
            }) => {
              const grid = tutorialBoardEntry(event.board)
              const value = scriptedTarget(event.board) ?? TUTORIAL_OPENING_TARGET
              return {
                hits: event.board,
                grid,
                targets: [
                  {
                    id: context.nextTargetId,
                    value,
                    spawnedAt: event.now,
                    // Trainee's own clock, which the tutorial never runs down —
                    // `clockLeft` reads a tutorial target as untouched. Carried anyway so
                    // the target is the same shape as every other.
                    duration: context.traineeTimeoutMs,
                    refAt: event.now,
                    refGrid: grid,
                    par: computePar(grid, value),
                    userSteps: 0,
                  },
                ],
                nextTargetId: context.nextTargetId + 1,
                // Emptied, seq kept — exactly what `freshGame` does, and for the same
                // reason: the hits describe a press made before the rewind, and the seq
                // keys animations that have to keep climbing across one.
                hitBatch: { seq: context.hitBatch.seq, hits: [] as HitInfo[] },
              }
            },
          ),
        },
```

- [ ] **Step 6: Run the tests to verify they pass**

Run: `pnpm exec vitest run machines/game.test.ts`
Expected: PASS — the six new tests and every test already in the file.

- [ ] **Step 7: Typecheck and commit**

```bash
pnpm typecheck
git add machines/game.ts machines/game.test.ts
git commit -m "feat(tutorial): put a run back on a board it has already played"
```

---

### Task 4: The lesson follows a rewind

The script already maps a hit count to the lesson it opens. A rewind reuses that map rather than adding a second one.

**Files:**

- Modify: `machines/tutorial-lesson.ts` — the comment above `LESSON_AFTER_HIT`
- Modify: `hooks/use-tutorial-lesson.ts`
- Modify: `machines/tutorial-lesson.test.ts`

**Interfaces:**

- Consumes: `LESSON_AFTER_HIT` from `@/machines/tutorial-lesson`.
- Produces: `useTutorialLesson` gains one input, `rewindSeq: number` — a counter the screen raises on every rewind it sends. Used by Task 5.

- [ ] **Step 1: Write the failing test**

Add to `machines/tutorial-lesson.test.ts`, inside the existing `describe('the lesson script', …)`:

```ts
  // What a rewind reads. The table's index 0 used to be dead — no hit lands at nought —
  // and the stepper going back to the opening board is the one thing that reads it. It
  // was already the right answer, which is why a rewind needs no second table.
  it('opens the board a rewind lands on from the same table a hit does', () => {
    expect(LESSON_AFTER_HIT[0]).toBe(FIRST_STEP)
  })
```

- [ ] **Step 2: Run the test to verify it passes already**

Run: `pnpm exec vitest run machines/tutorial-lesson.test.ts -t 'rewind'`
Expected: PASS. This one is a pin on an existing fact, not a driver — it is here so that a future change to `LESSON_AFTER_HIT[0]` fails loudly instead of silently breaking the stepper. Write it, watch it pass, move on.

- [ ] **Step 3: Correct the comment the pin contradicts**

In `machines/tutorial-lesson.ts`, in the comment block above `LESSON_AFTER_HIT`, replace this sentence:

```
// One entry per scripted target, plus two that are not boards: index 0 is never read — no
// hit has landed at nought, and what the opening target gets instead is the guided route —
// and the last is the sign-off, which answers the hit that clears the final scripted board
// and has a rolled one behind it. Past the end of the list the script is over.
```

with:

```
// One entry per scripted target, plus two that are not boards: index 0 answers no hit —
// none lands at nought — but it is what the stepper reads going back to the opening board,
// and it is FIRST_STEP, so a rewind and a fresh deal open the lesson the same way. The
// last is the sign-off, which answers the hit that clears the final scripted board and has
// a rolled one behind it. Past the end of the list the script is over.
```

- [ ] **Step 4: Teach the hook about a rewind**

In `hooks/use-tutorial-lesson.ts`, add `rewindSeq` to the parameter object and its type. Put it beside `runSeq`, whose shape it copies:

```ts
export function useTutorialLesson({
  tutorial,
  isPlaying,
  runSeq,
  rewindSeq,
  hits,
  batch,
  grid,
  targets,
}: {
  tutorial: boolean
  isPlaying: boolean
  runSeq: number
  // How many rewinds the stepper has sent this session. A counter for the reason `runSeq`
  // is one: going back to the board already under the player is a real request, and a
  // flag would have nothing to change.
  rewindSeq: number
  hits: number
  batch: HitBatch
  grid: Grid
  targets: readonly Target[]
}) {
```

Then add this effect directly beneath the existing `dealt` effect that watches `runSeq`:

```ts
  // A rewind, followed. The board under the player has moved to a scripted one, so the
  // lesson goes to the step that board opens on — the same table a hit reads, indexed by
  // the same hit count.
  //
  // Set rather than sent through `lessonStep`, which short-circuits at `done`: a player
  // going back after the script has run out would otherwise be put on a scripted board
  // with the lesson still saying nothing.
  const rewound = useRef(rewindSeq)
  useEffect(() => {
    if (rewound.current === rewindSeq) return
    rewound.current = rewindSeq
    setStep(LESSON_AFTER_HIT[openingRef.current.hits] ?? 'done')
  }, [rewindSeq])
```

`openingRef` is already kept current on every render (`openingRef.current = { tutorial, hits }`), so it carries the hit count the machine has just been rewound to. Add `LESSON_AFTER_HIT` to the existing import from `@/machines/tutorial-lesson`.

- [ ] **Step 5: Run the tests**

Run: `pnpm exec vitest run machines/tutorial-lesson.test.ts`
Expected: PASS.

- [ ] **Step 6: Typecheck and commit**

`pnpm typecheck` will report one error — `app/(tabs)/index.tsx` does not pass `rewindSeq` yet. Fix it now by passing a literal `0` at the single call site of `useTutorialLesson` (~line 880); Task 5 replaces it with the real counter.

```bash
pnpm typecheck
pnpm exec vitest run
git add machines/tutorial-lesson.ts machines/tutorial-lesson.test.ts hooks/use-tutorial-lesson.ts "app/(tabs)/index.tsx"
git commit -m "feat(tutorial): open the lesson on the board a rewind lands on"
```

---

### Task 5: The stepper, drawn and wired

The row itself, and the screen state behind it. Component and caller in one task: a component with no consumer fails `pnpm knip`.

**Files:**

- Create: `components/game/tutorial-stepper.tsx`
- Modify: `app/(tabs)/index.tsx`

**Interfaces:**

- Consumes: `TUTORIAL_STEPS`, `stepState`, `canGoBack`, `canGoForward` from `@/lib/tutorial-stepper` (Task 2); the `REWIND` event (Task 3); `rewindSeq` on `useTutorialLesson` (Task 4).
- Produces: `<TutorialStepper current furthest onGo />`.

- [ ] **Step 1: Write the component**

Create `components/game/tutorial-stepper.tsx`:

```tsx
import { Pressable, Text, View } from 'react-native'

import {
  canGoBack,
  canGoForward,
  stepState,
  TUTORIAL_STEPS,
  type StepState,
} from '@/lib/tutorial-stepper'
import { MODE_GRADIENT } from '@/machines/game'

// The tutorial's colour, worn for the reason the lesson's card wears it: this is the
// lesson talking about itself, not the game reporting anything.
const TINT = MODE_GRADIENT.trainee[0]

// The row's height, held whether anything in it is live or not.
//
// Fixed for the same reason the banner band below it is: this sits above the spawn canvas,
// and a row that grew or shrank would resize the canvas under a target already placed in
// the taller one.
export const TUTORIAL_STEPPER_HEIGHT = 34

const DOT = 22

// How each state is inked. `locked` leaves the tint entirely — a board nobody has reached
// is not part of the lesson yet, and tinting it would make it look like something to
// press. Its number takes the app's `text-dim` class instead, which is why it needs no
// colour here.
const DOT_STYLE: Record<StepState, { border: string; fill: string }> = {
  current: { border: TINT, fill: TINT },
  visited: { border: TINT, fill: 'transparent' },
  locked: { border: 'transparent', fill: 'transparent' },
}

// The number itself. White out of the filled dot the player is standing on, the tint on
// an open one, and dim on a board they have not reached.
const NUMBER_CLASS = 'font-mono text-[10px] font-black'
const numberColor = (state: StepState): string | undefined =>
  state === 'current' ? '#fff' : state === 'visited' ? TINT : undefined

function Arrow({
  glyph,
  live,
  label,
  onPress,
}: {
  glyph: string
  live: boolean
  label: string
  onPress: () => void
}) {
  return (
    <Pressable
      disabled={!live}
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled: !live }}
      hitSlop={10}
      className="w-8 items-center justify-center"
    >
      <Text
        selectable={false}
        className="font-mono text-[16px] font-black"
        // Not hidden when dark. An arrow that vanished would move the numbers under the
        // player's thumb the moment they reached their furthest board; dimmed, the row
        // is the same row from the first step to the last.
        style={{ color: live ? TINT : 'transparent', opacity: live ? 1 : 0.25 }}
      >
        {glyph}
      </Text>
    </Pressable>
  )
}

// Where the player is in the lesson, and the two ways they may move.
//
// It can put them back on a board they have already played and return them to where they
// were, and it can do nothing else: there is no tap anywhere on this row that reaches a
// board they have not reached by playing. See lib/tutorial-stepper.ts for the rules; this
// only draws them.
export function TutorialStepper({
  // The board under the player now, counted from nought.
  current,
  // The highest they have reached this run. Raised by play, never by this.
  furthest,
  onGo,
}: {
  current: number
  furthest: number
  onGo: (board: number) => void
}) {
  return (
    <View
      className="flex-row items-center justify-center"
      style={{ height: TUTORIAL_STEPPER_HEIGHT }}
    >
      <Arrow
        glyph="‹"
        live={canGoBack(current)}
        label="Back a step"
        onPress={() => {
          onGo(current - 1)
        }}
      />
      <View className="flex-row items-center gap-2 px-2">
        {Array.from({ length: TUTORIAL_STEPS }, (_, board) => {
          const state = stepState(board, current, furthest)
          const ink = DOT_STYLE[state]
          return (
            <Pressable
              key={board}
              disabled={state !== 'visited'}
              onPress={() => {
                onGo(board)
              }}
              accessibilityRole="button"
              accessibilityLabel={`Step ${board + 1}`}
              accessibilityState={{
                disabled: state !== 'visited',
                selected: state === 'current',
              }}
              hitSlop={6}
              className="items-center justify-center rounded-full border"
              style={{
                width: DOT,
                height: DOT,
                borderColor: ink.border,
                backgroundColor: ink.fill,
              }}
            >
              {/* Every number is drawn, whatever its state: the row keeps its width and
                its spacing from the first board to the last, and what changes as the
                player gets on is how much of it has come up. */}
              <Text
                selectable={false}
                className={
                  state === 'locked' ? `${NUMBER_CLASS} text-dim` : NUMBER_CLASS
                }
                style={{ color: numberColor(state) }}
              >
                {board + 1}
              </Text>
            </Pressable>
          )
        })}
      </View>
      <Arrow
        glyph="›"
        live={canGoForward(current, furthest)}
        label="Forward a step"
        onPress={() => {
          onGo(current + 1)
        }}
      />
    </View>
  )
}
```

- [ ] **Step 2: Hold the furthest board reached**

In `app/(tabs)/index.tsx`, beside the other run-scoped state near the lesson wiring (~line 877, just above the `useTutorialLesson` call), add:

```tsx
  // How far into the lesson the player has got, and how many times the stepper has put
  // them back.
  //
  // `furthest` is a high-water mark rather than a stored step: raised by play, never by
  // the stepper, and seeded from the run's own hit count — so a tutorial put back from
  // storage mid-run arrives with everything it had already played behind it, and nothing
  // extra has to be persisted for that.
  const [furthestStep, setFurthestStep] = useState(0)
  // Only ever climbs, and only the screen reads it — the lesson wants to know that a
  // rewind happened, not which one.
  const [rewindSeq, setRewindSeq] = useState(0)

  // Raised by play alone. A rewind drops `hits`, and the max is what makes that drop
  // invisible here: ground covered stays covered.
  useEffect(() => {
    setFurthestStep((reached) => Math.max(reached, hits))
  }, [hits])

  // A fresh run starts the mark over, seeded from the hit count that run arrived with —
  // nought for a run just dealt, and whatever it had already played for one put back from
  // storage. Read through a ref rather than depended on, for the reason the lesson does
  // the same: `hits` moves inside a run, and an effect watching it would reset the mark
  // on the first hit of the very run it was tracking.
  const hitsRef = useRef(hits)
  hitsRef.current = hits
  useEffect(() => {
    setFurthestStep(hitsRef.current)
  }, [state.context.runSeq])
```

- [ ] **Step 3: Pass the rewind counter to the lesson**

At the `useTutorialLesson` call (~line 880), replace the literal `0` left by Task 4:

```tsx
  const lesson = useTutorialLesson({
    tutorial,
    isPlaying,
    runSeq: state.context.runSeq,
    rewindSeq,
    hits,
    batch: state.context.hitBatch,
    grid: state.context.grid,
    targets: state.context.targets,
  })
```

Keep every other argument exactly as the file already has it — the list above names the ones that matter, not a replacement for what is there.

- [ ] **Step 4: Render the row**

In `app/(tabs)/index.tsx`, inside the targets area, directly **above** the `{tutorial && (` block that holds the banner band (~line 1393):

```tsx
                {/* Where the player is in the lesson. Above the band the lesson talks in,
                  so the two read top to bottom: which step this is, then what it says.
                  Tutorial runs only, and a fixed height for the same reason the band
                  below it is — see TUTORIAL_STEPPER_HEIGHT. */}
                {tutorial && (
                  <TutorialStepper
                    current={hits}
                    furthest={furthestStep}
                    onGo={(board) => {
                      send({ type: 'REWIND', board, now: Date.now() })
                      setRewindSeq((seq) => seq + 1)
                    }}
                  />
                )}
```

Add the import beside the other `@/components/game/*` imports:

```tsx
import { TutorialStepper } from '@/components/game/tutorial-stepper'
```

- [ ] **Step 5: Verify**

```bash
pnpm exec vitest run
pnpm typecheck
pnpm lint
pnpm knip
```

Expected: all four clean. `knip` in particular — it was the thing Task 2 left failing, and this task is what satisfies it.

- [ ] **Step 6: Run the app and walk the lesson**

Run: `pnpm web`

Clear the device's storage first so the launch owes a welcome run (in the browser: devtools → Application → Local Storage → clear the origin). Then check, in order:

1. Five numbers appear above the lesson's banner; ① is filled, ②–⑤ are dim, both arrows are dark.
2. Playing to board ③ lights ① and ② as outlined and fills ③; NEXT is still dark.
3. PREV puts the board, the target and the lesson's words back to ②, and NEXT lights up.
4. Tapping ① from there goes back further; tapping ④ does nothing, because it is locked.
5. NEXT returns to ③ without the board having to be played again.
6. No stepper appears in a Trainee, Accuracy or Speed run started from the intro.

- [ ] **Step 7: Commit**

```bash
git add components/game/tutorial-stepper.tsx "app/(tabs)/index.tsx"
git commit -m "feat(tutorial): step back through the lesson from a row of its boards"
```

---

### Task 6: The curtain

The screen between the splash and the first tutorial run. Component and wiring together, for the same knip reason as Task 5.

**Files:**

- Create: `components/tutorial-curtain.tsx`
- Modify: `constants/layers.ts`
- Modify: `app/(tabs)/index.tsx` — the welcome effect (~line 489)

**Interfaces:**

- Consumes: `LAYER.curtain`.
- Produces: `<TutorialCurtain onLift onGone />`.

- [ ] **Step 1: Add the layer**

In `constants/layers.ts`, between `dialog` and `splash`:

```ts
  // The curtain a first launch pauses on, between the logo leaving and the lesson
  // arriving. Over every screen and every dialog, because it replaces the lot for as long
  // as it is up — and under the splash, which is still fading out above it.
  curtain: 50,
```

- [ ] **Step 2: Write the component**

Create `components/tutorial-curtain.tsx`:

```tsx
import { Trans } from '@lingui/react/macro'
import { useEffect } from 'react'
import { Pressable, Text } from 'react-native'
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated'
import { scheduleOnRN } from 'react-native-worklets'

import { LAYER } from '@/constants/layers'
import { MODE_GRADIENT } from '@/machines/game'

// How long the words hold before they start to go, and how long going takes.
//
// The hold is about as long as the line takes to read twice, which is the length that
// reads as a beat rather than as a screen the player has been left on. The fade is slow
// enough to be a hand-off and not a cut: what is underneath by then is a board with a
// target already springing in, and the point of the whole screen is that the two are seen
// to be the same moment.
const HOLD_MS = 1400
const FADE_MS = 500

// The beat between the splash and the lesson.
//
// It is the app's own surface rather than white, and that is the whole trick: the ground
// under the words is the ground the game is about to be drawn on, so the hand-off is the
// words fading off a board rather than one screen being replaced by another. In light that
// surface is a warm off-white and in dark it is near-black — a literal white would flash on
// a dark launch and then have to fade back down to a dark board.
export function TutorialCurtain({
  // The fade has started. Whatever should be underneath when it finishes has this long to
  // get ready — the same contract the splash's own exit offers, and for the same reason:
  // a run dealt at the end of a fade is a run the player watches arrive into an empty
  // screen.
  onLift,
  // The curtain has gone and can be unmounted.
  onGone,
}: {
  onLift: () => void
  onGone: () => void
}) {
  const opacity = useSharedValue(1)

  // One-way, whether the hold ran out or a thumb cut it short.
  const lift = () => {
    if (opacity.value < 1) return
    onLift()
    opacity.value = withTiming(
      0,
      { duration: FADE_MS, easing: Easing.in(Easing.cubic) },
      (finished) => {
        'worklet'
        if (finished) scheduleOnRN(onGone)
      },
    )
  }

  useEffect(() => {
    const timer = setTimeout(lift, HOLD_MS)
    return () => {
      clearTimeout(timer)
    }
  }, [])

  const style = useAnimatedStyle(() => ({ opacity: opacity.value }))

  return (
    <Animated.View
      style={[
        {
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          zIndex: LAYER.curtain,
        },
        style,
      ]}
      className="bg-surface"
    >
      {/* The whole screen takes the tap: a player who has read it should not have to find
        anything to press. */}
      <Pressable onPress={lift} className="flex-1 items-center justify-center">
        <Text
          selectable={false}
          className="px-8 text-center font-mono text-[15px] font-black tracking-[2px]"
          style={{ color: MODE_GRADIENT.trainee[0] }}
        >
          <Trans>LET'S LEARN THE GAME</Trans>
        </Text>
      </Pressable>
    </Animated.View>
  )
}
```

- [ ] **Step 3: Put the curtain in the welcome's path**

In `app/(tabs)/index.tsx`, replace the effect that currently starts the welcome run (~line 489):

```tsx
  useEffect(() => {
    if (!welcome.pending || !splashExiting || !isMenu) return
    welcome.taken()
    startTutorial('welcome')
  }, [welcome, splashExiting, isMenu, startTutorial])
```

with a curtain phase, and rewrite the comment block above it — the run is no longer dealt as the splash leaves:

```tsx
  // A first launch does not go straight from the logo into the lesson. It pauses on a
  // curtain that says what is about to happen, and the lesson fades up through it.
  //
  // The curtain is raised as the splash *begins* its exit, so the logo scales away onto a
  // screen that is already there rather than onto an empty one — the same hand-off the
  // splash was written for. The run itself is dealt when the curtain starts to lift,
  // which is what puts a board with a target already springing in under the last of the
  // words. See components/tutorial-curtain.tsx.
  //
  // `menu` because START is only accepted there. `taken` runs first — it closes
  // `pending`, so a re-render mid-effect cannot raise a second curtain over the first.
  const [curtain, setCurtain] = useState<'down' | 'up'>('down')
  useEffect(() => {
    if (!welcome.pending || !splashExiting || !isMenu) return
    welcome.taken()
    setCurtain('up')
  }, [welcome, splashExiting, isMenu])
```

- [ ] **Step 4: Render it**

In the same file, beside the other full-viewport overlays — put it last among them, so nothing the screen already stacks can land on top of it (its `zIndex` settles the order, but rendering it last keeps the source honest about it):

```tsx
      {curtain === 'up' && (
        <TutorialCurtain
          onLift={() => {
            startTutorial('welcome')
          }}
          onGone={() => {
            setCurtain('down')
          }}
        />
      )}
```

Add the import beside the other `@/components/*` imports:

```tsx
import { TutorialCurtain } from '@/components/tutorial-curtain'
```

- [ ] **Step 5: Check the intro is not shown behind the curtain**

Find the condition that decides whether the intro screen renders (~line 1077, the expression containing `welcome.decided && !welcome.pending`). Add the curtain to it so the start screen is not built up behind a curtain that is about to lift off a game:

```tsx
    welcome.decided &&
    !welcome.pending &&
    curtain === 'down' &&
```

Read the surrounding expression before editing and keep its existing operands — the three lines above name what to add, not what to replace.

- [ ] **Step 6: Verify**

```bash
pnpm exec vitest run
pnpm typecheck
pnpm lint
pnpm knip
```

- [ ] **Step 7: Run the app and watch the sequence**

Run: `pnpm web`, with storage cleared so the launch owes a welcome run.

1. The logo plays, then scales away onto the curtain rather than onto the intro or the board.
2. `LET'S LEARN THE GAME` sits on the app's surface, in the tutorial's blue.
3. After about a second and a half it fades, and the tutorial's first target is already on the board as it goes.
4. Tapping during the hold starts the fade immediately, and the run still arrives under it.
5. Switch the device to dark mode and relaunch with storage cleared: the curtain is near-black, with no white flash at any point.
6. From the intro, HOW TO PLAY → TRY IT deals the tutorial with **no** curtain.

- [ ] **Step 8: Commit**

```bash
git add components/tutorial-curtain.tsx constants/layers.ts "app/(tabs)/index.tsx"
git commit -m "feat(tutorial): open a first launch on a curtain the lesson fades up through"
```

---

### Task 7: Translations, the guide, and the gate

**Files:**

- Modify: `locales/en/messages.po`, `locales/cs/messages.po` (generated, then the Czech filled by hand)
- Check: `components/overlays/how-to-play-overlay.tsx`

- [ ] **Step 1: Extract the new strings**

```bash
pnpm i18n:extract
```

Expected: `LET'S LEARN THE GAME` appears in both catalogues, with an empty `msgstr` in `locales/cs/messages.po`.

- [ ] **Step 2: Write the Czech**

In `locales/cs/messages.po`, fill the entry:

```po
#: components/tutorial-curtain.tsx
msgid "LET'S LEARN THE GAME"
msgstr "POJĎME SE NAUČIT HRU"
```

Then check the whole file for any other entry `i18n:extract` left empty and fill it — `--clean` also drops strings no longer used, so review the diff rather than only the additions.

- [ ] **Step 3: Translate the stepper's accessibility labels**

The stepper's three `accessibilityLabel`s in Task 5 are plain English strings. Translate them with `useLingui`, the pattern `components/game/step-up-toast.tsx` and `components/game/best-scores-line.tsx` already use for a label that cannot be wrapped in `<Trans>`.

In `components/game/tutorial-stepper.tsx`, add the import:

```tsx
import { useLingui } from '@lingui/react/macro'
```

Call it at the top of `TutorialStepper`'s body and at the top of `Arrow`'s:

```tsx
  const { t } = useLingui()
```

Then replace the three literals:

- in `Arrow`, the `label` prop stays a plain `string` — the two call sites below are what become macros
- `label="Back a step"` → `label={t\`Back a step\`}`
- `label="Forward a step"` → `label={t\`Forward a step\`}`
- `accessibilityLabel={\`Step ${board + 1}\`}` → `accessibilityLabel={t\`Step ${board + 1}\`}`

`Arrow` itself then needs no `useLingui` after all, since both its labels are passed in — remove it from there if you added it.

Re-run `pnpm i18n:extract` and fill the Czech:

```po
msgid "Back a step"
msgstr "O krok zpět"

msgid "Forward a step"
msgstr "O krok vpřed"

msgid "Step {0}"
msgstr "Krok {0}"
```

Check the exact `msgid` Lingui generates for the interpolated one and match it rather than assuming `{0}`.

- [ ] **Step 4: Re-check the guide**

Per the project rule in `CLAUDE.md`, every task ends by asking whether the change touched gameplay — controls, targets/timers, modes, difficulty, scoring, streaks, or lives.

Read `components/overlays/how-to-play-overlay.tsx` and confirm: the guide describes the game's controls and modes, and its only word about the tutorial is the TRY IT button. The stepper is a control on the tutorial run rather than on the game, the curtain is a launch screen, and neither changes a target, a timer, a mode, a score, a streak or a life. **Expected outcome: no change.** If reading it shows otherwise — for instance if the guide describes what a first launch looks like — update it and say so.

- [ ] **Step 5: Run the full gate**

```bash
pnpm check
```

Expected: ESLint, Prettier, TypeScript, Knip and Vitest all clean.

- [ ] **Step 6: Commit**

```bash
git add locales components/game/tutorial-stepper.tsx "app/(tabs)/index.tsx"
git commit -m "feat(tutorial): translate the curtain and the stepper"
```

---

## Verification

The whole feature is in when, from a cleared device:

1. Splash → curtain → tutorial, with no white flash in dark mode and the first target already on the board as the curtain goes.
2. The stepper shows five numbers, fills the one under the player, outlines the ones behind, and dims the ones ahead.
3. PREV moves the board, the target and the lesson's words together.
4. NEXT is dark until the player has gone back, and never reaches a board they have not played.
5. A locked number does not answer a tap.
6. No stepper and no curtain in any run that is not the tutorial.
7. `pnpm check` is clean.
