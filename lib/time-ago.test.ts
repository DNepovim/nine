import { describe, expect, it } from 'vitest'

import { timeAgo } from './time-ago'

const NOW = Date.parse('2026-08-13T12:00:00.000Z')
const ago = (ms: number) => new Date(NOW - ms).toISOString()

const MINUTE = 60_000
const HOUR = 60 * MINUTE
const DAY = 24 * HOUR

describe('timeAgo', () => {
  it('says NOW under a minute', () => {
    expect(timeAgo(ago(0), NOW)).toBe('NOW')
    expect(timeAgo(ago(59_000), NOW)).toBe('NOW')
  })

  it('counts minutes, hours and days', () => {
    expect(timeAgo(ago(MINUTE), NOW)).toBe('1M AGO')
    expect(timeAgo(ago(59 * MINUTE), NOW)).toBe('59M AGO')
    expect(timeAgo(ago(HOUR), NOW)).toBe('1H AGO')
    expect(timeAgo(ago(23 * HOUR), NOW)).toBe('23H AGO')
    expect(timeAgo(ago(DAY), NOW)).toBe('1D AGO')
  })

  it('rounds down to the unit rather than up', () => {
    expect(timeAgo(ago(HOUR + 59 * MINUTE), NOW)).toBe('1H AGO')
  })

  it('distinguishes minutes from months', () => {
    expect(timeAgo(ago(5 * MINUTE), NOW)).toBe('5M AGO')
    expect(timeAgo(ago(60 * DAY), NOW)).toBe('2MO AGO')
  })

  it('reaches weeks and years', () => {
    expect(timeAgo(ago(14 * DAY), NOW)).toBe('2W AGO')
    expect(timeAgo(ago(400 * DAY), NOW)).toBe('1Y AGO')
  })

  it('treats a future timestamp as NOW, so clock skew cannot read as ahead', () => {
    expect(timeAgo(ago(-5 * MINUTE), NOW)).toBe('NOW')
  })

  it('is null for a timestamp it cannot read', () => {
    expect(timeAgo('not a date', NOW)).toBeNull()
  })
})
