import { SWIPE_THRESHOLD } from '@/constants/game'
import type { DialMetrics } from '@/lib/dial-metrics'
import type { DialControl } from '@/machines/tutorial-lesson'

// The nine keys, in the order they are drawn and the order the grid is stored in.
// Anything that has to say something per key counts through this rather than its own
// literal, so a key's index means the same thing to the pan, the lesson and the machine.
export const DIAL_CELLS = [0, 1, 2, 3, 4, 5, 6, 7, 8]

// What one key was asked to do. Four of them are the sides a finger can leave a key
// through; the fifth is the finger lifting where it landed.
export type DialMove = 'up' | 'down' | 'left' | 'right' | 'tap'

// Every function here is called from the pan's worklets, on the UI thread, so the
// answer lands in the same frame as the finger that asked for it. They are pure, so
// they are also just functions in a test.

// One axis of a key's position: which of the three a coordinate falls in, with each key
// claiming half of the gap on either side of it.
//
// Above its caller, not below it: the worklet transform rewrites every function in here
// into a `const`, so a forward reference that would have hoisted throws on the way in.
function track(p: number, metrics: DialMetrics): number {
  'worklet'
  const pitch = metrics.button + metrics.gap
  return Math.min(2, Math.max(0, Math.floor((p + metrics.gap / 2) / pitch)))
}

// Which key a point in the dial's square belongs to, or none if it is outside it.
//
// The gap between two keys is split down the middle rather than left as dead space:
// a finger dragged across the dial is somewhere in a 12pt channel for a frame or two,
// and a key that only answered for its own pill would drop that frame's crossing.
export function cellAt(x: number, y: number, metrics: DialMetrics): number | null {
  'worklet'
  if (metrics.size <= 0) return null
  if (x < 0 || y < 0 || x >= metrics.size || y >= metrics.size) return null
  return track(y, metrics) * 3 + track(x, metrics)
}

// The side a key was left through, read from where the finger now is against the key's
// own centre. Not from how far the finger has travelled since it touched down: the
// player may have wandered over the key, changed their mind twice and come back, and
// none of that is the statement they made — leaving it on the right side is.
export function exitMove(
  cell: number,
  x: number,
  y: number,
  metrics: DialMetrics,
): DialMove {
  'worklet'
  const pitch = metrics.button + metrics.gap
  const dx = x - (pitch * (cell % 3) + metrics.button / 2)
  const dy = y - (pitch * Math.floor(cell / 3) + metrics.button / 2)
  if (Math.abs(dx) > Math.abs(dy)) return dx < 0 ? 'left' : 'right'
  return dy < 0 ? 'up' : 'down'
}

// What lifting off a key means, measured from where the finger entered it. The dominant
// axis past the threshold is a swipe; anything shorter is a tap — but only on the key
// the whole gesture began on. A key the finger merely crossed and happened to stop over
// is left alone, so ending a long drag never costs a stray +1 on a neighbour.
export function liftMove(dx: number, dy: number, crossed: boolean): DialMove | null {
  'worklet'
  if (Math.abs(dx) > Math.abs(dy)) {
    if (dx < -SWIPE_THRESHOLD) return 'left'
    if (dx > SWIPE_THRESHOLD) return 'right'
    return crossed ? null : 'tap'
  }
  if (dy < -SWIPE_THRESHOLD) return 'up'
  if (dy > SWIPE_THRESHOLD) return 'down'
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

// What each move asks the machine for. Exactly one of the two is ever filled: a move
// either steps the key or sets it outright, and the `null` on the other side is what
// says which — so a caller reads the effect instead of re-deciding it from the move.
export const MOVE_EFFECT = {
  up: { step: 1, set: null },
  tap: { step: 1, set: null },
  down: { step: -1, set: null },
  left: { step: null, set: 0 },
  right: { step: null, set: 9 },
} as const satisfies Record<DialMove, { step: 1 | -1 | null; set: number | null }>

// Where a move leaves a key. Up and down wrap, exactly as a press does in the machine,
// so neither of them can ever be a no-op. The sideways pair can: answering with the
// value it was given is how a move that would change nothing says so.
export function nextValue(move: DialMove, value: number): number {
  'worklet'
  const { step, set } = MOVE_EFFECT[move]
  if (step === null) return set
  return (((value + step) % 10) + 10) % 10
}

// One key being told what just happened to it, and the counter that makes a repeat of
// the same move a second event rather than no event at all.
export type DialCommand = { seq: number; move: DialMove }

// What every key starts on: a sequence nobody has reached, so the first render animates
// nothing. The move is a placeholder the guard on `seq` never lets through.
export const NO_COMMAND: DialCommand = { seq: 0, move: 'tap' }
