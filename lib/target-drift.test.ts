import { describe, expect, it } from 'vitest'

import { NINE_DIAL } from '@/modes'

import {
  driftedValue,
  driftPath,
  driftRange,
  isFresh,
  msToNextStep,
} from './target-drift'

const rising = { value: 100, drift: 1 as const, spawnedAt: 0 }
const falling = { value: 100, drift: -1 as const, spawnedAt: 0 }

describe('driftedValue', () => {
  it('is the value it arrived as for the whole first step', () => {
    expect(driftedValue(rising, 0, 1000)).toBe(100)
    expect(driftedValue(rising, 999, 1000)).toBe(100)
  })

  it('moves one per whole step, in its own direction', () => {
    expect(driftedValue(rising, 1000, 1000)).toBe(101)
    expect(driftedValue(rising, 16_499, 1000)).toBe(116)
    expect(driftedValue(falling, 3000, 1000)).toBe(97)
  })

  it('holds still where nothing drifts', () => {
    expect(driftedValue(rising, 5000, null)).toBe(100)
    expect(driftedValue({ ...rising, drift: 0 }, 5000, 1000)).toBe(100)
  })

  it('reads a clock that ran backwards as no time at all', () => {
    expect(driftedValue(rising, -500, 1000)).toBe(100)
  })
})

describe('isFresh', () => {
  it('is true under the first step and false from it on', () => {
    expect(isFresh(rising, 999, 1000)).toBe(true)
    expect(isFresh(rising, 1000, 1000)).toBe(false)
  })

  it('is never true where nothing drifts', () => {
    expect(isFresh(rising, 0, null)).toBe(false)
  })

  it('is never true for a target dealt still on a drifting run', () => {
    expect(isFresh({ ...rising, drift: 0 }, 0, 1000)).toBe(false)
  })
})

describe('driftRange', () => {
  it('keeps a rising target clear of the top by as many steps as its ring holds', () => {
    expect(driftRange(NINE_DIAL, 1, 16_500, 1000)).toEqual({ min: 0, max: 307 })
  })

  it('keeps a falling target clear of nought the same way', () => {
    expect(driftRange(NINE_DIAL, -1, 16_500, 1000)).toEqual({ min: 17, max: 324 })
  })

  it('never lets a target leave the dial before its ring runs out', () => {
    for (const drift of [1, -1] as const) {
      const { min, max } = driftRange(NINE_DIAL, drift, 16_500, 1000)
      for (const value of [min, max]) {
        const end = driftedValue({ value, drift, spawnedAt: 0 }, 16_500, 1000)
        expect(end).toBeGreaterThanOrEqual(0)
        expect(end).toBeLessThanOrEqual(NINE_DIAL.maxSum)
      }
    }
  })
})

describe('msToNextStep', () => {
  it('is what is left of the step it is on, and a millisecond over', () => {
    expect(msToNextStep(rising, 0, 1000)).toBe(1001)
    expect(msToNextStep(rising, 2400, 1000)).toBe(601)
    expect(msToNextStep(rising, 2999, 1000)).toBe(2)
  })
})

describe('driftPath', () => {
  it('is every arrival that would rise onto the sum within the ring', () => {
    expect(driftPath(120, 1, 3000, 1000)).toEqual([120, 119, 118, 117])
  })

  it('is every arrival that would fall onto it, from above', () => {
    expect(driftPath(120, -1, 2500, 1000)).toEqual([120, 121, 122, 123])
  })
})
