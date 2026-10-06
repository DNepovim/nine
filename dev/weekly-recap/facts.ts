import {
  BOARDS,
  DAY_COUNT,
  dayWinners,
  weekShape,
  type ShapeKind,
  type Takeover,
  type WeekFacts,
} from '@/lib/recap'
import { idSeed, seeded, type Rng } from '@/lib/rng'

// Invented weeks, for looking at the phrasings in the gallery.
//
// Dev-only, and the only part of the recap that stayed behind when the rest shipped: in
// production a week comes from `weekly_recap` and there is exactly one of it. The question
// this file exists to answer is whether the prose holds up across *many* weeks, and that
// cannot be read one real week at a time.
//
// Everything that is not the simulation — the boards, the shapes, the composition — now
// lives in lib/recap.ts and is imported back here, so what the gallery shows is the code
// the player gets rather than a copy of it that has drifted.

// Deterministic by design: a gallery entry that rolled a different week on every render
// would be impossible to look at twice.
const rngFor = (seed: string): Rng => seeded(idSeed(seed))

export type PoolKey = 'sparse' | 'small' | 'medium' | 'busy'

type Pool = {
  names: readonly [string, ...string[]]
  weights: readonly number[]
  playProb: number
}

// The real players, read off the production boards on 2026-09-23 — every nickname that
// appears in the top 50 of any of the six boards, all time. Public data: these are the names
// every player already sees on a leaderboard, which is why they can sit in a file.
//
// Five names on six boards is the finding, not the fixture. Invented pools of eight made
// `scattered` look like an ordinary week; against the real population it is nearly
// unreachable, and the shapes worth writing copy for are the ones at the top of this list.
// The four pools are the same five people playing more or less hard, rather than imagined
// crowds — `busy` is the optimistic case, not the expected one.
//
// Nicknames keep the casing their owner typed. The announcement bar upper-cases a rival's
// name because capitals are the only signal it has; here colour does that job, and shouting
// a name that was never written in capitals misrepresents the player.
const PLAYERS = ['Ruprd', 'Tomáš', 'plha', 'McRuprd', 'Mull3rm1x_'] as const

// `sparse` is the only pool that reaches a quiet week: across six boards at any ordinary
// play rate somebody tops a board every single day, which is worth knowing before anyone
// writes copy for quiet weeks.
export const POOLS = {
  sparse: { names: [PLAYERS[0], PLAYERS[1]], weights: [3, 1], playProb: 0.085 },
  // Weighted the way the real boards fall: the top two hold a place on all six, and the tail
  // appears on three, two and one.
  small: { names: PLAYERS, weights: [6, 5, 3, 2, 1], playProb: 0.5 },
  medium: { names: PLAYERS, weights: [4, 4, 3, 2, 2], playProb: 0.72 },
  busy: { names: PLAYERS, weights: [1, 1, 1, 1, 1], playProb: 0.9 },
} as const satisfies Record<PoolKey, Pool>

const weightedPick = (rng: Rng, pool: Pool): string => {
  const total = pool.weights.reduce((sum, weight) => sum + weight, 0)
  let remaining = rng() * total
  for (const [index, name] of pool.names.entries()) {
    remaining -= pool.weights[index] ?? 0
    if (remaining <= 0) return name
  }
  return pool.names[0]
}

// Rare on purpose. An all-time board that changed hands every week would not be worth a
// sentence.
const TAKEOVER_CHANCE = 0.14

// How often a board keeps yesterday's holder. Without this every board was re-rolled from
// scratch each day, which manufactured churn: `scattered` came out of 250 weeks in 300 even
// on the real five-player roster, and the shapes worth writing copy for never appeared. A
// daily best is not redrawn every morning — it stands until somebody beats it — and this is
// the cheapest honest way to say so.
const STICKINESS = 0.62

export function simulateWeek(seed: string, poolKey: PoolKey): WeekFacts {
  const rng = rngFor(seed)
  const pool = POOLS[poolKey]

  const holders: (string | null)[] = BOARDS.map(() => null)
  const cells = Array.from({ length: DAY_COUNT }, () =>
    BOARDS.map((_, boardIndex) => {
      if (rng() >= pool.playProb) return null
      const held = holders[boardIndex] ?? null
      const winner = held !== null && rng() < STICKINESS ? held : weightedPick(rng, pool)
      holders[boardIndex] = winner
      return winner
    }),
  )

  const takeovers = BOARDS.flatMap<Takeover>((board, boardIndex) => {
    if (rng() > TAKEOVER_CHANCE) return []
    // A board cannot change hands on a day nobody played it, so the day is drawn from the
    // days that were played rather than from the week.
    const played = cells.flatMap((day, dayIndex) =>
      (day[boardIndex] ?? null) === null ? [] : [dayIndex],
    )
    const dayIndex = played[Math.floor(rng() * played.length)]
    if (dayIndex === undefined) return []
    const nickname = cells[dayIndex]?.[boardIndex] ?? null
    if (nickname === null) return []
    return [{ board, boardIndex, dayIndex, nickname }]
  })

  return { cells, takeovers }
}

// Which population reaches which shape. Shape is decided almost entirely by who is playing:
// `scattered` needs a crowd, and `quiet` only happens when the game is nearly asleep —
// across six boards at any ordinary play rate, somebody tops a board every day.
const SHAPE_POOL = {
  empty: 'sparse',
  quiet: 'sparse',
  sweep: 'small',
  sweepBut: 'small',
  split: 'small',
  scattered: 'busy',
} as const satisfies Record<ShapeKind, PoolKey>

const SEARCH_LIMIT = 800

// A week of the requested shape, found by rolling seeds rather than hand-authored, so what
// the gallery shows is a week the simulation could actually produce.
export function weekForShape(kind: ShapeKind, salt: string): WeekFacts | null {
  const poolKey = SHAPE_POOL[kind]
  for (let attempt = 0; attempt < SEARCH_LIMIT; attempt++) {
    const facts = simulateWeek(`${salt}:${attempt}`, poolKey)
    if (weekShape(dayWinners(facts)).kind === kind) return facts
  }
  return null
}
