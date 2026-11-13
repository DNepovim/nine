import { describe, expect, it } from 'vitest'

import type { LeaderboardRow } from '@/lib/leaderboard'
import type { LocalScore } from '@/lib/local-scores'

import {
  abandonedBest,
  announcementsReady,
  crossedSession,
  deviceBestOf,
  leadKept,
  ownRowOf,
  sessionRivalChange,
  sessionTargetsOf,
  type SessionLeader,
  type SessionTargets,
} from './session-announcements'

const ME = 'me'
const RIVAL = 'rival'

const run = (score: number, hits = 0, timeMs: number | null = null) => ({
  score,
  hits,
  timeMs,
})
const leader = (
  userId: string,
  score: number,
  hits = 0,
  timeMs: number | null = null,
): SessionLeader => ({ ...run(score, hits, timeMs), userId, nickname: userId })

const targets = (over: Partial<SessionTargets>): SessionTargets => ({
  measure: 'score',
  mine: null,
  leader: null,
  empty: false,
  ...over,
})

describe('crossedSession on a score session', () => {
  it('takes the lead and its own best on one hit, the lead first', () => {
    const t = targets({ mine: run(100), leader: leader(RIVAL, 200) })
    expect(crossedSession(run(250), t, ME)).toEqual(['sessionFirst', 'sessionBest'])
  })

  it('passes only its own best below the leader', () => {
    const t = targets({ mine: run(100), leader: leader(RIVAL, 200) })
    expect(crossedSession(run(150), t, ME)).toEqual(['sessionBest'])
  })

  it('says nothing on an equal figure', () => {
    const t = targets({ mine: run(200), leader: leader(RIVAL, 200) })
    expect(crossedSession(run(200), t, ME)).toEqual([])
  })

  it('never takes the lead from the player themselves', () => {
    const t = targets({ mine: run(200), leader: leader(ME, 200) })
    expect(crossedSession(run(300), t, ME)).toEqual(['sessionBest'])
  })
})

describe("crossedSession against the player's own row", () => {
  it('does not take a lead again from a leader the device best already passed', () => {
    const stale = targets({ mine: run(300), leader: leader(RIVAL, 200) })
    expect(crossedSession(run(250), stale, ME)).toEqual([])
    expect(crossedSession(run(350), stale, ME)).toEqual(['sessionBest'])
  })

  it('does not open again a session reading empty under a held best', () => {
    const invisible = targets({ mine: run(100), empty: true })
    expect(crossedSession(run(50), invisible, ME)).toEqual([])
    expect(crossedSession(run(150), invisible, ME)).toEqual(['sessionBest'])
  })
})

describe('crossedSession on a hits session', () => {
  it('leads on more hits even with a lower score', () => {
    const t = targets({ measure: 'hits', leader: leader(RIVAL, 900, 5) })
    expect(crossedSession(run(400, 6), t, ME)).toEqual(['sessionFirst'])
  })

  it('lets the score decide between equal hits', () => {
    const t = targets({ measure: 'hits', leader: leader(RIVAL, 500, 5) })
    expect(crossedSession(run(400, 5), t, ME)).toEqual([])
    expect(crossedSession(run(600, 5), t, ME)).toEqual(['sessionFirst'])
  })
})

describe('crossedSession on a time session', () => {
  it('says nothing of its own, whatever the run', () => {
    const t = targets({
      measure: 'time',
      mine: run(100, 9, 60_000),
      leader: leader(RIVAL, 100, 9, 50_000),
    })
    expect(crossedSession(run(500, 9, 10_000), t, ME)).toEqual([])
    expect(crossedSession(run(0), targets({ measure: 'time', empty: true }), ME)).toEqual(
      [],
    )
  })
})

describe('crossedSession on an empty session', () => {
  it('opens it once the measure figure is above zero', () => {
    const empty = targets({ empty: true })
    expect(crossedSession(run(0), empty, ME)).toEqual([])
    expect(crossedSession(run(10), empty, ME)).toEqual(['sessionFirst'])
  })

  it('opens a hits session on a hit, not a score', () => {
    const empty = targets({ measure: 'hits', empty: true })
    expect(crossedSession(run(10, 0), empty, ME)).toEqual([])
    expect(crossedSession(run(0, 1), empty, ME)).toEqual(['sessionFirst'])
  })

  it('opens nothing on a board it failed to read', () => {
    expect(crossedSession(run(10), targets({ empty: false }), ME)).toEqual([])
  })
})

describe('ownRowOf', () => {
  it('keeps a device best above a stale board row', () => {
    expect(ownRowOf('score', run(100), run(300))).toEqual(run(300))
    const t = targets({ mine: ownRowOf('score', run(100), run(300)) })
    expect(crossedSession(run(200), t, ME)).toEqual([])
  })

  it('falls back to whichever side has one', () => {
    expect(ownRowOf('score', null, run(5))).toEqual(run(5))
    expect(ownRowOf('score', run(5), null)).toEqual(run(5))
    expect(ownRowOf('score', null, null)).toBeNull()
  })
})

