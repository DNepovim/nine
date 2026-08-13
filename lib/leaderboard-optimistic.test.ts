import { describe, expect, it } from 'vitest'

import type { LeaderboardRow } from './leaderboard'
import { withMyBest } from './leaderboard-optimistic'

// Fixed so a test can assert which candidate's timestamp the merged row carried.
const ACHIEVED_AT = '2026-08-13T10:00:00.000Z'
const NOW_ISO = '2026-08-13T12:00:00.000Z'

const row = (user_id: string, best_score: number, hits = 10): LeaderboardRow => ({
  rank: 0,
  user_id,
  nickname: user_id,
  best_score,
  hits,
  achieved_at: ACHIEVED_AT,
})

const board = [row('ace', 2140), row('bolt', 1980), row('cira', 1720)]

describe('withMyBest', () => {
  it('inserts the player when the board does not list them', () => {
    const out = withMyBest(board, null, 'me', 'ME', 1850, 12, NOW_ISO)
    expect(out.rows.map((r) => r.user_id)).toEqual(['ace', 'bolt', 'me', 'cira'])
    expect(out.myRank).toEqual({ rank: 3, total: 3, best_score: 1850, hits: 12 })
  })

  it('upgrades a row the player already occupies', () => {
    const listed = [row('ace', 2140), row('me', 1000, 5), row('cira', 900)]
    const out = withMyBest(listed, null, 'me', 'ME', 2500, 20, NOW_ISO)
    expect(out.rows.map((r) => [r.user_id, r.best_score])).toEqual([
      ['me', 2500],
      ['ace', 2140],
      ['cira', 900],
    ])
    expect(out.myRank.best_score).toBe(2500)
    expect(out.myRank.hits).toBe(20)
  })

  it('keeps the listed row when it already beats the local score', () => {
    const listed = [row('ace', 2140), row('me', 1800, 7)]
    const out = withMyBest(listed, null, 'me', 'ME', 900, 3, NOW_ISO)
    expect(out.rows.map((r) => [r.user_id, r.best_score])).toEqual([
      ['ace', 2140],
      ['me', 1800],
    ])
    expect(out.myRank.hits).toBe(7)
  })

  it('prefers the server rank when it beats both the row and the local score', () => {
    const out = withMyBest(
      board,
      { rank: 9, total: 40, best_score: 5000, hits: 44 },
      'me',
      'ME',
      100,
      1,
      NOW_ISO,
    )
    expect(out.myRank.best_score).toBe(5000)
    expect(out.myRank.hits).toBe(44)
    expect(out.rows[0]?.user_id).toBe('me')
  })

  it('never shrinks the reported total', () => {
    const out = withMyBest(
      board,
      { rank: 30, total: 500, best_score: 10, hits: 1 },
      'me',
      'ME',
      1850,
      12,
      NOW_ISO,
    )
    expect(out.myRank.total).toBe(500)
  })

  it('gives a tie to the player already on the board', () => {
    const out = withMyBest(board, null, 'me', 'ME', 1980, 12, NOW_ISO)
    expect(out.rows.map((r) => r.user_id)).toEqual(['ace', 'bolt', 'me', 'cira'])
  })

  it('caps the board at five rows', () => {
    const long = [...board, row('dot', 1510), row('eko', 1330)]
    const out = withMyBest(long, null, 'me', 'ME', 9999, 30, NOW_ISO)
    expect(out.rows).toHaveLength(5)
    expect(out.rows.map((r) => r.user_id)).toEqual(['me', 'ace', 'bolt', 'cira', 'dot'])
  })

  it('drops the player from the rows when they miss the top five', () => {
    const long = [...board, row('dot', 1510), row('eko', 1330)]
    const out = withMyBest(long, null, 'me', 'ME', 5, 1, NOW_ISO)
    expect(out.rows.some((r) => r.user_id === 'me')).toBe(false)
    expect(out.myRank.rank).toBe(6)
  })

  it('re-ranks from one', () => {
    const out = withMyBest(board, null, 'me', 'ME', 1850, 12, NOW_ISO)
    expect(out.rows.map((r) => r.rank)).toEqual([1, 2, 3, 4])
  })
})
