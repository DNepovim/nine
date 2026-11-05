// The shapes of GLIMPSE's storm, as plain numbers: a bolt's zigzag and a sheet of rain.
//
// Both are derived from a seed rather than rolled, so a target's bolt is the same bolt on
// every render and a sheet of rain is the same rain whichever screen draws it — the
// opening's and the remains' meet without a streak jumping.

// A small, fast, seeded generator (mulberry32): nought up to one, the same run of them for
// the same seed.
export function seeded(seed: number): () => number {
  let state = seed >>> 0
  return () => {
    state = (state + 0x6d2b79f5) >>> 0
    let t = state
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

export type BoltPoint = { x: number; y: number }

// How far a bolt wanders either side of its line, and how long each of its legs runs.
const BOLT_WANDER = 26
const BOLT_LEG = 34

// A bolt from the top of a box `height` tall down to its foot, in a box `width` wide: the
// foot is the middle of the bottom edge, which is where the thing struck stands. The wander
// narrows to nothing at the foot so the bolt lands on it rather than near it.
export function boltPoints(seed: number, width: number, height: number): BoltPoint[] {
  const roll = seeded(seed)
  const centre = width / 2
  const legs = Math.max(2, Math.round(height / BOLT_LEG))
  const points: BoltPoint[] = []
  for (let leg = 0; leg <= legs; leg += 1) {
    const along = leg / legs
    const wander = leg === 0 || leg === legs ? 0 : (roll() * 2 - 1) * BOLT_WANDER
    points.push({ x: centre + wander * (1 - along * 0.6), y: along * height })
  }
  return points
}

// How many legs a fork has, how far each carries it sideways, and how thick the fork's
// stroke is against the trunk's.
const FORK_LEGS = [3, 5] as const
const FORK_SIDE = [10, 26] as const

// The forks of a bolt: each leaves one of the trunk's bends, heads off to a side, and keeps
// falling, jagged as the trunk is. At most `count`, from bends chosen by the seed; a fork
// never starts at the very top or the foot, and never falls below the box.
export function boltForks(
  seed: number,
  trunk: readonly BoltPoint[],
  count: number,
  height: number,
): BoltPoint[][] {
  const roll = seeded(seed)
  const bends = trunk.slice(1, -1)
  const forks: BoltPoint[][] = []
  const taken = new Set<number>()
  for (let fork = 0; fork < count && taken.size < bends.length; fork += 1) {
    const at = Math.floor(roll() * bends.length)
    if (taken.has(at)) continue
    taken.add(at)
    const start = bends[at]
    if (start === undefined) continue
    const side = roll() < 0.5 ? -1 : 1
    const legs = FORK_LEGS[0] + Math.floor(roll() * (FORK_LEGS[1] - FORK_LEGS[0] + 1))
    const points: BoltPoint[] = [start]
    let { x, y } = start
    for (let leg = 0; leg < legs; leg += 1) {
      x += side * (FORK_SIDE[0] + roll() * (FORK_SIDE[1] - FORK_SIDE[0]))
      y = Math.min(height, y + BOLT_LEG * (0.7 + roll() * 0.6))
      points.push({ x, y })
    }
    forks.push(points)
  }
  return forks
}

export const boltPath = (points: readonly BoltPoint[]): string =>
  points
    .map(({ x, y }) => `${Math.round(x * 10) / 10},${Math.round(y * 10) / 10}`)
    .join(' ')

export type Streak = { x: number; y: number; length: number }

// The share of its length a streak leans over: rain driven a little by the wind.
export const RAIN_LEAN = 0.14

// `count` streaks scattered over a sheet `width` wide and `height` tall.
export function rainStreaks(
  seed: number,
  count: number,
  width: number,
  height: number,
  minLength: number,
  maxLength: number,
): Streak[] {
  const roll = seeded(seed)
  return Array.from({ length: count }, () => ({
    x: roll() * (width + height * RAIN_LEAN),
    y: roll() * height,
    length: minLength + roll() * (maxLength - minLength),
  }))
}

export type Splash = {
  // Where along the surface, nought to one, left to right.
  at: number
  // How long one splash takes, and how long before its first.
  period: number
  offset: number
  // How wide its droplets throw, and how high.
  spread: number
  lift: number
}

// Where rain breaks on a water surface: `count` splashes spread along it, each on its own
// beat so no two land together.
export function splashSpots(seed: number, count: number): Splash[] {
  const roll = seeded(seed)
  return Array.from({ length: count }, (_, index) => ({
    // Evenly stood and then shaken, so they neither clump nor line up.
    at: (index + 0.15 + roll() * 0.7) / count,
    period: 520 + roll() * 520,
    offset: roll() * 1000,
    spread: 8 + roll() * 10,
    lift: 8 + roll() * 9,
  }))
}
