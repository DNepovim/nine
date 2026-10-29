import { describe, expect, it } from 'vitest'

import { isRating, RATINGS } from './session-rating'

describe('isRating', () => {
  it('accepts every key of the dial', () => {
    for (const rating of RATINGS) expect(isRating(rating)).toBe(true)
  })

  it('refuses anything off it', () => {
    for (const value of [0, 10, -1, 4.5, Number.NaN]) expect(isRating(value)).toBe(false)
  })
})
