import { describe, expect, it } from 'vitest'

import { formatReleaseDate } from './format-date'

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