describe('abandonedBest', () => {
  it('takes the better of the row held and how far the run got', () => {
    expect(abandonedBest('score', run(145), run(312))).toEqual(run(312))
    expect(abandonedBest('score', run(500), run(312))).toEqual(run(500))
    expect(abandonedBest('score', null, run(312))).toEqual(run(312))
  })

  it('takes nothing from a run with no figure on the measure', () => {
    expect(abandonedBest('score', run(145), run(0))).toEqual(run(145))
    expect(abandonedBest('score', null, run(0))).toBeNull()
    expect(abandonedBest('hits', null, run(50, 0))).toBeNull()
    expect(abandonedBest('time', null, run(500, 9))).toBeNull()
  })

  it('takes nothing when the run reported nothing', () => {
    expect(abandonedBest('score', run(145), null)).toEqual(run(145))
  })
})

describe('deviceBestOf', () => {
  const entry = (sessionId: string | undefined, score: number, hits = 0): LocalScore => ({
    mode: 'accuracy',
    difficulty: 'easy',
    day: '2026-11-03',
    score,
    hits,
    achievedAt: '2026-11-03T12:00:00Z',
    status: 'published',
    attempts: 0,
    sessionId,
  })

  it('reads only the session asked for, by its measure', () => {
    const store = [
      entry('s1', 100, 9),
      entry('s1', 300, 2),
      entry(undefined, 999),
      entry('s2', 500),
    ]
    expect(deviceBestOf(store, 's1', 'score')?.score).toBe(300)
    expect(deviceBestOf(store, 's1', 'hits')?.score).toBe(100)
    expect(deviceBestOf(store, 's3', 'score')).toBeNull()
  })
})

describe('sessionTargetsOf', () => {
  const row = (user_id: string, best_score: number): LeaderboardRow => ({
    rank: 1,
    user_id,
    nickname: user_id,
    best_score,
    hits: 0,
    achieved_at: '2026-11-03T12:00:00Z',
    avg_acc: null,
    avg_spd: null,
  })

  it('takes row one as the leader and finds the player by id', () => {
    const t = sessionTargetsOf({
      measure: 'score',
      rows: [row(RIVAL, 200), row(ME, 100)],
      empty: false,
      userId: ME,
      device: null,
    })
    expect(t.leader?.userId).toBe(RIVAL)
    expect(t.mine?.score).toBe(100)
  })
})

describe('leadKept', () => {
  const was = leader(ME, 100)

  it('holds while the live run is still ahead of the rival who passed its row', () => {
    expect(leadKept(was, leader(RIVAL, 200), ME, 'score', run(500))).toBe(true)
  })

  it('lets go once the rival passes the run, or draws level with it', () => {
    expect(leadKept(was, leader(RIVAL, 600), ME, 'score', run(500))).toBe(false)
    expect(leadKept(was, leader(RIVAL, 500), ME, 'score', run(500))).toBe(false)
  })

  it('asks by the measure', () => {
    expect(leadKept(was, leader(RIVAL, 900, 5), ME, 'hits', run(100, 6))).toBe(true)
    expect(leadKept(was, leader(RIVAL, 100, 6), ME, 'hits', run(900, 5))).toBe(false)
  })

  it('gives a live race up to a finished rival, having no time of its own yet', () => {
    expect(leadKept(was, leader(RIVAL, 100, 9, 50_000), ME, 'time', run(900, 9))).toBe(
      false,
    )
  })

  it("has nothing to keep unless the lead was the player's and has left", () => {
    expect(leadKept(leader('x', 1), leader(RIVAL, 2), ME, 'score', run(500))).toBe(false)
    expect(leadKept(was, leader(ME, 200), ME, 'score', run(500))).toBe(false)
    expect(leadKept(null, leader(RIVAL, 2), ME, 'score', run(500))).toBe(false)
    expect(leadKept(was, null, ME, 'score', run(500))).toBe(false)
    expect(leadKept(was, leader(RIVAL, 2), null, 'score', run(500))).toBe(false)
  })
})

describe('sessionRivalChange', () => {
  it('says the lead was taken when it passes from the player to someone else', () => {
    expect(sessionRivalChange(leader(ME, 100), leader(RIVAL, 200), ME)).toEqual({
      id: 'sessionLost',
      name: 'RIVAL',
    })
  })

  it('stays quiet when the player was not leading', () => {
    expect(sessionRivalChange(leader('x', 100), leader(RIVAL, 200), ME)).toBeNull()
  })

  it('stays quiet when the player still leads, or takes it', () => {
    expect(sessionRivalChange(leader(ME, 100), leader(ME, 200), ME)).toBeNull()
    expect(sessionRivalChange(leader(RIVAL, 100), leader(ME, 200), ME)).toBeNull()
  })

  it('stays quiet with no baseline', () => {
    expect(sessionRivalChange(null, leader(RIVAL, 200), ME)).toBeNull()
    expect(sessionRivalChange(leader(ME, 100), leader(RIVAL, 200), null)).toBeNull()
  })
})

describe('announcementsReady', () => {
  const targets = sessionTargetsOf({
    measure: 'score',
    rows: [],
    empty: true,
    userId: 'u1',
    device: null,
  })

  it('waits on an ordinary run for its board and the connection', () => {
    expect(announcementsReady(null, true, null, true)).toBe(true)
    expect(announcementsReady(null, false, null, true)).toBe(false)
    expect(announcementsReady(null, true, null, false)).toBe(false)
  })

  it('waits on a session run for the session board, not the mode’s', () => {
    expect(announcementsReady('s', true, null, true)).toBe(false)
    expect(announcementsReady('s', false, targets, true)).toBe(true)
    expect(announcementsReady('s', false, targets, false)).toBe(false)
  })
})
