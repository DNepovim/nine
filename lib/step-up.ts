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

// A run that began on the tutorial's closing CTA gets asked on hit count alone — no
// clean streak, no clock. That player was taught the game ninety seconds ago and has
// never seen a scored board; the offer is the last step of the tutorial rather than a
// reward for playing well, so waiting for evidence of playing well would strand exactly
// the player it was written for. Twelve targets is long enough to have found the rhythm.
export const TUTORIAL_HITS = 12

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
  // Whether this run began on the tutorial's closing CTA rather than from the intro.
  fromTutorial: boolean
}

// Which bar was cleared. The offer says different things depending: one has watched the
// player do something well and can say so, the other has only counted to twelve.
//
// A list rather than a bare union so the screen gallery can enumerate them and show
// every wording — a reason added here turns up there without being remembered.
export const STEP_UP_REASONS = ['clean', 'tutorial'] as const
export type StepUpReason = (typeof STEP_UP_REASONS)[number]

// One resolved batch in, at most one offer out.
export function stepUpReducer(
  state: StepUpState,
  facts: StepUpFacts,
): { state: StepUpState; offer: StepUpReason | null } {
  const cleanRun = facts.clean ? state.cleanRun + 1 : 0

  const reason = (): StepUpReason | null => {
    if (state.offered || facts.playedScored) return null
    // Checked first, but it is the slower bar in practice: five clean hits arrive well
    // before twelve of anything, so a tutorial graduate playing well still gets the
    // opener that says so.
    if (
      cleanRun >= CLEAN_RUN &&
      facts.hits >= MIN_HITS &&
      facts.elapsedMs >= MIN_RUN_MS
    ) {
      return 'clean'
    }
    if (facts.fromTutorial && facts.hits >= TUTORIAL_HITS) return 'tutorial'
    return null
  }

  const offer = reason()
  return { state: { cleanRun, offered: state.offered || offer !== null }, offer }
}

// The line the toast carries: something about what they just did, then the invitation.
//
// Two halves rather than one sentence so the recognition can be specific without the
// invitation changing — and the counts come off the thresholds rather than being written
// out, so raising a bar can never leave the words claiming a different number.
//
// One opener pool per reason. The clean-run openers are about how the player is doing,
// which the tutorial offer has no standing to claim: it fires on twelve targets however
// they went, so it marks the milestone and leaves the praise out of it. The invitations
// are shared — that half is the same question either way.
const OPENERS = {
  clean: ["You're playing well.", `${CLEAN_RUN} clean in a row.`, 'Nice streak.'],
  tutorial: [
    `That's ${TUTORIAL_HITS} targets.`,
    "You've got the idea.",
    "That's the practice done.",
  ],
} as const satisfies Record<StepUpReason, readonly [string, ...string[]]>

const INVITES = ["Let's try a real game.", 'Ready to play for real?'] as const

const pick = <T>(pool: readonly [T, ...T[]], roll: number): T => {
  const index = Math.min(pool.length - 1, Math.max(0, Math.floor(roll * pool.length)))
  return pool[index] ?? pool[0]
}

export type StepUpMessage = { opener: string; invite: string }

// Rolls are parameters rather than Math.random() calls inside, exactly as the
// announcement bar does it: the choice stays pure and testable, and the randomness lives
// at the call site where it can be taken once instead of on every render.
export const stepUpMessage = (
  reason: StepUpReason,
  openerRoll: number,
  inviteRoll: number,
): StepUpMessage => ({
  opener: pick(OPENERS[reason], openerRoll),
  invite: pick(INVITES, inviteRoll),
})

export const openerPool = (reason: StepUpReason): readonly string[] => OPENERS[reason]
export const invitePool = (): readonly string[] => INVITES
