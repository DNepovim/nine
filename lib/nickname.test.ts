import { describe, expect, it } from 'vitest'

import { nicknameProblem } from '@/lib/nickname'

// Written as code points where the character is one a reader cannot be sure of by eye:
// a keycap and a flag are sequences, not single characters, and a test whose input is
// ambiguous on screen is a test nobody can check.
const FIRE = String.fromCodePoint(0x1f525)
const VARIATION_SELECTOR = String.fromCodePoint(0xfe0f)
const KEYCAP = String.fromCodePoint(0x20e3)
const REGIONAL_C = String.fromCodePoint(0x1f1e8)
const REGIONAL_Z = String.fromCodePoint(0x1f1ff)
const VICTORY_HAND = String.fromCodePoint(0x270c)

describe('nicknameProblem', () => {
  it('passes a plain name', () => {
    expect(nicknameProblem('ACE_9')).toBeNull()
  })

  it('passes a name with diacritics', () => {
    expect(nicknameProblem('Ján')).toBeNull()
  })

  it('ignores the whitespace around a name', () => {
    expect(nicknameProblem('  ACE_9  ')).toBeNull()
  })

  it('turns down a name that is only emoji', () => {
    expect(nicknameProblem(FIRE.repeat(3))).toBe('emoji')
  })

  it('turns down a name with one emoji in it', () => {
    expect(nicknameProblem(`ACE${FIRE}`)).toBe('emoji')
  })

  it('turns down a dingbat, which the keyboard offers from the same page', () => {
    expect(nicknameProblem(VICTORY_HAND.repeat(3))).toBe('emoji')
  })

  it('turns down a flag, which is two regional indicators rather than a character', () => {
    expect(nicknameProblem(`${REGIONAL_C}${REGIONAL_Z}`)).toBe('emoji')
  })

  it('turns down a keycap, whose digits would otherwise read as numbers', () => {
    expect(nicknameProblem(`1${VARIATION_SELECTOR}${KEYCAP}`)).toBe('emoji')
  })

  it('calls a name with no emoji in it the wrong shape, not an emoji', () => {
    expect(nicknameProblem('ace 9')).toBe('shape')
  })

  it('turns down a name shorter than three characters', () => {
    expect(nicknameProblem('ab')).toBe('shape')
  })

  it('turns down a name longer than sixteen characters', () => {
    expect(nicknameProblem('a'.repeat(17))).toBe('shape')
  })
})
