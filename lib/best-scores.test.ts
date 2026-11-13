import { describe, expect, it } from 'vitest'

import { SPECTRUM } from '@/constants/colors'
import { challengeId, gradientOf } from '@/modes'
import { challengeInk } from '@/modes/challenges/palette'

import { cellColor, keysFor, type SessionBests } from './best-scores'

const SESSION: SessionBests = {
  measure: 'score',
  best: 900,
  holder: null,
  mine: false,
  myBest: 400,
  last: null,
  closesAt: 0,
}

describe('keysFor', () => {
  it('draws all four of a board’s cells online, and only the player’s own offline', () => {
    expect(keysFor(null, true)).toEqual(['you', 'today', 'week', 'ever'])
    expect(keysFor(null, false)).toEqual(['you'])
  })

  it('draws a session’s two cells whether or not the device is online', () => {
    expect(keysFor(SESSION, true)).toEqual(['you', 'session'])
    expect(keysFor(SESSION, false)).toEqual(['you', 'session'])
  })

  it('adds the last airing’s winner where the challenge has had one', () => {
    const last = {
      holder: { userId: 'u', nickname: 'EVA', avgAccuracy: null, avgSpeed: null },
      value: 1,
      mine: false,
    }
    expect(keysFor({ ...SESSION, last }, true)).toEqual(['you', 'session', 'last'])
  })
})

describe('cellColor', () => {
  it('walks the game spectrum across a board’s cells', () => {
    expect(cellColor('you', 'accuracy')).toBe(SPECTRUM[0])
    expect(cellColor('ever', 'accuracy')).toBe(SPECTRUM[3])
  })

  it('paints a challenge’s session and last cells in its own ink', () => {
    const mode = challengeId('drift')
    const ink = challengeInk(gradientOf(mode)[1])
    expect(cellColor('session', mode)).toBe(ink)
    expect(cellColor('last', mode)).toBe(ink)
    expect(cellColor('you', mode)).toBe(SPECTRUM[0])
  })
})
