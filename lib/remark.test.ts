import { describe, expect, it } from 'vitest'

import { MAX_REMARK_LENGTH, remarkOf } from '@/lib/remark'

describe('remarkOf', () => {
  it('trims the ends', () => {
    expect(remarkOf('  too fast  ')).toBe('too fast')
  })

  it('is null for nothing, or nothing but whitespace', () => {
    expect(remarkOf('')).toBeNull()
    expect(remarkOf(' \n\t ')).toBeNull()
  })

  it('keeps the lines inside', () => {
    expect(remarkOf('\nfirst\nsecond\n')).toBe('first\nsecond')
  })
})

describe('MAX_REMARK_LENGTH', () => {
  // The column's check says the same; the two have to move together.
  it('is 500', () => {
    expect(MAX_REMARK_LENGTH).toBe(500)
  })
})
