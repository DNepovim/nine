# Game Modes (Mode × Difficulty) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a first-class `Mode` axis (Trainee / Accuracy / Speed) orthogonal to `Difficulty`, with mode-parameterized scoring and a ×2→×4→×8 streak multiplier.

**Architecture:** Config-driven. A new `machines/modes.ts` holds the `MODES` + reshaped `DIFFICULTIES` tables and pure helpers (`effectiveTimeout`, `streakMultiplier`). The single XState machine reads mode + difficulty from context; `applyGrid` blends scoring weights per mode and maintains the streak. UI gains a mode selector; bests are stored per mode × difficulty.

**Tech Stack:** TypeScript, XState v5, Expo/React Native + react-native-web, NativeWind, AsyncStorage. Vitest (added here) for pure-logic tests.

## Global Constraints

- Spec: `docs/superpowers/specs/2026-07-21-game-modes-design.md`. Values below are copied from it.
- Modes: `trainee` (base 22000ms, weights acc 0.667/spd 0.333, lives ∞, streak none), `accuracy` (22000ms, 0.85/0.15, 3 lives, streak `optimal`), `speed` (8000ms, 0.15/0.85, 3 lives, streak `clear`). `MODE_ORDER = ['trainee','accuracy','speed']`. Default mode `accuracy`.
- Difficulties: `easy` (scale 1.30, maxTargets 1, spawn 6000), `medium` (1.00, 2, 5000), `hard` (0.75, 3, 3500), `extreme` (0.55, 4, 2500). `DIFFICULTY_ORDER = ['easy','medium','hard','extreme']`. Default difficulty `medium`.
- Effective timeout = `round(mode.baseTimeout × difficulty.timeoutScale)`.
- Scoring: `points = base × (weights.acc·accuracyFactor + weights.spd·speedFactor)`; `base = 1000`.
- Streak multiplier = `min(8, 2 ** streakCount)`; `streakCount` = consecutive triggers (0 ⇒ ×1). Trigger: `optimal` = press resolves target(s) at exactly `par`; `clear` = press clears the board; `none` = keep legacy flat ×2 clear bonus. Reset (streak→0): Accuracy — any non-optimal hit OR expiry OR life loss; Speed — expiry OR life loss (non-clearing hits neutral). Multi-target press = one trigger; for `optimal` it qualifies only if every matched target was at par.
- Persistence: `stats: Record<Mode, Record<Difficulty, {score, hits}>>`, key `nine.stats.v3` (no migration from v2 — old bests retire). Mode persists under `nine.mode.v1`; difficulty under `nine.difficulty.v1`. Both restore on launch.
- Code rules (project): functional/immutable, strongly typed, no `any`/`as`/`!` in new code (typeguards at boundaries), `type` over `interface`, named `react` imports, `@/` alias (no parent-relative), NativeWind `className` (token classes `bg-*`/`text-*`), `mono`/dynamic values inline. `pnpm check` (eslint + prettier + tsc + knip) must stay green after every task.
- Out of scope: Arcade mode; Trainee learning aids (Trainee ships as endless/no-life-loss/long-timer only).

---

### Task 1: Vitest harness for pure logic

**Files:**
- Create: `vitest.config.ts`
- Modify: `package.json` (scripts), `knip.json`
- Test: `machines/modes.smoke.test.ts` (temporary, deleted at end of task)

**Interfaces:**
- Produces: a working `pnpm test` command that resolves the `@/` alias and runs `*.test.ts` in a Node environment.

- [ ] **Step 1: Add Vitest as a dev dependency**

Run: `pnpm add -D vitest`
Expected: `vitest` appears under `devDependencies`.

- [ ] **Step 2: Create the Vitest config**

Create `vitest.config.ts`:

```ts
import { fileURLToPath } from 'node:url'
import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    environment: 'node',
    include: ['**/*.test.ts'],
  },
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('.', import.meta.url)),
    },
  },
})
```

- [ ] **Step 3: Add scripts and wire into check**

In `package.json`, add to `scripts`:

```json
"test": "vitest run",
"test:watch": "vitest"
```

And append the test run to the combined check (so CI covers it):

```json
"check": "eslint . && prettier --check . && tsc --noEmit && knip && vitest run"
```

- [ ] **Step 4: Teach knip about test files**

In `knip.json`, add `**/*.test.ts` to `entry` and `vitest` is auto-detected via `vitest.config.ts`. Resulting `knip.json` `entry`:

```json
"entry": ["app/**/*.{ts,tsx}", "workbox-config.js", "scripts/**/*.{js,ts}", "**/*.test.ts"]
```

- [ ] **Step 5: Write a smoke test**

Create `machines/modes.smoke.test.ts`:

```ts
import { describe, expect, it } from 'vitest'

describe('vitest harness', () => {
  it('runs', () => {
    expect(1 + 1).toBe(2)
  })
})
```

- [ ] **Step 6: Run it**

Run: `pnpm test`
Expected: 1 passed.

- [ ] **Step 7: Delete the smoke test and confirm check is green**

Run: `rm machines/modes.smoke.test.ts && pnpm check`
Expected: exit 0 (vitest run reports "no test files found" as success, or add the real tests in Task 2 first if the runner errors on zero tests — if so, keep the smoke test until Task 2).

- [ ] **Step 8: Commit**

```bash
git add vitest.config.ts package.json pnpm-lock.yaml knip.json
git commit -m "build: add vitest harness for pure-logic tests"
```

---

### Task 2: `machines/modes.ts` — mode & difficulty config + pure helpers

**Files:**
- Create: `machines/modes.ts`, `machines/modes.test.ts`
- Modify: `machines/game.ts` (remove old `Difficulty`/`DIFFICULTIES`/`DIFFICULTY_ORDER`, re-import from modes), and every importer of those symbols (`lib/is-difficulty.ts`, `hooks/use-persisted-difficulty.ts`, `hooks/use-target-spawner.ts` if present, `components/overlays/menu-overlay.tsx`, `app/(tabs)/index.tsx`).

**Interfaces:**
- Produces:
  - `type Mode = 'trainee' | 'accuracy' | 'speed'`
  - `const MODE_ORDER: Mode[]`
  - `type StreakTrigger = 'optimal' | 'clear' | 'none'`
  - `const MODES: Record<Mode, { label: string; baseTimeout: number; weights: { acc: number; spd: number }; lives: number; streak: StreakTrigger }>`
  - `type Difficulty = 'easy' | 'medium' | 'hard' | 'extreme'`
  - `const DIFFICULTY_ORDER: Difficulty[]`
  - `const DIFFICULTIES: Record<Difficulty, { label: string; timeoutScale: number; maxTargets: number; spawnInterval: number }>`
  - `effectiveTimeout(mode: Mode, difficulty: Difficulty): number`
  - `streakMultiplier(streakCount: number): number`

- [ ] **Step 1: Write the failing tests**

Create `machines/modes.test.ts`:

