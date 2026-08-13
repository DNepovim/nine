import {
  DIFFICULTY_ORDER,
  SCORED_MODES,
  type Difficulty,
  type ScoredMode,
} from '@/machines/game'

// One board's standing for the player: where they sit and what they scored.
export type BoardStanding = {
  mode: ScoredMode
  difficulty: Difficulty
  rank: number
  score: number
}

export type Medal = {
  mode: ScoredMode
  difficulty: Difficulty
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

// Gold first, then the hardest board, then mode order — a stable sort with no ties
// left to chance, so the line does not reshuffle between renders.
export function toMedals(standings: readonly BoardStanding[]): Medal[] {
  return standings
    .filter(isMedal)
    .flatMap((standing) => {
      const rank = PODIUM.find((place) => place === standing.rank)
      return rank === undefined
        ? []
        : [{ mode: standing.mode, difficulty: standing.difficulty, rank }]
    })
    .sort(
      (a, b) =>
        a.rank - b.rank ||
        difficultyWeight(a.difficulty) - difficultyWeight(b.difficulty) ||
        modeWeight(a.mode) - modeWeight(b.mode),
    )
}
