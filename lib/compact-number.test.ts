import { describe, expect, it } from 'vitest'

import { compactNumber } from './compact-number'

const shown = (total: number): string => {
  const { value, suffix } = compactNumber(total)
  return `${value}${suffix}`
}

describe('compactNumber', () => {
  it('leaves anything under a thousand alone', () => {
    expect(shown(0)).toBe('0')
    expect(shown(940)).toBe('940')
    expect(shown(999)).toBe('999')
  })

  it('takes one decimal below ten thousand', () => {
    expect(shown(1000)).toBe('1k')
    expect(shown(1234)).toBe('1.2k')
    expect(shown(9949)).toBe('9.9k')
  })

  it('drops the decimal above ten thousand', () => {
    expect(shown(12345)).toBe('12k')
    expect(shown(84500)).toBe('85k')
  })

  it('reaches for millions rather than four-figure thousands', () => {
    expect(shown(999999)).toBe('1M')
    expect(shown(1234567)).toBe('1.2M')
    expect(shown(42000000)).toBe('42M')
  })

  it('keeps the suffix apart from the digits', () => {
    // The two are set in different faces — the seven-segment score font has no letters.
    expect(compactNumber(1234)).toEqual({ value: '1.2', suffix: 'k' })
    expect(compactNumber(940)).toEqual({ value: '940', suffix: '' })
  })

  it('rounds a fractional total before deciding anything', () => {
    expect(shown(999.6)).toBe('1k')
  })
})
