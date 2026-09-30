import type { MessageDescriptor } from '@lingui/core'
import { msg } from '@lingui/core/macro'

import { TUTORIAL_BANNER_MS, TUTORIAL_FIRST_WORD_MS } from '@/constants/tutorial'

// The lesson the tutorial run plays: what is being said right now, and what moves it on.
//
// A script rather than a machine, for the reason `machines/coach.ts` is one too — the
// interesting half is pure (which step follows which, and on what), and the half that needs
// React is only the timers. The hook owns those; this owns the order.
//
// The spine of it is the hit count. `TUTORIAL_TARGETS` deals one fixed board per hit, each
// chosen so that a single move is the obvious answer, and this walks the same list from the
// other end: the hit that clears the nth target opens the lesson for the one dealt in its
// place. Nothing here is triggered by watching the player play, which is what an earlier
// version did and what let two lessons want the screen at once.
//
// What each step shows, and what the dial will accept while it does, is in LESSON_VOICE and
// LESSON_DIAL below, so the screen never works either out from the step's name.

export type LessonStep =
  // The beat before the first word. Long enough for the target to finish arriving.
  | 'waiting'
  // A card on the target: this is the number to reach.
  | 'target'
  // A card on the sum above the dial: this is the number that has to match it.
  | 'sum'
  // The route, one lit key at a time, with a banner saying to tap the lit one. The dial is
  // shut to everything else.
  | 'guided'
  // The hit landed, and the lesson hands the dial over.
  | 'congrats'
  // Nothing said and nothing watched for. The lesson is between targets.
  | 'free'
  // A target below the sum. Taps only climb, so this is the first board that needs a swipe
  // down at all.
  | 'swipeDown'
  // A target far below. Stepping down would take all day; a key emptied outright is what
  // this one asks for.
  | 'swipeLeft'
  // A target far above. The same argument the other way — a key filled to nine.
  | 'swipeRight'
  // The script's last word: every move has been shown, and what is left is practice. The
  // board behind it is already a rolled one, so the run has handed itself over before the
  // line saying so has finished being read.
  | 'practice'
  // Taught. The run carries on as a tutorial run, and the lesson says nothing more.
  | 'done'

export const FIRST_STEP: LessonStep = 'waiting'

// The three gestures the lesson ever asks for outright. A tap it never has to: the guided
// route makes that point by being the only thing the dial will take.
export type Swipe = 'down' | 'left' | 'right'

export type LessonEvent =
  // The step's hold ran out, or the player tapped through it.
  | { type: 'ADVANCE' }
  // A target was cleared. `hits` is the run's total, which is what the script is written
  // against — the same number the spawner deals the next target by.
  | { type: 'HIT'; hits: number }
  // A key was swiped. Reported for every swipe; only the step asking for that one answers.
  | { type: 'SWIPED'; swipe: Swipe }

// What a tap anywhere, or a hold running out, moves each step on to. A step that answers with
// itself is one no clock can end: the route waits for the hit, the three gesture lessons wait
// for their gesture, `free` for the next target, `done` for nothing.
const ON_ADVANCE = {
  waiting: 'target',
  target: 'sum',
  sum: 'guided',
  guided: 'guided',
  congrats: 'free',
  free: 'free',
  swipeDown: 'swipeDown',
  swipeLeft: 'swipeLeft',
  swipeRight: 'swipeRight',
  practice: 'done',
  done: 'done',
} as const satisfies Record<LessonStep, LessonStep>

// The lesson each hit opens, indexed by the run's hit count — so the hit that clears
// `TUTORIAL_TARGETS[n]` opens the lesson for the target dealt in its place.
//
// One entry per scripted target, plus two that are not boards: index 0 answers no hit —
// none lands at nought — but it is what the stepper reads going back to the opening board,
// and it is FIRST_STEP, so a rewind and a fresh deal open the lesson the same way. The
// last is the sign-off, which answers the hit that clears the final scripted board and has
// a rolled one behind it. Past the end of the list the script is over.
export const LESSON_AFTER_HIT: readonly LessonStep[] = [
  'waiting',
  'congrats',
  'swipeDown',
  'swipeLeft',
  'swipeRight',
  'practice',
]

// Which gesture ends which lesson, and `null` for every step not asking for one. A gesture
// the lesson did not ask for is a player playing, and leaves the step where it was.
const ENDED_BY = {
  waiting: null,
  target: null,
  sum: null,
  guided: null,
  congrats: null,
  free: null,
  swipeDown: 'down',
  swipeLeft: 'left',
  swipeRight: 'right',
  practice: null,
  done: null,
} as const satisfies Record<LessonStep, Swipe | null>

// The next step, given what just happened. Anything a step has no answer for leaves it
// exactly where it was.
export function lessonStep(step: LessonStep, event: LessonEvent): LessonStep {
  // Taught is taught. Without this a run put back from storage — which starts at `done`,
  // its lesson already given — would have the script pick up again from whatever its hit
  // count happened to be.
  if (step === 'done') return 'done'
  if (event.type === 'ADVANCE') return ON_ADVANCE[step]
  if (event.type === 'HIT') return LESSON_AFTER_HIT[event.hits] ?? 'done'
  return ENDED_BY[step] === event.swipe ? 'free' : step
}

