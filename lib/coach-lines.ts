import type { PressVerdict } from '@/machines/coach'

// What Trainee's coach says, and who gets to say it.
//
// The line under the stat row is one line, and four things want it. Praise for a
// clean hit wins outright — it arrives with a confetti shower, and the coach must
// not talk over a celebration — so praise is resolved at the call site and does not
// appear here. What is left ranks among itself.
//
// Sentence case rather than the app's usual shouting caps, matching the praise lines
// and the announcement bar: this is the game talking to you, not a label.

export type CoachKind = PressVerdict | 'debrief'

// Each line says what the player did, never what to do instead — naming the key
// would be solving the target for them, which is the one thing a practice mode must
// not do. "The big keys" is a class of key, and that is advice.
const LINES = {
  lost: ['Going the wrong way', 'That’s not closer', 'Try a different key'],
  tapping: ['Swipe instead of tapping', 'A swipe gets there', 'Swipe to 0 or 9'],
  coarse: ['Start with the big keys', 'Big keys first', 'Go big, then fine-tune'],
  wrap: ['A tap is quicker', 'Tap is quicker here', 'One tap beats a swipe'],
} as const satisfies Record<PressVerdict, readonly [string, ...string[]]>

export const pressPool = (verdict: PressVerdict): readonly string[] => LINES[verdict]

// Which line to use, given a roll in [0, 1). The roll is a parameter rather than a
// Math.random() call inside, so the choice stays pure and testable and the randomness
// lives at the call site — the same shape as `praiseFor` and `messageFor`.
export function pressLine(verdict: PressVerdict, roll: number): string {
  const pool = LINES[verdict]
  const index = Math.min(pool.length - 1, Math.max(0, Math.floor(roll * pool.length)))
  return pool[index] ?? pool[0]
}

// Past this the figures stop fitting the bar, and a hit this wasteful does not need a
// number to make its point.
const MAX_STEPS = 99

// What a hit cost against what it could have cost. The stat row above already shows
// the accuracy percentage; what a percentage cannot say is what it was made of.
export function debriefLine(steps: number, par: number): string {
  if (steps > MAX_STEPS) return 'Way too many steps'
  return `${steps} steps — ${par} would do`
}

// Where each kind sits when two want the line at once. A habit is the most actionable
// thing the coach has, so it outranks the debrief; `lost` is the quietest observation
// and yields to both.
const RANK = {
  tapping: 0,
  coarse: 0,
  wrap: 0,
  debrief: 1,
  lost: 2,
} as const satisfies Record<CoachKind, number>

// Whether an arriving line may take the bar from the one already showing. Equal ranks
// replace, so a second habit supersedes the first rather than being dropped — the
// newer observation is about the press the player just made.
export const outranks = (next: CoachKind, current: CoachKind): boolean =>
  RANK[next] <= RANK[current]
