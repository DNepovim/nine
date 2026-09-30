import { describe, expect, it } from 'vitest'

import {
  allowedMove,
  cellAt,
  exitMove,
  liftMove,
  nextValue,
  type DialMove,
} from '@/lib/dial-gesture'
import { dialMetrics } from '@/lib/dial-metrics'

// A phone held upright: an 81pt button, the fixed 12pt gap, a 267pt square. Every
// coordinate below is in that square's own space, which is what the pan reports.
const PHONE = dialMetrics({ width: 375, height: 667 })

// The centre of a key, which is what a point has to be read back to.
const centre = (cell: number) => ({
  x: (PHONE.button + PHONE.gap) * (cell % 3) + PHONE.button / 2,
  y: (PHONE.button + PHONE.gap) * Math.floor(cell / 3) + PHONE.button / 2,
})

describe('cellAt', () => {
  it('reads every key back from its own centre', () => {
    for (let cell = 0; cell < 9; cell++) {
      const { x, y } = centre(cell)
      expect(cellAt(x, y, PHONE), `cell ${cell}`).toBe(cell)
    }
  })

  it('splits the gap between the two keys it separates', () => {
    // The gap runs 81..93 on the x axis, so its midpoint is 87.
    expect(cellAt(86, 40, PHONE)).toBe(0)
    expect(cellAt(88, 40, PHONE)).toBe(1)
  })

  it('gives a point on the pill but off its centre to that pill', () => {
    // Just inside the top-left key's box, and just inside the bottom-right's.
    expect(cellAt(1, 1, PHONE)).toBe(0)
    expect(cellAt(PHONE.size - 1, PHONE.size - 1, PHONE)).toBe(8)
  })

  it('has no key outside the square', () => {
    expect(cellAt(-1, 40, PHONE)).toBeNull()
    expect(cellAt(40, -1, PHONE)).toBeNull()
    expect(cellAt(PHONE.size, 40, PHONE)).toBeNull()
    expect(cellAt(40, PHONE.size, PHONE)).toBeNull()
  })

  it('has no key at all before the dial has been measured', () => {
    expect(cellAt(0, 0, { button: 0, gap: 12, size: 0 })).toBeNull()
  })
})

describe('exitMove', () => {
  it('names the side the finger left through', () => {
    const { x, y } = centre(4)
    expect(exitMove(4, PHONE.size, y, PHONE)).toBe('right')
    expect(exitMove(4, -20, y, PHONE)).toBe('left')
    expect(exitMove(4, x, -20, PHONE)).toBe('up')
    expect(exitMove(4, x, PHONE.size, PHONE)).toBe('down')
  })

  it('reads a diagonal exit as its longer axis', () => {
    const { x, y } = centre(0)
    expect(exitMove(0, x + 90, y + 20, PHONE)).toBe('right')
    expect(exitMove(0, x + 20, y + 90, PHONE)).toBe('down')
  })

  it('gives an exactly diagonal exit to the vertical, as a lift does', () => {
    const { x, y } = centre(0)
    expect(exitMove(0, x + 60, y + 60, PHONE)).toBe('down')
  })

  it('still names a side once the finger has left the dial entirely', () => {
    const { y } = centre(6)
    expect(exitMove(6, -200, y, PHONE)).toBe('left')
  })
})

describe('liftMove', () => {
  it('takes the longer axis past the threshold', () => {
    expect(liftMove(30, 5, false)).toBe('right')
    expect(liftMove(-30, 5, false)).toBe('left')
    expect(liftMove(5, -30, false)).toBe('up')
    expect(liftMove(5, 30, false)).toBe('down')
  })

  it('reads a lift that went nowhere as a tap, when the gesture began there', () => {
    expect(liftMove(0, 0, false)).toBe('tap')
    expect(liftMove(15, 10, false)).toBe('tap')
  })

  it('leaves a key the finger only passed through alone', () => {
    // No stray +1 on the key you happened to stop over on the way somewhere.
    expect(liftMove(0, 0, true)).toBeNull()
    expect(liftMove(15, 10, true)).toBeNull()
  })

  it('still takes a real swipe on a key the finger passed through', () => {
    expect(liftMove(0, -40, true)).toBe('up')
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
    expect(nextValue('up', 8)).toBe(9)
    expect(nextValue('up', 9)).toBe(0)
    expect(nextValue('down', 1)).toBe(0)
    expect(nextValue('down', 0)).toBe(9)
  })

  it('counts a tap as a step up', () => {
    expect(nextValue('tap', 8)).toBe(9)
    expect(nextValue('tap', 9)).toBe(0)
  })

  it('sets the floor and the ceiling sideways', () => {
    expect(nextValue('left', 5)).toBe(0)
    expect(nextValue('right', 5)).toBe(9)
  })

  it('answers with the value it was given where there is nothing to do', () => {
    // Which is how a no-op is spotted: leaving a 0 leftward, or a 9 rightward.
    expect(nextValue('left', 0)).toBe(0)
    expect(nextValue('right', 9)).toBe(9)
  })
})

describe('a swipe across the bottom row', () => {
  // Start on the bottom-left key, drag right across the bottom-centre to the
  // bottom-right, then flick up and lift: two nines and a step.
  it('leaves a nine behind each key it crosses and steps the one it ends on', () => {
    const values = [0, 0, 0, 0, 0, 0, 3, 4, 5]
    const walk = (cell: number, move: DialMove) => {
      values[cell] = nextValue(move, values[cell] ?? 0)
    }

    walk(6, exitMove(6, centre(7).x, centre(6).y, PHONE)) // left the 6 rightward
    walk(7, exitMove(7, centre(8).x, centre(7).y, PHONE)) // left the 7 rightward
    const lift = liftMove(0, -40, true) // flicked up on the 8 and lifted
    if (lift === null) throw new Error('the flick up should have been taken')
    expect(lift).toBe('up')
    walk(8, lift)

    expect(values).toEqual([0, 0, 0, 0, 0, 0, 9, 9, 6])
  })
})
