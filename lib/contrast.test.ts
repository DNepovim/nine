import { describe, expect, it } from 'vitest'

import { contrastRatio, readableOn } from '@/lib/contrast'

describe('contrastRatio', () => {
  it('runs from one for a colour on itself to twenty-one for black on white', () => {
    expect(contrastRatio('#123456', '#123456')).toBeCloseTo(1)
    expect(contrastRatio('#000000', '#FFFFFF')).toBeCloseTo(21)
    expect(contrastRatio('#FFFFFF', '#000000')).toBeCloseTo(21)
  })
})

describe('readableOn', () => {
  const DARK_GROUND = '#110F18'
  const LIGHT_INK = '#F3EFE9'

  it('keeps a colour that reads on the ground', () => {
    expect(readableOn('#8296FF', DARK_GROUND, LIGHT_INK)).toBe('#8296FF')
  })

  it('falls back where it would vanish — black on the dark scheme', () => {
    expect(readableOn('#000000', DARK_GROUND, LIGHT_INK)).toBe(LIGHT_INK)
    expect(readableOn('#1C1928', DARK_GROUND, LIGHT_INK)).toBe(LIGHT_INK)
  })
})
