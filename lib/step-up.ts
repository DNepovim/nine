import type { Difficulty, Mode } from '@/machines/game'

// When Trainee should offer the player a scored board, and what it says when it does.
//
// Trainee is the only mode with infinite lives, so it is the only one that never reaches
// the game-over screen — which is where every other mode makes this offer, through
// `nextChallenge`. A player who has quietly outgrown practice would otherwise never be
// asked, because the screen that asks does not exist for them.
//
// It cannot reuse `earnedChallenge` either: that bar is a share of the run's hits landing
// on a streak, and Trainee runs with `streak: 'none'`, so its strike count is always
// zero. Clean hits are the signal Trainee actually produces — they are what the confetti
// is already celebrating.

// Clean hits in a row. Any hit that is not clean puts it back to nothing, so this is
// "on a roll right now" rather than "did well at some point".
export const CLEAN_RUN = 5

// Floors, so a lucky opening cannot trigger the offer. Five clean hits inside the first
// thirty seconds is a good start, not evidence of anything.
export const MIN_HITS = 10
export const MIN_RUN_MS = 60_000

// Where the offer points. Easy on purpose: Trainee hands out infinite lives, so even a
// player clearing Extreme practice has never once been under the pressure of losing, and
// dropping them on a matching Extreme board would be a worse welcome than a fair one.
export const STEP_UP_BOARD = { mode: 'accuracy', difficulty: 'easy' } as const satisfies {
  mode: Mode
  difficulty: Difficulty
}

export type StepUpState = {
  cleanRun: number
  // The offer is made once per run at most. Twice would be nagging, and there is no
  // second thing to say.
  offered: boolean
}

export const initialStepUp = (): StepUpState => ({ cleanRun: 0, offered: false })

export type StepUpFacts = {
  // Whether the batch that just resolved held a clean hit — the same test the confetti
  // fires on.
  clean: boolean
  hits: number
  elapsedMs: number
  // Whether the player has ever posted a score on a scored board. They know the real
  // modes exist, so there is nothing to introduce and the offer would only be noise.
  playedScored: boolean
}

// One resolved batch in, at most one offer out.
export function stepUpReducer(
  state: StepUpState,
  facts: StepUpFacts,
): { state: StepUpState; offer: boolean } {
  const cleanRun = facts.clean ? state.cleanRun + 1 : 0
  const earned =
    !state.offered &&
    !facts.playedScored &&
    cleanRun >= CLEAN_RUN &&
    facts.hits >= MIN_HITS &&
    facts.elapsedMs >= MIN_RUN_MS

  return { state: { cleanRun, offered: state.offered || earned }, offer: earned }
}

// The line the toast carries: something about what they just did, then the invitation.
//
// Two halves rather than one sentence so the recognition can be specific without the
// invitation changing — and the count comes off CLEAN_RUN rather than being written out,
// so raising the bar can never leave the words claiming a different number.
const OPENERS = [
  "You're playing well.",
  `${CLEAN_RUN} clean in a row.`,
  'Nice streak.',
] as const

const INVITES = ["Let's try a real game.", 'Ready to play for real?'] as const

const pick = <T>(pool: readonly [T, ...T[]], roll: number): T => {
  const index = Math.min(pool.length - 1, Math.max(0, Math.floor(roll * pool.length)))
  return pool[index] ?? pool[0]
}

export type StepUpMessage = { opener: string; invite: string }

// Rolls are parameters rather than Math.random() calls inside, exactly as the
// announcement bar does it: the choice stays pure and testable, and the randomness lives
// at the call site where it can be taken once instead of on every render.
export const stepUpMessage = (openerRoll: number, inviteRoll: number): StepUpMessage => ({
  opener: pick(OPENERS, openerRoll),
  invite: pick(INVITES, inviteRoll),
})

export const openerPool = (): readonly string[] => OPENERS
export const invitePool = (): readonly string[] => INVITES
