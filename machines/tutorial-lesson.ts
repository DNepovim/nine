import type { MessageDescriptor } from '@lingui/core'
import { msg } from '@lingui/core/macro'

import { TUTORIAL_WELCOME_MS, TUTORIAL_WELCOME_OUT_MS } from '@/constants/tutorial'

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
  // The lesson's own first word, set in the middle of an empty board: what this run is
  // and that none of it counts. It stands where a screen of its own used to — a curtain
  // over the whole app — and the target it is standing in the way of waits behind it,
  // for the moment it fades of its own accord or the tap that takes it early.
  | 'welcome'
  // The beat before the first word. Long enough for the target to finish arriving.
  | 'waiting'
  // A card on the target: this is the number to reach.
  | 'target'
  // A card on the sum above the dial: this is the number that has to match it.
  | 'sum'
  // The route, one lit key at a time, with a banner saying to tap the lit one. The dial is
  // shut to everything else.
  | 'guided'
  // The hit landed. The last thing the lesson says about the board it set up, and the
  // dial is handed over on the tap that takes it away.
  | 'congrats'
  // What a key is worth, in one line: the rule behind every number on the dial, with the
  // row and column multipliers coming up beside the dial as it is said and staying up.
  //
  // The one line the lesson leaves standing while the player plays. It comes after the
  // hand-over rather than before it because it is not an instruction — there is nothing to
  // do about it, and a rule read off a dial being used is a rule read once rather than
  // memorised. So it holds no tap and shuts no key: it is up for the whole of the first
  // board the player takes alone, and the hit that clears that board is what replaces it.
  | 'weights'
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
  // board behind it is already a rolled one, so the tap that takes this away is the tap
  // that hands the run over.
  | 'practice'
  // Taught. The run carries on as a tutorial run, and the lesson says nothing more.
  | 'done'

export const FIRST_STEP: LessonStep = 'welcome'

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
  welcome: 'waiting',
  waiting: 'target',
  target: 'sum',
  sum: 'guided',
  guided: 'guided',
  congrats: 'weights',
  // Nothing taps the weights line away — the dial is open under it and a tap there is a
  // press. The hit that clears the board it is standing over is what moves it on.
  weights: 'weights',
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
// and it is the silent beat the two pointing cards follow, so a rewind opens the opening
// board the way a fresh deal does bar the welcome, which is said once a launch and not
// again. The last is the sign-off, which answers the hit that clears the final scripted
// board and has a rolled one behind it. Past the end of the list the script is over.
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
// Only from the steps that have handed the dial over and are saying nothing binding. In
// practice that is the weights line, which is what board two is played under, and the free
// board between targets. The hand-over before them holds the dial shut while it is up, so
// no press can cross the target during it — it is answered anyway, because the crossing is
// reported a render after the press that caused it and the lesson may have moved on by
// then, and because the answer here should not have to be re-derived if a step's dial ever
// opens.
//
// Every lesson asking for something of its own is left alone — including the swipe-down
// one, which is already up — and once the script has reached it the overshoot is a player
// playing.
//
// The scripted board still gives the lesson again when it is dealt, which is right: that
// board is nine below its own sum, so the gesture is needed there whether or not it has
// been needed once already.
const brought = (step: LessonStep, hits: number): LessonStep => {
  if (hits >= SWIPE_DOWN_BOARD) return step
  return step === 'weights' || step === 'congrats' || step === 'free' ? 'swipeDown' : step
}

