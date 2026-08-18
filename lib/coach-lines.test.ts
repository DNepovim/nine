import { describe, expect, it } from 'vitest'

import { debriefLine, outranks, pressLine, pressPool } from './coach-lines'

const VERDICTS = ['lost', 'tapping', 'coarse', 'wrap'] as const

// The cap the praise lines already keep: one row of 10px mono under the stat row,
// read at a glance mid-run.
const MAX_LENGTH = 24

describe('pressLine', () => {
  it('picks the first line at the bottom of the roll', () => {
    expect(pressLine('lost', 0)).toBe(pressPool('lost')[0])
  })

  it('picks the last line at the top of the roll', () => {
    const pool = pressPool('tapping')
    expect(pressLine('tapping', 0.999)).toBe(pool[pool.length - 1])
  })

  it('stays inside the pool for a roll of exactly 1', () => {
    expect(pressPool('coarse')).toContain(pressLine('coarse', 1))
  })

  it('draws only from its own verdict', () => {
    for (const verdict of VERDICTS) {
      for (const roll of [0, 0.3, 0.7, 0.99]) {
        expect(pressPool(verdict)).toContain(pressLine(verdict, roll))
      }
    }
  })
})

describe('coach pools', () => {
  it('keeps every line short enough for the bar', () => {
    for (const verdict of VERDICTS) {
      for (const line of pressPool(verdict)) {
        expect(line.length).toBeLessThanOrEqual(MAX_LENGTH)
      }
    }
  })

  it('offers more than one line per verdict, so the coach varies', () => {
    for (const verdict of VERDICTS) {
      expect(pressPool(verdict).length).toBeGreaterThan(1)
    }
  })

  it('never names a key by its weight label', () => {
    // The dial labels its keys ×1 … ×9 (`components/game/dial-button.tsx`), so a
    // line carrying that label is naming specific buttons rather than giving
    // advice — which is solving the target, the one thing the coach must not do.
    for (const verdict of VERDICTS) {
      for (const line of pressPool(verdict)) {
        expect(line).not.toMatch(/×/)
      }
    }
  })
})

describe('debriefLine', () => {
  it('names what the hit cost and what it could have cost', () => {
    expect(debriefLine(12, 4)).toBe('12 steps — 4 would do')
  })

  it('stays inside the bar at its longest figures', () => {
    expect(debriefLine(99, 15).length).toBeLessThanOrEqual(MAX_LENGTH)
  })

  it('drops the figures past 99 steps rather than overflowing the bar', () => {
    expect(debriefLine(100, 4)).toBe('Way too many steps')
  })
})

describe('outranks', () => {
  it('lets a habit take the line from a debrief', () => {
    expect(outranks('tapping', 'debrief')).toBe(true)
    expect(outranks('coarse', 'debrief')).toBe(true)
    expect(outranks('wrap', 'debrief')).toBe(true)
  })

  it('does not let a debrief take the line from a habit', () => {
    expect(outranks('debrief', 'coarse')).toBe(false)
  })

  it('lets anything take the line from lost', () => {
    expect(outranks('debrief', 'lost')).toBe(true)
    expect(outranks('tapping', 'lost')).toBe(true)
  })

  it('does not let lost take the line from a debrief', () => {
    expect(outranks('lost', 'debrief')).toBe(false)
  })

  it('lets a fresh habit replace one already showing', () => {
    // Equal ranks replace: the newer observation is about the press just made.
    expect(outranks('coarse', 'tapping')).toBe(true)
  })
})
