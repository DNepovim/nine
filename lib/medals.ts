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

// A rank alone does not mean a medal. `my_rank` answers with `count(*) + 1` and a
// coalesced score of 0 for a player who has never posted, so on an empty board someone
// who has never played comes back as rank 1 — a fresh install would otherwise show
// three golds. A real medal needs a real score behind it.
const isMedal = (standing: BoardStanding): boolean =>
  standing.score > 0 && standing.rank <= 3

// Hardest first within a medal: holding extreme is the bigger claim, and the line is
// capped, so the boards most worth showing should survive the cut.
const difficultyWeight = (difficulty: Difficulty): number =>
  -DIFFICULTY_ORDER.indexOf(difficulty)

const modeWeight = (mode: ScoredMode): number => SCORED_MODES.indexOf(mode)

// All time outranks the week, which outranks the day: the longer the board has stood,
// the more a place on it says.
const periodWeight = (period: MedalPeriod): number => MEDAL_PERIODS.indexOf(period)

// Collapse a set of medals down to one per key, keeping whichever the comparator
// calls better. Both of the line's collapses are this shape, differing only in what
// counts as the same thing and what counts as better.
const keepBest = (
  medals: readonly Medal[],
  key: (medal: Medal) => string,
  isBetter: (candidate: Medal, held: Medal) => boolean,
): Medal[] => {
  const best = new Map<string, Medal>()
  for (const medal of medals) {
    const held = best.get(key(medal))
    if (held === undefined || isBetter(medal, held)) best.set(key(medal), medal)
  }
  return [...best.values()]
}

// Holding a board all-time almost always means holding it this week and today as
// well, so the same board would take three of the line's few slots and crowd out the
// others. Each board appears once, at its best claim: the highest rank it holds, and
// among equal ranks the longest-standing board.
const bestPerBoard = (medals: readonly Medal[]): Medal[] =>
  keepBest(
    medals,
    (medal) => `${medal.mode}-${medal.difficulty}`,
    (candidate, held) =>
      candidate.rank < held.rank ||
      (candidate.rank === held.rank &&
        periodWeight(candidate.period) < periodWeight(held.period)),
  )

// Gold on Easy says nothing that gold on Hard does not already say, so one medal in
// one mode shows once, on the hardest board that earned it. Ranks stay separate: a
// silver on Easy beside a gold on Hard is two different claims, and dropping the
// silver would hide a board the player actually holds.
const hardestPerMedal = (medals: readonly Medal[]): Medal[] =>
  keepBest(
    medals,
    (medal) => `${medal.mode}-${medal.rank}`,
    (candidate, held) =>
      difficultyWeight(candidate.difficulty) < difficultyWeight(held.difficulty) ||
      (candidate.difficulty === held.difficulty &&
        periodWeight(candidate.period) < periodWeight(held.period)),
  )

// Gold first, then all-time over the week over the day, then the hardest board, then
// mode order — a stable sort with no ties left to chance, so the line does not
// reshuffle between renders.
export function toMedals(standings: readonly BoardStanding[]): Medal[] {
  const medals = standings.filter(isMedal).flatMap((standing) => {
    const rank = PODIUM.find((place) => place === standing.rank)
    return rank === undefined
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
  return hardestPerMedal(bestPerBoard(medals)).sort(
    (a, b) =>
      a.rank - b.rank ||
      periodWeight(a.period) - periodWeight(b.period) ||
      difficultyWeight(a.difficulty) - difficultyWeight(b.difficulty) ||
      modeWeight(a.mode) - modeWeight(b.mode),
  )
}
