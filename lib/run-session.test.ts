import { describe, expect, it } from 'vitest'

import type { PeriodBoard } from '@/hooks/use-board'
import type { LeaderboardRow } from '@/lib/leaderboard'
import type { PreviousWinner } from '@/lib/session-board'

import {
  runSessionMedalsOf,
  savedSessionOf,
  sessionBestsOf,
  sessionClockOf,
  sessionRunOf,
  sessionTargetsFor,
} from './run-session'

const row = (over: Partial<LeaderboardRow>): LeaderboardRow => ({
  rank: 1,
  user_id: 'u1',
  nickname: 'ADA',
  best_score: 0,
  hits: 0,
  achieved_at: '2026-11-14T12:00:00Z',
  avg_acc: null,
  avg_spd: null,
  ...over,
})

const HOLDER = { userId: 'u1', nickname: 'ADA', avgAccuracy: null, avgSpeed: null }

const board = (over: Partial<PeriodBoard>): PeriodBoard => ({
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

const winner = (over: Partial<PreviousWinner>): PreviousWinner => ({
  userId: 'u3',
  nickname: 'EVA',
  score: 900,
  timeMs: null,
  hits: 12,
  avgAccuracy: null,
  avgSpeed: null,
  ...over,
})

const CLOSES = 1_800_000_000_000

describe('sessionBestsOf', () => {
  it('is null for an ordinary run, and until both halves of a session are in hand', () => {
    const held = board({})
    expect(sessionBestsOf(null, CLOSES, held, 'score', 'u1', null)).toBeNull()
    expect(sessionBestsOf('s', null, held, 'score', 'u1', null)).toBeNull()
    expect(sessionBestsOf('s', CLOSES, null, 'score', 'u1', null)).toBeNull()
  })

  it('reads a score session off the board’s own record and best', () => {
    const held = board({
      record: 700,
      recordHolder: HOLDER,
      recordIsMine: true,
      myBest: 700,
    })
    expect(sessionBestsOf('s', CLOSES, held, 'score', 'u1', null)).toEqual({
      measure: 'score',
      best: 700,
      holder: HOLDER,
      mine: true,
      myBest: 700,
      last: null,
      closesAt: CLOSES,
    })
  })

  it('reads a race off the times of the top row and the player’s own', () => {
    const held = board({
      rows: [
        row({ user_id: 'u2', time_ms: 41_000 }),
        row({ rank: 2, user_id: 'u1', time_ms: 52_000 }),
      ],
    })
    const bests = sessionBestsOf('s', CLOSES, held, 'time', 'u1', null)
    expect(bests?.best).toBe(41_000)
    expect(bests?.myBest).toBe(52_000)
  })

  it('reads a hits session off the hits', () => {
    const held = board({ rows: [row({ user_id: 'u2', hits: 30 })] })
    const bests = sessionBestsOf('s', CLOSES, held, 'hits', 'u1', null)
    expect(bests?.best).toBe(30)
    expect(bests?.myBest).toBe(0)
  })

  it('names the last airing’s winner by the session’s measure', () => {
    const last = sessionBestsOf('s', CLOSES, board({}), 'score', 'u3', winner({}))?.last
    expect(last).toEqual({ holder: winner({}), value: 900, mine: true })
  })

  it('leaves out a race winner with no time rather than drawing one', () => {
    const bests = sessionBestsOf('s', CLOSES, board({}), 'time', 'u1', winner({}))
    expect(bests?.last).toBeNull()
  })
})

describe('sessionClockOf', () => {
  it('is the close time on a session run and nothing on an ordinary one', () => {
    expect(sessionClockOf('s', CLOSES)).toBe(CLOSES)
    expect(sessionClockOf(null, CLOSES)).toBeNull()
  })
})

describe('savedSessionOf', () => {
  it('keeps both halves or neither', () => {
    expect(savedSessionOf('s', CLOSES)).toEqual({ id: 's', closesAt: CLOSES })
    expect(savedSessionOf('s', null)).toBeNull()
    expect(savedSessionOf(null, CLOSES)).toBeNull()
  })
})

describe('sessionRunOf', () => {
  const figures = { score: 10, hits: 1, timeMs: null }

  it('is null until the session’s targets are in hand', () => {
    expect(sessionRunOf(null, figures, 'u1')).toBeNull()
  })
})

describe('runSessionMedalsOf', () => {
  it('is empty for a run with no session', () => {
    const held = board({ rows: [row({ best_score: 10 })] })
    expect(
      runSessionMedalsOf(
        null,
        held,
        { score: 500, hits: 5, timeMs: null },
        'score',
        'u1',
      ),
    ).toEqual([])
  })
})

describe('sessionTargetsFor', () => {
  it('waits on an ordinary run, and on a session board whose read failed', () => {
    expect(sessionTargetsFor(null, board({}), 'score', 'u1', [])).toBeNull()
    expect(
      sessionTargetsFor('s', board({ error: 'offline' }), 'score', 'u1', []),
    ).toBeNull()
    expect(sessionTargetsFor('s', null, 'score', 'u1', [])).toBeNull()
  })

  it('has targets once a session board has been read', () => {
    expect(
      sessionTargetsFor('s', board({ empty: true }), 'score', 'u1', []),
    ).not.toBeNull()
  })
})
