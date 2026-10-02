# Arcade Fortified Villages Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Give about one arcade crossroad in three a walled village among its ways, which the hero must take by knocking down its towers while killing the warriors it sends — with three hearts on the run that only a siege can spend.

**Architecture:** Everything that can be pure is pure. `machines/arcade.ts` learns which villages are walled (rolled at map-growth from the crossroad's own seed, so a retreat gives back the same walls). A new `machines/siege.ts` holds the whole fight as pure functions over a `Siege` value — generate, resolve a hit, advance one scheduled event, shift every clock by a pause. `hooks/use-arcade-run.ts` adds four beats and calls those functions; it never computes a siege rule itself. Warriors never tick in React: each carries `spawnedAt` and `walkMs`, the screen derives its position on the UI thread, and the hook arms exactly one timer for the next event.

**Tech Stack:** TypeScript, React Native (Expo), NativeWind v4, react-native-reanimated v4, react-native-svg, Vitest (node environment), Lingui.

**Spec:** `docs/superpowers/specs/2026-10-02-arcade-fortified-villages-design.md`

## Global Constraints

- **Path alias.** Imports use `@/*` from the repo root. Never a relative `../` import.
- **No new dependencies.** Everything needed is already installed.
- **Tests live beside `machines/` and `lib/` only.** The suite runs in `environment: 'node'` and renders nothing — there are no hook or component tests in this repo and this plan adds none. Hook and screen tasks are verified by `pnpm check` plus a manual run.
- **Pure modules import no React.** `machines/siege.ts` and `machines/arcade.ts` must not import from `react`, `react-native` or `react-native-reanimated`.
- **Reanimated components defined at module level**, never inside a render function.
- **`className` for static styles**, the `style` prop only for values computed at runtime.
- **Comments explain why, not what**, in the voice of the surrounding files — see `machines/arcade.ts` for the register.
- **Domain language** (CLAUDE.md): a **crossroad** is one position on the way and also one "round"; the villages at the ends of its ways are **buds** in code; the 3×3 playfield is the **grid**, the keys are the **dial**, and neither is ever a "board". **Hearts** are drawn with `HeartIcon`; the word for losing one is a **life**, matching `FloatingLifeLoss`.
- **Determinism.** A run is one seed. Every roll must come from `rngFor(seed, key)` with a key naming what is being rolled, so the same seed walks the same map and fights the same siege.
- **Arcade is behind the `arcade: 'developer'` flag.** Nothing in this plan changes that.
- **How to Play must end up accurate** (CLAUDE.md rule) — Task 10.

## Review Focus

1. **A grid with too few cheap sums.** A deep siege needs up to 9 distinct values 2–3 presses away. `parValues` must stretch its band rather than return a short list, and must never return a duplicate. _(Task 1 tests it; Task 3 tests the 9-value case end to end.)_
2. **A warrior spawning when every cheap value is already taken.** Exclusion plus stretch must still produce a reachable number, or the warrior must not spawn at all — never a warrior carrying a value a tower already has. _(Task 5.)_
3. **Walking back and forth across a fortified crossroad.** A retreat must return the same walls; the fort roll must not consume the fan's rng stream or re-roll on revisit. _(Task 2.)_
4. **A sum landing on a tower already knocked flat.** A tower at `left === 0` is still drawn as rubble and still holds its old value; dialling that value must resolve nothing. _(Task 4.)_
5. **Pausing mid-siege.** A warrior three quarters of the way down must still be three quarters of the way down on resume — every siege clock shifts by exactly the pause. _(Task 5 tests `shift`; Task 6 wires it.)_

---

### Task 1: `parValues` — one number-picker for fans and sieges

`wayValues` already picks N distinct sums that are 3–4 presses from a grid, stretching the band when it cannot fill the fan. A siege needs the same picker with a cheaper band and an exclusion list. Generalise rather than copy.

**Files:**

- Modify: `machines/arcade.ts` (the `wayValues` function, around line 160)
- Test: `machines/arcade.test.ts`

**Interfaces:**

- Consumes: `parTable(dial, grid)` from `@/machines/scoring`; `ARCADE_DIAL`, `Rng`, `Grid`.
- Produces:
  - `parValues(grid: Grid, count: number, rng: Rng, band: ParBand): readonly number[]`
  - `type ParBand = { min: number; max: number; exclude?: readonly number[] }`
  - `wayValues(grid: Grid, count: number, rng: Rng): readonly number[]` — unchanged signature, now a one-line call to `parValues`.
  - `rngFor(seed: number, id: string): Rng` — **newly exported** (it is currently a private const in the same file). Task 3 needs it.

- [ ] **Step 1: Write the failing tests**

Add to `machines/arcade.test.ts`, importing `parValues` alongside the existing imports from `./arcade`:

```ts
describe('parValues', () => {
  it('gives distinct values inside the band it is asked for', () => {
    const values = parValues(zeros, 4, seeded(1), { min: 2, max: 3 })
    const table = parTable(NINE_DIAL, zeros)
    expect(values).toHaveLength(4)
    expect(new Set(values).size).toBe(4)
    for (const value of values) {
      expect(table[value]).toBeGreaterThanOrEqual(2)
      expect(table[value]).toBeLessThanOrEqual(3)
    }
  })

  it('never returns a value it was told to exclude', () => {
    const first = parValues(busy, 3, seeded(5), { min: 2, max: 3 })
    const second = parValues(busy, 3, seeded(5), { min: 2, max: 3, exclude: first })
    expect(second).toHaveLength(3)
    for (const value of second) expect(first).not.toContain(value)
  })

  it('stretches the band rather than coming back short', () => {
    // Nine values in a two-to-three-press band is more than most grids hold, so this
    // only passes if the band widens. A deep siege asks for exactly this many.
    const values = parValues(zeros, 9, seeded(9), { min: 2, max: 3 })
    expect(values).toHaveLength(9)
    expect(new Set(values).size).toBe(9)
  })

  it('still answers wayValues the way it always did', () => {
    const table = parTable(NINE_DIAL, busy)
    for (const value of wayValues(busy, 3, seeded(11))) {
      expect(table[value]).toBeGreaterThanOrEqual(3)
    }
  })
})
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `pnpm vitest run machines/arcade.test.ts -t parValues`
Expected: FAIL — `parValues is not a function` (it is not exported yet).

- [ ] **Step 3: Implement**

In `machines/arcade.ts`, export `rngFor` by changing its declaration:

```ts
// The randomness one crossroad of one run is grown from. Pure in both its arguments, so a
// run is a seed and nothing else: the same seed walks the same map every time.
//
// Exported because a siege is grown the same way — see machines/siege.ts, which keys its
// own streams on `siege:${id}` so that nothing it rolls can shift the fan.
export const rngFor = (seed: number, id: string): Rng => seeded((seed ^ idSeed(id)) >>> 0)
```

Then replace the whole `wayValues` function with:

```ts
// What a band of presses is, for the picker below. `exclude` is what is already live and
// may not be handed out twice — a siege asks for this, a fan never does.
export type ParBand = { min: number; max: number; exclude?: readonly number[] }

// Which sums are `count` distinct targets the given number of presses from here.
//
// The band first, widened only if it cannot fill the ask. Shuffled rather than taken in
// order, or every crossroad would offer the lowest few sums in the band and a run would
// climb through the same numbers every time.
//
// One picker for two callers that want the same thing at different prices: a fan wants
// three or four presses, a siege wants two or three and asks for far more of them.
export function parValues(
  grid: Grid,
  count: number,
  rng: Rng,
  band: ParBand,
): readonly number[] {
  const table = parTable(ARCADE_DIAL, grid)
  const barred = new Set(band.exclude ?? [])
  for (let stretch = 0; stretch <= PAR_STRETCH; stretch++) {
    const candidates: number[] = []
    for (let value = 1; value <= ARCADE_DIAL.maxSum; value++) {
      if (barred.has(value)) continue
      const par = table[value]
      if (par === undefined || !Number.isFinite(par)) continue
      if (par >= band.min && par <= band.max + stretch) candidates.push(value)
    }
    if (candidates.length < count) continue
    // Fisher–Yates, far enough to fill the ask and no further.
    for (let i = 0; i < count; i++) {
      const j = i + Math.floor(rng() * (candidates.length - i))
      const a = candidates[i]
      const b = candidates[j]
      if (a === undefined || b === undefined) continue
      candidates[i] = b
      candidates[j] = a
    }
    return candidates.slice(0, count)
  }
  return []
}

// What every way at a crossroad costs from the grid as it stands when the crossroad opens.
export function wayValues(grid: Grid, count: number, rng: Rng): readonly number[] {
  return parValues(grid, count, rng, { min: PAR_MIN, max: PAR_MAX })
}
```

`PAR_STRETCH` is already defined above in the same file; raise it from `6` to `12` so a nine-value ask in a two-press band can actually widen far enough:

```ts
// How far the band may be stretched when it cannot fill an ask. A fan has never needed
// more than a step or two, but a deep siege asks for nine distinct numbers from a band
// two presses wide, and a grid that left it short would have no walls to knock down.
const PAR_STRETCH = 12
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `pnpm vitest run machines/arcade.test.ts`
Expected: PASS — the four new tests and every existing `wayValues` / `openCrossroad` test.

- [ ] **Step 5: Commit**

```bash
git add machines/arcade.ts machines/arcade.test.ts
git commit -m "refactor(arcade): one number-picker for fans and sieges"
```

---

### Task 2: Which villages are walled

A crossroad's fan learns, when it is grown, whether one of its villages is fortified. The roll comes from a stream of its own so it cannot shift the fan, which means every map that exists today keeps exactly the ways it has.

**Files:**

- Modify: `machines/arcade.ts` (`Crossroad` type, `newMap`, `openCrossroad`)
- Test: `machines/arcade.test.ts`

**Interfaces:**

- Consumes: `rngFor` and `parValues` from Task 1.
- Produces: `Crossroad` gains two fields —
  - `fortified: boolean` — the village standing here is walled.
  - `dry: number` — how many fans in a row up this branch offered no walls.

- [ ] **Step 1: Write the failing tests**

Add to `machines/arcade.test.ts`:

```ts
describe('fortified villages', () => {
  const grown = (seed: number, id: string, map = newMap(seed)) =>
    openCrossroad(map, id, zeros, seed)

  it('starts the run on an unwalled village with a dry slate', () => {
    const map = newMap(3)
    expect(map[START]?.fortified).toBe(false)
    expect(map[START]?.dry).toBe(0)
  })

  it('walls at most one village in a fan', () => {
    for (let seed = 1; seed <= 60; seed++) {
      const ways = grown(seed, START)[START]?.ways ?? []
      const walled = ways.filter((w) => grown(seed, START)[w.to]?.fortified === true)
      expect(walled.length).toBeLessThanOrEqual(1)
    }
  })

  it('gives back the same walls when the crossroad is grown again', () => {
    const once = grown(17, START)
    const twice = openCrossroad(once, START, busy, 17)
    for (const way of once[START]?.ways ?? []) {
      expect(twice[way.to]?.fortified).toBe(once[way.to]?.fortified)
      expect(twice[way.to]?.dry).toBe(once[way.to]?.dry)
    }
  })

  it('never opens a siege out of the village just taken', () => {
    // Walk down a branch until a walled village turns up, then grow its own fan.
    for (let seed = 1; seed <= 80; seed++) {
      let map = grown(seed, START)
      let at = START
      for (let step = 0; step < 8; step++) {
        const here = map[at]
        const next = here?.ways[0]
        if (next === undefined) break
        map = openCrossroad(map, next.to, zeros, seed)
        at = next.to
        if (map[at]?.fortified !== true) continue
        for (const way of map[at]?.ways ?? []) {
          expect(map[way.to]?.fortified).toBe(false)
        }
      }
    }
  })

  it('forces walls after three dry fans', () => {
    // A branch cannot go four crossroads without one, whatever the seed rolls.
    for (let seed = 1; seed <= 40; seed++) {
      let map = grown(seed, START)
      let at = START
      let dryRun = 0
      for (let step = 0; step < 12; step++) {
        const offered = (map[at]?.ways ?? []).some((w) => map[w.to]?.fortified === true)
        dryRun = offered ? 0 : dryRun + 1
        expect(dryRun).toBeLessThanOrEqual(4)
        const next = map[at]?.ways[0]
        if (next === undefined) break
        map = openCrossroad(map, next.to, zeros, seed)
        at = next.to
      }
    }
  })

  it('walls about a third of the fans it grows', () => {
    let fans = 0
    let walled = 0
    for (let seed = 1; seed <= 400; seed++) {
      const map = grown(seed, START)
      fans += 1
      if ((map[START]?.ways ?? []).some((w) => map[w.to]?.fortified === true)) walled += 1
    }
    expect(walled / fans).toBeGreaterThan(0.2)
    expect(walled / fans).toBeLessThan(0.5)
  })
})
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `pnpm vitest run machines/arcade.test.ts -t 'fortified villages'`
Expected: FAIL — `expect(undefined).toBe(false)`, because `Crossroad` has no `fortified` field.

- [ ] **Step 3: Implement**

In `machines/arcade.ts`, add to the `Crossroad` type, after `depth`:

```ts
// Whether the village standing here is walled, and so has to be taken rather than
// walked into. Decided when this crossroad is created — that is, when the fan that
// offers it is grown — so a retreat gives back the same walls it left.
fortified: boolean
// How many fans in a row up this branch offered no walls. Carried rather than counted,
// because the map is a tree: there is no sequence to look back along, only a parent.
dry: number
```

Add the two constants beside `WAY_COUNTS`:

```ts
// How often a fan offers a walled village, and how many dry fans may pass before one is
// forced. A crossroad is the round: roughly one round in three has a siege in it, and a
// branch cannot go more than three without.
const FORT_CHANCE = 1 / 3
const FORT_DRY_MAX = 3
```

In `newMap`, add to the START crossroad:

```ts
      fortified: false,
      dry: 0,
```

In `openCrossroad`, after `if (values.length === 0) return map` and before the `ways` mapping:

```ts
// Rolled on a stream of its own rather than on the fan's, so adding walls to the map
// moved no fan that existed before them: a seed that walked a way yesterday walks the
// same way today.
const fortRng = rngFor(seed, `fort:${id}`)
const offers = !at.fortified && (at.dry >= FORT_DRY_MAX || fortRng() < FORT_CHANCE)
const walled = offers ? Math.floor(fortRng() * values.length) : -1
```

and in the loop that creates the destinations, add to each new crossroad:

```ts
      fortified: ways.indexOf(way) === walled,
      dry: offers ? 0 : at.dry + 1,
```

Use the loop index instead of `indexOf` — rewrite that loop as:

```ts
const grown: Record<string, Crossroad> = { ...map, [id]: { ...at, ways } }
ways.forEach((way, i) => {
  grown[way.to] = {
    id: way.to,
    from: id,
    depth: at.depth + 1,
    heading: way.angle,
    pos: {
      x: at.pos.x + Math.cos(way.angle) * way.reach,
      y: at.pos.y + Math.sin(way.angle) * way.reach,
    },
    ways: [],
    name: settlementName(rngFor(seed, `name:${way.to}`)),
    fortified: i === walled,
    dry: offers ? 0 : at.dry + 1,
  }
})
return grown
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `pnpm vitest run machines/arcade.test.ts`
Expected: PASS — all of them, including the existing `openCrossroad` and `trail` suites.

- [ ] **Step 5: Run the type checker**

Run: `pnpm typecheck`
Expected: PASS. If any test or fixture builds a `Crossroad` literal by hand it will fail here; add `fortified: false, dry: 0` to it.

- [ ] **Step 6: Commit**

```bash
git add machines/arcade.ts machines/arcade.test.ts
git commit -m "feat(arcade): wall about one village in three"
```

---

### Task 3: A siege, and the walls it is made of

**Files:**

- Create: `constants/siege.ts`
- Create: `machines/siege.ts`
- Create: `machines/siege.test.ts`

**Interfaces:**

- Consumes: `rngFor`, `parValues`, `ARCADE_DIAL`, `UP` from `@/machines/arcade`; `Grid` from `@/modes`.
- Produces:
  - `type Tower = { id: string; value: number; left: number; hits: number; angle: number }`
  - `type Warrior = { id: string; value: number; spawnedAt: number; walkMs: number; lane: number }`
  - `type Siege = { at: string; depth: number; seed: number; towers: readonly Tower[]; warriors: readonly Warrior[]; spawned: number; nextAt: number }`
  - `towerCount(depth: number): number`
  - `towerHits(depth: number): number`
  - `liveValues(siege: Siege): readonly number[]`
  - `newSiege(at: string, depth: number, seed: number, grid: Grid, now: number): Siege`

- [ ] **Step 1: Write `constants/siege.ts`**

```ts
// A siege's own timings, counts and sizes, in one table for the same reason
// constants/arcade.ts is one: the camera closing, the hero stopping short of the gate and
// the first warrior leaving it are one movement, and a beat tuned in one place and not the
// others would read as three things happening at once.

// Hearts a run carries. The same three every scored mode gives, and the same three hearts
// the player already knows — a siege is the only thing in arcade that spends them.
export const HEARTS = 3

// The walls: how many towers a siege has and how many hits each takes, at the start of a
// run and at the deepest a siege is asked to be.
export const TOWERS_SHALLOW = 4
export const TOWERS_DEEP = 6
export const TOWER_HITS_SHALLOW = 3
export const TOWER_HITS_DEEP = 5

// How many crossroads deep a siege is at its hardest. Past it nothing more is added — a
// run that climbs forever should not meet a wall that grows forever with it.
export const SIEGE_DEPTH_FULL = 24

// The press band every number in a siege is drawn from. Cheaper than a fan's three to
// four, because a crossroad asks for one number and a siege asks for dozens.
export const SIEGE_PAR_MIN = 2
export const SIEGE_PAR_MAX = 3

// Warriors: how many may be on the ground at once, how long one takes to cross it, when
// the first leaves the gate and how long the gap between them starts at.
//
// The last two are bases: both are run through the same decay everything in the app that
// tightens uses, counting warriors-already-sent plus the depth of the siege. So a fight
// speeds up as it drags on *and* starts faster the deeper it is.
export const WARRIORS_LIVE_MAX = 3
export const WARRIOR_WALK_MS = 7000
export const SPAWN_FIRST_MS = 2600
export const SPAWN_EVERY_MS = 5200

// How wide the warriors' lanes fan out below the gate, in radians, so two never come down
// the same line.
export const LANE_SPREAD = 0.9

// The camera closing on the walls and opening out again, and how far in it goes.
export const CLOSE_MS = 760
export const OPEN_MS = 620
export const SIEGE_ZOOM = 2.4

// Where the hero stops along the way in: short of the gate, with the walls above it.
export const STANDOFF = 0.82

// The beat the last tower buys, and the beat the last heart buys.
export const TAKEN_MS = 900
export const OVERRUN_MS = 900
```

- [ ] **Step 2: Write the failing tests**

Create `machines/siege.test.ts`:

```ts
import { describe, expect, it } from 'vitest'

import {
  SIEGE_PAR_MAX,
  SIEGE_PAR_MIN,
  TOWER_HITS_DEEP,
  TOWER_HITS_SHALLOW,
  TOWERS_DEEP,
  TOWERS_SHALLOW,
} from '@/constants/siege'
import { parTable } from '@/machines/scoring'
import { NINE_DIAL, type Grid } from '@/modes'

import { liveValues, newSiege, towerCount, towerHits } from './siege'

const zeros: Grid = [0, 0, 0, 0, 0, 0, 0, 0, 0]
const busy: Grid = [3, 7, 1, 9, 2, 4, 0, 6, 8]

describe('towerCount and towerHits', () => {
  it('start shallow and end deep', () => {
    expect(towerCount(0)).toBe(TOWERS_SHALLOW)
    expect(towerCount(100)).toBe(TOWERS_DEEP)
    expect(towerHits(0)).toBe(TOWER_HITS_SHALLOW)
    expect(towerHits(100)).toBe(TOWER_HITS_DEEP)
  })

  it('never go backwards as the run climbs', () => {
    for (let depth = 1; depth <= 60; depth++) {
      expect(towerCount(depth)).toBeGreaterThanOrEqual(towerCount(depth - 1))
      expect(towerHits(depth)).toBeGreaterThanOrEqual(towerHits(depth - 1))
    }
  })
})

describe('newSiege', () => {
  it('builds the walls the depth asks for', () => {
    const siege = newSiege('1.0', 0, 42, zeros, 1000)
    expect(siege.towers).toHaveLength(TOWERS_SHALLOW)
    for (const tower of siege.towers) {
      expect(tower.left).toBe(TOWER_HITS_SHALLOW)
      expect(tower.hits).toBe(TOWER_HITS_SHALLOW)
    }
    expect(siege.warriors).toEqual([])
    expect(siege.spawned).toBe(0)
  })

  it('gives every tower a number of its own, inside the siege band', () => {
    const siege = newSiege('2', 40, 7, busy, 0)
    const table = parTable(NINE_DIAL, busy)
    expect(new Set(siege.towers.map((t) => t.value)).size).toBe(siege.towers.length)
    for (const tower of siege.towers) {
      expect(table[tower.value]).toBeGreaterThanOrEqual(SIEGE_PAR_MIN)
      // The band stretches when it has to, so this is the ask rather than the promise.
      expect(table[tower.value]).toBeLessThanOrEqual(SIEGE_PAR_MAX + 12)
    }
  })

  it('fills a deep siege even from an untouched grid', () => {
    const siege = newSiege('3', 100, 1, zeros, 0)
    expect(siege.towers).toHaveLength(TOWERS_DEEP)
    expect(new Set(siege.towers.map((t) => t.value)).size).toBe(TOWERS_DEEP)
  })

  it('is the same siege for the same seed and crossroad', () => {
    const a = newSiege('1.2', 9, 300, busy, 0)
    const b = newSiege('1.2', 9, 300, busy, 0)
    expect(a).toEqual(b)
  })

  it('is a different siege at a different crossroad', () => {
    const a = newSiege('1.2', 9, 300, busy, 0)
    const b = newSiege('1.3', 9, 300, busy, 0)
    expect(a.towers.map((t) => t.value)).not.toEqual(b.towers.map((t) => t.value))
  })

  it('counts only standing towers as live', () => {
    const siege = newSiege('1', 0, 5, zeros, 0)
    const flattened = {
      ...siege,
      towers: siege.towers.map((t, i) => (i === 0 ? { ...t, left: 0 } : t)),
    }
    expect(liveValues(flattened)).toHaveLength(siege.towers.length - 1)
    expect(liveValues(flattened)).not.toContain(siege.towers[0]?.value)
  })
})
```

- [ ] **Step 3: Run the tests to verify they fail**

Run: `pnpm vitest run machines/siege.test.ts`
Expected: FAIL — `Failed to resolve import "./siege"`.

- [ ] **Step 4: Write `machines/siege.ts`**

```ts
import {
  LANE_SPREAD,
  SIEGE_DEPTH_FULL,
  SIEGE_PAR_MAX,
  SIEGE_PAR_MIN,
  SPAWN_EVERY_MS,
  SPAWN_FIRST_MS,
  TOWER_HITS_DEEP,
  TOWER_HITS_SHALLOW,
  TOWERS_DEEP,
  TOWERS_SHALLOW,
  WARRIOR_WALK_MS,
  WARRIORS_LIVE_MAX,
} from '@/constants/siege'
import { parValues, rngFor, UP } from '@/machines/arcade'
import { decayed, type Grid } from '@/modes'

// A siege: the walls at a fortified village, the warriors coming out of its gate, and
// what a press does to either.
//
// Pure, like machines/arcade.ts and for the same reason: no pixels, no React and no
// clock. The hook owns the one timer and calls in here for every rule, so a fight can be
// replayed from a seed and tested without a render.
//
// Nothing in here removes a flattened tower. A tower at `left === 0` is rubble that is
// still drawn and still carries the number it used to answer to — it simply stops being
// live, which is what `liveValues` is for.

export type Tower = {
  id: string
  value: number
  // How many hits it still stands for, and how many it stood for to begin with. The
  // drawing needs both: how far down a tower is, is the ratio.
  left: number
  hits: number
  // Where on the wall it stands, in radians, measured the way the screen measures them.
  angle: number
}

export type Warrior = {
  id: string
  value: number
  // When it left the gate and how long it takes to reach the hero. A position rather than
  // a progress, so nothing has to tick: the screen reads the clock it already runs and
  // works the rest out on the UI thread.
  spawnedAt: number
  walkMs: number
  // Which line it comes down, in radians off straight, so two never overlap.
  lane: number
}

export type Siege = {
  // The crossroad this is the siege of, which is also what its randomness is keyed on.
  at: string
  depth: number
  seed: number
  towers: readonly Tower[]
  warriors: readonly Warrior[]
  // How many have left the gate. What the cadence tightens on, along with the depth.
  spawned: number
  // When the next one leaves.
  nextAt: number
}

// How far into the ramp a depth sits, nought at the start and one at the deepest a siege
// is asked to be.
const ramp = (depth: number): number => Math.min(1, Math.max(0, depth) / SIEGE_DEPTH_FULL)

// How many towers a siege of this depth has, and how many hits each of them takes.
//
// One figure for the whole siege rather than a roll per tower: a wall is of one build, and
// four towers each needing a different unsaid number of hits reads as noise rather than as
// difficulty.
export const towerCount = (depth: number): number =>
  Math.round(TOWERS_SHALLOW + (TOWERS_DEEP - TOWERS_SHALLOW) * ramp(depth))

export const towerHits = (depth: number): number =>
  Math.round(TOWER_HITS_SHALLOW + (TOWER_HITS_DEEP - TOWER_HITS_SHALLOW) * ramp(depth))

// Every number a press could resolve right now. Flattened towers are not among them, so
// their old numbers are free to be handed to a warrior later.
export const liveValues = (siege: Siege): readonly number[] => [
  ...siege.towers.filter((tower) => tower.left > 0).map((tower) => tower.value),
  ...siege.warriors.map((warrior) => warrior.value),
]

// The walls as the hero finds them.
//
// Measured against the grid the hero arrives holding, exactly as a fan is: a siege whose
// numbers were fixed when the map was grown would be reachable from one grid and nowhere
// near reachable from another.
export function newSiege(
  at: string,
  depth: number,
  seed: number,
  grid: Grid,
  now: number,
): Siege {
  const rng = rngFor(seed, `siege:${at}`)
  const count = towerCount(depth)
  const hits = towerHits(depth)
  const values = parValues(grid, count, rng, {
    min: SIEGE_PAR_MIN,
    max: SIEGE_PAR_MAX,
  })
  const towers: Tower[] = values.map((value, i) => ({
    id: `t${i}`,
    value,
    left: hits,
    hits,
    // Evenly round the wall from the top, so the walls read as a ring rather than as a
    // scatter — and so the one the player is looking for is where it was last time.
    angle: UP + (i / values.length) * Math.PI * 2,
  }))
  return {
    at,
    depth,
    seed,
    towers,
    warriors: [],
    spawned: 0,
    nextAt: now + SPAWN_FIRST_MS,
  }
}
```

Leave `decayed`, `LANE_SPREAD`, `SPAWN_EVERY_MS`, `WARRIORS_LIVE_MAX` and `WARRIOR_WALK_MS` imported but unused for now — Task 5 uses them, and the lint step there will catch it if not. If `pnpm lint` objects in this task, drop those five imports and add them back in Task 5.

- [ ] **Step 5: Run the tests to verify they pass**

Run: `pnpm vitest run machines/siege.test.ts`
Expected: PASS — all 7 tests.

- [ ] **Step 6: Commit**

```bash
git add constants/siege.ts machines/siege.ts machines/siege.test.ts
git commit -m "feat(arcade): the walls a fortified village stands behind"
```

---

### Task 4: What a press does inside a siege

The dial's sum carries between hits in both engines — nothing is reset. So a tower is chipped by _arriving_ at its number, not by sitting on it, and a move that leaves the sum where it was resolves nothing at all.

**Files:**

- Modify: `machines/siege.ts`
- Test: `machines/siege.test.ts`

**Interfaces:**

- Consumes: `Siege`, `Tower`, `Warrior` from Task 3.
- Produces:
  - `type SiegeHit = { siege: Siege; tower: Tower | null; warrior: Warrior | null; taken: boolean }`
  - `land(siege: Siege, prevSum: number, nextSum: number): SiegeHit` — `tower` is the tower **after** the chip, `taken` is true only on the move that flattens the last one standing.

- [ ] **Step 1: Write the failing tests**

Add to `machines/siege.test.ts` (extend the import from `./siege` with `land`):

```ts
describe('land', () => {
  const siege = newSiege('1', 0, 42, zeros, 0)
  const first = siege.towers[0]
  if (first === undefined) throw new Error('a siege with no towers')

  it('chips the tower whose number was arrived at', () => {
    const hit = land(siege, 0, first.value)
    expect(hit.tower?.id).toBe(first.id)
    expect(hit.tower?.left).toBe(first.left - 1)
    expect(hit.siege.towers[0]?.left).toBe(first.left - 1)
    expect(hit.warrior).toBeNull()
    expect(hit.taken).toBe(false)
  })

  it('resolves nothing when the sum did not move', () => {
    const hit = land(siege, first.value, first.value)
    expect(hit.tower).toBeNull()
    expect(hit.warrior).toBeNull()
    expect(hit.siege).toBe(siege)
  })

  it('resolves nothing on a number no one answers to', () => {
    const live = new Set(liveValues(siege))
    const quiet = [...Array(100).keys()].find((n) => n > 0 && !live.has(n)) ?? 999
    const hit = land(siege, 0, quiet)
    expect(hit.tower).toBeNull()
    expect(hit.warrior).toBeNull()
  })

  it('leaves rubble alone', () => {
    const flat = {
      ...siege,
      towers: siege.towers.map((t) => (t.id === first.id ? { ...t, left: 0 } : t)),
    }
    const hit = land(flat, 0, first.value)
    expect(hit.tower).toBeNull()
    expect(hit.siege.towers[0]?.left).toBe(0)
  })

  it('calls the village taken on the hit that flattens the last tower', () => {
    const nearly = {
      ...siege,
      towers: siege.towers.map((t, i) => ({ ...t, left: i === 0 ? 1 : 0 })),
    }
    const hit = land(nearly, 0, first.value)
    expect(hit.taken).toBe(true)
  })

  it('kills the warrior whose number was arrived at', () => {
    const live = new Set(liveValues(siege))
    const free = [...Array(100).keys()].find((n) => n > 0 && !live.has(n)) ?? 999
    const withWarrior = {
      ...siege,
      warriors: [{ id: 'w0', value: free, spawnedAt: 0, walkMs: 5000, lane: 0 }],
    }
    const hit = land(withWarrior, 0, free)
    expect(hit.warrior?.id).toBe('w0')
    expect(hit.siege.warriors).toEqual([])
    expect(hit.tower).toBeNull()
  })
})
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `pnpm vitest run machines/siege.test.ts -t land`
Expected: FAIL — `land is not a function`.

- [ ] **Step 3: Implement**

Append to `machines/siege.ts`:

```ts
// What one press resolved. At most one of `tower` and `warrior` is ever set: every live
// number in a siege is distinct, which is the whole reason they are drawn from one pool.
export type SiegeHit = {
  siege: Siege
  // The tower as it stands *after* the chip, so the screen knows how far down it now is.
  tower: Tower | null
  warrior: Warrior | null
  // True only on the press that flattens the last tower standing.
  taken: boolean
}

// A press, resolved against the walls.
//
// The sum is what matters, not the keys: a press changes the grid, the grid gives a sum,
// and arriving at a live number is the hit. Sitting on one is not — the sum carries
// between hits in both engines, so a tower is chipped by dialling away from its number and
// coming back to it, which is what makes three hits three journeys rather than three taps.
//
// Hence the first guard. `pressGrid` always moves the sum, but `setGrid` can write a digit
// the value it already held, and without this that would re-hit whatever the sum is
// standing on.
export function land(siege: Siege, prevSum: number, nextSum: number): SiegeHit {
  const miss: SiegeHit = { siege, tower: null, warrior: null, taken: false }
  if (nextSum === prevSum) return miss

  const struck = siege.towers.find((tower) => tower.left > 0 && tower.value === nextSum)
  if (struck !== undefined) {
    const chipped: Tower = { ...struck, left: struck.left - 1 }
    const towers = siege.towers.map((tower) => (tower.id === struck.id ? chipped : tower))
    return {
      siege: { ...siege, towers },
      tower: chipped,
      warrior: null,
      taken: towers.every((tower) => tower.left === 0),
    }
  }

  const cut = siege.warriors.find((warrior) => warrior.value === nextSum)
  if (cut !== undefined) {
    return {
      siege: {
        ...siege,
        warriors: siege.warriors.filter((warrior) => warrior.id !== cut.id),
      },
      tower: null,
      warrior: cut,
      taken: false,
    }
  }

  return miss
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `pnpm vitest run machines/siege.test.ts`
Expected: PASS — 13 tests.

- [ ] **Step 5: Commit**

```bash
git add machines/siege.ts machines/siege.test.ts
git commit -m "feat(arcade): chip a tower by arriving at its number"
```

---

### Task 5: The warriors' schedule

One timer, not one per warrior. The hook asks when the next thing happens, sleeps until then, and asks the siege to advance by exactly one event.

**Files:**

- Modify: `machines/siege.ts`
- Test: `machines/siege.test.ts`

**Interfaces:**

- Consumes: `Siege`, `Warrior`, `liveValues`, `newSiege` from Tasks 3–4; `decayed` from `@/modes`; `parValues`, `rngFor` from `@/machines/arcade`.
- Produces:
  - `warriorWalk(depth: number): number`
  - `spawnGap(siege: Siege): number`
  - `spawnWarrior(siege: Siege, grid: Grid, now: number): Siege`
  - `nextEvent(siege: Siege): number` — a wall-clock millisecond stamp.
  - `advance(siege: Siege, grid: Grid, now: number): { siege: Siege; lost: boolean }` — resolves **one** event; `lost` is true when a warrior reached the hero.
  - `shift(siege: Siege, byMs: number): Siege`

- [ ] **Step 1: Write the failing tests**

Add to `machines/siege.test.ts` (extend the `./siege` import with `advance`, `nextEvent`, `shift`, `spawnGap`, `spawnWarrior`, `warriorWalk`, and add `WARRIORS_LIVE_MAX` to the `@/constants/siege` import):

```ts
describe('the schedule a village sends its warriors on', () => {
  it('walks faster the deeper the siege', () => {
    expect(warriorWalk(30)).toBeLessThan(warriorWalk(0))
    for (let depth = 1; depth <= 40; depth++) {
      expect(warriorWalk(depth)).toBeLessThanOrEqual(warriorWalk(depth - 1))
    }
  })

  it('sends them faster the longer the fight drags on', () => {
    const siege = newSiege('1', 0, 3, zeros, 0)
    const later = { ...siege, spawned: 10 }
    expect(spawnGap(later)).toBeLessThan(spawnGap(siege))
  })

  it('sends them faster at depth too', () => {
    const shallow = newSiege('1', 0, 3, zeros, 0)
    const deep = newSiege('1', 30, 3, zeros, 0)
    expect(spawnGap(deep)).toBeLessThan(spawnGap(shallow))
  })

  it('gives a warrior a number nothing else is answering to', () => {
    let siege = newSiege('1', 100, 11, busy, 0)
    for (let i = 0; i < 3; i++) {
      const before = liveValues(siege)
      siege = spawnWarrior(siege, busy, i * 1000)
      const fresh = siege.warriors[siege.warriors.length - 1]
      if (fresh === undefined) continue
      expect(before).not.toContain(fresh.value)
    }
    expect(new Set(liveValues(siege)).size).toBe(liveValues(siege).length)
  })

  it('holds off once the ground is full', () => {
    let siege = newSiege('1', 0, 11, busy, 0)
    for (let i = 0; i < 8; i++) siege = spawnWarrior(siege, busy, i * 1000)
    expect(siege.warriors.length).toBeLessThanOrEqual(WARRIORS_LIVE_MAX)
  })

  it('says when the next thing happens', () => {
    const siege = newSiege('1', 0, 11, zeros, 1000)
    expect(nextEvent(siege)).toBe(siege.nextAt)
    const marching = {
      ...siege,
      warriors: [{ id: 'w0', value: 5, spawnedAt: 1000, walkMs: 100, lane: 0 }],
    }
    expect(nextEvent(marching)).toBe(1100)
  })

  it('advances one event at a time, and says when a heart went', () => {
    const siege = newSiege('1', 0, 11, zeros, 0)
    const arriving = {
      ...siege,
      warriors: [{ id: 'w0', value: 99, spawnedAt: 0, walkMs: 100, lane: 0 }],
    }
    const first = advance(arriving, zeros, 200)
    expect(first.lost).toBe(true)
    expect(first.siege.warriors).toEqual([])

    const second = advance(siege, zeros, siege.nextAt)
    expect(second.lost).toBe(false)
    expect(second.siege.warriors).toHaveLength(1)
  })

  it('does nothing when nothing is due', () => {
    const siege = newSiege('1', 0, 11, zeros, 0)
    const quiet = advance(siege, zeros, siege.nextAt - 1)
    expect(quiet.siege).toBe(siege)
    expect(quiet.lost).toBe(false)
  })

  it('keeps every walk where it was across a pause', () => {
    let siege = newSiege('1', 0, 11, zeros, 0)
    siege = spawnWarrior(siege, zeros, 1000)
    const paused = shift(siege, 5000)
    expect(paused.nextAt).toBe(siege.nextAt + 5000)
    expect(paused.warriors[0]?.spawnedAt).toBe((siege.warriors[0]?.spawnedAt ?? 0) + 5000)
    expect(paused.warriors[0]?.walkMs).toBe(siege.warriors[0]?.walkMs)
  })
})
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `pnpm vitest run machines/siege.test.ts -t 'sends its warriors'`
Expected: FAIL — `warriorWalk is not a function`.

- [ ] **Step 3: Implement**

Append to `machines/siege.ts`:

```ts
// How long a warrior takes to cross the ground, and how long the gate waits between
// sending them.
//
// Both on the one curve everything in the app that tightens already uses, so a siege
// squeezes at the same felt rate a Speed clock does. The gap counts warriors-already-sent
// *plus* the depth, which is how one curve does the two escalations the mode asks for: a
// fight speeds up as it drags on, and a deeper fight starts faster.
export const warriorWalk = (depth: number): number =>
  Math.round(decayed(WARRIOR_WALK_MS, depth))

export const spawnGap = (siege: Siege): number =>
  Math.round(decayed(SPAWN_EVERY_MS, siege.spawned + siege.depth))

// One more out of the gate.
//
// Its number is drawn now rather than when the siege was built, against the grid as it
// stands and excluding everything already live — so a warrior is never something the
// player cannot reach in the time it takes to walk at them, however far the dial has
// wandered while the towers were being chipped.
//
// With the ground already full the gate still resets its clock. The village is not short
// of men; it is short of room.
export function spawnWarrior(siege: Siege, grid: Grid, now: number): Siege {
  const waited = { ...siege, nextAt: now + spawnGap(siege) }
  if (siege.warriors.length >= WARRIORS_LIVE_MAX) return waited

  const rng = rngFor(siege.seed, `siege:${siege.at}:w${siege.spawned}`)
  const [value] = parValues(grid, 1, rng, {
    min: SIEGE_PAR_MIN,
    max: SIEGE_PAR_MAX,
    exclude: liveValues(siege),
  })
  if (value === undefined) return waited

  const sent = siege.spawned + 1
  return {
    ...siege,
    warriors: [
      ...siege.warriors,
      {
        id: `w${siege.spawned}`,
        value,
        spawnedAt: now,
        walkMs: warriorWalk(siege.depth),
        lane: (rng() - 0.5) * LANE_SPREAD,
      },
    ],
    spawned: sent,
    nextAt: now + spawnGap({ ...siege, spawned: sent }),
  }
}

// When the next thing in this siege happens: a warrior leaving the gate, or one reaching
// the hero, whichever comes first. One timer in the hook is armed to this, and re-armed
// after every event — the same single-timer shape every other arcade beat has.
export function nextEvent(siege: Siege): number {
  let due = siege.nextAt
  for (const warrior of siege.warriors) {
    due = Math.min(due, warrior.spawnedAt + warrior.walkMs)
  }
  return due
}

// Resolve exactly one event, and say whether it cost a heart.
//
// One at a time rather than catching up in a loop: each one is a beat the screen has to
// show, and a hook that applied three at once would drop two of them.
//
// Arrivals go first. A warrior that reached the hero while the gate was also due has been
// standing on them for however long the timer was late, and sending a new one ahead of
// collecting that is the wrong order to read.
export function advance(
  siege: Siege,
  grid: Grid,
  now: number,
): { siege: Siege; lost: boolean } {
  let arrived: Warrior | null = null
  for (const warrior of siege.warriors) {
    const at = warrior.spawnedAt + warrior.walkMs
    if (at > now) continue
    if (arrived === null || at < arrived.spawnedAt + arrived.walkMs) arrived = warrior
  }
  if (arrived !== null) {
    const gone = arrived
    return {
      siege: {
        ...siege,
        warriors: siege.warriors.filter((warrior) => warrior.id !== gone.id),
      },
      lost: true,
    }
  }
  if (now >= siege.nextAt) return { siege: spawnWarrior(siege, grid, now), lost: false }
  return { siege, lost: false }
}

// Every clock in the siege moved forward by however long the player was away.
//
// What makes a pause resumable: a warrior three quarters of the way down is three quarters
// of the way down when the player comes back, because its `spawnedAt` moved with the pause
// and its `walkMs` did not. The same trick the run's own `beatAt` uses.
export function shift(siege: Siege, byMs: number): Siege {
  return {
    ...siege,
    nextAt: siege.nextAt + byMs,
    warriors: siege.warriors.map((warrior) => ({
      ...warrior,
      spawnedAt: warrior.spawnedAt + byMs,
    })),
  }
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `pnpm vitest run machines/siege.test.ts`
Expected: PASS — 22 tests.

- [ ] **Step 5: Run lint and typecheck**

Run: `pnpm lint && pnpm typecheck`
Expected: PASS. Every import added in Task 3 is now used.

- [ ] **Step 6: Commit**

```bash
git add machines/siege.ts machines/siege.test.ts
git commit -m "feat(arcade): the schedule a village sends its warriors on"
```

---

### Task 6: Hearts, and the four beats of a siege

The hook stops being arcade's whole story and starts being its clock. Every siege rule comes from `machines/siege.ts`; nothing here decides one.

**Files:**

- Modify: `hooks/use-arcade-run.ts`

**Interfaces:**

- Consumes: everything produced by Tasks 1–5.
- Produces, on the object `useArcadeRun()` returns — the screen reads these in Tasks 7–9:
  - `hearts: number`
  - `siege: Siege | null`
  - `taken: number` — villages taken this run.
  - `flee: () => void`
  - `phase` now also takes `'closing' | 'siege' | 'taken' | 'overrun'`.

- [ ] **Step 1: Widen the phase union and the beat table**

In `hooks/use-arcade-run.ts`, replace the `ArcadePhase` type and `DIALABLE`:

```ts
// The beats a run moves through. `dawn` is the card the run opens on — nothing is drawn and
// nothing is listening, because there is no crossroad to answer yet. `bloom` and `open` are
// both dialable: the clock only starts once the fan is drawn, and a player quick enough to
// answer before it does has earned the head start.
//
// `rocket` is a walk that does not stop — see the strike below.
//
// The four at the end are a siege. `closing` is the camera coming down on the walls, with
// the hero stopped short of the gate; `siege` is the fight and is dialable; `taken` is the
// last tower falling; `overrun` is the last heart going, which is the one end arcade has
// that is not the mouth.
export type ArcadePhase =
  | 'dawn'
  | 'bloom'
  | 'open'
  | 'walk'
  | 'rocket'
  | 'retreat'
  | 'falling'
  | 'closing'
  | 'siege'
  | 'taken'
  | 'overrun'
  | 'over'

const DIALABLE: readonly ArcadePhase[] = ['bloom', 'open', 'siege']
```

Add to `BEAT_MS`:

```ts
  closing: CLOSE_MS,
  taken: TAKEN_MS,
  overrun: OVERRUN_MS,
```

`siege` is deliberately absent: its length is however long the fight takes.

Add the imports:

```ts
import { CLOSE_MS, HEARTS, OVERRUN_MS, TAKEN_MS } from '@/constants/siege'
import { advance, land, newSiege, nextEvent, shift, type Siege } from '@/machines/siege'
```

- [ ] **Step 2: Put hearts and the siege on the run**

Add to the `Run` type, after `strikes`:

```ts
// Hearts. The one thing in arcade a siege can spend and nothing else can: a retreat at
// an ordinary crossroad still costs only depth, as it always has.
hearts: number
// The fight the hero is in, and nothing at every other moment.
siege: Siege | null
// How many villages this run has taken. A run stat, like the strikes.
taken: number
```

and to `startRun`:

```ts
  hearts: HEARTS,
  siege: null,
  taken: 0,
```

- [ ] **Step 3: Divert an arrival at a walled village into the siege**

In the `walk` branch of the beat effect, replace the body of the `setRun` updater with:

```ts
setRun((r) => {
  const way = r.moving
  if (r.phase !== 'walk' || way === null) return r
  const landed = r.map[way.to]?.depth ?? 0
  // A walled village is not walked into. The hero stops short of the gate, the
  // camera comes down, and the fan at the far end waits until the walls are down —
  // which is why `openCrossroad` is not called here for one.
  if (r.map[way.to]?.fortified === true) {
    return {
      ...r,
      at: way.to,
      phase: 'closing',
      moving: null,
      best: Math.max(r.best, landed),
      siege: newSiege(way.to, landed, r.seed, r.grid, now),
      ...beat(r, now),
    }
  }
  // The fan at the far end is grown now rather than when the way was offered, so it
  // is measured against the grid the player arrives holding.
  const map = openCrossroad(r.map, way.to, r.grid, r.seed)
  return {
    ...r,
    map,
    at: way.to,
    phase: 'bloom',
    moving: null,
    best: Math.max(r.best, landed),
    ...beat(r, now),
  }
})
```

Do the same in the `rocket` branch, with `through` in place of `way`: a rocket that _lands_ on a walled village opens its siege.

- [ ] **Step 4: Add the three new beats to the effect**

Insert after the `retreat` branch:

```ts
// The camera has come down. The fight starts.
if (run.phase === 'closing') {
  after(BEAT_MS.closing, () => {
    const now = Date.now()
    setRun((r) => (r.phase === 'closing' ? { ...r, phase: 'siege', ...beat(r, now) } : r))
  })
}

// The fight itself. One timer, armed to whichever happens first — a warrior leaving
// the gate or one reaching the hero — and re-armed by the `seq` bump every event
// carries, which is the same single-timer shape every other beat here uses.
if (run.phase === 'siege' && run.siege !== null) {
  const due = nextEvent(run.siege)
  timer.current = setTimeout(
    () => {
      const now = Date.now()
      setRun((r) => {
        if (r.phase !== 'siege' || r.siege === null) return r
        const step = advance(r.siege, r.grid, now)
        if (!step.lost) return { ...r, siege: step.siege, ...beat(r, now) }
        const hearts = r.hearts - 1
        if (hearts > 0) {
          return { ...r, siege: step.siege, hearts, ...beat(r, now) }
        }
        return {
          ...r,
          siege: step.siege,
          hearts: 0,
          phase: 'overrun',
          // The run is over at this point, so this is where its clock stops.
          playedMs: r.playedMs + (now - r.playingSince),
          playingSince: now,
          ...beat(r, now),
        }
      })
    },
    Math.max(0, due - Date.now()),
  )
}

// The walls are down. The hero walks in and the village offers its own fan, measured
// against the grid the fight left behind.
if (run.phase === 'taken') {
  after(BEAT_MS.taken, () => {
    const now = Date.now()
    setRun((r) => {
      if (r.phase !== 'taken') return r
      return {
        ...r,
        map: openCrossroad(r.map, r.at, r.grid, r.seed),
        phase: 'bloom',
        siege: null,
        ...beat(r, now),
      }
    })
  })
}

if (run.phase === 'overrun') {
  after(BEAT_MS.overrun, () => {
    const now = Date.now()
    setRun((r) => (r.phase === 'overrun' ? { ...r, phase: 'over', ...beat(r, now) } : r))
  })
}
```

Note the `siege` branch sets `timer.current` directly rather than through `after`: `after` measures from `beatAt`, and a siege event is measured from its own due time.

- [ ] **Step 5: Resolve a press against the walls**

In `applyMove`, insert immediately after `const next = build(r.grid)` and `const sum = sumOf(ARCADE_DIAL, next)`:

```ts
// In a siege the sum answers to the walls rather than to a fan.
if (r.phase === 'siege' && r.siege !== null) {
  const hit = land(r.siege, sumOf(ARCADE_DIAL, r.grid), sum)
  if (!hit.taken) return { ...r, grid: next, siege: hit.siege }
  return {
    ...r,
    grid: next,
    siege: hit.siege,
    phase: 'taken',
    // One heart back for the village, and never a fourth.
    hearts: Math.min(HEARTS, r.hearts + 1),
    taken: r.taken + 1,
    ...beat(r, now),
  }
}
```

- [ ] **Step 6: Stop a strike skipping a siege**

Still in `applyMove`, in the strike branch, change the guard so a way into a walled village is always a plain walk:

```ts
// A strike cannot skip a siege: the rocket's first hop is a crossroad it passes
// *through* without stopping, and a village with walls on it is not passed through.
// It still counted as a strike — it was answered fast — it simply has nowhere to go.
const walled = r.map[taken.to]?.fortified === true
if (walled || !isStrike(leftMs, answered)) {
  return { ...r, grid: next, phase: 'walk', moving: taken, ...beat(r, now) }
}
```

- [ ] **Step 7: Shift the siege across a pause**

In `resume`, replace the updater body:

```ts
setRun((r) => {
  if (!r.paused) return r
  // How long the player was away. The beat starts again as far back as it had got,
  // so what is left of it is what was left of it when they stopped — and every clock
  // in a siege moves by exactly the same amount, so a warrior three quarters of the
  // way down still is.
  const away = now - r.heldMs - r.beatAt
  return {
    ...r,
    paused: false,
    beatAt: now - r.heldMs,
    playingSince: now,
    siege: r.siege === null ? null : shift(r.siege, away),
  }
})
```

- [ ] **Step 8: Add `flee`**

Add beside `pause` in the returned object:

```ts
    // Breaking off a siege. It costs a heart — the only way out of a fight that is not
    // winning it — and drops the hero back down the way it came.
    //
    // A button on the screen rather than a number on the dial: the siege already asks the
    // player to read towers and warriors as numbers, and a number that means *leave*
    // among numbers that mean *hit* is a trap rather than an option.
    flee: () => {
      const now = Date.now()
      setRun((r) => {
        if (r.paused || r.phase !== 'siege') return r
        const hearts = r.hearts - 1
        if (hearts <= 0) {
          return {
            ...r,
            hearts: 0,
            phase: 'overrun',
            siege: null,
            playedMs: r.playedMs + (now - r.playingSince),
            playingSince: now,
            ...beat(r, now),
          }
        }
        return {
          ...r,
          hearts,
          // No map change. A village that was fled keeps its walls and is built fresh when
          // the hero comes back — `newSiege` runs again on arrival — so chip-and-flee buys
          // nothing.
          phase: 'retreat',
          moving: wayInto(r.map, r.at),
          siege: null,
          ...beat(r, now),
        }
      })
    },
```

- [ ] **Step 9: Return the new fields**

Add to the returned object, beside `strikes`:

```ts
    hearts: run.hearts,
    siege: run.siege,
    taken: run.taken,
```

- [ ] **Step 10: Verify**

Run: `pnpm lint && pnpm typecheck && pnpm vitest run`
Expected: PASS throughout. The screen does not yet read `hearts`, `siege`, `taken` or `flee`; `knip` is not run here because it will flag them as unused until Task 9 — the full `pnpm check` comes at the end of Task 9.

- [ ] **Step 11: Commit**

```bash
git add hooks/use-arcade-run.ts
git commit -m "feat(arcade): three hearts, and the four beats of a siege"
```

---

### Task 7: The camera closing on the walls

**Files:**

- Modify: `components/game/arcade-game.tsx`

**Interfaces:**

- Consumes: `run.phase`, `run.siege`, `run.hearts` from Task 6; `SIEGE_ZOOM`, `CLOSE_MS`, `OPEN_MS`, `STANDOFF` from `constants/siege.ts`.
- Produces: a `camScale` shared value on the same view `camX`/`camY` already transform; `walledAt(id: string): boolean` on the hook's returned object; a `fortified: boolean` prop on `WayBud` and `TownMark`; and the mount point for `SiegeField` (Task 8).

- [ ] **Step 1: Add the new beats to the three per-phase tables**

`DRIFT_MS`, `TRAVEL` and `CREEP` are each `satisfies Record<ArcadePhase, …>`, so the file will not compile until all four new beats are in all three. Add:

```ts
// DRIFT_MS — a siege moves the camera in, not across.
  closing: 0,
  siege: 0,
  taken: 0,
  overrun: 0,
```

```ts
// TRAVEL — the hero holds at the stand-off for the whole fight; `closing` is the last of
// the walk, which `walk` already drove, so none of these move it.
  closing: null,
  siege: null,
  taken: null,
  overrun: null,
```

```ts
// CREEP — a siege has no crossroad clock. The way behind is clear for all of it.
  closing: null,
  siege: null,
  taken: null,
  overrun: null,
```

- [ ] **Step 2: Hold the hero short of the gate**

In the effect that drives `progress` (around line 267), after `const travel = TRAVEL[run.phase]`, add:

```ts
// A walk into a walled village stops short of the gate, with the walls above the hero
// and the ground between them for the warriors to cross.
if (run.phase === 'walk' && run.destination?.fortified === true) {
  progress.value = 0
  progress.value = withTiming(STANDOFF, {
    duration: WALK_MS,
    easing: Easing.inOut(Easing.cubic),
  })
  return
}
```

- [ ] **Step 3: Add the zoom**

Beside `camX`/`camY` (around line 198):

```ts
// How far in the camera has come. One for the whole canvas, on the same view the pan is
// on, so the country, the ways and the village scale together — a siege is the same
// sheet looked at closer, not a second screen.
const camScale = useSharedValue(1)
```

Add the effect that drives it, below the drift effect:

```ts
// In on the walls, and out again when they are down. `taken` opens out while the hero is
// still walking in, so the fan it blooms into arrives on a sheet already at rest.
useEffect(() => {
  const closing = isOneOf(run.phase, SIEGE_PHASES)
  camScale.value = withTiming(closing ? SIEGE_ZOOM : 1, {
    duration: closing ? CLOSE_MS : OPEN_MS,
    easing: Easing.inOut(Easing.cubic),
  })
}, [run.phase])
```

with, at module level:

```ts
// The beats the camera is in close for. `taken` is not among them: the walls coming down
// is the camera letting go.
const SIEGE_PHASES: readonly ArcadePhase[] = ['closing', 'siege', 'overrun']
```

Add `{ scale: camScale.value }` to the transform array of the animated style at line ~295, **after** the two translates — order matters, and scaling after the pan keeps the anchor fixed.

- [ ] **Step 4: Dim the country behind**

Add a shared value and style beside the camera:

```ts
// What the country and the ways fade to while a siege is on. Not hidden — the run has to
// stay somewhere on the map — but out of the way of a screen that has just become busy.
const away = useSharedValue(1)
useEffect(() => {
  away.value = withTiming(isOneOf(run.phase, SIEGE_PHASES) ? 0.25 : 1, {
    duration: isOneOf(run.phase, SIEGE_PHASES) ? CLOSE_MS : OPEN_MS,
  })
}, [run.phase])
```

Apply `useAnimatedStyle(() => ({ opacity: away.value }))` to the group that draws the trail stems and the unchosen buds — the `behind` / `stems` render block around line 349–400. Leave the standing crossroad's own village at full strength: it is the thing being besieged.

- [ ] **Step 5: Draw the walls on the bud, so the choice is visible**

This is the half of the spec that makes a crossroad a decision: _"The bud at that way's end is drawn with towers/a heavier wall, so choosing it is choosing a fight."_ Without it the player dials into a siege blind.

`components/game/way-bud.tsx` already draws a town through `TownMark`, which already has a wall, merlons, towers at the quarters and a gate — the vocabulary is there and only needs turning up. Thread a flag down to it.

In `arcade-game.tsx`, add to the `BudSpec` type (around line 177):

```ts
// Whether this village has walls worth the name. The one thing about a way that is worth
// knowing *before* dialling it, which is the whole reason it is drawn rather than
// discovered.
fortified: boolean
```

and set it where the fan's buds are built (around line 394):

```ts
        fortified: run.map[way.to]?.fortified === true,
```

`run.map` is not on the hook's returned object — use the `nameOf`-style accessor instead. Add one to `hooks/use-arcade-run.ts` beside `nameOf`:

```ts
    // Whether the village at the end of a way has walls. Asked of the run because the
    // walls are on the map, and the map is what this hook holds.
    walledAt: (id: string) => run.map[id]?.fortified === true,
```

and use `fortified: run.walledAt(way.to)` in the bud spec. Pass `fortified={bud.fortified}` to `<WayBud>` at line 574.

In `way-bud.tsx`, take the prop and hand it to `TownMark`:

```ts
// A walled village is a fight, and the fan has to say so before it is chosen.
fortified: boolean
```

In `components/game/town-mark.tsx`, take `fortified` and make the three strokes it already draws heavier when it is set — the wall, the merlons and the quarter-towers:

```tsx
      strokeWidth={fortified ? 2.4 : 1.4}
```

on the wall and the merlon paths, and raise the quarter-towers' size by a third. No new shape and no new colour: the same town, built up. A walled village should read as _more of a town_, not as a different kind of mark.

- [ ] **Step 6: Verify by hand**

Run: `pnpm typecheck && pnpm lint`
Expected: PASS.

Then run the app (`pnpm ios` or `pnpm web`), set the `arcade` flag so the pill is reachable, and play until a walled village turns up. Confirm: one bud in the fan is visibly heavier-walled before you choose it; dialling it makes the hero stop short of the gate; the camera comes in over about three quarters of a second; the country behind dims; and the dial stays dead through `closing`. Nothing is drawn on the walls yet — that is Task 8.

- [ ] **Step 7: Commit**

```bash
git add components/game/arcade-game.tsx components/game/way-bud.tsx components/game/town-mark.tsx hooks/use-arcade-run.ts
git commit -m "feat(arcade): show the walls before the way is chosen"
```

---

### Task 8: Drawing the fight

**Files:**

- Create: `components/game/siege-tower.tsx`
- Create: `components/game/siege-warrior.tsx`
- Create: `components/game/siege-field.tsx`
- Modify: `components/game/arcade-game.tsx` (mount `SiegeField`)

**Interfaces:**

- Consumes: `Siege`, `Tower`, `Warrior` from `@/machines/siege`; `TOWN_BOX` from `@/components/game/town-mark`; the canvas `clock` and `turn` shared values the screen already runs.
- Produces:
  - `SiegeTower({ tower, x, y, turn, ink, line, face })`
  - `SiegeWarrior({ warrior, clock, epoch, fromX, fromY, toX, toY, turn, ink, line, face })`
  - `SiegeField({ siege, clock, epoch, turn, villageX, villageY, heroX, heroY, ink, line, face })`
  - `TOWER_BOX: number` from `siege-tower.tsx`

- [ ] **Step 1: `components/game/siege-tower.tsx`**

One tower on the wall, drawn in the same hand `town-mark.tsx` uses — a block with merlons along its top — losing height as it is chipped. The numeral sits in a disc on the ground's own colour, like every other number on this map, and is counter-rotated against the sheet's turn because a number is read rather than drawn.

```tsx
import { Text, View } from 'react-native'
import Animated, {
  useAnimatedStyle,
  useDerivedValue,
  withTiming,
  type SharedValue,
} from 'react-native-reanimated'
import Svg, { Path, Rect } from 'react-native-svg'

import { mapLabel } from '@/constants/theme'
import type { Tower } from '@/machines/siege'

// A tower on the wall of a besieged village.
//
// Damage is height, not a gauge: a tower knocked halfway down says what a bar under it
// would say, and says it in the map's own language. At nought it is a stump of rubble that
// still carries the number it used to answer to — dialling that number does nothing, which
// is what the flattened silhouette is there to tell you.

const WIDTH = 22
const FULL = 46
const STUMP = 9
const MERLON = 3

export const TOWER_BOX = FULL + 24

export function SiegeTower({
  tower,
  x,
  y,
  turn,
  ink,
  line,
  face,
}: {
  tower: Tower
  x: number
  y: number
  // The sheet's own turn, taken back out of the numeral: a number is read, not drawn.
  turn: SharedValue<number>
  ink: string
  line: string
  // The ground's own colour, which is what every mark on this map knocks out with.
  face: string
}) {
  const standing = tower.hits > 0 ? tower.left / tower.hits : 0
  const height = useDerivedValue(() =>
    withTiming(STUMP + (FULL - STUMP) * standing, { duration: 220 }),
  )

  const body = useAnimatedStyle(() => ({ height: height.value }))
  const counter = useAnimatedStyle(() => ({
    transform: [{ rotate: `${-turn.value}rad` }],
  }))

  return (
    <View
      className="absolute items-center"
      style={{ left: x - TOWER_BOX / 2, top: y - TOWER_BOX / 2, width: TOWER_BOX }}
      pointerEvents="none"
    >
      <Animated.View style={[{ width: WIDTH }, body]}>
        <Svg width={WIDTH} height={FULL} viewBox={`0 0 ${WIDTH} ${FULL}`}>
          <Rect
            x={1}
            y={MERLON}
            width={WIDTH - 2}
            height={FULL - MERLON - 1}
            fill={face}
            stroke={line}
            strokeWidth={1.4}
          />
          <Path
            d={`M1 ${MERLON} v${-MERLON} h4 v${MERLON} h5 v${-MERLON} h4 v${MERLON} h5`}
            fill={face}
            stroke={line}
            strokeWidth={1.4}
          />
        </Svg>
      </Animated.View>
      <Animated.View style={counter}>
        <Text style={[mapLabel, { color: ink, fontSize: 15 }]}>{tower.value}</Text>
      </Animated.View>
    </View>
  )
}
```

`mapLabel` is `Fonts.serif` in `constants/theme.ts` — the same face `way-bud.tsx` sets its own numeral in, so a tower's number is read in the hand every other number on this map is.

- [ ] **Step 2: `components/game/siege-warrior.tsx`**

A warrior's position is never React state. It is derived on the UI thread from the canvas clock the screen already runs, against `spawnedAt` and `walkMs`.

```tsx
import { Text, View } from 'react-native'
import Animated, { useAnimatedStyle, type SharedValue } from 'react-native-reanimated'
import Svg, { Circle } from 'react-native-svg'

import { mapLabel } from '@/constants/theme'
import type { Warrior } from '@/machines/siege'

// One warrior crossing the ground between the gate and the hero.
//
// Nothing about this is React state. The hook knows only when a warrior left and how long
// it takes; where it *is* comes off the canvas clock on the UI thread, which is what keeps
// a fight with three of them on the ground from re-rendering the whole map sixty times a
// second.

const SIZE = 26

export function SiegeWarrior({
  warrior,
  clock,
  epoch,
  fromX,
  fromY,
  toX,
  toY,
  turn,
  ink,
  line,
  face,
}: {
  warrior: Warrior
  // The canvas clock, in ms since the first frame.
  clock: SharedValue<number>
  // What that clock reads as wall-clock zero, so `spawnedAt` and `clock` can be compared.
  epoch: number
  fromX: number
  fromY: number
  toX: number
  toY: number
  turn: SharedValue<number>
  ink: string
  line: string
  face: string
}) {
  const walk = useAnimatedStyle(() => {
    const elapsed = epoch + clock.value - warrior.spawnedAt
    const t = Math.min(1, Math.max(0, elapsed / warrior.walkMs))
    // Fanned off the straight line by its own lane, so two never come down together.
    const bow = Math.sin(t * Math.PI) * warrior.lane * (toY - fromY)
    return {
      transform: [
        { translateX: fromX + (toX - fromX) * t + bow },
        { translateY: fromY + (toY - fromY) * t },
      ],
    }
  })

  const counter = useAnimatedStyle(() => ({
    transform: [{ rotate: `${-turn.value}rad` }],
  }))

  return (
    <Animated.View
      className="absolute items-center justify-center"
      style={[{ left: -SIZE / 2, top: -SIZE / 2, width: SIZE, height: SIZE }, walk]}
      pointerEvents="none"
    >
      <Svg width={SIZE} height={SIZE} style={{ position: 'absolute' }}>
        <Circle
          cx={SIZE / 2}
          cy={SIZE / 2}
          r={SIZE / 2 - 1}
          fill={face}
          stroke={line}
          strokeWidth={1.4}
        />
      </Svg>
      <Animated.View style={counter}>
        <Text style={[mapLabel, { color: ink, fontSize: 13 }]}>{warrior.value}</Text>
      </Animated.View>
    </Animated.View>
  )
}
```

- [ ] **Step 3: `components/game/siege-field.tsx`**

Places the towers round the wall and the warriors on the ground, and nothing else — so `arcade-game.tsx` gains one element rather than a hundred lines.

```tsx
import { View } from 'react-native'
import type { SharedValue } from 'react-native-reanimated'

import { SiegeTower } from '@/components/game/siege-tower'
import { SiegeWarrior } from '@/components/game/siege-warrior'
import type { Siege } from '@/machines/siege'

// Everything a siege puts on the sheet: the towers on the wall above, and whatever is
// crossing the ground between them and the hero.
//
// A component of its own because arcade-game.tsx is already the longest file in the app,
// and because this is the one part of the screen that is a *place* rather than the map.

// How far out from the village's centre the towers stand, in points.
const WALL = 34

export function SiegeField({
  siege,
  clock,
  epoch,
  turn,
  villageX,
  villageY,
  heroX,
  heroY,
  ink,
  line,
  face,
}: {
  siege: Siege
  clock: SharedValue<number>
  epoch: number
  turn: SharedValue<number>
  villageX: number
  villageY: number
  heroX: number
  heroY: number
  ink: string
  line: string
  face: string
}) {
  return (
    <View className="absolute inset-0" pointerEvents="none">
      {siege.towers.map((tower) => (
        <SiegeTower
          key={tower.id}
          tower={tower}
          x={villageX + Math.cos(tower.angle) * WALL}
          y={villageY + Math.sin(tower.angle) * WALL}
          turn={turn}
          ink={ink}
          line={line}
          face={face}
        />
      ))}
      {siege.warriors.map((warrior) => (
        <SiegeWarrior
          key={warrior.id}
          warrior={warrior}
          clock={clock}
          epoch={epoch}
          fromX={villageX}
          fromY={villageY}
          toX={heroX}
          toY={heroY}
          turn={turn}
          ink={ink}
          line={line}
          face={face}
        />
      ))}
    </View>
  )
}
```

- [ ] **Step 4: Mount it**

In `arcade-game.tsx`, inside the panned/scaled group — beside where `VillageArrival` is rendered around line 606 — add:

```tsx
{
  run.siege !== null && here !== undefined && pitch > 0 && (
    <SiegeField
      siege={run.siege}
      clock={clock}
      epoch={epoch}
      turn={turn}
      villageX={pointsOf(here.pos, pitch).x}
      villageY={pointsOf(here.pos, pitch).y}
      heroX={hero.x}
      heroY={hero.y}
      ink={MAP_INK}
      line={isDark ? MAP_INK : PIE_INK}
      face={SURFACE}
    />
  )
}
```

`epoch` is what turns the canvas clock into wall-clock. Add it beside the frame callback:

```ts
// What the canvas clock reads as wall-clock zero. The clock counts from the first frame
// and a warrior's `spawnedAt` is a Date.now(), so one of them has to be rebased — and it
// has to be this one, because a siege is replayable from a seed and a frame count is not.
const epoch = useRef(Date.now()).current
```

This is correct only if the frame clock starts at zero when the screen mounts, which it does — `useFrameCallback` reports `timeSinceFirstFrame`. Confirm by eye in step 5 that a warrior leaves the gate rather than appearing halfway down.

- [ ] **Step 5: Verify by hand**

Run: `pnpm typecheck && pnpm lint`
Expected: PASS.

Then play to a walled village and confirm: four towers stand round the wall with their numbers readable, dialling a tower's number shortens it, dialling it again does nothing until you have dialled away and back, warriors leave the gate on different lines, and dialling a warrior's number removes it.

- [ ] **Step 6: Commit**

```bash
git add components/game/siege-tower.tsx components/game/siege-warrior.tsx components/game/siege-field.tsx components/game/arcade-game.tsx
git commit -m "feat(arcade): draw the towers and the men coming out of the gate"
```

---

### Task 9: Hearts, the retreat button, and the villages taken

**Files:**

- Create: `components/game/heart-icon.tsx`
- Modify: `app/(tabs)/index.tsx` (move `HeartIcon` out, import it back)
- Modify: `components/game/arcade-game.tsx` (hearts row, RETREAT button)
- Modify: `components/game/arcade-over.tsx` (villages taken)

**Interfaces:**

- Consumes: `run.hearts`, `run.taken`, `run.flee`, `run.phase` from Task 6.
- Produces: `HeartIcon({ filled, emptyColor })` importable from `@/components/game/heart-icon`.

- [ ] **Step 1: Lift `HeartIcon` into a file of its own**

Cut the `HeartIcon` function from `app/(tabs)/index.tsx:277` into `components/game/heart-icon.tsx` verbatim, exported, with the imports it needs, and this header:

```tsx
// A heart, filled or spent.
//
// Lifted out of the game screen when arcade grew hearts of its own. Two screens drawing
// the same three hearts two different ways would be two things to keep in step, and the
// player reads them as one thing.
```

Then in `app/(tabs)/index.tsx`, delete the local definition and add:

```ts
import { HeartIcon } from '@/components/game/heart-icon'
```

- [ ] **Step 2: Run the checks to prove nothing moved**

Run: `pnpm typecheck && pnpm lint && pnpm vitest run`
Expected: PASS. The game screen renders exactly what it did.

- [ ] **Step 3: Commit the lift on its own**

```bash
git add app/\(tabs\)/index.tsx components/game/heart-icon.tsx
git commit -m "refactor(game): give the heart a file of its own"
```

- [ ] **Step 4: Put the hearts on the arcade top bar**

`RunTopBar` is rendered at `components/game/arcade-game.tsx:496` and takes no children, so the hearts go in the `<View>` that wraps it, directly under it. Add `import { HeartIcon } from '@/components/game/heart-icon'` and, immediately after the `</RunTopBar>`-closing `/>` on line 502:

```tsx
<View className="flex-row gap-1">
  {[0, 1, 2].map((i) => (
    <HeartIcon
      key={i}
      filled={i < run.hearts}
      emptyColor={isDark ? '#1C1D30' : '#FDFCFA'}
    />
  ))}
</View>
```

Use the same `emptyColor` pair the game screen uses — they are the two surface colours, and a third would be a new one to keep in step. `isDark` is already a prop of `ArcadeGame`.

- [ ] **Step 5: Add the RETREAT button**

Below the canvas and above the dial, shown only while `run.phase === 'siege'`:

```tsx
{
  run.phase === 'siege' && (
    <Pressable
      onPress={run.flee}
      className="self-center rounded-full border px-4 py-1.5"
      style={{ borderColor: EMBER }}
    >
      <Text style={[mono, { color: EMBER, fontSize: 12 }]}>
        <Trans>RETREAT · −1</Trans>
      </Text>
    </Pressable>
  )
}
```

`EMBER` is already destructured at the top of the file from `gradientOf('arcade')`. `Trans` is already imported. The `−1` is a heart, and sits beside the hearts the player can see — spelling it out in words would need a string that reads badly in Czech at that width.

- [ ] **Step 6: Add "villages taken" to the game-over card**

In `components/game/arcade-over.tsx`, widen the props and the stat row:

```ts
export function ArcadeOver({
  depth,
  strikes,
  taken,
  playedMs,
  ...
}: {
  depth: number
  strikes: number
  // How many walled villages this run took. Beside the strikes because it is the same kind
  // of claim: not what the run was worth, but what it did.
  taken: number
  playedMs: number
  ...
})
```

and change the call on line 51 to `arcadeStats(strikes, taken, playedMs)`.

In `lib/run-stats.ts`, replace `arcadeStats` (line 70) with:

```ts
export const arcadeStats = (
  strikes: number,
  taken: number,
  playedMs: number,
): RunStat[] => [
  { key: 'strikes', label: msg`STRIKES`, value: `${strikes}`, overhang: false },
  // What the run took, beside what it did fast. The same kind of claim as the strikes:
  // not what the run was worth — that is the depth on the card above — but what happened
  // on the way up.
  { key: 'taken', label: msg`TAKEN`, value: `${taken}`, overhang: false },
  { key: 'time', label: msg`TIME`, value: formatGameTime(playedMs), overhang: true },
]
```

Then pass `taken={run.taken}` where `arcade-game.tsx` renders `<ArcadeOver …/>`.

The card lays its stats out in a row, so check by eye in step 8 that three fit the width before two did — if they do not, drop `TIME`'s `overhang` to `false`.

- [ ] **Step 7: Run the whole gate**

Run: `pnpm check`
Expected: PASS — eslint, prettier, tsc, knip and vitest. `knip` should now be clean: `hearts`, `siege`, `taken` and `flee` all have readers.

If prettier objects, run `pnpm format` and re-run `pnpm check`.

- [ ] **Step 8: Verify by hand**

Play a run and confirm: three hearts on the bar from the start; a warrior reaching the hero takes one with `FloatingLifeLoss`-style feedback; taking a village gives one back and never a fourth; RETREAT costs one and drops the hero back a crossroad; the last heart ends the run on the `overrun` beat; the game-over card counts the villages taken.

- [ ] **Step 9: Commit**

```bash
git add components/game/arcade-game.tsx components/game/arcade-over.tsx
git commit -m "feat(arcade): hearts on the bar, a way out of a siege, and a tally"
```

---

### Task 10: Tell the player

CLAUDE.md: _"At the end of every task, check whether the change touched gameplay… If so, update the guide so it stays accurate."_ This change is nothing but gameplay, and the guide already names arcade in fourteen places.

**Files:**

- Modify: `components/overlays/how-to-play-overlay.tsx`
- Modify: `docs/superpowers/specs/2026-09-30-arcade-way-design.md` (one line under "Still to come")

- [ ] **Step 1: Read what the guide already says about arcade**

Run: `grep -n -i arcade components/overlays/how-to-play-overlay.tsx`

Read the surrounding section in full before writing. Match its voice, its length and its Lingui macro usage exactly — every player-facing string goes through `<Trans>` or `` msg`…` ``, never a bare literal.

- [ ] **Step 2: Add the siege to the arcade section**

Three things the player cannot find out safely by playing, and nothing else:

1. Some villages have walls. Choosing one means taking it.
2. Towers take several hits each, and a hit means **arriving** at the number — dial away and come back.
3. Warriors reaching you cost a heart; taking the village gives one back; out of hearts ends the run.

Keep it to the guide's own rhythm — short lines, present tense, second person.

- [ ] **Step 3: Close the loop on the old spec**

Under "Still to come" in `docs/superpowers/specs/2026-09-30-arcade-way-design.md`, add one line:

```markdown
Fortified villages and the siege are built — see
`docs/superpowers/specs/2026-10-02-arcade-fortified-villages-design.md`.
```

- [ ] **Step 4: Run the gate**

Run: `pnpm check`
Expected: PASS. If Lingui complains about an uncompiled catalogue, run `pnpm i18n:extract` (if the repo has it) or follow whatever `pnpm i18n:compile` reports.

- [ ] **Step 5: Verify by hand**

Open HOW TO PLAY from the intro and read the arcade section in both English and Czech. Nothing may overflow its line.

- [ ] **Step 6: Commit**

```bash
git add components/overlays/how-to-play-overlay.tsx docs/superpowers/specs/2026-09-30-arcade-way-design.md
git commit -m "docs(arcade): tell the player what a walled village asks"
```

---

## What this plan does not build

Named in the spec and deliberately out of scope:

- **The lure.** Nothing makes a player choose the walled village. A cautious player never sieges and never loses a heart. That is the loot and progression work, and it is the next spec, not this plan.
- **Tuning the deep end.** 30 tower hits in a depth-24 siege may be a slog. Every number is a constant in `constants/siege.ts` for exactly that reason; move them after one play.
- **A fled village remembering its damage.** Specced and implemented as a reset.
