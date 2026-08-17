import {
  DIFFICULTY_ORDER,
  SCORED_MODES,
  type Difficulty,
  type ScoredMode,
} from '@/machines/game'

// Which board a medal was won on. `ever` is the all-time board; the other two empty
// on the Prague clock, so a today medal is a claim about the last few hours and an
// ever medal is a claim about the game.
export type MedalPeriod = 'today' | 'week' | 'ever'

export const MEDAL_PERIODS = ['ever', 'week', 'today'] as const satisfies readonly [
  MedalPeriod,
  ...MedalPeriod[],
]

// One board's standing for the player: where they sit and what they scored.
export type BoardStanding = {
  mode: ScoredMode
  difficulty: Difficulty
  period: MedalPeriod
  rank: number
  score: number
}

export type Medal = {
  mode: ScoredMode
  difficulty: Difficulty
  period: MedalPeriod
  rank: 1 | 2 | 3
}

const PODIUM = [1, 2, 3] as const

// The medal a place on a board earns, or null for no medal at all.
//
// A rank alone is not enough. `my_rank` answers with `count(*) + 1` and a coalesced
// score of 0 for a player who has never posted, so on an empty board someone who has
// never played comes back as rank 1 — a fresh install would otherwise wear three golds.
// A real medal needs a real score behind it.
export const medalRank = (rank: number, score: number): 1 | 2 | 3 | null =>
  score > 0 ? (PODIUM.find((place) => place === rank) ?? null) : null

// Hardest first: holding extreme is the bigger claim.
const difficultyWeight = (difficulty: Difficulty): number =>
  -DIFFICULTY_ORDER.indexOf(difficulty)

const modeWeight = (mode: ScoredMode): number => SCORED_MODES.indexOf(mode)

// All time outranks the week, which outranks the day: the longer the board has stood,
// the more a place on it says.
const periodWeight = (period: MedalPeriod): number => MEDAL_PERIODS.indexOf(period)

// Which of two medals is the better claim.
//
// The period is decided first and the metal second, which is the whole ordering: a
// bronze that has stood all week beats a silver from this morning, because the day's
// board empties tonight and the week's does not. Difficulty settles what is left.
const isBetter = (candidate: Medal, held: Medal): boolean => {
  const period = periodWeight(candidate.period) - periodWeight(held.period)
  if (period !== 0) return period < 0
  if (candidate.rank !== held.rank) return candidate.rank < held.rank
  return difficultyWeight(candidate.difficulty) < difficultyWeight(held.difficulty)
}

// One medal per mode, so the line is never longer than there are modes to win in.
//
// A player who holds a board all-time almost always holds it this week and today too,
// and across three difficulties — left alone that is nine entries saying one thing.
// The mode is the unit worth reporting, and its single best claim is what stands for it.
const bestPerMode = (medals: readonly Medal[]): Medal[] => {
  const best = new Map<ScoredMode, Medal>()
  for (const medal of medals) {
    const held = best.get(medal.mode)
    if (held === undefined || isBetter(medal, held)) best.set(medal.mode, medal)
  }
  return [...best.values()]
}

// The player's standing across every board, reduced to one medal per mode.
//
// Ordered by mode rather than by metal, so each mode keeps its own slot: the medals are
// told apart by the colour of the difficulty beside them, and a line whose entries
// swapped places as ranks changed would make that colour hard to trust.
export function toMedals(standings: readonly BoardStanding[]): Medal[] {
  const medals = standings.flatMap((standing) => {
    const rank = medalRank(standing.rank, standing.score)
    return rank === null
      ? []
      : [
          {
            mode: standing.mode,
            difficulty: standing.difficulty,
            period: standing.period,
            rank,
          },
        ]
  })
  return bestPerMode(medals).sort((a, b) => modeWeight(a.mode) - modeWeight(b.mode))
}