// How the lesson speaks at each step: a card pointing at something, a banner over the board,
// or nothing at all.
export type LessonVoice = 'silent' | 'targetTip' | 'sumTip' | 'banner'

export const LESSON_VOICE = {
  waiting: 'silent',
  target: 'targetTip',
  sum: 'sumTip',
  guided: 'banner',
  congrats: 'banner',
  free: 'silent',
  swipeDown: 'banner',
  swipeLeft: 'banner',
  swipeRight: 'banner',
  practice: 'banner',
  done: 'silent',
} as const satisfies Record<LessonStep, LessonVoice>

// What the dial will take at each step.
//
// `off` is the whole dial inert: it covers the two pointing cards, because a card that can be
// played through is a card nobody reads, and the silent beat before them, because a thumb
// already on a key would otherwise get a press in before the lesson had said anything. `one`
// is the guided route — the key the route is owed, taps only, every other key dead. `all` is
// the game, and nothing turns the dial back off once it is on.
export type LessonDial = 'off' | 'one' | 'all'

export const LESSON_DIAL = {
  waiting: 'off',
  target: 'off',
  sum: 'off',
  guided: 'one',
  congrats: 'all',
  free: 'all',
  swipeDown: 'all',
  swipeLeft: 'all',
  swipeRight: 'all',
  practice: 'all',
  done: 'all',
} as const satisfies Record<LessonStep, LessonDial>

// What one key on the dial will take.
//
// `full` is every gesture, which is every key in every run but a guided tutorial route.
// `tap` is the lit key on that route: taps only, so the route cannot be swiped off course
// into needing a gesture the lesson has not taught yet. `off` is dimmed and deaf.
export type DialControl = 'full' | 'tap' | 'off'

// Which of those a given key gets. The lesson is the only thing that ever answers anything
// but `full`.
export const keyControl = (
  dial: LessonDial,
  liveKey: number | null,
  index: number,
): DialControl => {
  if (dial === 'all') return 'full'
  if (dial === 'off') return 'off'
  return index === liveKey ? 'tap' : 'off'
}

// Whether a tap anywhere on the screen moves this step on. True exactly where the dial is
// off: those are the steps holding the player up, and a tap is how they say they have read
// it. Everywhere else a tap is a press on the dial and means something else entirely.
export const dismissedByTap = (step: LessonStep): boolean => LESSON_DIAL[step] === 'off'

// What the lesson says, step by step. `null` is a step that says nothing — the beat before
// the first word, the gaps between targets, and the run once it has been taught.
//
// Short, and in the app's own caps: these are labels on the thing they point at rather than
// prose about it, and every one is read in the second before a thumb moves. Each names the
// move the board in front of the player is asking for, never the mechanic behind it — the
// dial teaches that part by answering.
export const LESSON_LINE = {
  waiting: null,
  target: msg`THE MARK TO MEET`,
  sum: msg`YOUR TOTAL — BRING IT LEVEL`,
  // The halo says which key; this says what to do with it. Without a line the route asks a
  // player to work out from a dimmed dial that the one bright key is an instruction.
  guided: msg`TAP THE KEY THAT GLOWS`,
  congrats: msg`STRUCK — THE NEXT IS YOURS`,
  free: null,
  swipeDown: msg`LOWER NOW — SWIPE A KEY DOWN`,
  // Said as what the gesture does rather than as where it gets you: a player who knows a
  // swipe left empties a key can work out when to reach for one, where "swipe left to go far
  // down" leaves them guessing how far.
  swipeLeft: msg`SWIPE LEFT TO EMPTY A KEY`,
  swipeRight: msg`SWIPE RIGHT TO FILL A KEY`,
  // Every gesture the dial has has now been asked for — a tap, and all three swipes — so
  // this names the set rather than one more move, and hands the run over. What follows is
  // a tutorial run with nothing left to say: rolled targets, no clock, one at a time.
  practice: msg`THAT IS EVERY MOVE — LET’S TRAIN`,
  done: null,
} as const satisfies Record<LessonStep, MessageDescriptor | null>

// How long each step holds before moving itself on, and `null` for every step that waits on
// the player instead.
//
// Most of them wait. The two pointing cards go on a tap and on nothing else — a clock would
// be the lesson deciding they had been read, and the player who had not read one would be
// handed a live board with no idea what had just been asked of them. The three gesture
// lessons hold until the gesture: each is the one move the dial has not needed yet, and
// timed away it would be advice nobody had to take.
//
// The holds left are the beat before the first word, which nobody is waiting on, and the two
// banners that ask for nothing — the congratulation and the sign-off — both read while the
// player is already playing.
export const LESSON_HOLD_MS = {
  waiting: TUTORIAL_FIRST_WORD_MS,
  target: null,
  sum: null,
  guided: null,
  congrats: TUTORIAL_BANNER_MS,
  free: null,
  swipeDown: null,
  swipeLeft: null,
  swipeRight: null,
  practice: TUTORIAL_BANNER_MS,
  done: null,
} as const satisfies Record<LessonStep, number | null>
