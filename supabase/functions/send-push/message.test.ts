import { describe, expect, it } from 'vitest'

import { takeoverMessage } from './message'

const taken = { mode: 'accuracy', difficulty: 'hard', byNickname: 'ŽLUŤOUČEK' }

describe('takeoverMessage', () => {
  it('speaks English to an English subscriber', () => {
    expect(takeoverMessage('en', taken).body).toBe(
      'ŽLUŤOUČEK took your record — ACCURACY, HARD.',
    )
  })

  it('speaks Czech to a Czech one', () => {
    const message = takeoverMessage('cs', {
      ...taken,
      mode: 'speed',
      difficulty: 'extreme',
    })
    expect(message.title).toBe('Rekord je pryč')
    expect(message.body).toBe('ŽLUŤOUČEK ti vzal rekord — RYCHLOST, EXTRÉMNÍ.')
  })

  it('keeps a ten-character nickname whole', () => {
    const nick = 'WWWWWWWWWW'
    expect(takeoverMessage('en', { ...taken, byNickname: nick }).body).toContain(nick)
  })

  it('tags by board so a second takeover replaces the first', () => {
    expect(takeoverMessage('en', taken).tag).toBe('takeover-accuracy-hard')
  })

  it('shows a board it has no word for as it came', () => {
    expect(takeoverMessage('en', { ...taken, mode: 'blitz' }).body).toContain('BLITZ')
  })
})
