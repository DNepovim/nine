import { describe, expect, it } from 'vitest'

import { groupDigits } from '@/lib/group-digits'

import { sessionFigure } from './session-figure'

const run = { score: 12500, timeMs: 9400, hits: 14 }

describe('sessionFigure', () => {
  it('prints the score, grouped, on a score session', () => {
    expect(sessionFigure('score', run)).toBe(groupDigits(12500))
  })

  it('prints the clock on a race, and a dash where there is none', () => {
    expect(sessionFigure('time', run)).toBe('9.4″')
    expect(sessionFigure('time', { ...run, timeMs: null })).toBe('—')
  })

  it('prints the hits on a hits session, whatever the score', () => {
    expect(sessionFigure('hits', run)).toBe('14')
  })
})
