import { describe, expect, it } from 'vitest'

import { MAX_TARGET } from '@/constants/game'
import { TUTORIAL_TARGET_REACH } from '@/constants/tutorial'
import { pickTargetValue, rangeAround } from '@/lib/target-value'

describe('rangeAround', () => {
  it('reaches the same distance either side', () => {
    expect(rangeAround(150, 80)).toEqual({ min: 70, max: 230 })
  })

  it('clips at zero rather than sliding up', () => {
    expect(rangeAround(20, 80)).toEqual({ min: 0, max: 100 })
  })

  it('clips at the top of the range rather than sliding down', () => {
    expect(rangeAround(MAX_TARGET, 80)).toEqual({
      min: MAX_TARGET - 80,
      max: MAX_TARGET,
    })
  })
})

describe('pickTargetValue', () => {
  it('takes the roll across the whole range when nothing is taken', () => {
    expect(pickTargetValue({ roll: 0, taken: [] })).toBe(0)
    expect(pickTargetValue({ roll: 0.5, taken: [] })).toBe(162)
    expect(pickTargetValue({ roll: 0.999999, taken: [] })).toBe(MAX_TARGET)
  })

  it('never hands back a value the board already holds', () => {
    expect(pickTargetValue({ roll: 0.5, taken: [162] })).toBe(163)
  })

  it('walks down when the step up is taken too', () => {
    expect(pickTargetValue({ roll: 0.5, taken: [162, 163] })).toBe(161)
  })

  it('stays inside the range it was given', () => {
    const range = rangeAround(120, TUTORIAL_TARGET_REACH)
    for (let i = 0; i <= 20; i++) {
      const value = pickTargetValue({ roll: i / 20, taken: [120], range })
      expect(value).toBeGreaterThanOrEqual(range.min)
      expect(value).toBeLessThanOrEqual(range.max)
      expect(value).not.toBe(120)
    }
  })

  it('keeps the walk inside the range rather than stepping past its top', () => {
    const range = { min: 100, max: 102 }
    expect(pickTargetValue({ roll: 0.999999, taken: [102], range })).toBe(101)
  })

  it('gives the roll back when every value in the range is taken', () => {
    const range = { min: 10, max: 12 }
    expect(pickTargetValue({ roll: 0, taken: [10, 11, 12], range })).toBe(10)
  })
})
