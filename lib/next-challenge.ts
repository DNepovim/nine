import { DIFFICULTIES, MODES, type Difficulty, type Mode } from '@/machines/modes'

// What the game-over screen offers next to "play again": the same run one rung
// harder. Losing is the moment a player is most willing to be dared, and the dare
// only works if it is one press away — asking them to walk back through the menu to
// change difficulty is how a board never gets tried.
export type Challenge = { mode: Mode; difficulty: Difficulty; label: string }

const NEXT_DIFFICULTY = {
  easy: 'hard',
  hard: 'extreme',
  // Nothing above extreme — the ladder continues in the mode instead.
  extreme: null,
} as const satisfies Record<Difficulty, Difficulty | null>

// At the top of the difficulty ladder the challenge changes mode at the same
// difficulty. Accuracy and Speed reward opposite instincts, so each is a fresh
// board to the other's veteran rather than a demotion — and they point at each
// other, so an Extreme player can bounce between them forever. Trainee has
// infinite lives and so never reaches this screen; it points at Accuracy because
// the step up from practice is a mode, not a difficulty.
const OTHER_MODE = {
  trainee: 'accuracy',
  accuracy: 'speed',
  speed: 'accuracy',
} as const satisfies Record<Mode, Mode>

// A tenth of the run's hits landing on a streak is the bar. Streaks are what the
// harder boards are made of, so a player who found a few of them has shown the thing
// the next rung asks for — and a run that found none was not a run worth daring.
const STRIKE_SHARE = 0.1

// Whether the run earned the offer. Being invited up a rung straight after a run that
// went nowhere reads as the game not watching.
export const earnedChallenge = (hits: number, strikes: number): boolean =>
  hits > 0 && strikes >= hits * STRIKE_SHARE

export function nextChallenge(mode: Mode, difficulty: Difficulty): Challenge {
  const harder = NEXT_DIFFICULTY[difficulty]
  if (harder !== null) {
    return { mode, difficulty: harder, label: `STEP UP TO ${DIFFICULTIES[harder].label}` }
  }
  const other = OTHER_MODE[mode]
  // "STEP UP" would be a lie sideways: Speed is not above Accuracy, just different.
  return { mode: other, difficulty, label: `TRY ${MODES[other].label}` }
}

const PREV_DIFFICULTY = {
  // Nothing below Easy at the difficulty level — the ladder continues into Trainee.
  easy: null,
  hard: 'easy',
  extreme: 'hard',
} as const satisfies Record<Difficulty, Difficulty | null>

// Every game over on a scored mode is the same event — three lives spent — so it
// cannot say *how* the run went wrong the way `earnedChallenge`'s streak share does.
// Hit count is the one number that still can: a handful of hits before the board wins
// says the pace outran the player before they found any rhythm, whichever mode it was.
const STRUGGLE_HITS = 3

// Whether the run is worth easing off from. `earnedChallenge` requires hits > 0
// because daring someone who did nothing is absurd; here zero hits is the clearest
// case there is — a run that landed nothing is exactly the one an easier board or
// Trainee is for.
export const struggledRun = (hits: number): boolean => hits < STRUGGLE_HITS

export function easierChallenge(mode: Mode, difficulty: Difficulty): Challenge {
  const easier = PREV_DIFFICULTY[difficulty]
  if (easier !== null) {
    return {
      mode,
      difficulty: easier,
      label: `STEP DOWN TO ${DIFFICULTIES[easier].label}`,
    }
  }
  // Already on Easy — Trainee is the full step down: no clock, no lives, nothing left
  // to ease. Difficulty stays as it was and is ignored on the Trainee board.
  return { mode: 'trainee', difficulty, label: 'TRY TRAINEE' }
}

// What the game-over screen offers, if anything — up on a run that showed it was
// ready, down on one that did not get going, and nothing for the ordinary run between
// the two.
//
// The two thresholds can both pass on a short, streaky run — a couple of hits, both
// optimal, before the board won anyway. Landing clean hits at all outranks landing few
// of them, so the dare wins that tie: a player who is connecting deserves encouragement
// over a suggestion to ease off. One function rather than each caller checking both in
// this order is what keeps the offer and the analytics event that announces it from
// ever quietly disagreeing.
export function runChallenge(
  mode: Mode,
  difficulty: Difficulty,
  hits: number,
  strikes: number,
): Challenge | null {
  if (earnedChallenge(hits, strikes)) return nextChallenge(mode, difficulty)
  if (struggledRun(hits)) return easierChallenge(mode, difficulty)
  return null
}
