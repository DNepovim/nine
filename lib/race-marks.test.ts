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

  // At a row apart neither player is the slow one, so neither is drawn as one.
  it('gives both sides the same animal when the table is close', () => {
    const close = raceMarks('closeMine')
    expect(close.mine).toBe(close.theirs)
    expect(raceMarks('closeTheirs')).toEqual(close)
    expect(raceMarks('even')).toEqual(close)
  })

  it('draws nothing at all when neither player has started', () => {
    expect(raceMarks('unplayed')).toEqual({ mine: null, theirs: null })
  })
})
