import { describe, expect, it } from 'vitest'

import { isRestDay } from '@/lib/rest-day'

describe('isRestDay', () => {
  it('is Sunday and no other day', () => {
    expect(isRestDay(new Date(2026, 10, 8, 12))).toBe(true)
    expect(isRestDay(new Date(2026, 10, 8, 0, 0))).toBe(true)
    expect(isRestDay(new Date(2026, 10, 8, 23, 59))).toBe(true)
    expect(isRestDay(new Date(2026, 10, 7, 23, 59))).toBe(false)
    expect(isRestDay(new Date(2026, 10, 9, 0, 0))).toBe(false)
  })
})
