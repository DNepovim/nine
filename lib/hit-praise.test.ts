import { describe, expect, it } from 'vitest'

import { praiseFor, praisePool } from './hit-praise'

const REASONS = ['accuracy', 'speed', 'both'] as const

describe('praiseFor', () => {
  it('picks the first line at the bottom of the roll', () => {
    expect(praiseFor('accuracy', 0)).toBe(praisePool('accuracy')[0])
  })

  it('picks the last line at the top of the roll', () => {
    const pool = praisePool('speed')
    expect(praiseFor('speed', 0.999)).toBe(pool[pool.length - 1])
  })

  it('stays inside the pool for a roll of exactly 1', () => {
    expect(praisePool('both')).toContain(praiseFor('both', 1))
  })

  it('draws only from its own reason', () => {
    for (const reason of REASONS) {
      for (const roll of [0, 0.3, 0.7, 0.99]) {
        expect(praisePool(reason)).toContain(praiseFor(reason, roll))
      }
    }
  })
})

describe('praise pools', () => {
  // The line sits in the top bar under the stat row. Short on purpose — it is
  // read at a glance mid-run, and the figures it would otherwise repeat are
  // already in the row above.
  const MAX_LENGTH = 24

  it('keeps every line short enough for the bar', () => {
    for (const reason of REASONS) {
      for (const line of praisePool(reason)) {
        expect(line.length).toBeLessThanOrEqual(MAX_LENGTH)
      }
    }
  })

  it('offers more than one line per reason, so praise varies', () => {
    for (const reason of REASONS) {
      expect(praisePool(reason).length).toBeGreaterThan(1)
    }
  })
})