// Which gesture ends which lesson, and `null` for every step not asking for one. A gesture
// the lesson did not ask for is a player playing, and leaves the step where it was.
const ENDED_BY = {
  welcome: null,
  waiting: null,
  target: null,
  sum: null,
  guided: null,
  congrats: null,
  weights: null,
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

// How the lesson speaks at each step: its first word set plainly in the middle of an empty
// board, a card pointing at something on it, a banner under the sum, or nothing at all.
export type LessonVoice = 'silent' | 'opening' | 'targetTip' | 'sumTip' | 'banner'

export const LESSON_VOICE = {
  welcome: 'opening',
  waiting: 'silent',
  target: 'targetTip',
  sum: 'sumTip',
  guided: 'banner',
  congrats: 'banner',
  weights: 'banner',
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
// `off` is the whole dial inert, and it covers every step the lesson is holding the player
// up on: a card that can be played through is a card nobody reads. That is the opening
// word, the two pointing cards, the hand-over and the sign-off — and the silent beat among
// them, because a thumb already on a key would otherwise get a press in before the lesson
// had said anything. It is also what makes a tap on any of them a tap on the lesson rather
// than a press, which is how the opening word can be taken early.
//
// `one` is the guided route — the key the route is owed, taps only, every other key dead.
// `all` is the game, and it is what the dial is at every step the lesson is not holding
// the player up on: the three gesture lessons, the drag, the free board between targets,
// the run once it has been taught — and the weights line, which is the one thing the
// lesson says over a live dial, because it is a rule to be used rather than an
// instruction to be obeyed.
export type LessonDial = 'off' | 'one' | 'all'

export const LESSON_DIAL = {
  welcome: 'off',
  waiting: 'off',
  target: 'off',
  sum: 'off',
  guided: 'one',
  congrats: 'off',
  weights: 'all',
  free: 'all',
  swipeDown: 'all',
  swipeLeft: 'all',
  swipeRight: 'all',
  sweep: 'all',
  practice: 'off',
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
// An instruction and nothing else. Every line here is read in the second before a thumb
// moves, by a player who has the dial in front of them and does not yet know what it does
// — so each one names the move the board is asking for, in as few words as the move can
// be named in, and nothing is said twice. No turn of phrase, nothing about the mechanic
// behind the move, and no line that has to be finished before it means anything: the dial
// teaches the rest by answering.
export const LESSON_LINE = {
  // The one card that is not an instruction: what this run is, said on the board it is
  // about — a lesson that opens straight onto a dial looks exactly like a run.
  welcome: msg`LET'S LEARN THE GAME`,
  waiting: null,
  target: msg`REACH THIS NUMBER`,
  sum: msg`THIS IS YOUR TOTAL`,
  // The halo says which key; this says what to do with it. Without a line the route asks a
  // player to work out from a dimmed dial that the one bright key is an instruction.
  guided: msg`TAP THE GLOWING KEY`,
  congrats: msg`GOOD. THE NEXT ONE IS YOURS`,
  // The rule the whole dial is built on, as the arithmetic itself rather than a sentence
  // about it: the row's multiplier, the column's, and the digit the key is standing on.
  // The two multipliers come up beside the dial as this is read, so the line names three
  // things the player can see — and it stays up over the board being played under it, so
  // the three can be checked against a key the player has just pressed.
  weights: msg`KEY = ROW × COLUMN × DIGIT`,
  free: null,
  swipeDown: msg`SWIPE A KEY DOWN`,
  // Said as what the gesture does rather than as where it gets you: a player who knows a
  // swipe left empties a key can work out when to reach for one, where "swipe left to go far
  // down" leaves them guessing how far.
  swipeLeft: msg`SWIPE LEFT TO EMPTY A KEY`,
  swipeRight: msg`SWIPE RIGHT TO FILL A KEY`,
  // Named as the board's own move first and the drag second, because the move is the part
  // the player can already do: three keys they know how to empty, and the only new thing
  // being that the finger need not come up between them.
  sweep: msg`EMPTY THE ROW IN ONE DRAG`,
  // Every gesture the dial has has now been asked for — a tap, all three swipes, and the
  // drag that strings them together — so this hands the run over rather than naming one
  // more move. What follows is a tutorial run with nothing left to say: rolled targets, no
  // clock, one at a time.
  practice: msg`THAT IS EVERY MOVE. NOW PRACTISE`,
  done: null,
} as const satisfies Record<LessonStep, MessageDescriptor | null>

// How long each step holds before moving itself on, and `null` for every step that waits on
// the player instead.
//
// Every step that asks for something waits. Nothing the lesson *instructs* is taken off the
// screen by a clock: a clock there is the lesson deciding a line has been read, and the
// player who had not read one is handed a board that has silently started expecting
// something. So the pointing cards, the hand-over and the sign-off go on a tap, the guided
// route and the weights line go on the hit, and the three gesture lessons and the drag go
// on the gesture — each of those being the one thing the dial has not needed yet, and timed
// away it would be advice nobody had to take.
//
// Two steps are not that, and both are on a clock. The opening word asks for nothing at
// all — it says what the run is — so standing until it is tapped makes a wall out of a
// sentence, in front of a board that is already dealt; it dissolves on its own instead,
// and a tap still takes it early. And the beat after it shows nothing: the target is
// springing in across it, and a tooltip pointing at something still on its way in points
// at nothing. Nobody is waiting on either and nothing of either can be missed.
export const LESSON_HOLD_MS = {
  welcome: TUTORIAL_WELCOME_MS,
  waiting: TUTORIAL_WELCOME_OUT_MS,
  target: null,
  sum: null,
  guided: null,
  congrats: null,
  weights: null,
  free: null,
  swipeDown: null,
  swipeLeft: null,
  swipeRight: null,
  sweep: null,
  practice: null,
  done: null,
} as const satisfies Record<LessonStep, number | null>

// Whether the dial wears its multipliers at this step: a small `1×` over each column and
// beside each row, in the grey the app keeps for a number that is not part of the game.
//
// On from the step that explains them and never off again, which is what makes them a
// labelled dial rather than a card that flashed. Before that step they would be three
// numbers nobody had introduced, at the one moment the lesson is asking the player to
// look at a target instead.
export const LESSON_AXES = {
  welcome: false,
  waiting: false,
  target: false,
  sum: false,
  guided: false,
  congrats: false,
  weights: true,
  free: true,
  swipeDown: true,
  swipeLeft: true,
  swipeRight: true,
  sweep: true,
  practice: true,
  // The run carries on as a tutorial run once the script is done, and so does the
  // labelling: a dial that lost its multipliers at the sign-off would be taking the
  // lesson back the moment the player was left to use it.
  done: true,
} as const satisfies Record<LessonStep, boolean>

// Whether the drag is the player's to use yet: one gesture crossing from key to key,
// which is the last move the lesson teaches and so the one it has to keep out of reach
// until it does. A board answered with a drag the player has not been shown is a board
// that answered itself, and the lesson for it would then be teaching a move already made.
//
// True from the step that asks for it on, and the hook latches it there — see
// `hooks/use-tutorial-lesson.ts`. A latch rather than a flag per step, because `free` is
// both the gap before the drag lesson and the gap after it, and the stepper can put an
// earlier board back under a player who has already been taught. `done` is true for the
// run put back from storage mid-lesson, which starts there having had the whole script.
//
// Nothing outside a live tutorial reads this: in every other run the drag is the player's
// own setting, and the dial takes it on by default.
export const LESSON_DRAG = {
  welcome: false,
  waiting: false,
  target: false,
  sum: false,
  guided: false,
  congrats: false,
  weights: false,
  free: false,
  swipeDown: false,
  swipeLeft: false,
  swipeRight: false,
  sweep: true,
  practice: true,
  done: true,
} as const satisfies Record<LessonStep, boolean>

// The gesture the lesson is miming, and `null` at every step that is not asking for one.
//
// A line naming a swipe is a line about something the player has never done. So the step
// that says it also shows it: a thumb over the dial, travelling the way the gesture goes,
// again and again until the gesture is made. `drag` is the last lesson's — the same
// travel, held across a whole row.
export type HandGesture = Swipe | 'drag'

export const LESSON_HAND = {
  welcome: null,
  waiting: null,
  target: null,
  sum: null,
  // Nothing to mime: the route is taps, and the lit key is already the instruction.
  guided: null,
  congrats: null,
  weights: null,
  free: null,
  swipeDown: 'down',
  swipeLeft: 'left',
  swipeRight: 'right',
  sweep: 'drag',
  practice: null,
  done: null,
} as const satisfies Record<LessonStep, HandGesture | null>