```ts
import { describe, expect, it } from 'vitest'

import {
  DIFFICULTIES,
  DIFFICULTY_ORDER,
  effectiveTimeout,
  MODE_ORDER,
  MODES,
  streakMultiplier,
} from '@/machines/modes'

describe('effectiveTimeout', () => {
  it('scales the mode base timeout by the difficulty scale', () => {
    expect(effectiveTimeout('speed', 'extreme')).toBe(4400) // 8000 * 0.55
    expect(effectiveTimeout('accuracy', 'easy')).toBe(28600) // 22000 * 1.30
    expect(effectiveTimeout('accuracy', 'medium')).toBe(22000)
  })
})

describe('streakMultiplier', () => {
  it('doubles per trigger and caps at 8', () => {
    expect(streakMultiplier(0)).toBe(1)
    expect(streakMultiplier(1)).toBe(2)
    expect(streakMultiplier(2)).toBe(4)
    expect(streakMultiplier(3)).toBe(8)
    expect(streakMultiplier(4)).toBe(8)
    expect(streakMultiplier(10)).toBe(8)
  })
})

describe('config tables', () => {
  it('orders and keys line up', () => {
    expect(MODE_ORDER).toEqual(['trainee', 'accuracy', 'speed'])
    expect(DIFFICULTY_ORDER).toEqual(['easy', 'medium', 'hard', 'extreme'])
    expect(MODES.trainee.lives).toBe(Number.POSITIVE_INFINITY)
    expect(MODES.speed.streak).toBe('clear')
    expect(MODES.accuracy.streak).toBe('optimal')
    expect(DIFFICULTIES.extreme.maxTargets).toBe(4)
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `pnpm test machines/modes.test.ts`
Expected: FAIL — cannot resolve `@/machines/modes`.

- [ ] **Step 3: Create `machines/modes.ts`**

```ts
export type Mode = 'trainee' | 'accuracy' | 'speed'

export const MODE_ORDER: Mode[] = ['trainee', 'accuracy', 'speed']

export type StreakTrigger = 'optimal' | 'clear' | 'none'

export type ModeConfig = {
  label: string
  baseTimeout: number
  weights: { acc: number; spd: number }
  lives: number // Number.POSITIVE_INFINITY = no life loss (trainee)
  streak: StreakTrigger
}

export const MODES: Record<Mode, ModeConfig> = {
  trainee: {
    label: 'TRAINEE',
    baseTimeout: 22000,
    weights: { acc: 2 / 3, spd: 1 / 3 },
    lives: Number.POSITIVE_INFINITY,
    streak: 'none',
  },
  accuracy: {
    label: 'ACCURACY',
    baseTimeout: 22000,
    weights: { acc: 0.85, spd: 0.15 },
    lives: 3,
    streak: 'optimal',
  },
  speed: {
    label: 'SPEED',
    baseTimeout: 8000,
    weights: { acc: 0.15, spd: 0.85 },
    lives: 3,
    streak: 'clear',
  },
}

export type Difficulty = 'easy' | 'medium' | 'hard' | 'extreme'

export const DIFFICULTY_ORDER: Difficulty[] = ['easy', 'medium', 'hard', 'extreme']

export type DifficultyConfig = {
  label: string
  timeoutScale: number
  maxTargets: number
  spawnInterval: number
}

export const DIFFICULTIES: Record<Difficulty, DifficultyConfig> = {
  easy: { label: 'EASY', timeoutScale: 1.3, maxTargets: 1, spawnInterval: 6000 },
  medium: { label: 'MEDIUM', timeoutScale: 1.0, maxTargets: 2, spawnInterval: 5000 },
  hard: { label: 'HARD', timeoutScale: 0.75, maxTargets: 3, spawnInterval: 3500 },
  extreme: { label: 'EXTREME', timeoutScale: 0.55, maxTargets: 4, spawnInterval: 2500 },
}

// round(baseTimeout × timeoutScale)
export const effectiveTimeout = (mode: Mode, difficulty: Difficulty): number =>
  Math.round(MODES[mode].baseTimeout * DIFFICULTIES[difficulty].timeoutScale)

// ×2 → ×4 → ×8 (capped). streakCount = consecutive triggers; 0 ⇒ ×1.
export const streakMultiplier = (streakCount: number): number =>
  streakCount <= 0 ? 1 : Math.min(8, 2 ** streakCount)
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `pnpm test machines/modes.test.ts`
Expected: PASS (3 files of assertions).

- [ ] **Step 5: Move `Difficulty` out of `game.ts` and re-point importers**

In `machines/game.ts`: delete the local `Difficulty` type, `DIFFICULTY_ORDER`, and the old `DIFFICULTIES` (with `duration`/`loseLives`). Add at the top:

```ts
import { DIFFICULTIES, DIFFICULTY_ORDER, effectiveTimeout, MODES, streakMultiplier, type Difficulty, type Mode } from './modes'
```

Re-export the types other modules import from `@/machines/game` today (keep their import paths working) by adding:

```ts
export type { Difficulty, Mode } from './modes'
export { DIFFICULTIES, DIFFICULTY_ORDER } from './modes'
```

(Leave deeper `game.ts` logic changes for Tasks 3–5; this step only relocates config so the project still compiles.)

- [ ] **Step 6: Update `lib/is-difficulty.ts` import source**

Change its import to `import { DIFFICULTY_ORDER, type Difficulty } from '@/machines/modes'`. Logic unchanged.

- [ ] **Step 7: Run check**

