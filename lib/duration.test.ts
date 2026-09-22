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

  it('does not pad minutes, and keeps climbing past 59', () => {
    expect(formatGameTime(62 * 60_000 + 4_000)).toBe('62′04″')
  })

  it('floors rather than rounds, so a part-second never counts as a full one', () => {
    expect(formatGameTime(59_999)).toBe('59″')
  })

  it('treats a negative duration as zero', () => {
    expect(formatGameTime(-500)).toBe('0″')
  })
})
