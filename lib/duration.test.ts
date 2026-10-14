import { describe, expect, it } from 'vitest'

import { formatCareerTime, formatCountdown, formatGameTime } from './duration'

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

describe('formatCareerTime', () => {
  it('says the largest unit there is and the one under it', () => {
    expect(formatCareerTime(40 * 60_000 + 12_000)).toBe('40′12″')
    expect(formatCareerTime(7 * 3_600_000 + 38 * 60_000)).toBe('7ʰ38′')
    expect(formatCareerTime(12 * 86_400_000 + 7 * 3_600_000)).toBe('12ᵈ07ʰ')
  })

  it('pads the smaller figure and leaves the leading one alone', () => {
    expect(formatCareerTime(7 * 3_600_000 + 8 * 60_000)).toBe('7ʰ08′')
    expect(formatCareerTime(40 * 60_000 + 5_000)).toBe('40′05″')
  })

  it('says the second unit even when it is nought', () => {
    // Two orders always, so the figure a player reads twice has moved between the two.
    expect(formatCareerTime(7 * 3_600_000)).toBe('7ʰ00′')
    expect(formatCareerTime(12 * 86_400_000)).toBe('12ᵈ00ʰ')
  })

  it('drops everything under the second unit rather than rounding it up', () => {
    expect(formatCareerTime(247 * 3_600_000 + 38 * 60_000 + 12_000)).toBe('10ᵈ07ʰ')
    expect(formatCareerTime(86_400_000 - 1)).toBe('23ʰ59′')
    expect(formatCareerTime(3_600_000 - 1)).toBe('59′59″')
    expect(formatCareerTime(60_000 - 1)).toBe('59″')
  })

  it('falls back to seconds below a minute, there being nothing under them to add', () => {
    expect(formatCareerTime(12_000)).toBe('12″')
    expect(formatCareerTime(0)).toBe('0″')
  })

  it('treats a negative duration as zero', () => {
    expect(formatCareerTime(-500)).toBe('0″')
  })

  it('does not cap the leading figure', () => {
    expect(formatCareerTime(400 * 86_400_000)).toBe('400ᵈ00ʰ')
  })
})

describe('formatCountdown', () => {
  const s = 1000
  const m = 60 * s
  const h = 60 * m

  it('writes a clock, not a duration', () => {
    // The opposite choice from `formatGameTime` one function up, and deliberately so.
    expect(formatCountdown(1 * h + 52 * m + 9 * s)).toBe('1:52:09')
    expect(formatGameTime(1 * h + 52 * m + 9 * s)).toBe('1ʰ52′09″')
  })

  it('always shows the seconds, so the last column is always moving', () => {
    // This replaced a rule that dropped them once there was an hour left. The figure was
    // easier to read for it and the card looked stopped, which is the worse trade: the
    // seconds are on the banner to move rather than to be read.
    expect(formatCountdown(1 * h + 52 * m + 9 * s)).toBe('1:52:09')
    expect(formatCountdown(52 * m + 9 * s)).toBe('52:09')
    expect(formatCountdown(22 * h + 41 * m + 29 * s)).toBe('22:41:29')
  })

  it('keeps counting in hours rather than growing a days column', () => {
    // A window is a day long. 1ᵈ would sit unmoved for its first hour.
    expect(formatCountdown(25 * h + 1 * m)).toBe('25:01:00')
    expect(formatCountdown(400 * h)).toBe('400:00:00')
  })

  it('drops the hours when there are none', () => {
    expect(formatCountdown(52 * m + 9 * s)).toBe('52:09')
  })

  it('keeps the minutes even when there are none, so the shape never changes', () => {
    expect(formatCountdown(9 * s)).toBe('0:09')
    expect(formatCountdown(59 * s)).toBe('0:59')
    expect(formatCountdown(60 * s)).toBe('1:00')
  })

  it('pads the second figure and leaves the leading one alone', () => {
    expect(formatCountdown(1 * h + 5 * m)).toBe('1:05:00')
    expect(formatCountdown(5 * m)).toBe('5:00')
  })

  it('floors rather than rounding, so it never claims a second still running', () => {
    expect(formatCountdown(9 * s + 999)).toBe('0:09')
  })

  it('clamps at zero for a window that shut while the card was up', () => {
    expect(formatCountdown(0)).toBe('0:00')
    expect(formatCountdown(-5000)).toBe('0:00')
  })
})
