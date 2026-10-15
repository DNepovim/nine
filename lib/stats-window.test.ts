import { describe, expect, it } from 'vitest'

import { windowDays } from './stats-window'

// The three windows the admin's figures are read over. Worth a test because all three
// bounds are the app's own definitions rather than arithmetic: a week is the Monday the
// `week` leaderboard turns on, and a month is the thirty days `run_receipts` is kept for
// — not a calendar month, which would ask for rows that have been pruned.
describe('windowDays', () => {
  it('reads today as the one day', () => {
    expect(windowDays('today', '2026-10-15')).toEqual({
      from: '2026-10-15',
      to: '2026-10-15',
    })
  })

  it('reads yesterday as the one finished day before it', () => {
    // The only window whose comparison is like for like: one whole day against the whole
    // day before it.
    expect(windowDays('yesterday', '2026-10-15')).toEqual({
      from: '2026-10-14',
      to: '2026-10-14',
    })
  })

  it('reads yesterday across the turn of a month', () => {
    expect(windowDays('yesterday', '2026-10-01')).toEqual({
      from: '2026-09-30',
      to: '2026-09-30',
    })
  })

  it('reads a week as Monday through the day asked about', () => {
    // 15 October 2026 is a Thursday, so the week opened on the 12th. "This week so far",
    // the same stretch the `week` board shows, rather than a rolling seven days.
    expect(windowDays('week', '2026-10-15')).toEqual({
      from: '2026-10-12',
      to: '2026-10-15',
    })
  })

  it('reads a week asked about on its own Monday as that one day', () => {
    expect(windowDays('week', '2026-10-12')).toEqual({
      from: '2026-10-12',
      to: '2026-10-12',
    })
  })

  it('reads a month as thirty days inclusive, not a calendar month', () => {
    // Thirty days counted back from and including the 15th, which is as far back as the
    // receipts go. A calendar month would start on the 1st and come up short by two
    // weeks for anybody reading on the 15th.
    expect(windowDays('month', '2026-10-15')).toEqual({
      from: '2026-09-16',
      to: '2026-10-15',
    })
  })
})
