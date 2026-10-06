import { CROSSING_SHARE, SWIPE_THRESHOLD } from '@/constants/game'
import type { DialMetrics } from '@/lib/dial-metrics'
import type { DialControl } from '@/machines/tutorial-lesson'

// What one key was asked to do. Four of them are the sides a finger can leave a key
// through; the fifth is the finger lifting where it landed.
export type DialMove = 'up' | 'down' | 'left' | 'right' | 'tap'

// Every function here is called from the pan's worklets, on the UI thread, so the
// answer lands in the same frame as the finger that asked for it. They are pure, so
// they are also just functions in a test.

// One axis of a key's position: which of the `lanes` a coordinate falls in, with each key
// claiming half of the gap on either side of it.
//
// Above its caller, not below it: the worklet transform rewrites every function in here
// into a `const`, so a forward reference that would have hoisted throws on the way in.
function track(p: number, metrics: DialMetrics, lanes: number): number {
  'worklet'
  const pitch = metrics.button + metrics.gap
  return Math.min(lanes - 1, Math.max(0, Math.floor((p + metrics.gap / 2) / pitch)))
}

// Which key a point in the dial's square belongs to, or none if it is outside it.
//
// The gap between two keys is split down the middle rather than left as dead space:
// a finger dragged across the dial is somewhere in a 12pt channel for a frame or two,
// and a key that only answered for its own pill would drop that frame's crossing.
export function cellAt(
  x: number,
  y: number,
  metrics: DialMetrics,
  shape: { rows: number; cols: number },
): number | null {
  'worklet'
  if (metrics.width <= 0 || metrics.height <= 0) return null
  if (x < 0 || y < 0 || x >= metrics.width || y >= metrics.height) return null
  return track(y, metrics, shape.rows) * shape.cols + track(x, metrics, shape.cols)
}

// The side a key was left through, read from where the finger now is against the key's
// own centre. Not from how far the finger has travelled since it touched down: the
// player may have wandered over the key, changed their mind twice and come back, and
// none of that is the statement they made — leaving it on the right side is.
//
// Which side it was is all this answers. Whether the key took the move is a separate
// question, and `travelled` against `crossReach` is where it is asked.
export function exitMove(
  cell: number,
  x: number,
  y: number,
  metrics: DialMetrics,
  cols: number,
): DialMove {
  'worklet'
  const pitch = metrics.button + metrics.gap
  const dx = x - (pitch * (cell % cols) + metrics.button / 2)
  const dy = y - (pitch * Math.floor(cell / cols) + metrics.button / 2)
  if (Math.abs(dx) > Math.abs(dy)) return dx < 0 ? 'left' : 'right'
  return dy < 0 ? 'up' : 'down'
}

// Where each move points, as a unit vector in the dial's own space. `tap` points
// nowhere: it is the finger staying put, not a side a key can be left by.
const MOVE_DIRECTION = {
  up: { x: 0, y: -1 },
  down: { x: 0, y: 1 },
  left: { x: -1, y: 0 },
  right: { x: 1, y: 0 },
  tap: { x: 0, y: 0 },
} as const satisfies Record<DialMove, { x: number; y: number }>

// How far the finger has to get onto a key it arrived at before the key answers at all.
//
// Taken from the dial it is playing rather than fixed in points, so the bar is the same
// share of a key whatever size the keys are — a challenge's five-column dial included.
export function crossReach(metrics: DialMetrics): number {
  'worklet'
  return (metrics.button + metrics.gap) * CROSSING_SHARE
}

// How much of a key's width the finger actually spent on it, in the direction it is
// leaving by, measured from where it entered. This is the part of the path that speaks
// for the move, and the one number that separates a crossing from a graze: a drag that
// means the key travels the whole way across it, while a finger that clips the neighbour
// of the key it is swiping goes in and comes straight back out the same side and so
// travels nothing — however deep the clip itself went.
export function travelled(move: DialMove, dx: number, dy: number): number {
  'worklet'
  const direction = MOVE_DIRECTION[move]
  return dx * direction.x + dy * direction.y
}

// What lifting off a key means, measured from where the finger entered it. The dominant
// axis past the bar is a swipe; anything shorter is a tap — but only on the key the
// whole gesture began on. A key the finger merely crossed and happened to stop over is
// left alone, so ending a long drag never costs a stray +1 on a neighbour.
//
// The bar itself is higher on a key the finger arrived at than on the key it landed on:
// a swipe that carries a little way past the key it was aimed at is the overshoot of one
// gesture, not the start of another, and `reach` is how much overshoot a neighbour
// swallows before it counts as having been swiped too.
export function liftMove(
  dx: number,
  dy: number,
  crossed: boolean,
  reach: number,
): DialMove | null {
  'worklet'
  const bar = crossed ? reach : SWIPE_THRESHOLD
  if (Math.abs(dx) > Math.abs(dy)) {
    if (dx < -bar) return 'left'
    if (dx > bar) return 'right'
    return crossed ? null : 'tap'
  }
  if (dy < -bar) return 'up'
  if (dy > bar) return 'down'
  return crossed ? null : 'tap'
}

// What a key actually does with a move, given what the lesson is letting it take.
//
// A shut key takes nothing, whether the finger lifts on it or only passes over. A
// tap-only key reads every lift as a tap — the guided route's keys are each one tap
// short of where they need to be, and a swipe there would ask for a gesture the lesson
// has not reached — but takes nothing at all from a finger crossing it, so a drag
// aimed elsewhere cannot nudge the key the route is pointing at.
export function allowedMove(
  control: DialControl,
  move: DialMove,
  lift: boolean,
): DialMove | null {
  'worklet'
  if (control === 'off') return null
  if (control === 'tap') return lift ? 'tap' : null
  return move
}

// What each move asks the machine for. Exactly one of the three is ever filled: a move
// either steps the key, or sets it to the floor, or sets it to the ceiling — and which
// one is filled is what says which, so a caller reads the effect instead of re-deciding
// it from the move.
//
// `set` names an end of the key's range rather than a digit, because how high a key goes
// is the dial's business: a swipe right fills the key, whatever filling it means on the
// dial being played.
export const MOVE_EFFECT = {
  up: { step: 1, set: null },
  tap: { step: 1, set: null },
  down: { step: -1, set: null },
  left: { step: null, set: 'floor' },
  right: { step: null, set: 'ceiling' },
} as const satisfies Record<
  DialMove,
  { step: 1 | -1 | null; set: 'floor' | 'ceiling' | null }
>

// Where a move leaves a key. Up and down wrap, exactly as a press does in the machine,
// so neither of them can ever be a no-op. The sideways pair can: answering with the
// value it was given is how a move that would change nothing says so.
export function nextValue(move: DialMove, value: number, digits: number): number {
  'worklet'
  const { step, set } = MOVE_EFFECT[move]
  if (step === null) return set === 'floor' ? 0 : digits - 1
  return (((value + step) % digits) + digits) % digits
}

// One key being told what just happened to it, and the counter that makes a repeat of
// the same move a second event rather than no event at all.
export type DialCommand = { seq: number; move: DialMove }

// What every key starts on: a sequence nobody has reached, so the first render animates
// nothing. The move is a placeholder the guard on `seq` never lets through.
export const NO_COMMAND: DialCommand = { seq: 0, move: 'tap' }
