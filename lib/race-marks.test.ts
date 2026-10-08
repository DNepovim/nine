import { describe, expect, it } from 'vitest'

import { raceMarks } from './race-marks'

describe('raceMarks', () => {
  it('draws the same pair of animals from either side of a rout', () => {
    const mine = raceMarks('routMine')
    const theirs = raceMarks('routTheirs')
    expect(mine.mine).toBe(theirs.theirs)
    expect(mine.theirs).toBe(theirs.mine)
  })

  it('draws the same pair of animals from either side of a clear lead', () => {
    const mine = raceMarks('clearMine')
    const theirs = raceMarks('clearTheirs')
    expect(mine.mine).toBe(theirs.theirs)
    expect(mine.theirs).toBe(theirs.mine)
  })

  it('tells a rout apart from a clear lead', () => {
    expect(raceMarks('routMine').mine).not.toBe(raceMarks('clearMine').mine)
    expect(raceMarks('routMine').theirs).not.toBe(raceMarks('clearMine').theirs)
  })

  // At a row apart neither player is the slow one, so neither is drawn as one — but they
  // are still two players, and one glyph over both names says nothing about either.
  it('gives the two sides different animals when the table is close', () => {
    const close = raceMarks('closeMine')
    expect(close.mine).not.toBe(close.theirs)
    expect(raceMarks('closeTheirs')).toEqual(close)
    expect(raceMarks('even')).toEqual(close)
  })

  // The pair has to be two animals of the one standing, which is checkable as this: neither
  // of them is an animal the card uses to mean a lead, in either direction.
  it('draws neither side of a close table as a leader or a laggard', () => {
    const close = raceMarks('closeMine')
    const decided = [raceMarks('routMine'), raceMarks('clearMine')].flatMap((pair) => [
      pair.mine,
      pair.theirs,
    ])
    expect(decided).not.toContain(close.mine)
    expect(decided).not.toContain(close.theirs)
  })

  it('draws nothing at all when neither player has started', () => {
    expect(raceMarks('unplayed')).toEqual({ mine: null, theirs: null })
  })
})
