import { describe, expect, it } from 'vitest'

import { formatGameTime } from './duration'

describe('formatGameTime', () => {
  it('formats zero', () => {
    expect(formatGameTime(0)).toBe('0:00')
  })

  it('pads seconds under ten', () => {
    expect(formatGameTime(5_000)).toBe('0:05')
  })

  it('rolls into minutes', () => {
    expect(formatGameTime(65_000)).toBe('1:05')
  })

  it('does not pad minutes, and keeps climbing past 59', () => {
    expect(formatGameTime(62 * 60_000 + 4_000)).toBe('62:04')
  })

  it('floors rather than rounds, so a part-second never counts as a full one', () => {
    expect(formatGameTime(59_999)).toBe('0:59')
  })

  it('treats a negative duration as zero', () => {
    expect(formatGameTime(-500)).toBe('0:00')
  })
})
