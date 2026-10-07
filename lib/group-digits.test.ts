import { describe, expect, it } from 'vitest'

import { groupDigits } from './group-digits'

// The separator the module uses, spelled here so a test fails loudly if it ever changes
// rather than passing against whatever it became.
const SPACE = ' '

describe('groupDigits', () => {
  it('leaves anything under a thousand alone', () => {
    expect(groupDigits(0)).toBe('0')
    expect(groupDigits(7)).toBe('7')
    expect(groupDigits(999)).toBe('999')
  })

  it('marks off the first thousand', () => {
    expect(groupDigits(1000)).toBe(`1${SPACE}000`)
    expect(groupDigits(1240)).toBe(`1${SPACE}240`)
  })

  it('marks off every group of a long figure', () => {
    expect(groupDigits(86_500)).toBe(`86${SPACE}500`)
    expect(groupDigits(912_006)).toBe(`912${SPACE}006`)
    expect(groupDigits(4_912_006)).toBe(`4${SPACE}912${SPACE}006`)
  })

  it('rounds before it groups, so a fraction never leaks a decimal point in', () => {
    expect(groupDigits(1499.6)).toBe(`1${SPACE}500`)
  })

  it('keeps a negative figure negative', () => {
    expect(groupDigits(-12_300)).toBe(`-12${SPACE}300`)
  })
})
