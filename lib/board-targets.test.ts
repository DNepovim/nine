import { describe, expect, it } from 'vitest'

import type { PeriodBoard } from '@/hooks/use-board'

import { boardTargetsOf } from './board-targets'

const period = (over: Partial<PeriodBoard>): PeriodBoard => ({
  rows: [],
  myRank: null,
  loading: false,
  error: null,
  record: null,
  recordIsMine: false,
  recordHolder: null,
  empty: false,
  myBest: 0,
  unpublished: null,
  ...over,
})

describe('boardTargetsOf', () => {
  it('measures an ordinary run against the higher of the record and the player’s best', () => {
    const board = {
      today: period({ record: 300, myBest: 500 }),
      week: period({ record: 800, myBest: 500 }),
      forever: period({ record: 1200, myBest: 500 }),
    }
    expect(boardTargetsOf(null, 450, board)).toEqual({
      storedBest: 450,
      todayBest: 500,
      weekBest: 800,
      everBest: 1200,
      todayEmpty: false,
      weekEmpty: false,
    })
  })

  it('has no bar on a board nobody has scored on, and says it is there to open', () => {
    const empty = period({ empty: true })
    const targets = boardTargetsOf(null, 0, { today: empty, week: empty, forever: empty })
    expect(targets.todayBest).toBeNull()
    expect(targets.todayEmpty).toBe(true)
    expect(targets.weekEmpty).toBe(true)
  })

  it('measures a session run against nothing at all', () => {
    const board = {
      today: period({ record: 300, empty: true }),
      week: period({ record: 800 }),
      forever: period({ record: 1200 }),
    }
    expect(boardTargetsOf('session-1', 450, board)).toEqual({
      storedBest: 0,
      todayBest: null,
      weekBest: null,
      everBest: null,
      todayEmpty: false,
      weekEmpty: false,
    })
  })
})
