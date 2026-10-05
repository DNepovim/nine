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
  // The gate's clock through `opened`, which is also what stamps it again when the fight
  // actually starts — a siege is built the moment the hero reaches the walls and is not
  // fought until a camera move later. See below. The `nextAt` handed in is a placeholder
  // for a field that cannot be left out; `opened` is what sets it.
  return opened({ at, depth, seed, towers, warriors: [], spawned: 0, nextAt: now }, now)
}

// The fight starting.
//
// The gate's first clock is set here rather than on arrival, and the difference is most of
// a second. A hero that reaches a walled village stands through the camera coming down on
// it with a dial that answers nothing, and `SPAWN_FIRST_MS` counted from the arrival would
// have spent nearly a third of itself before the player could press a key — so the grace
// the constant names would not be the grace the player gets.
//
// It is also the one beat of a siege that nothing pauses — the camera move is not dialable,
// so `usePauseOnBlur` does not cover it — and a phone put away under it would freeze the JS
// timer for as long as the player liked and open the fight with a warrior already due.
// Stamping on the way in rather than on arrival is what makes that stretch cost nothing.
export function opened(siege: Siege, now: number): Siege {
  return { ...siege, nextAt: now + SPAWN_FIRST_MS }
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
