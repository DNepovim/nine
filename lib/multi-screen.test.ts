import { describe, expect, it } from 'vitest'

import { multiScreenOf } from '@/lib/multi-screen'

describe('multiScreenOf', () => {
  it('is the screen of the room its phase names', () => {
    expect(multiScreenOf(true, 'waiting')).toEqual({
      waiting: true,
      playing: false,
      results: false,
      active: true,
    })
    expect(multiScreenOf(true, 'playing').playing).toBe(true)
    expect(multiScreenOf(true, 'results').results).toBe(true)
  })

  it('is none of them for a player in no room, whatever phase is left over', () => {
    expect(multiScreenOf(false, 'playing')).toEqual({
      waiting: false,
      playing: false,
      results: false,
      active: false,
    })
  })
})
