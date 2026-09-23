import {
  DIFFICULTY_ORDER,
  SCORED_MODES,
  type Difficulty,
  type ScoredMode,
} from '@/machines/game'

// Fixtures for the weekly-recap prototype: a week of `daily_scores` invented from a
// seed, in the shape the real `weekly_recap` RPC would return it.
//
// Dev-only, like everything under dev/ — it never reaches a production bundle, and its
// copy is plain English rather than `msg` descriptors, because dev/ sits outside the
// lingui catalog paths in lingui.config.ts. Moving the phrasings into constants/ as
// `msg` is part of shipping the feature, not of looking at it.

export type Board = { mode: ScoredMode; difficulty: Difficulty }

// The six scored boards, hardest last within each mode — the order the grid reads in.
export const BOARDS: readonly Board[] = SCORED_MODES.flatMap((mode) =>
  DIFFICULTY_ORDER.map((difficulty) => ({ mode, difficulty })),
)

export const DAYS = [
  'Monday',
  'Tuesday',
  'Wednesday',
  'Thursday',
  'Friday',
  'Saturday',
  'Sunday',
] as const

// An all-time board record taken during the window. The real RPC derives these from
// `scores.updated_at` falling inside the week — see the design note about what that
// cannot see (a record taken last week and beaten again this week).
type FallenRecord = {
  board: Board
  boardIndex: number
  dayIndex: number
  nickname: string
}

// One week. `cells[dayIndex][boardIndex]` is the nickname that topped that board that
// day, or null where nobody played it.
export type WeekFacts = {
  cells: readonly (readonly (string | null)[])[]
  records: readonly FallenRecord[]
}

// Deterministic by design: a gallery entry that rolled a different week on every render
// would be impossible to look at twice, and the real recap is seeded on the week's
// Monday for the same reason — it must not change under the player.
export type Random = () => number

const hashSeed = (seed: string): number => {
  let h = 2166136261
  for (let i = 0; i < seed.length; i++) {
    h = Math.imul(h ^ seed.charCodeAt(i), 16777619)
  }
  return h >>> 0
}

export function seeded(seed: string): Random {
  let a = hashSeed(seed)
  return () => {
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

// Takes a non-empty tuple so there is always something to return — the phrasing pools
// are all written as literal tuples, which is what makes that hold at compile time.
export const pickFrom = <T>(random: Random, options: readonly [T, ...T[]]): T =>
  options[Math.floor(random() * options.length)] ?? options[0]

export type PoolKey = 'sparse' | 'small' | 'medium' | 'busy'

type Pool = {
  names: readonly [string, ...string[]]
  weights: readonly number[]
  playProb: number
}

// The real players, read off the production boards on 2026-09-23 — every nickname that
// appears in the top 50 of any of the six boards, all time. Public data: these are the
// names every player already sees on a leaderboard, which is why they can sit in a file.
//
// Five names on six boards is the finding, not the fixture. Invented pools of eight made
// `scattered` look like an ordinary week; against the real population it is nearly
// unreachable, and the shapes worth writing copy for are the ones at the top of this
// list. The four pools are the same five people playing more or less hard, rather than
// imagined crowds — `busy` is the optimistic case, not the expected one.
//
// Nicknames keep the casing their owner typed. The announcement bar upper-cases a
// rival's name because capitals are the only signal it has; here colour does that job,
// and shouting a name that was never written in capitals misrepresents the player.
const PLAYERS = ['Ruprd', 'Tomáš', 'plha', 'McRuprd', 'Mull3rm1x_'] as const

// `sparse` is the only pool that reaches a quiet week: across six boards at any ordinary
// play rate somebody tops a board every single day, which is worth knowing before anyone
// writes copy for quiet weeks.
export const POOLS = {
  sparse: { names: [PLAYERS[0], PLAYERS[1]], weights: [3, 1], playProb: 0.085 },
  // Weighted the way the real boards fall: the top two hold a place on all six, and the
  // tail appears on three, two and one.
  small: { names: PLAYERS, weights: [6, 5, 3, 2, 1], playProb: 0.5 },
  medium: { names: PLAYERS, weights: [4, 4, 3, 2, 2], playProb: 0.72 },
  busy: { names: PLAYERS, weights: [1, 1, 1, 1, 1], playProb: 0.9 },
} as const satisfies Record<PoolKey, Pool>

const weightedPick = (random: Random, pool: Pool): string => {
  const total = pool.weights.reduce((sum, weight) => sum + weight, 0)
  let remaining = random() * total
  for (const [index, name] of pool.names.entries()) {
    remaining -= pool.weights[index] ?? 0
    if (remaining <= 0) return name
  }
  return pool.names[0]
}

// Rare on purpose. An all-time record that fell every week would not be a record.
const RECORD_CHANCE = 0.14

// How often a board keeps yesterday's holder. Without this every board was re-rolled from
// scratch each day, which manufactured churn: `scattered` came out of 250 weeks in 300
// even on the real five-player roster, and the shapes worth writing copy for never
// appeared. A daily best is not redrawn every morning — it stands until somebody beats
// it — and this is the cheapest honest way to say so.
const STICKINESS = 0.62

export function simulateWeek(seed: string, poolKey: PoolKey): WeekFacts {
  const random = seeded(seed)
  const pool = POOLS[poolKey]

  const holders: (string | null)[] = BOARDS.map(() => null)
  const cells = DAYS.map(() =>
    BOARDS.map((_, boardIndex) => {
      if (random() >= pool.playProb) return null
      const held = holders[boardIndex] ?? null
      const winner =
        held !== null && random() < STICKINESS ? held : weightedPick(random, pool)
      holders[boardIndex] = winner
      return winner
    }),
  )

  const records = BOARDS.flatMap((board, boardIndex) => {
    if (random() > RECORD_CHANCE) return []
    // A record cannot fall on a board nobody played, so the day is drawn from the days
    // that were played rather than from the week.
    const played = DAYS.flatMap((_, dayIndex) =>
      (cells[dayIndex]?.[boardIndex] ?? null) === null ? [] : [dayIndex],
    )
    const dayIndex = played[Math.floor(random() * played.length)]
    if (dayIndex === undefined) return []
    const nickname = cells[dayIndex]?.[boardIndex] ?? null
    if (nickname === null) return []
    return [{ board, boardIndex, dayIndex, nickname }]
  })

  return { cells, records }
}
