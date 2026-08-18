import { describe, expect, it } from 'vitest'

import { pickTips } from './pick-tips'

const TIPS = ['a', 'b', 'c', 'd', 'e']

describe('pickTips', () => {
  it('takes as many as asked for', () => {
    expect(pickTips(TIPS, 3, [0, 0, 0])).toHaveLength(3)
  })

  it('never repeats a tip, however the rolls fall', () => {
    // Every roll at the bottom of the range would take index 0 each time if the pool
    // were not shrinking.
    expect(pickTips(TIPS, 3, [0, 0, 0])).toEqual(['a', 'b', 'c'])
  })

  it('follows the rolls', () => {
    // 0.999 takes the last of whatever is left, so this walks backwards.
    expect(pickTips(TIPS, 3, [0.999, 0.999, 0.999])).toEqual(['e', 'd', 'c'])
  })

  it('picks from across the pool', () => {
    expect(pickTips(TIPS, 2, [0.5, 0])).toEqual(['c', 'a'])
  })

  it('clamps a roll of exactly 1 rather than falling off the end', () => {
    expect(pickTips(TIPS, 1, [1])).toEqual(['e'])
  })

  it('clamps a negative roll', () => {
    expect(pickTips(TIPS, 1, [-0.5])).toEqual(['a'])
  })

  it('treats a missing roll as the bottom of the range', () => {
    expect(pickTips(TIPS, 2, [])).toEqual(['a', 'b'])
  })

  it('gives back the whole list when asked for more than there is', () => {
    expect(pickTips(TIPS, 9, [0, 0, 0, 0, 0])).toHaveLength(TIPS.length)
  })

  it('is empty when asked for nothing', () => {
    expect(pickTips(TIPS, 0, [])).toEqual([])
  })

  it('leaves the list it was given alone', () => {
    const source = [...TIPS]
    pickTips(source, 3, [0.4, 0.7, 0.1])
    expect(source).toEqual(TIPS)
  })
})