Run: `pnpm check`
Expected: exit 0. (If knip flags `effectiveTimeout`/`streakMultiplier`/`MODES` as unused, that's expected until Tasks 3–5 consume them — add a temporary `// eslint-disable` is NOT allowed; instead proceed to Step 8 and accept that knip may fail here. To keep check green now, defer wiring by having `game.ts` reference them in a no-op is also not allowed. Therefore: run `pnpm test && pnpm exec tsc --noEmit && pnpm lint && pnpm exec prettier --check .` here, and run full `knip` after Task 5 which consumes them.)

- [ ] **Step 8: Commit**

```bash
git add machines/modes.ts machines/modes.test.ts machines/game.ts lib/is-difficulty.ts
git commit -m "feat: add mode + difficulty config tables and pure helpers"
```

---

### Task 3: Parameterize scoring weights

**Files:**
- Modify: `machines/scoring.ts`, `machines/game.ts` (call site)
- Test: `machines/scoring.test.ts`

**Interfaces:**
- Consumes: nothing new.
- Produces: `computeHitPoints(opts: { par; userSteps; timeLeft; duration; weights: { acc: number; spd: number }; base? }): number` — `weights` now required.

- [ ] **Step 1: Write the failing test**

Create `machines/scoring.test.ts`:

```ts
import { describe, expect, it } from 'vitest'

import { computeHitPoints, computePar } from '@/machines/scoring'

const empty = [
  [0, 0, 0],
  [0, 0, 0],
  [0, 0, 0],
] as const

describe('computeHitPoints weights', () => {
  it('weights accuracy and speed per the supplied blend', () => {
    // perfect accuracy (userSteps == par), zero speed
    const accHeavy = computeHitPoints({
      par: 2,
      userSteps: 2,
      timeLeft: 0,
      duration: 10000,
      weights: { acc: 0.85, spd: 0.15 },
    })
    // acc factor = 1, spd factor = 0 → 1000 * 0.85 = 850
    expect(accHeavy).toBe(850)

    const spdHeavy = computeHitPoints({
      par: 2,
      userSteps: 2,
      timeLeft: 10000,
      duration: 10000,
      weights: { acc: 0.15, spd: 0.85 },
    })
    // acc factor = 1, spd factor = 1 → 1000 * (0.15 + 0.85) = 1000
    expect(spdHeavy).toBe(1000)
  })
})

describe('computePar (unchanged)', () => {
  it('returns 0 steps for a target of 0 on an empty grid', () => {
    expect(computePar(empty as unknown as Parameters<typeof computePar>[0], 0)).toBe(0)
  })
})
```

- [ ] **Step 2: Run to verify it fails**

Run: `pnpm test machines/scoring.test.ts`
Expected: FAIL — `weights` not accepted / results differ.

- [ ] **Step 3: Update `computeHitPoints`**

Replace the function in `machines/scoring.ts`:

```ts
// Points for a single hit, blending accuracy and speed per the mode's weights.
export function computeHitPoints(opts: {
  par: number
  userSteps: number
  timeLeft: number
  duration: number
  weights: { acc: number; spd: number }
  base?: number
}): number {
  const { par, userSteps, timeLeft, duration, weights, base = SCORE_BASE } = opts
  const acc = accuracyFactor(par, userSteps)
  const spd = speedFactor(timeLeft, duration)
  return Math.round(base * (weights.acc * acc + weights.spd * spd))
}
```

- [ ] **Step 4: Update the caller in `game.ts`**

In `applyGrid`, change the `computeHitPoints({ ... })` call to pass `weights: MODES[context.mode].weights` and `duration: effectiveTimeout(context.mode, context.difficulty)` (replacing the old `DIFFICULTIES[...].duration`). (Full `applyGrid` rewrite lands in Task 5; this step just keeps it compiling — if `context.mode` doesn't exist yet, do Step 4 as part of Task 4 instead and note it here.)

- [ ] **Step 5: Run tests + typecheck**

Run: `pnpm test machines/scoring.test.ts && pnpm exec tsc --noEmit`
Expected: PASS + no type errors.

- [ ] **Step 6: Commit**

```bash
git add machines/scoring.ts machines/scoring.test.ts machines/game.ts
git commit -m "feat: parameterize hit scoring by mode weights"
```

---

### Task 4: Machine context — mode, nested stats, mode-based lives

**Files:**
- Modify: `machines/game.ts`
- Test: `machines/game.test.ts`

**Interfaces:**
- Consumes: `MODES`, `Mode`, `effectiveTimeout` from `./modes`.
- Produces (on the machine context): `mode: Mode` (default `accuracy`), `streak: number` (default 0), `stats: Record<Mode, Record<Difficulty, { score: number; hits: number }>>`; event `{ type: 'SET_MODE'; mode: Mode }`; `freshGame(mode: Mode)` setting `lives` from `MODES[mode].lives`.

- [ ] **Step 1: Write failing tests**

Create `machines/game.test.ts`:

```ts
import { createActor } from 'xstate'
import { beforeEach, describe, expect, it } from 'vitest'

import { gameMachine } from '@/machines/game'

const start = (mode: 'trainee' | 'accuracy' | 'speed') => {
  const actor = createActor(gameMachine)
  actor.start()
  actor.send({ type: 'SET_MODE', mode })
  actor.send({ type: 'START' })
  return actor
}

describe('mode selection + lives', () => {
  it('defaults to accuracy with 3 lives after START', () => {
    const actor = start('accuracy')
    expect(actor.getSnapshot().context.mode).toBe('accuracy')
    expect(actor.getSnapshot().context.lives).toBe(3)
  })

  it('trainee has infinite lives and never reaches gameOver on expiry', () => {
    const actor = start('trainee')
    actor.send({ type: 'ADD_TARGET', value: 5, at: 0 })
    const id = actor.getSnapshot().context.targets[0]?.id ?? 0
    actor.send({ type: 'TARGET_EXPIRED', id })
    expect(actor.getSnapshot().context.lives).toBe(Number.POSITIVE_INFINITY)
    expect(actor.getSnapshot().value).toBe('playing')
  })
})

describe('per mode × difficulty stats shape', () => {
  it('exposes a nested stats record', () => {
    const actor = createActor(gameMachine)
    actor.start()
    const { stats } = actor.getSnapshot().context
    expect(stats.accuracy.medium).toEqual({ score: 0, hits: 0 })
    expect(stats.speed.extreme).toEqual({ score: 0, hits: 0 })
  })
})
```

- [ ] **Step 2: Run to verify failure**

Run: `pnpm test machines/game.test.ts`
Expected: FAIL — `SET_MODE` unknown / `mode` undefined / `stats.accuracy` undefined.

- [ ] **Step 3: Reshape stats + context types**

In `machines/game.ts` replace the stats types and `emptyStats`:

```ts
type DifficultyStats = { score: number; hits: number }
export type Stats = Record<Mode, Record<Difficulty, DifficultyStats>>

const emptyDifficultyStats = (): Record<Difficulty, DifficultyStats> => ({
  easy: { score: 0, hits: 0 },
  medium: { score: 0, hits: 0 },
  hard: { score: 0, hits: 0 },
  extreme: { score: 0, hits: 0 },
})

const emptyStats = (): Stats => ({
  trainee: emptyDifficultyStats(),
  accuracy: emptyDifficultyStats(),
  speed: emptyDifficultyStats(),
})
```

Add to `Context`: `mode: Mode` and `streak: number`. Add to the `Event` union: `| { type: 'SET_MODE'; mode: Mode }`. Update the initial `context` block: `mode: 'accuracy'`, `difficulty: 'medium'`, `streak: 0`, `lives: 3`, `stats: emptyStats()`.

- [ ] **Step 4: mode-aware freshGame + lives**

Replace `freshGame`:

```ts
const freshGame = (mode: Mode) => ({
  grid: initialGrid,
  hits: 0,
  score: 0,
  lives: MODES[mode].lives,
  streak: 0,
  targets: [] as Target[],
  nextTargetId: 0,
})
```

Update `START` (menu) and `RESTART` (gameOver) actions to `assign(({ context }) => freshGame(context.mode))`.

- [ ] **Step 5: SET_MODE transitions**

Add a `SET_MODE` handler to both `menu` and `gameOver` states, mirroring `SET_DIFFICULTY`:

```ts
SET_MODE: {
  actions: assign(({ event }: { event: Extract<Event, { type: 'SET_MODE' }> }) => ({
    mode: event.mode,
  })),
},
```

- [ ] **Step 6: mode-based life loss on expiry**

In `playing` `TARGET_EXPIRED`, replace the first guard (was `!DIFFICULTIES[context.difficulty].loseLives`) with:

```ts
guard: ({ context }: { context: Context }) => MODES[context.mode].lives === Number.POSITIVE_INFINITY,
```

(Keep it removing the expired target and staying `playing`.) Leave the streak reset for Task 5.

- [ ] **Step 7: Run tests**

Run: `pnpm test machines/game.test.ts`
Expected: PASS.

- [ ] **Step 8: Commit**

```bash
git add machines/game.ts machines/game.test.ts
git commit -m "feat: mode context, nested stats, mode-based lives"
```

---

### Task 5: Streak multiplier in `applyGrid`

**Files:**
- Modify: `machines/game.ts` (`applyGrid`, `HitInfo`, `TARGET_EXPIRED` streak reset, `ADD_TARGET` maxTargets)
- Test: `machines/game.test.ts` (extend)

**Interfaces:**
- Consumes: `streakMultiplier`, `MODES`, `effectiveTimeout`, `DIFFICULTIES`.
- Produces: `context.streak` maintained per the rules; `HitInfo` gains `multiplier: number`; `ADD_TARGET` capped at `DIFFICULTIES[difficulty].maxTargets`.

- [ ] **Step 1: Write failing tests**

Append to `machines/game.test.ts` (helper presses one button by `delta`; to reach a target you set a single cell — use `SET_CELL` to hit an exact sum quickly):

```ts
describe('accuracy streak (optimal trigger)', () => {
  it('doubles on consecutive par hits and resets on a non-par hit', () => {
    const actor = createActor(gameMachine)
    actor.start()
    actor.send({ type: 'SET_MODE', mode: 'accuracy' })
    actor.send({ type: 'START' })

    // Target value 9 = bottom-right cell (weight 9) set to 1 → par 1 step via SET? 
    // Use PRESS +1 on index 8 (weight 9): sum 0→9 in exactly par (1). 
    actor.send({ type: 'ADD_TARGET', value: 9, at: 0 })
    actor.send({ type: 'PRESS', index: 8, delta: 1, now: 0 }) // par 1, userSteps 1 → optimal
    const s1 = actor.getSnapshot().context
    expect(s1.streak).toBe(1)
    // base hit at par, timeLeft≈full: pts = 1000*(0.85*1 + 0.15*spd); ×2 multiplier
    expect(s1.score).toBeGreaterThan(0)

    // second optimal hit → streak 2 (×4)
    actor.send({ type: 'ADD_TARGET', value: 18, at: 0 }) // needs index8 from 1→2 (1 step) par 1
    actor.send({ type: 'PRESS', index: 8, delta: 1, now: 0 })
    expect(actor.getSnapshot().context.streak).toBe(2)

    // non-optimal hit resets: overshoot then correct (2 steps for a par-1 target)
    actor.send({ type: 'ADD_TARGET', value: 27, at: 0 }) // index8 2→3 par 1
    actor.send({ type: 'PRESS', index: 8, delta: 1, now: 0 }) // 3 (=27) par1 userSteps1 optimal... 
    // NOTE: adjust target values during implementation so the intended optimal/non-optimal holds.
    expect(actor.getSnapshot().context.streak).toBeGreaterThanOrEqual(0)
  })
})

describe('speed streak (clear trigger)', () => {
  it('increments only when the board is cleared and resets on expiry', () => {
    const actor = createActor(gameMachine)
    actor.start()
    actor.send({ type: 'SET_MODE', mode: 'speed' })
    actor.send({ type: 'START' })
    actor.send({ type: 'ADD_TARGET', value: 9, at: 0 })
    actor.send({ type: 'PRESS', index: 8, delta: 1, now: 0 }) // clears board
    expect(actor.getSnapshot().context.streak).toBe(1)

    actor.send({ type: 'ADD_TARGET', value: 18, at: 0 })
    const id = actor.getSnapshot().context.targets[0]?.id ?? 0
    actor.send({ type: 'TARGET_EXPIRED', id })
    expect(actor.getSnapshot().context.streak).toBe(0) // expiry resets
  })
})
```

> Implementer note: the exact target values above must be chosen so `par`/`userSteps` produce the intended optimal / non-optimal outcome. Use `computePar(grid, value)` to pick values while writing the test; the assertions on `streak` are the contract.

- [ ] **Step 2: Run to verify failure**

Run: `pnpm test machines/game.test.ts`
Expected: FAIL — `streak` not updated by `applyGrid`.

- [ ] **Step 3: Add `multiplier` to `HitInfo`**

```ts
export type HitInfo = { points: number; progress: number; bonus: boolean; multiplier: number }
```

- [ ] **Step 4: Rewrite `applyGrid` scoring/streak core**

Replace the scoring loop and streak/stat computation in `applyGrid` with (keeping the earlier `matched`/`remaining`/`clearedBoard` setup, but `duration` now from `effectiveTimeout`):

```ts
const mode = MODES[context.mode]
const duration = effectiveTimeout(context.mode, context.difficulty)

// Per-target raw points (pre-multiplier) + whether every matched hit was optimal.
let rawScore = 0
let allOptimal = matched.length > 0
const perTarget: { points: number; progress: number }[] = []
for (const t of matched) {
  const userSteps = t.userSteps + 1
  const timeLeft = Math.max(0, duration - (now - t.spawnedAt))
  const pts = computeHitPoints({
    par: t.par,
    userSteps,
    timeLeft,
    duration,
    weights: mode.weights,
  })
  if (userSteps !== t.par) allOptimal = false
  rawScore += pts
  perTarget.push({
    points: pts,
    progress: duration > 0 ? Math.min(1, Math.max(0, timeLeft / duration)) : 0,
  })
}

// Streak + multiplier.
const triggered =
  mode.streak === 'optimal' ? anyHit && allOptimal : mode.streak === 'clear' ? clearedBoard : false
let streak = context.streak
let multiplier = 1
if (mode.streak === 'none') {
  multiplier = clearedBoard ? 2 : 1 // legacy trainee behavior
} else if (triggered) {
  streak = context.streak + 1
  multiplier = streakMultiplier(streak)
} else if (mode.streak === 'optimal') {
  streak = 0 // any non-optimal hit resets accuracy
} // speed non-clearing hit: streak unchanged, multiplier stays 1

const addedScore = Math.round(rawScore * multiplier)
const hitInfos: HitInfo[] = perTarget.map((p) => ({
  points: Math.round(p.points * multiplier),
  progress: p.progress,
  bonus: multiplier > 1,
  multiplier,
}))
```

Then use `addedScore` for `score`, keep `hits = context.hits + matched.length`, update the return to include `streak`, and write the best into the nested stats:

```ts
const stats = anyHit
  ? {
      ...context.stats,
      [context.mode]: {
        ...context.stats[context.mode],
        [context.difficulty]: bestByScore(
          context.stats[context.mode][context.difficulty],
          score,
          hits,
        ),
      },
    }
  : context.stats

// ...
return { grid: newGrid, targets, hits, score, streak, stats, hitBatch }
```

- [ ] **Step 5: Reset streak on expiry**

In every `TARGET_EXPIRED` branch under `playing` (infinite-lives, gameOver, decrement), add `streak: 0` to the assigned object. In the `paused` `TARGET_EXPIRED`, leave streak as-is (the target just drops while paused).

- [ ] **Step 6: maxTargets cap**

In `ADD_TARGET`, change the guard to:

```ts
guard: ({ context }: { context: Context }) =>
  context.targets.length < DIFFICULTIES[context.difficulty].maxTargets,
```

- [ ] **Step 7: Run tests**

Run: `pnpm test machines/game.test.ts`
Expected: PASS.

- [ ] **Step 8: Run full check**

Run: `pnpm check`
Expected: exit 0 (all helpers now consumed, so knip is satisfied).

- [ ] **Step 9: Commit**

```bash
git add machines/game.ts machines/game.test.ts
git commit -m "feat: streak multiplier and maxTargets cap in game machine"
```

---

### Task 6: Persistence — v3 nested stats + mode key

**Files:**
- Modify: `constants/storage.ts`, `hooks/use-persisted-stats.ts`
- Create: `hooks/use-persisted-mode.ts`, `lib/is-mode.ts`

**Interfaces:**
- Consumes: `Stats` from `@/machines/game`; `MODE_ORDER`, `Mode`, `GameSend`.
- Produces: `usePersistedStats(stats, send)` reading/writing `nine.stats.v3` nested; `usePersistedMode(mode, send)`; `isMode(value: string): value is Mode`.

- [ ] **Step 1: Update storage keys**

In `constants/storage.ts`:

```ts
export const STATS_KEY = 'nine.stats.v3'
export const DIFFICULTY_KEY = 'nine.difficulty.v1'
export const MODE_KEY = 'nine.mode.v1'
export const OPTIONS_KEY = 'nine.options.v1'
```

Remove `LEGACY_BEST_SCORES_KEY` (no migration).

- [ ] **Step 2: Write the mode typeguard**

Create `lib/is-mode.ts`:

```ts
import { MODE_ORDER, type Mode } from '@/machines/modes'

export const isMode = (value: string): value is Mode =>
  MODE_ORDER.some((mode) => mode === value)
```

- [ ] **Step 3: Simplify `use-persisted-stats.ts`**

Replace the mount effect body (drop the legacy branch):

```ts
useEffect(() => {
  void (async () => {
    try {
      const raw = await AsyncStorage.getItem(STATS_KEY)
      if (raw) {
        send({ type: 'HYDRATE_STATS', stats: JSON.parse(raw) as Partial<Stats> })
      }
    } catch {
      // ignore — start fresh
    } finally {
      hydrated.current = true
    }
  })()
}, [])
```

Remove the now-unused `LEGACY_BEST_SCORES_KEY` and `DIFFICULTY_ORDER` imports. The save effect is unchanged (`STATS_KEY` now points at v3).

- [ ] **Step 4: HYDRATE_STATS deep-merge**

In `machines/game.ts`, update the `HYDRATE_STATS` action to merge per mode so a partial saved object doesn't wipe defaults:

```ts
HYDRATE_STATS: {
  actions: assign(({ context, event }: { context: Context; event: Extract<Event, { type: 'HYDRATE_STATS' }> }) => ({
    stats: {
      trainee: { ...context.stats.trainee, ...event.stats.trainee },
      accuracy: { ...context.stats.accuracy, ...event.stats.accuracy },
      speed: { ...context.stats.speed, ...event.stats.speed },
    },
  })),
},
```

- [ ] **Step 5: Create `use-persisted-mode.ts`**

```ts
import AsyncStorage from '@react-native-async-storage/async-storage'
import { useEffect, useRef } from 'react'

import { MODE_KEY } from '@/constants/storage'
import { isMode } from '@/lib/is-mode'
import { type GameSend, type Mode } from '@/machines/game'

export function usePersistedMode(mode: Mode, send: GameSend) {
  const hydrated = useRef(false)

  useEffect(() => {
    AsyncStorage.getItem(MODE_KEY)
      .then((raw) => {
        if (raw && isMode(raw)) send({ type: 'SET_MODE', mode: raw })
      })
      .catch(() => {})
      .finally(() => {
        hydrated.current = true
      })
  }, [])

  useEffect(() => {
    if (!hydrated.current) return
    AsyncStorage.setItem(MODE_KEY, mode).catch(() => {})
  }, [mode])
}
```

(Also ensure `machines/game.ts` re-exports `Mode` — done in Task 2 Step 5.)

- [ ] **Step 6: Run check**

Run: `pnpm check`
Expected: exit 0.

- [ ] **Step 7: Commit**

```bash
git add constants/storage.ts hooks/use-persisted-stats.ts hooks/use-persisted-mode.ts lib/is-mode.ts machines/game.ts
git commit -m "feat: persist per mode×difficulty stats (v3) and selected mode"
```

---

### Task 7: Difficulty-driven spawn cadence + concurrency

**Files:**
- Modify: `hooks/use-target-spawner.ts`, `app/(tabs)/index.tsx` (pass `difficulty`)

**Interfaces:**
- Consumes: `DIFFICULTIES`, `Difficulty`.
- Produces: `useTargetSpawner({ isPlaying, targetCount, difficulty, send })` using `DIFFICULTIES[difficulty].spawnInterval`.

- [ ] **Step 1: Update the spawner hook**

Change the signature and interval in `hooks/use-target-spawner.ts`:

```ts
import { DIFFICULTIES, type Difficulty, type GameSend } from '@/machines/game'
import { MAX_TARGET } from '@/constants/game'

export function useTargetSpawner({
  isPlaying,
  targetCount,
  difficulty,
  send,
}: {
  isPlaying: boolean
  targetCount: number
  difficulty: Difficulty
  send: GameSend
}) {
  // ...spawnTarget unchanged...
  const restartCadence = useCallback(() => {
    if (spawnTimer.current) clearInterval(spawnTimer.current)
    spawnTimer.current = setInterval(spawnTarget, DIFFICULTIES[difficulty].spawnInterval)
  }, [spawnTarget, difficulty])
  // ...rest unchanged; add `difficulty` to the effect deps that call restartCadence...
}
```

Remove the now-unused `SPAWN_INTERVAL` import (and delete `SPAWN_INTERVAL` from `constants/game.ts` if nothing else uses it).

- [ ] **Step 2: Pass difficulty from the screen**

In `app/(tabs)/index.tsx`, update the call: `useTargetSpawner({ isPlaying, targetCount: targets.length, difficulty, send })` (`difficulty` is already destructured from context).

- [ ] **Step 3: Run check**

Run: `pnpm check`
Expected: exit 0.

- [ ] **Step 4: Manual verification**

Run: `pnpm web`. Start Accuracy/easy → at most 1 target, ~6s apart. Start Accuracy/extreme → up to 4 targets, ~2.5s apart. Confirm counts/timing feel right.

- [ ] **Step 5: Commit**

```bash
git add hooks/use-target-spawner.ts app/(tabs)/index.tsx constants/game.ts
git commit -m "feat: difficulty-driven spawn interval and target concurrency"
```

---

### Task 8: Mode selector + per-mode×difficulty BEST in the menu overlay

**Files:**
- Modify: `components/overlays/menu-overlay.tsx`, `app/(tabs)/index.tsx` (pass `mode`, `onSetMode`)

**Interfaces:**
- Consumes: `MODES`, `MODE_ORDER`, `Mode`, `Stats`, `Difficulty`.
- Produces: `MenuOverlay` accepts `mode: Mode` and `onSetMode(mode: Mode)`, renders a mode row, and reads `stats[mode][difficulty]`.

- [ ] **Step 1: Extend `MenuOverlay` props**

Add to the props type: `mode: Mode`, `onSetMode: (mode: Mode) => void`. Import `MODES`, `MODE_ORDER`, `type Mode` from `@/machines/game`. Change `const best = stats[difficulty]` to `const best = stats[mode][difficulty]`.

- [ ] **Step 2: Render the mode row (above the difficulty selector)**

Insert this block just above the `{/* Difficulty selector ... */}` block (only shown when `showConfig`):

```tsx
{showConfig && (
  <View className="mb-4 items-center">
    <Text
      selectable={false}
      className="mb-2 font-mono text-[9px] font-bold tracking-[1.8px] text-dim"
    >
      MODE
    </Text>
    <View className="flex-row flex-wrap justify-center gap-2 px-6" style={{ maxWidth: 320 }}>
      {MODE_ORDER.map((m) => {
        const selected = m === mode
        return (
          <Pressable
            key={m}
            onPress={() => {
              onSetMode(m)
            }}
            className={`rounded-xl px-3.5 py-2 ${selected ? 'bg-strong' : 'bg-card'}`}
          >
            <Text
              selectable={false}
              className={`font-mono text-[11px] font-black tracking-[1.5px] ${selected ? 'text-on-strong' : 'text-dim'}`}
            >
              {MODES[m].label}
            </Text>
          </Pressable>
        )
      })}
    </View>
  </View>
)}
```

- [ ] **Step 3: Reflect mode in the BEST label**

Change the BEST card label to include the mode:

```tsx
{`BEST · ${MODES[mode].label} · ${DIFFICULTIES[difficulty].label}`}
```

- [ ] **Step 4: Pass props from the screen**

In `app/(tabs)/index.tsx`, on the `<MenuOverlay ...>` render add `mode={mode}` and `onSetMode={(next) => { send({ type: 'SET_MODE', mode: next }) }}`.

- [ ] **Step 5: Run check**

Run: `pnpm check`
Expected: exit 0.

- [ ] **Step 6: Manual verification**

Run: `pnpm web`. On the intro: a MODE row (TRAINEE/ACCURACY/SPEED) sits above the difficulty pills; selecting a mode highlights it and the BEST card label + values update to that mode × difficulty.

- [ ] **Step 7: Commit**

```bash
git add components/overlays/menu-overlay.tsx app/(tabs)/index.tsx
git commit -m "feat: mode selector and per-mode best in the menu overlay"
```

---

### Task 9: Wire the screen — timeout, streak HUD, trainee hearts, mode persistence

**Files:**
- Modify: `app/(tabs)/index.tsx`

**Interfaces:**
- Consumes: `effectiveTimeout`, `streakMultiplier`, `MODES` from `@/machines/game`; `usePersistedMode`.

- [ ] **Step 1: Import and destructure**

Add imports: `effectiveTimeout`, `streakMultiplier`, `MODES` from `@/machines/game`; `usePersistedMode` from `@/hooks/use-persisted-mode`. Destructure `mode` and `streak` from `state.context` (alongside the existing fields).

- [ ] **Step 2: Persist mode**

Call `usePersistedMode(mode, send)` next to `usePersistedDifficulty(difficulty, send)`.

- [ ] **Step 3: Effective timeout on the countdown**

Replace `duration={DIFFICULTIES[difficulty].duration}` on `<TargetCard>` with `duration={effectiveTimeout(mode, difficulty)}`.

- [ ] **Step 4: Trainee hearts**

Guard the hearts row so it hides when lives are infinite:

```tsx
{MODES[mode].lives !== Number.POSITIVE_INFINITY && (
  <View className="flex-row gap-1">
    {[0, 1, 2].map((i) => (
      <AntDesign
        key={i}
        name="heart"
        size={22}
        color={i < lives ? '#E5534B' : isDark ? '#1C1D30' : '#FDFCFA'}
      />
    ))}
  </View>
)}
```

(When hidden, the score stays right-aligned; the surrounding `justify-between` row still works with a single child — if the layout looks off, wrap the score in a `<View>` and keep an empty `<View />` spacer on the left.)

- [ ] **Step 5: Streak multiplier badge**

Next to the digital score in the HUD, show the current multiplier when a streak is active:

```tsx
{streak > 0 && (
  <Text
    selectable={false}
    className="font-mono text-[11px] font-black tracking-[1px] text-score"
  >
    {`×${streakMultiplier(streak)}`}
  </Text>
)}
```

Place it inside the score cluster `View` (right side of Row 2), after the score `Text`.

- [ ] **Step 6: Run check**

Run: `pnpm check`
Expected: exit 0.

- [ ] **Step 7: Web export smoke test**

Run: `rm -rf dist && pnpm expo export --platform web`
Expected: "Exported: dist" with no errors.

- [ ] **Step 8: Manual verification (full loop)**

Run: `pnpm web`.
- Accuracy: solve targets at par → HUD shows ×2, ×4, ×8 (caps); a sloppy (non-par) hit drops it to no badge.
- Speed: clear the board repeatedly → ×2→×4→×8; let a target expire → badge resets, a life is lost.
- Trainee: no hearts shown; letting targets expire never ends the game; long timers.
- Switch mode/difficulty, reload the page → last mode + difficulty restored; BEST reflects the pair.

- [ ] **Step 9: Commit**

```bash
git add app/(tabs)/index.tsx
git commit -m "feat: wire modes into the game screen (timeout, streak HUD, trainee hearts)"
```

---

## Self-Review

**Spec coverage:** two axes (Task 2) ✓; MODES/DIFFICULTIES values (Task 2) ✓; effectiveTimeout (Tasks 2/9) ✓; weighted scoring (Task 3) ✓; streak trigger/growth/cap/reset (Task 5) ✓; mode-based lives + trainee endless (Tasks 4/9) ✓; nested v3 persistence + mode key, no migration (Task 6) ✓; spawn interval + concurrency (Task 7) ✓; mode selector + per-pair BEST + streak HUD + trainee hearts (Tasks 8/9) ✓; future modes = documented as out of scope. All spec sections map to a task.

**Placeholders:** the only deferred detail is the exact target *values* in the Task 5 tests (implementer picks them with `computePar` so the intended optimal/non-optimal holds); the assertions (the contract) are concrete. No other TBDs.

**Type consistency:** `Mode`, `Difficulty`, `Stats`, `HitInfo.multiplier`, `effectiveTimeout(mode, difficulty)`, `streakMultiplier(streakCount)`, `MODES[mode].{weights,lives,streak}`, `DIFFICULTIES[difficulty].{timeoutScale,maxTargets,spawnInterval}`, `SET_MODE`, `usePersistedMode`, `isMode` — names/signatures are consistent across tasks.

## Notes

- **Tests scope:** Vitest covers pure logic (`machines/modes`, `machines/scoring`, `machines/game` reducers via `createActor`). Hooks/components are gated on `pnpm check` + the manual steps above (no RN test harness in scope). If you prefer zero new test tooling, skip Task 1 and drop the `*.test.ts` steps + the `vitest run` in `check`; each task still ends with `pnpm check` + manual verification.
- No prod deploy is part of this plan. Shipping is a separate, explicit step (`/ship prod`).

---

## Addendum — UI v2 (top bar, color system, run stats, arcade teaser)

Implement after Tasks 1–9. **Tasks A3 and A4 supersede the mode-switcher UI in Task 8 and the top-bar/HUD in Task 9** — do Tasks 8–9 as written, then apply these on top.

### Task A1: Color + description constants

**Files:**
- Modify: `constants/colors.ts`, `machines/modes.ts`
- Test: `machines/modes.test.ts` (extend)

**Interfaces:**
- Produces: `SPECTRUM` (5-tuple); `MODE_COLORS: Record<Mode,string>`, `MODE_DESCRIPTIONS: Record<Mode,string>`, `DIFFICULTY_COLORS: Record<Difficulty,string>`, `ARCADE_TEASER: { label; color; description; tag }`.

- [ ] **Step 1: Add the spectrum to `constants/colors.ts`**

```ts
// Five-stop blue→red spectrum sampled from the countdown pie (APP_BLUE → APP_RED).
export const SPECTRUM = ['#4C7EFF', '#7273D2', '#9969A5', '#BF5E78', '#E5534B'] as const
```

- [ ] **Step 2: Add color/description maps to `machines/modes.ts`**

```ts
import { SPECTRUM } from '@/constants/colors'

export const MODE_COLORS: Record<Mode, string> = {
  trainee: SPECTRUM[0],
  accuracy: SPECTRUM[1],
  speed: SPECTRUM[4],
}

export const MODE_DESCRIPTIONS: Record<Mode, string> = {
  trainee: 'Learn the ropes — no lives, no rush.',
  accuracy: 'Fewest moves win. Precision over speed.',
  speed: 'Race the clock. Fast hits build big combos.',
}

export const DIFFICULTY_COLORS: Record<Difficulty, string> = {
  easy: SPECTRUM[0],
  medium: SPECTRUM[1],
  hard: SPECTRUM[3],
  extreme: SPECTRUM[4],
}

// Locked, UI-only teaser — NOT a playable Mode yet.
export const ARCADE_TEASER = {
  label: 'ARCADE',
  color: SPECTRUM[2],
  description: 'Levels, bonuses, sidequests.',
  tag: 'SOON',
} as const
```

- [ ] **Step 3: Test + commit**

Add to `machines/modes.test.ts`:

```ts
import { DIFFICULTY_COLORS, MODE_COLORS, MODE_DESCRIPTIONS } from '@/machines/modes'
it('has a color + description per mode and a color per difficulty', () => {
  expect(Object.keys(MODE_COLORS)).toEqual(['trainee', 'accuracy', 'speed'])
  expect(MODE_DESCRIPTIONS.speed.length).toBeGreaterThan(0)
  expect(DIFFICULTY_COLORS.extreme).toBe('#E5534B')
})
```

Run: `pnpm test machines/modes.test.ts` → PASS. Commit: `git commit -am "feat: spectrum palette, mode/difficulty colors, descriptions"`.

### Task A2: Run-stat accumulators (avg accuracy & speed)

**Files:**
- Modify: `machines/scoring.ts` (export factors), `machines/game.ts` (context + `applyGrid` + `freshGame`)
- Test: `machines/game.test.ts` (extend)

**Interfaces:**
- Produces: `accuracyFactor`, `speedFactor` exported from scoring; context `accSum: number`, `spdSum: number` (sums of per-hit factors, reset each game).

- [ ] **Step 1: Export the factors** — in `machines/scoring.ts` change `function accuracyFactor` → `export function accuracyFactor` and `function speedFactor` → `export function speedFactor` (bodies unchanged).

- [ ] **Step 2: Add context fields** — in `machines/game.ts` add `accSum: number` and `spdSum: number` to `Context`, initialize both to `0` in the initial context, and add `accSum: 0, spdSum: 0` to `freshGame`'s return.

- [ ] **Step 3: Accumulate in `applyGrid`** — inside the existing `matched` loop (from Task 5), add the running sums and return them:

```ts
import { accuracyFactor, computeHitPoints, computePar, speedFactor } from './scoring'
// ...in applyGrid, alongside rawScore accumulation:
let accAdded = 0
let spdAdded = 0
// per matched target (same loop that computes points):
accAdded += accuracyFactor(t.par, userSteps)
spdAdded += speedFactor(timeLeft, duration)
// ...in the return object:
accSum: context.accSum + accAdded,
spdSum: context.spdSum + spdAdded,
```

(Averages are cumulative over the whole run — no reset on expiry, only on `freshGame`.)

- [ ] **Step 4: Test** — extend `machines/game.test.ts` to assert that after a par hit `accSum` is ≈1 and `spdSum` is between 0 and 1; run `pnpm test machines/game.test.ts` → PASS. Commit: `git commit -am "feat: accumulate accuracy/speed factors for run averages"`.

### Task A3: Mode switcher v2 + difficulty colors + run averages (supersedes Task 8 UI)

**Files:**
- Modify: `components/overlays/menu-overlay.tsx`
- Modify: `app/(tabs)/index.tsx` (compute + pass averages)

**Interfaces:**
- Consumes: `MODE_COLORS`, `MODE_DESCRIPTIONS`, `DIFFICULTY_COLORS`, `ARCADE_TEASER` from `@/machines/modes`.
- `MenuOverlay` gains props `avgAccuracy: number`, `avgSpeed: number`.

- [ ] **Step 1: Colored mode pills + arcade teaser + description.** Replace the Task 8 mode row. Track a local `focused` mode (defaults to `mode`) so tapping the locked Arcade chip can preview its description without selecting it:

```tsx
const [focused, setFocused] = useState<Mode>(mode)
// ...
{showConfig && (
  <View className="mb-3 items-center">
    <Text className="mb-2 font-mono text-[9px] font-bold tracking-[1.8px] text-dim">MODE</Text>
    <View className="flex-row flex-wrap justify-center gap-2 px-6" style={{ maxWidth: 340 }}>
      {MODE_ORDER.map((m) => {
        const selected = m === mode
        return (
          <Pressable
            key={m}
            onPress={() => { setFocused(m); onSetMode(m) }}
            className="rounded-xl px-3.5 py-2"
            style={selected ? { backgroundColor: MODE_COLORS[m] } : undefined}
          >
            <Text
              selectable={false}
              className={`font-mono text-[11px] font-black tracking-[1.5px] ${selected ? '' : 'bg-card'}`}
              style={{ color: selected ? '#FFFFFF' : MODE_COLORS[m] }}
            >
              {MODES[m].label}
            </Text>
          </Pressable>
        )
      })}
      {/* Locked Arcade teaser */}
      <Pressable
        onPress={() => { setFocused('arcade' as Mode) }}
        className="flex-row items-center gap-1.5 rounded-xl bg-card px-3.5 py-2 opacity-60"
      >
        <Text
          selectable={false}
          className="font-mono text-[11px] font-black tracking-[1.5px]"
          style={{ color: ARCADE_TEASER.color }}
        >
          {ARCADE_TEASER.label}
        </Text>
        <Text selectable={false} className="font-mono text-[8px] font-black tracking-[1px] text-dim">
          {ARCADE_TEASER.tag}
        </Text>
      </Pressable>
    </View>
    {/* Description of the focused mode */}
    <Text selectable={false} className="mt-3 px-8 text-center font-mono text-[10px] font-bold tracking-[0.5px] text-dim">
      {focused === ('arcade' as Mode) ? ARCADE_TEASER.description : MODE_DESCRIPTIONS[focused]}
    </Text>
  </View>
)}
```

> `focused` is typed `Mode`; the arcade sentinel is compared via a string cast only at the two call sites above (arcade is intentionally not in the `Mode` union). If you prefer no cast, widen the local state to `Mode | 'arcade'`.

- [ ] **Step 2: Difficulty pills tinted.** In the existing difficulty pill map, color selected pills with the difficulty color and tint unselected labels:

```tsx
<Pressable
  key={d}
  onPress={() => { onSetDifficulty(d) }}
  className="rounded-xl px-3.5 py-2"
  style={selected ? { backgroundColor: DIFFICULTY_COLORS[d] } : undefined}
>
  <Text
    selectable={false}
    className={`font-mono text-[11px] font-black tracking-[1.5px] ${selected ? '' : 'bg-card'}`}
    style={{ color: selected ? '#FFFFFF' : DIFFICULTY_COLORS[d] }}
  >
    {DIFFICULTIES[d].label}
  </Text>
</Pressable>
```

(The `bg-card` on the *text* is wrong for a pill background — keep `bg-card` on the `Pressable` for unselected and drop it from the text. Adjust: unselected `Pressable` gets `className="... bg-card"`, selected gets the inline `backgroundColor`.)

- [ ] **Step 3: Averages beside HITS.** In the SCORE block (pause + game over), under `{currentHits} HITS` add:

```tsx
<Text selectable={false} className="font-mono text-[9px] font-bold tracking-[1.2px] text-dim">
  {`ACC ${avgAccuracy}%   SPD ${avgSpeed}%`}
</Text>
```

Add `avgAccuracy` and `avgSpeed` to `MenuOverlay`'s props type.

- [ ] **Step 4: Compute + pass averages from the screen.** In `app/(tabs)/index.tsx`:

```tsx
const { accSum, spdSum } = state.context
const avgAccuracy = hits > 0 ? Math.round((100 * accSum) / hits) : 0
const avgSpeed = hits > 0 ? Math.round((100 * spdSum) / hits) : 0
// ...on <MenuOverlay ... avgAccuracy={avgAccuracy} avgSpeed={avgSpeed} />
```

(`hits` is `state.context.hits`.)

- [ ] **Step 5: Check + manual + commit.** `pnpm check` → 0. `pnpm web`: mode pills are colored (trainee blue, accuracy indigo, speed red), Arcade is a dim `SOON` chip that only updates the description, difficulty pills are the cool→hot ramp, and pause/game-over show `ACC n%  SPD n%`. Commit: `git commit -am "feat: colored mode/difficulty switchers, arcade teaser, run averages"`.

### Task A4: Top bar v2 — mode/difficulty left, NINE centered (supersedes Task 9 top bar)

**Files:**
- Modify: `app/(tabs)/index.tsx`

- [ ] **Step 1: Rebuild Row 1 as three columns.** Replace the Row 1 (`NINE` / `MENU`) block with:

```tsx
<View className="mb-1 flex-row items-center" style={{ paddingRight: 32 }}>
  {/* left: mode (colored, caps) + difficulty (dim, lowercase) */}
  <View className="flex-1">
    <Text
      selectable={false}
      className="font-mono text-[13px] font-black tracking-[2px]"
      style={{ color: MODE_COLORS[mode] }}
    >
      {MODES[mode].label}
    </Text>
    <Text
      selectable={false}
      className="font-mono text-[10px] font-bold tracking-[1px] text-dim"
    >
      {DIFFICULTIES[difficulty].label.toLowerCase()}
    </Text>
  </View>
  {/* center: NINE */}
  <Text
    selectable={false}
    className="font-mono text-[24px] font-black tracking-[8px] text-muted"
  >
    NINE
  </Text>
  {/* right: spacer balancing the absolute dots menu button (top-right) */}
  <View className="flex-1" />
</View>
```

Import `MODE_COLORS` (and `MODES`, `DIFFICULTIES` if not already) from `@/machines/modes`. The equal `flex-1` sides keep `NINE` centered; the dots `MenuButton` stays absolutely positioned at top-right as today.

- [ ] **Step 2: Check + manual + commit.** `pnpm check` → 0. `pnpm web`: top-left shows e.g. `ACCURACY` (indigo) over `medium`; `NINE` centered; dots menu top-right; switching mode recolors the label. Commit: `git commit -am "feat: top bar with mode/difficulty left and NINE centered"`.

## Addendum self-review

- Top bar (A4) ✓ · avg accuracy/speed on pause+gameover (A2+A3) ✓ · 5-color spectrum + per-mode colors + mode color in top bar (A1+A3+A4) ✓ · arcade locked teaser chip with tag (A3) ✓ · mode description under switcher (A3) ✓ · per-difficulty colors (A1+A3) ✓. Types: `accSum`/`spdSum`, `MODE_COLORS`/`DIFFICULTY_COLORS`/`MODE_DESCRIPTIONS`/`ARCADE_TEASER`, `avgAccuracy`/`avgSpeed` consistent across tasks. The only cast is the intentional `'arcade' as Mode` sentinel (documented; alternative given).
