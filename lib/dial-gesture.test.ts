import { describe, expect, it } from 'vitest'

import {
  allowedMove,
  cellAt,
  crossReach,
  exitMove,
  liftMove,
  nextValue,
  travelled,
  type DialMove,
} from '@/lib/dial-gesture'
import { dialMetrics } from '@/lib/dial-metrics'
import { NINE_DIAL } from '@/modes'

// A phone held upright: an 81pt button, the fixed 12pt gap, a 267pt square. Every
// coordinate below is in that square's own space, which is what the pan reports.
const BOARD = NINE_DIAL
const PHONE = dialMetrics({ width: 375, height: 667 }, BOARD)

// The distance between two key centres, and how far a finger arriving from another key
// has to get onto a key before the key answers: 32.55pt of the 93 on this phone.
const PITCH = PHONE.button + PHONE.gap
const REACH = crossReach(PHONE)

// The centre of a key, which is what a point has to be read back to.
const centre = (cell: number) => ({
  x: PITCH * (cell % 3) + PHONE.button / 2,
  y: PITCH * Math.floor(cell / 3) + PHONE.button / 2,
})

// The near and far edges of the band a key claims, on one axis: the key's own pill plus
// half the gap on either side of it, which is where a finger crosses in and out.
const bandStart = (lane: number) => PITCH * lane - PHONE.gap / 2
const bandEnd = (lane: number) => bandStart(lane + 1)

describe('cellAt', () => {
  it('reads every key back from its own centre', () => {
    for (let cell = 0; cell < 9; cell++) {
      const { x, y } = centre(cell)
      expect(cellAt(x, y, PHONE, BOARD), `cell ${cell}`).toBe(cell)
    }
  })

  it('splits the gap between the two keys it separates', () => {
    // The gap runs 81..93 on the x axis, so its midpoint is 87.
    expect(cellAt(86, 40, PHONE, BOARD)).toBe(0)
    expect(cellAt(88, 40, PHONE, BOARD)).toBe(1)
  })

  it('gives a point on the pill but off its centre to that pill', () => {
    // Just inside the top-left key's box, and just inside the bottom-right's.
    expect(cellAt(1, 1, PHONE, BOARD)).toBe(0)
    expect(cellAt(PHONE.width - 1, PHONE.width - 1, PHONE, BOARD)).toBe(8)
  })

  it('has no key outside the square', () => {
    expect(cellAt(-1, 40, PHONE, BOARD)).toBeNull()
    expect(cellAt(40, -1, PHONE, BOARD)).toBeNull()
    expect(cellAt(PHONE.width, 40, PHONE, BOARD)).toBeNull()
    expect(cellAt(40, PHONE.width, PHONE, BOARD)).toBeNull()
  })

  it('has no key at all before the dial has been measured', () => {
    expect(cellAt(0, 0, { button: 0, gap: 12, width: 0, height: 0 }, BOARD)).toBeNull()
  })
})

describe('exitMove', () => {
  it('names the side the finger left through', () => {
    const { x, y } = centre(4)
    expect(exitMove(4, PHONE.width, y, PHONE, BOARD.cols)).toBe('right')
    expect(exitMove(4, -20, y, PHONE, BOARD.cols)).toBe('left')
    expect(exitMove(4, x, -20, PHONE, BOARD.cols)).toBe('up')
    expect(exitMove(4, x, PHONE.width, PHONE, BOARD.cols)).toBe('down')
  })

  it('reads a diagonal exit as its longer axis', () => {
    const { x, y } = centre(0)
    expect(exitMove(0, x + 90, y + 20, PHONE, BOARD.cols)).toBe('right')
    expect(exitMove(0, x + 20, y + 90, PHONE, BOARD.cols)).toBe('down')
  })

  it('gives an exactly diagonal exit to the vertical, as a lift does', () => {
    const { x, y } = centre(0)
    expect(exitMove(0, x + 60, y + 60, PHONE, BOARD.cols)).toBe('down')
  })

  it('still names a side once the finger has left the dial entirely', () => {
    const { y } = centre(6)
    expect(exitMove(6, -200, y, PHONE, BOARD.cols)).toBe('left')
  })
})

describe('liftMove', () => {
  it('takes the longer axis past the threshold', () => {
    expect(liftMove(30, 5, false, REACH)).toBe('right')
    expect(liftMove(-30, 5, false, REACH)).toBe('left')
    expect(liftMove(5, -30, false, REACH)).toBe('up')
    expect(liftMove(5, 30, false, REACH)).toBe('down')
  })

  it('reads a lift that went nowhere as a tap, when the gesture began there', () => {
    expect(liftMove(0, 0, false, REACH)).toBe('tap')
    expect(liftMove(15, 10, false, REACH)).toBe('tap')
  })

  it('leaves a key the finger only passed through alone', () => {
    // No stray +1 on the key you happened to stop over on the way somewhere.
    expect(liftMove(0, 0, true, REACH)).toBeNull()
    expect(liftMove(15, 10, true, REACH)).toBeNull()
  })

  it('still takes a real swipe on a key the finger passed through', () => {
    expect(liftMove(0, -40, true, REACH)).toBe('up')
  })

  it('swallows the overshoot of a swipe that carried onto the next key', () => {
    // 25pt past the boundary is the tail of the gesture aimed at the key before this
    // one, not a second swipe — even though the same 25pt on the key the finger landed
    // on is a swipe outright.
    expect(liftMove(25, 0, true, REACH)).toBeNull()
    expect(liftMove(25, 0, false, REACH)).toBe('right')
  })
})

