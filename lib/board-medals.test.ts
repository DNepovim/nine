import { describe, expect, it } from 'vitest'

import { boardMedals, currentBoardMedals, runMedal } from './board-medals'

const theirs = (score: number) => ({ score, isMine: false })
const mine = (score: number) => ({ score, isMine: true })

describe('runMedal', () => {
  it('is gold when nothing on the board beats the run', () => {
    expect(runMedal(500, [theirs(400), theirs(300)])).toBe(1)
    expect(runMedal(500, [])).toBe(1)
  })

  it('counts the players standing above it', () => {
    expect(runMedal(500, [theirs(900), theirs(400)])).toBe(2)
    expect(runMedal(500, [theirs(900), theirs(800)])).toBe(3)
  })

  it('is nothing past the podium', () => {
    expect(runMedal(500, [theirs(900), theirs(800), theirs(700)])).toBeNull()
  })

  it('is nothing when the player’s own better run is what the board shows', () => {
    // Gold already held with 5000; a 4000 changes nothing and wins nothing.
    expect(runMedal(4000, [mine(5000)])).toBeNull()
    expect(runMedal(4000, [theirs(9000), mine(5000)])).toBeNull()
  })

  it('takes the medal when the run is the row the board now shows', () => {
    // The store folds the finished run in, so the player's own row is this score.
    expect(runMedal(5000, [mine(5000), theirs(4000)])).toBe(1)
    expect(runMedal(5000, [theirs(9000), mine(5000)])).toBe(2)
  })

  it('does not count a weaker row of the player’s own as someone ahead', () => {
    expect(runMedal(5000, [theirs(9000), mine(1000)])).toBe(2)
  })

  it('never medals a scoreless run, however empty the board', () => {
    expect(runMedal(0, [])).toBeNull()
  })
})

describe('boardMedals', () => {
  it('shows only the longest board when the metal is the same', () => {
    // Leading all time means leading the week and the day with the same score.
    expect(boardMedals({ ever: 1, week: 1, today: 1 })).toEqual([
      { period: 'ever', rank: 1 },
    ])
  })

  it('keeps every period when the metals differ', () => {
    expect(boardMedals({ ever: 3, week: 2, today: 1 })).toEqual([
      { period: 'ever', rank: 3 },
      { period: 'week', rank: 2 },
      { period: 'today', rank: 1 },
    ])
  })

  it('keeps a better day beside a weaker week', () => {
    expect(boardMedals({ ever: null, week: 3, today: 1 })).toEqual([
      { period: 'week', rank: 3 },
      { period: 'today', rank: 1 },
    ])
  })

  it('drops only the period that repeats the one above it', () => {
    // Third all time, first this week, first today: the day says nothing the week did
    // not already say.
    expect(boardMedals({ ever: 3, week: 1, today: 1 })).toEqual([
      { period: 'ever', rank: 3 },
      { period: 'week', rank: 1 },
    ])
  })

  it('skips a period with no medal at all', () => {
    expect(boardMedals({ ever: null, week: null, today: 2 })).toEqual([
      { period: 'today', rank: 2 },
    ])
  })

  it('has nothing to show for a player off every podium', () => {
    expect(boardMedals({ ever: null, week: null, today: null })).toEqual([])
  })
})

describe('currentBoardMedals', () => {
  const row = (best_score: number, user_id = 'rival') => ({ best_score, user_id })

  it('reads the same rank runMedal would, across all three periods at once', () => {
    const board = {
      forever: { rows: [row(900), row(800)] },
      week: { rows: [row(400)] },
      today: { rows: [] },
    }
    // Bronze all time, but gold this week and today — the day says nothing the week
    // did not already say, so it is dropped the same way `boardMedals` drops it.
    expect(currentBoardMedals(board, 500, 'me')).toEqual([
      { period: 'ever', rank: 3 },
      { period: 'week', rank: 1 },
    ])
  })

  it('marks the player’s own row so a run cannot beat itself', () => {
    const board = {
      forever: { rows: [row(500, 'me')] },
      week: { rows: [row(500, 'me')] },
      today: { rows: [row(500, 'me')] },
    }
    expect(currentBoardMedals(board, 500, 'me')).toEqual([{ period: 'ever', rank: 1 }])
  })

  it('has nothing to show for a player off every podium', () => {
    const board = {
      forever: { rows: [row(900), row(800), row(700)] },
      week: { rows: [row(900), row(800), row(700)] },
      today: { rows: [row(900), row(800), row(700)] },
    }
    expect(currentBoardMedals(board, 500, 'me')).toEqual([])
  })
})
