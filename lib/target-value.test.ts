import { describe, expect, it } from 'vitest'

import { TUTORIAL_TARGET_REACH } from '@/constants/tutorial'
import { fullRange, pickTargetValue, rangeAround } from '@/lib/target-value'
import { NINE_DIAL } from '@/modes'

describe('rangeAround', () => {
  it('reaches the same distance either side', () => {
    expect(rangeAround(NINE_DIAL, 150, 80)).toEqual({ min: 70, max: 230 })
  })

  it('clips at zero rather than sliding up', () => {
    expect(rangeAround(NINE_DIAL, 20, 80)).toEqual({ min: 0, max: 100 })
  })

  it('clips at the top of the range rather than sliding down', () => {
    expect(rangeAround(NINE_DIAL, NINE_DIAL.maxSum, 80)).toEqual({
      min: NINE_DIAL.maxSum - 80,
      max: NINE_DIAL.maxSum,
    })
  })
})

describe('pickTargetValue', () => {
  it('takes the roll across the whole range when nothing is taken', () => {
    expect(pickTargetValue({ roll: 0, taken: [], range: fullRange(NINE_DIAL) })).toBe(0)
    expect(pickTargetValue({ roll: 0.5, taken: [], range: fullRange(NINE_DIAL) })).toBe(
      162,
    )
    expect(
      pickTargetValue({ roll: 0.999999, taken: [], range: fullRange(NINE_DIAL) }),
    ).toBe(NINE_DIAL.maxSum)
  })

  it('never hands back a value the board already holds', () => {
    expect(
      pickTargetValue({ roll: 0.5, taken: [162], range: fullRange(NINE_DIAL) }),
    ).toBe(163)
  })

  it('walks down when the step up is taken too', () => {
    expect(
      pickTargetValue({ roll: 0.5, taken: [162, 163], range: fullRange(NINE_DIAL) }),
    ).toBe(161)
  })

  it('stays inside the range it was given', () => {
    const range = rangeAround(NINE_DIAL, 120, TUTORIAL_TARGET_REACH)
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
