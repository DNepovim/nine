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
