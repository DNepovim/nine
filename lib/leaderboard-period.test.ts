import { describe, expect, it } from 'vitest'

import { qualifiesForTab, tabSince } from './leaderboard-period'

describe('tabSince', () => {
  it('bounds today at today', () => {
    expect(tabSince('today', '2026-08-10')).toBe('2026-08-10')
  })

  it('bounds the week at six days back, so the window spans seven days', () => {
    expect(tabSince('week', '2026-08-10')).toBe('2026-08-04')
  })

  it('crosses a month boundary', () => {
    expect(tabSince('week', '2026-08-03')).toBe('2026-07-28')
  })

  it('has no bound for all time', () => {
    expect(tabSince('forever', '2026-08-10')).toBeNull()
  })
})

describe('qualifiesForTab', () => {
  it("accepts today's score under today", () => {
    expect(qualifiesForTab('2026-08-10', 'today', '2026-08-10')).toBe(true)
  })

  it("rejects yesterday's score under today", () => {
    expect(qualifiesForTab('2026-08-09', 'today', '2026-08-10')).toBe(false)
  })

  it('accepts the oldest day still inside the week', () => {
    expect(qualifiesForTab('2026-08-04', 'week', '2026-08-10')).toBe(true)
  })

  it('rejects the day that just fell out of the week', () => {
    expect(qualifiesForTab('2026-08-03', 'week', '2026-08-10')).toBe(false)
  })

  it('accepts anything under all time', () => {
    expect(qualifiesForTab('2019-01-01', 'forever', '2026-08-10')).toBe(true)
  })
})
