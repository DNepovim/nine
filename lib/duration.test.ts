import { describe, expect, it } from 'vitest'

import { formatGameTime } from './duration'

describe('formatGameTime', () => {
  it('formats zero', () => {
    expect(formatGameTime(0)).toBe('0″')
  })

  it('says only the seconds under a minute, unpadded', () => {
    expect(formatGameTime(5_000)).toBe('5″')
    expect(formatGameTime(12_000)).toBe('12″')
  })

  it('rolls into minutes, and pads the seconds once there are any', () => {
    expect(formatGameTime(65_000)).toBe('1′05″')
    expect(formatGameTime(72_000)).toBe('1′12″')
  })

  it('rolls into hours, and pads the minutes once there are any', () => {
    expect(formatGameTime(62 * 60_000 + 4_000)).toBe('1ʰ02′04″')
    expect(formatGameTime(3_600_000)).toBe('1ʰ00′00″')
    expect(formatGameTime(3_600_000 + 5_000)).toBe('1ʰ00′05″')
  })

  it('does not pad the leading figure, and keeps climbing past 24', () => {
    expect(formatGameTime(247 * 3_600_000 + 38 * 60_000 + 12_000)).toBe('247ʰ38′12″')
  })

  it('holds the hour back until there is one', () => {
    expect(formatGameTime(3_599_999)).toBe('59′59″')
  })

  it('floors rather than rounds, so a part-second never counts as a full one', () => {
    expect(formatGameTime(59_999)).toBe('59″')
  })

  it('treats a negative duration as zero', () => {
    expect(formatGameTime(-500)).toBe('0″')
  })
})