describe('crossReach', () => {
  it('reads the bar off the dial being played', () => {
    expect(crossReach(PHONE)).toBeCloseTo(32.55)
  })

  it('scales with the keys, so it is the same share of a wider dial', () => {
    const wide = dialMetrics({ width: 750, height: 1334 }, BOARD)
    expect(crossReach(wide) / (wide.button + wide.gap)).toBeCloseTo(
      REACH / (PHONE.button + PHONE.gap),
    )
  })
})

describe('travelled', () => {
  it('gives the whole key to a finger that crossed it end to end', () => {
    expect(travelled('right', PITCH, 0)).toBe(PITCH)
    expect(travelled('down', 0, PITCH)).toBe(PITCH)
    expect(travelled('left', -PITCH, 0)).toBe(PITCH)
    expect(travelled('up', 0, -PITCH)).toBe(PITCH)
  })

  it('ignores the axis the key was not left by', () => {
    // Sliding along a row says nothing about leaving the key upwards.
    expect(travelled('up', 60, 0)).toBe(0)
  })

  it('gives nothing to a finger that came back out of the side it went in by', () => {
    expect(travelled('up', 40, 3)).toBe(-3)
  })

  it('counts a tap as travel in no direction at all', () => {
    expect(travelled('tap', 40, 40)).toBe(0)
  })
})

describe('a finger that clips the key beside the one it is swiping', () => {
  // Sweeping right along the middle row, 3pt of the thumb dips into the bottom row's
  // band over the 7 and comes straight back up out of it.
  const entry = { x: 100, y: bandStart(2) }
  const exit = { x: 140, y: bandStart(2) + 3 }

  it('leaves the clipped key alone, however far along the row the thumb went', () => {
    const move = exitMove(7, exit.x, exit.y, PHONE, BOARD.cols)
    expect(move).toBe('up')
    expect(travelled(move, exit.x - entry.x, exit.y - entry.y)).toBeLessThan(REACH)
  })

  it('still takes the key the finger crossed properly on its way', () => {
    // The 4, left rightward through the whole of its band on the same sweep.
    const move = exitMove(4, bandEnd(1), centre(4).y, PHONE, BOARD.cols)
    expect(move).toBe('right')
    expect(travelled(move, bandEnd(1) - bandStart(1), 0)).toBeGreaterThanOrEqual(REACH)
  })

  it('still takes a key entered from one side and left through the next', () => {
    // Right into the middle of the 4 from the 3, then down out of it into the 7: not a
    // crossing end to end, but half a key of travel downwards is a decision.
    const move = exitMove(4, centre(4).x, bandEnd(1), PHONE, BOARD.cols)
    expect(move).toBe('down')
    expect(travelled(move, 0, bandEnd(1) - centre(4).y)).toBeGreaterThanOrEqual(REACH)
  })
})

describe('allowedMove', () => {
  const MOVES = ['up', 'down', 'left', 'right', 'tap'] as const satisfies DialMove[]

  it('takes nothing on a key the lesson has shut', () => {
    for (const move of MOVES) expect(allowedMove('off', move, true)).toBeNull()
    for (const move of MOVES) expect(allowedMove('off', move, false)).toBeNull()
  })

  it('reads every lift as a tap where only taps are taken', () => {
    for (const move of MOVES) expect(allowedMove('tap', move, true)).toBe('tap')
  })

  it('lets the finger cross a tap-only key without touching it', () => {
    for (const move of MOVES) expect(allowedMove('tap', move, false)).toBeNull()
  })

  it('passes every move through on a live key', () => {
    for (const move of MOVES) expect(allowedMove('full', move, false)).toBe(move)
  })
})

describe('nextValue', () => {
  it('steps up and down, wrapping the way a press does', () => {
    expect(nextValue('up', 8, BOARD.digits)).toBe(9)
    expect(nextValue('up', 9, BOARD.digits)).toBe(0)
    expect(nextValue('down', 1, BOARD.digits)).toBe(0)
    expect(nextValue('down', 0, BOARD.digits)).toBe(9)
  })

  it('counts a tap as a step up', () => {
    expect(nextValue('tap', 8, BOARD.digits)).toBe(9)
    expect(nextValue('tap', 9, BOARD.digits)).toBe(0)
  })

  it('sets the floor and the ceiling sideways', () => {
    expect(nextValue('left', 5, BOARD.digits)).toBe(0)
    expect(nextValue('right', 5, BOARD.digits)).toBe(9)
  })

  it('answers with the value it was given where there is nothing to do', () => {
    // Which is how a no-op is spotted: leaving a 0 leftward, or a 9 rightward.
    expect(nextValue('left', 0, BOARD.digits)).toBe(0)
    expect(nextValue('right', 9, BOARD.digits)).toBe(9)
  })
})

describe('a swipe across the bottom row', () => {
  // Start on the bottom-left key, drag right across the bottom-centre to the
  // bottom-right, then flick up and lift: two nines and a step.
  it('leaves a nine behind each key it crosses and steps the one it ends on', () => {
    const values = [0, 0, 0, 0, 0, 0, 3, 4, 5]
    const walk = (cell: number, move: DialMove) => {
      values[cell] = nextValue(move, values[cell] ?? 0, BOARD.digits)
    }

    walk(6, exitMove(6, centre(7).x, centre(6).y, PHONE, BOARD.cols)) // left the 6 rightward
    walk(7, exitMove(7, centre(8).x, centre(7).y, PHONE, BOARD.cols)) // left the 7 rightward
    const lift = liftMove(0, -40, true, REACH) // flicked up on the 8 and lifted
    if (lift === null) throw new Error('the flick up should have been taken')
    expect(lift).toBe('up')
    walk(8, lift)

    expect(values).toEqual([0, 0, 0, 0, 0, 0, 9, 9, 6])
  })
})
