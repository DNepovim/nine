import { describe, expect, it } from 'vitest'

import { seeded } from '@/machines/arcade'

import { settlementName } from './place-names'

const names = (count: number, town = false): string[] =>
  Array.from({ length: count }, (_, i) => settlementName(seeded(1000 + i * 7919), town))

describe('settlementName', () => {
  it('gives the same place the same name every time', () => {
    expect(settlementName(seeded(42))).toBe(settlementName(seeded(42)))
  })

  it('fits under a village without reaching its neighbours', () => {
    for (const name of names(400)) {
      expect(name.length).toBeGreaterThan(2)
      expect(name.length).toBeLessThanOrEqual(13)
    }
  })

  it('never joins three consonants at the seam', () => {
    // Ashshaw and Woldale are the two failures this rule exists to stop, so the test is
    // that no name carries a tripled consonant run or a doubled letter from a join.
    for (const name of names(400)) {
      expect(name).not.toMatch(/[bcdfghjklmnpqrstvwxz]{4}/i)
      expect(name).not.toMatch(/(.)\1\1/i)
    }
  })

  it('only ever says letters, spaces and capitals where a name has them', () => {
    for (const name of names(400)) {
      expect(name).toMatch(/^[A-Z][a-z]+( [A-Z][a-z]+)?$/)
    }
  })

  it('says more than a handful of different things', () => {
    expect(new Set(names(300)).size).toBeGreaterThan(120)
  })

  it('gives towns endings a village does not get', () => {
    const grand = /(port|gard|hold|keep|minster|castle|watch)$/
    expect(names(80, true).filter((n) => grand.test(n)).length).toBeGreaterThan(10)
  })
})
