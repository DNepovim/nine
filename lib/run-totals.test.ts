import { describe, expect, it } from 'vitest'

import {
  dropRuns,
  fromStored,
  pruneRunTotals,
  queueRun,
  runKindOf,
  sentKey,
  type PendingRun,
} from './run-totals'

const DAY = 24 * 60 * 60 * 1000
const NOW = Date.parse('2026-09-21T12:00:00.000Z')

const run = (runId: string, postedAt = '2026-09-21T11:00:00.000Z'): PendingRun => ({
  runId,
  sessionId: null,
  mode: 'accuracy',
  difficulty: 'hard',
  score: 1200,
  hits: 14,
  accSum: 11.2,
  spdSum: 6.4,
  elapsedMs: 96_000,
  final: true,
  postedAt,
})

// The same run played in a session: no mode, because the server reads it off the session.
const sessionRun = (runId: string, sessionId = 'session-1'): PendingRun => ({
  runId,
  sessionId,
  difficulty: 'hard',
  score: 90,
  hits: 6,
  accSum: 0,
  spdSum: 0,
  elapsedMs: 40_000,
  final: true,
  postedAt: '2026-09-21T11:00:00.000Z',
})

const agoDays = (days: number): string => new Date(NOW - days * DAY).toISOString()

describe('queueRun', () => {
  it('keeps every run, including one that beat nothing', () => {
    const store = queueRun(queueRun([], run('a')), { ...run('b'), score: 0, hits: 0 })
    expect(store.map((entry) => entry.runId)).toEqual(['a', 'b'])
  })

  it('keeps only the latest post of a run that posts twice', () => {
    const early = { ...run('a'), score: 400, final: false }
    const late = { ...run('a'), score: 1200, final: true }
    const store = queueRun(queueRun([run('older')], early), late)
    expect(store.map((entry) => entry.runId)).toEqual(['older', 'a'])
    expect(store.at(-1)).toEqual(late)
  })

  it("keeps a session run's session through a replace", () => {
    const early = { ...sessionRun('s'), score: 40, final: false }
    const late = sessionRun('s')
    const store = queueRun(queueRun([run('board')], early), late)
    expect(store.map((entry) => entry.sessionId)).toEqual([null, 'session-1'])
    expect(store.at(-1)?.score).toBe(90)
  })
})

describe('fromStored', () => {
  it('reads an entry an older build wrote as a board run', () => {
    // No `sessionId`, no `final`, no `postedAt`: exactly what a build before session runs
    // and before early posts left in the queue.
    const stored = {
      runId: 'old',
      mode: 'speed' as const,
      difficulty: 'easy' as const,
      score: 300,
      hits: 5,
      accSum: 4,
      spdSum: 3,
      endedAt: '2026-09-20T10:00:00.000Z',
    }
    expect(fromStored(stored)).toEqual({
      runId: 'old',
      sessionId: null,
      mode: 'speed',
      difficulty: 'easy',
      score: 300,
      hits: 5,
      accSum: 4,
      spdSum: 3,
      elapsedMs: 0,
      final: true,
      postedAt: '2026-09-20T10:00:00.000Z',
    })
  })

  it('reads a session run back as one, with no mode', () => {
    const read = fromStored(sessionRun('s'))
    expect(read.sessionId).toBe('session-1')
    expect(read).not.toHaveProperty('mode')
  })
})

describe('runKindOf', () => {
  it('posts a scored mode to its board, session or not', () => {
    const board = { sessionId: null, mode: 'speed', difficulty: 'hard' }
    expect(runKindOf('speed', 'hard', null)).toEqual(board)
    // A board first: a scored-mode run must never leave `player_totals` for a receipt
    // the server would file under the session's mode instead.
    expect(runKindOf('speed', 'hard', 'session-1')).toEqual(board)
  })

  it('posts a run in a session as a session run, with no mode', () => {
    expect(runKindOf('challenge/four-keys', 'easy', 'session-1')).toEqual({
      sessionId: 'session-1',
      difficulty: 'easy',
    })
  })

  it('counts a run with neither nowhere', () => {
    expect(runKindOf('trainee', 'easy', null)).toBeNull()
    // A challenge run put back from storage has lost its session.
    expect(runKindOf('challenge/four-keys', 'easy', null)).toBeNull()
  })
})

describe('dropRuns', () => {
  it('removes the posts that landed and leaves the rest', () => {
    const store = [run('a'), run('b'), run('c')]
    const landed = new Set([sentKey(run('b'))])
    expect(dropRuns(store, landed).map((entry) => entry.runId)).toEqual(['a', 'c'])
  })

  it('leaves the store alone when nothing landed', () => {
    const store = [run('a')]
    expect(dropRuns(store, new Set())).toEqual(store)
  })

  it('keeps a post that replaced the one that landed while it was in flight', () => {
    const sent = { ...run('a', agoDays(1)), score: 400, final: false }
    // The run carried on and posted again before the drain wrote the queue back. Same
    // run, later stamp — and the figures it is holding have not reached the server.
    const store = [{ ...run('a', agoDays(0)), score: 1200 }]
    expect(dropRuns(store, new Set([sentKey(sent)]))).toEqual(store)
  })
})

describe('pruneRunTotals', () => {
  it('keeps everything inside the bounds', () => {
    const store = [run('a', agoDays(1)), run('b', agoDays(29))]
    expect(pruneRunTotals(store, NOW)).toEqual(store)
  })

  it('drops runs past the age bound', () => {
    const store = [run('fresh', agoDays(2)), run('stale', agoDays(31))]
    expect(pruneRunTotals(store, NOW).map((entry) => entry.runId)).toEqual(['fresh'])
  })

  it('keeps the newest runs past the count bound', () => {
    const store = Array.from({ length: 205 }, (_, index) =>
      run(`run-${index}`, agoDays(index / 10)),
    )
    const pruned = pruneRunTotals(store, NOW)
    expect(pruned).toHaveLength(200)
    expect(pruned[0]?.runId).toBe('run-0')
    expect(pruned.some((entry) => entry.runId === 'run-204')).toBe(false)
  })
})
