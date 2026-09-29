import { describe, expect, it } from 'vitest'

import { formatReleaseDate, formatShortDate, monthsSince } from './format-date'

describe('formatReleaseDate', () => {
  it('spells out the month', () => {
    expect(formatReleaseDate('2026-08-10')).toBe('10 August 2026')
  })

  it('drops the leading zero from the day', () => {
    expect(formatReleaseDate('2026-01-05')).toBe('5 January 2026')
  })

  it('handles both ends of the year', () => {
    expect(formatReleaseDate('2026-12-31')).toBe('31 December 2026')
    expect(formatReleaseDate('2026-01-01')).toBe('1 January 2026')
  })

  it('does not shift the day for timezones west of Greenwich', () => {
    // A bare ISO day parsed by Date is UTC midnight, which renders as the
    // previous day anywhere behind it. Parsing by hand avoids that entirely.
    expect(formatReleaseDate('2026-08-01')).toBe('1 August 2026')
  })

  it('returns anything unrecognised untouched', () => {
    expect(formatReleaseDate('not-a-date')).toBe('not-a-date')
    expect(formatReleaseDate('2026-13-01')).toBe('2026-13-01')
  })
})

describe('formatShortDate', () => {
  it('renders an instant as a day and a short month', () => {
    expect(formatShortDate('2026-09-17T12:00:00.000Z')).toBe('17 SEP')
  })

  it('does not pad the day', () => {
    expect(formatShortDate('2026-01-05T12:00:00.000Z')).toBe('5 JAN')
  })

  it('returns nothing at all for something that is not a date', () => {
    expect(formatShortDate('not a date')).toBe('')
  })
})

describe('monthsSince', () => {
  const at = (iso: string) => new Date(`${iso}T12:00:00.000Z`)

  it('counts nothing until the day comes round', () => {
    expect(monthsSince('2026-09-22', at('2026-09-29'))).toBe(0)
    expect(monthsSince('2026-09-22', at('2026-10-21'))).toBe(0)
    expect(monthsSince('2026-09-22', at('2026-10-22'))).toBe(1)
  })

  it('counts calendar months, not thirty-day blocks', () => {
    expect(monthsSince('2026-01-15', at('2026-03-15'))).toBe(2)
    expect(monthsSince('2026-01-15', at('2027-01-15'))).toBe(12)
    expect(monthsSince('2025-06-01', at('2026-09-30'))).toBe(15)
  })

  it('reads a join day in the future as brand new', () => {
    expect(monthsSince('2027-01-01', at('2026-09-29'))).toBe(0)
  })

  it('returns nothing at all for something that is not a day', () => {
    expect(monthsSince('not-a-date', at('2026-09-29'))).toBeNull()
    expect(monthsSince('2026-13-01', at('2026-09-29'))).toBeNull()
  })
})
