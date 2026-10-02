import {
  SIEGE_DEPTH_FULL,
  SIEGE_PAR_MAX,
  SIEGE_PAR_MIN,
  SPAWN_FIRST_MS,
  TOWER_HITS_DEEP,
  TOWER_HITS_SHALLOW,
  TOWERS_DEEP,
  TOWERS_SHALLOW,
} from '@/constants/siege'
import { parValues, rngFor, UP } from '@/machines/arcade'
import { type Grid } from '@/modes'

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
