import { describe, expect, it } from 'vitest'

import type { LeaderboardRow } from './leaderboard'
import { displayRows } from './leaderboard-rows'

const ACHIEVED_AT = '2026-08-13T10:00:00.000Z'

const row = (nickname: string, best_score: number): LeaderboardRow => ({
  rank: 0,
  user_id: nickname,
  nickname,
  best_score,
  hits: 1,
  achieved_at: ACHIEVED_AT,
})

const board = [row('ACE', 2140), row('BOLT', 1980), row('CIRA', 1720)]

describe('displayRows', () => {
  it('ranks the server rows from one when there is nothing local', () => {
    const out = displayRows(board, null, null)
    expect(out.map((r) => [r.rank, r.nickname])).toEqual([
      [1, 'ACE'],
      [2, 'BOLT'],
      [3, 'CIRA'],
    ])
  })

  it('caps the board at five rows', () => {
    const long = [...board, row('DOT', 1510), row('EKO', 1330), row('FIG', 1200)]
    expect(displayRows(long, null, null)).toHaveLength(5)
  })

  it('slots the unpublished score in by value', () => {
    // 1850 sits between BOLT's 1980 and CIRA's 1720.
    const out = displayRows(board, null, { score: 1850, label: 'YOU' })
    expect(out.map((r) => r.nickname)).toEqual(['ACE', 'BOLT', 'YOU', 'CIRA'])
    expect(out[2]?.rank).toBe(3)
  })

  it('ranks the unpublished score first when it beats the board', () => {
    const out = displayRows(board, null, { score: 9999, label: 'YOU' })
    expect(out.map((r) => r.nickname)).toEqual(['YOU', 'ACE', 'BOLT', 'CIRA'])
    expect(out[0]?.rank).toBe(1)
  })

  it('marks only the unpublished row', () => {
    const out = displayRows(board, null, { score: 1850, label: 'YOU' })
    expect(out.filter((r) => r.unpublished).map((r) => r.nickname)).toEqual(['YOU'])
  })

  it('gives a tie to the published score', () => {
    const out = displayRows(board, null, { score: 1980, label: 'YOU' })
    expect(out.map((r) => r.nickname)).toEqual(['ACE', 'BOLT', 'YOU', 'CIRA'])
  })

  it('shows the unpublished score alone on an empty board', () => {
    const out = displayRows([], null, { score: 500, label: 'YOU' })
    expect(out).toEqual([
      {
        key: 'unpublished',
        rank: 1,
        nickname: 'YOU',
        score: 500,
        isUser: true,
        unpublished: true,
        // No board timestamp: the score has never reached the board.
        achievedAt: null,
      },
    ])
  })

  it('drops the unpublished score when it does not make the top five', () => {
    const long = [...board, row('DOT', 1510), row('EKO', 1330)]
    const out = displayRows(long, null, { score: 10, label: 'YOU' })
    expect(out.some((r) => r.unpublished)).toBe(false)
  })

  it('flags the signed-in player among the server rows', () => {
    const out = displayRows(board, 'BOLT', null)
    expect(out.filter((r) => r.isUser).map((r) => r.nickname)).toEqual(['BOLT'])
  })
})
