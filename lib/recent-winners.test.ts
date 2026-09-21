import { describe, expect, it } from 'vitest'

import { winnerLines } from './recent-winners'

const ADA = { userId: 'ada', nickname: 'ADA' }
const GRACE = { userId: 'grace', nickname: 'GRACE' }

describe('winnerLines', () => {
  it('says nothing when neither window has a winner', () => {
    expect(winnerLines({ yesterday: null, lastWeek: null })).toEqual([])
  })

  it('shows yesterday alone when last week has no winner', () => {
    expect(winnerLines({ yesterday: ADA, lastWeek: null })).toEqual([
      { window: 'yesterday', winner: ADA },
    ])
  })

  it('shows last week alone when yesterday has no winner', () => {
    expect(winnerLines({ yesterday: null, lastWeek: GRACE })).toEqual([
      { window: 'lastWeek', winner: GRACE },
    ])
  })

  it('cycles both windows when different players won them, yesterday first', () => {
    expect(winnerLines({ yesterday: ADA, lastWeek: GRACE })).toEqual([
      { window: 'yesterday', winner: ADA },
      { window: 'lastWeek', winner: GRACE },
    ])
  })

  it('collapses to one line when the same player won both', () => {
    expect(winnerLines({ yesterday: ADA, lastWeek: ADA })).toEqual([
      { window: 'both', winner: ADA },
    ])
  })

  it('takes the later nickname when a player renamed between the two windows', () => {
    const renamed = { userId: 'ada', nickname: 'ADA_LOVELACE' }
    expect(winnerLines({ yesterday: renamed, lastWeek: ADA })).toEqual([
      { window: 'both', winner: renamed },
    ])
  })
})
