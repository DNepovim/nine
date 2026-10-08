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
// place. An earlier version triggered its lessons by watching the player play instead,
// which is what let two of them want the screen at once.
//
// One lesson is brought forward by what the player does, and it is the exception the rest
// of the script is written to avoid: a dial above the target, before anything has said how
// to come back down, is the one position a player can get into that the next hit cannot
// get them out of. See `brought` below.
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
  // A row standing at nine, and a target exactly that row below. Three keys in a line,
  // each asked for the same move — so this is the first board where lifting between them
  // is the slow way round, and the one gesture the dial has that is not a move.
  | 'sweep'
  // The script's last word: every move has been shown, and what is left is practice. The
  // board behind it is already a rolled one, so the run has handed itself over before the
  // line saying so has finished being read.
  | 'practice'
  // Taught. The run carries on as a tutorial run, and the lesson says nothing more.
  | 'done'

export const FIRST_STEP: LessonStep = 'waiting'

// The three gestures the lesson ever asks for by name. A tap it never has to: the guided
// route makes that point by being the only thing the dial will take. The drag the last
// lesson asks for is not one of these — it is any of them, held — and arrives as SWEPT.
export type Swipe = 'down' | 'left' | 'right'

export type LessonEvent =
  // The step's hold ran out, or the player tapped through it.
  | { type: 'ADVANCE' }
  // A target was cleared. `hits` is the run's total, which is what the script is written
  // against — the same number the spawner deals the next target by.
  | { type: 'HIT'; hits: number }
  // A key was swiped. Reported for every swipe; only the step asking for that one answers.
  | { type: 'SWIPED'; swipe: Swipe }
  // The dial has gone above the target it is chasing. Reported on the crossing rather
  // than for every press above it, and `hits` says how far into the script the player is
  // — a board past the swipe-down lesson has nothing to learn from one.
  | { type: 'OVERSHOT'; hits: number }
  // One gesture moved a second key without the finger lifting. Not a swipe of its own —
  // the keys it moved each reported their own — so it is a separate event rather than a
  // fourth `Swipe`, and only the step teaching the drag listens for it.
  | { type: 'SWEPT' }

// What a tap anywhere, or a hold running out, moves each step on to. A step that answers with
// itself is one no clock can end: the route waits for the hit, the three gesture lessons wait
// for their gesture, the last for a drag, `free` for the next target, `done` for nothing.
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
  sweep: 'sweep',
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
  'sweep',
  'practice',
]

// Which board the swipe-down lesson is scripted for. Read off the table rather than
// written again, so bringing the lesson forward cannot end up pointing at a different one
// than the board itself opens.
const SWIPE_DOWN_BOARD = LESSON_AFTER_HIT.indexOf('swipeDown')

// An overshoot, answered. Taps only climb, so a player who dials above the target before
// the swipe-down lesson has been reached is stuck with no gesture that gets them back and
// nothing having told them one exists — the second board is where that happens, since it
// is the first the player takes alone. So the lesson is brought to the board they are
// standing on instead of waiting for the hit that would have dealt its own.
//
// Only from the two steps that have handed the dial over and are saying nothing binding:
// the congratulation, which the player can already play through, and the free board after
// it. Every lesson asking for something of its own is left alone — including the
// swipe-down one, which is already up — and once the script has reached it the overshoot
// is a player playing.
//
// The scripted board still gives the lesson again when it is dealt, which is right: that
// board is nine below its own sum, so the gesture is needed there whether or not it has
// been needed once already.
const brought = (step: LessonStep, hits: number): LessonStep => {
  if (hits >= SWIPE_DOWN_BOARD) return step
  return step === 'congrats' || step === 'free' ? 'swipeDown' : step
}

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
  // Not ended by a swipe at all, however many of them it takes — SWEPT is what ends it.
  sweep: null,
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
  if (event.type === 'OVERSHOT') return brought(step, event.hits)
  if (event.type === 'SWEPT') return step === 'sweep' ? 'free' : step
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
  sweep: 'banner',
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
  sweep: 'all',
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
  // Named as the board's own move first and the drag second, because the move is the part
  // the player can already do: three keys they know how to empty, and the only new thing
  // being that the finger need not come up between them.
  sweep: msg`EMPTY THE ROW — ONE DRAG, DON’T LIFT`,
  // Every gesture the dial has has now been asked for — a tap, all three swipes, and the
  // drag that strings them together — so this names the set rather than one more move, and
  // hands the run over. What follows is
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
// lessons hold until the gesture, and the drag until the drag: each is the one thing the
// dial has not needed yet, and timed away it would be advice nobody had to take.
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
  sweep: null,
  practice: TUTORIAL_BANNER_MS,
  done: null,
} as const satisfies Record<LessonStep, number | null>
