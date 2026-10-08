import { TUTORIAL_TARGETS } from '@/constants/tutorial'
import { type Difficulty, type ModeId } from '@/modes'

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

// A player whose first launch opened straight into Trainee gets asked on hit count alone
// — no clean streak, no clock. They have never seen a scored board, so the offer is how
// they find out the boards exist rather than a reward for playing well, and waiting for
// evidence of playing well would strand exactly the player it was written for. Ten
// targets is long enough to have found the rhythm.
//
// Unlike the run itself, this does not expire with the launch that opened it. The bar
// stays low in every practice run until the player has actually posted a scored score —
// which is the same thing that switches the offer off for good, below.
export const WELCOME_HITS = 10

// How long the taught player is left alone before the offer: seven targets past the last
// scripted board, dealt and answered with the lesson silent.
//
// The lesson ending is the wrong moment to ask. It hands the run over with "that is every
// move" and a rolled board behind it, and a dialog arriving on top of that would take the
// practice away at the exact moment the player was given it. Seven is long enough to be a
// stretch of play in its own right — rolled targets, their own routes, nobody pointing at
// anything — so the question lands on a player who has actually been playing rather than
// on one who has just finished being taught.
export const TAUGHT_PRACTICE = 7

// The hit count that offer is due at: the whole script, and then that practice.
export const TAUGHT_HITS = TUTORIAL_TARGETS.length + TAUGHT_PRACTICE

// Whether the tutorial has anything left to teach, and so whether its offer is due.
//
// Separate from the reducer above because nothing about it is a matter of how well the
// run is going: the lesson either finished or it did not. The bars the reducer keeps —
// a clean streak, a minute on the clock — are for a practice run nobody scripted, and
// applied here they would hold a taught player on a board with no lesson left on it.
export const offerAfterTutorial = (facts: {
  // Whether this run is the tutorial at all. Every other run answers the reducer.
  tutorial: boolean
  // Whether the lesson has run out — `done`, the step past the sign-off. Implied by the
  // hit count on an uninterrupted run, and asked for anyway: the stepper can send a
  // player back through the script, and one halfway through it is being taught again
  // however many targets they have put down.
  taught: boolean
  hits: number
  // The same door the reducer's own offer is shut by: a player who has posted a scored
  // score is retaking the tutorial, not finding the boards for the first time.
  playedScored: boolean
}): boolean =>
  facts.tutorial && facts.taught && facts.hits >= TAUGHT_HITS && !facts.playedScored

// Where the offer points. Easy on purpose: Trainee hands out infinite lives, so even a
// player clearing Extreme practice has never once been under the pressure of losing, and
// dropping them on a matching Extreme board would be a worse welcome than a fair one.
export const STEP_UP_BOARD = { mode: 'accuracy', difficulty: 'easy' } as const satisfies {
  mode: ModeId
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
  // Whether this install opened with the welcome run — see lib/welcome.ts. Persisted, so
  // this is true of every Trainee run the player has, not only the first one.
  fromWelcome: boolean
}

// Which bar was cleared. The offer says different things depending: one has watched the
// player do something well and can say so, the other has only counted to ten.
//
// A list rather than a bare union so the screen gallery can enumerate them and show
// every wording — a reason added here turns up there without being remembered.
export const STEP_UP_REASONS = ['clean', 'welcome'] as const
export type StepUpReason = (typeof STEP_UP_REASONS)[number]

// One resolved batch in, at most one offer out.
export function stepUpReducer(
  state: StepUpState,
  facts: StepUpFacts,
): { state: StepUpState; offer: StepUpReason | null } {
  const cleanRun = facts.clean ? state.cleanRun + 1 : 0

  const reason = (): StepUpReason | null => {
    if (state.offered || facts.playedScored) return null
    // Checked first, so a welcomed player who is also on a roll by their tenth target
    // gets the opener that says so rather than the one that only counts.
    if (
      cleanRun >= CLEAN_RUN &&
      facts.hits >= MIN_HITS &&
      facts.elapsedMs >= MIN_RUN_MS
    ) {
      return 'clean'
    }
    if (facts.fromWelcome && facts.hits >= WELCOME_HITS) return 'welcome'
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
// which the welcome offer has no standing to claim: it fires on ten targets however they
// went, so it marks the milestone and leaves the praise out of it. The invitations are
// shared — that half is the same question either way.
const OPENERS = {
  clean: ["You're playing well.", `${CLEAN_RUN} clean in a row.`, 'Nice streak.'],
  welcome: [
    `That's ${WELCOME_HITS} targets.`,
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
