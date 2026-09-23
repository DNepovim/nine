import { describe, expect, it } from 'vitest'

import { MOTTO_MAX, mottoLength, normalizeMotto } from '@/lib/motto'

// Written as code points rather than pasted in: every character these tests are about is
// invisible, and a test whose input nobody can see is a test nobody can check.
const BELL = String.fromCodePoint(0x0007)
const ZERO_WIDTH_SPACE = String.fromCodePoint(0x200b)
const RIGHT_TO_LEFT_OVERRIDE = String.fromCodePoint(0x202e)
const ZERO_WIDTH_JOINER = String.fromCodePoint(0x200d)
const MAN = String.fromCodePoint(0x1f468)
const ROCKET = String.fromCodePoint(0x1f680)
const TARGET = String.fromCodePoint(0x1f3af)

describe('normalizeMotto', () => {
  it('trims the whitespace around it', () => {
    expect(normalizeMotto('  nine lives  ')).toBe('nine lives')
  })

  it('collapses a run of spaces into one', () => {
    expect(normalizeMotto('nine     lives')).toBe('nine lives')
  })

  it('turns a newline into a space', () => {
    expect(normalizeMotto('nine\nlives')).toBe('nine lives')
  })

  it('turns a tab into a space', () => {
    expect(normalizeMotto('nine\tlives')).toBe('nine lives')
  })

  it('drops a control character without leaving a gap', () => {
    expect(normalizeMotto(`nine${BELL}lives`)).toBe('ninelives')
  })

  it('drops a zero-width space, which no font would have shown', () => {
    expect(normalizeMotto(`nine${ZERO_WIDTH_SPACE}lives`)).toBe('ninelives')
  })

  it('drops a right-to-left override, which would have reordered the line', () => {
    expect(normalizeMotto(`nine${RIGHT_TO_LEFT_OVERRIDE}lives`)).toBe('ninelives')
  })

  it('keeps a zero-width joiner, which holds an emoji sequence together', () => {
    const sequence = `${MAN}${ZERO_WIDTH_JOINER}${ROCKET}`
    expect(normalizeMotto(sequence)).toBe(sequence)
  })

  it('returns an empty string for whitespace alone', () => {
    expect(normalizeMotto('   \n  ')).toBe('')
  })

  it('leaves an already clean line untouched', () => {
    expect(normalizeMotto('I dial faster than I think')).toBe(
      'I dial faster than I think',
    )
  })
})

describe('mottoLength', () => {
  it('counts plain characters', () => {
    expect(mottoLength('nine')).toBe(4)
  })

  it('counts an emoji as one character, the way the database does', () => {
    expect(mottoLength(TARGET)).toBe(1)
  })

  it('counts nothing as nothing', () => {
    expect(mottoLength('')).toBe(0)
  })
})

describe('MOTTO_MAX', () => {
  it('matches the ceiling the database constraint enforces', () => {
    expect(MOTTO_MAX).toBe(50)
  })
})
