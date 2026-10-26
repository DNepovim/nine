import { describe, expect, it } from 'vitest'

import { challengeId } from '@/modes'

import {
  bestFor,
  bestPending,
  markPublished,
  MAX_PUBLISH_ATTEMPTS,
  noteRefusal,
  pendingOf,
  pruneLocalScores,
  recordRun,
  type LocalScore,
} from './local-scores'

// A Wednesday, so its Monday-to-Sunday week has days either side of it.
const TODAY = '2026-08-12'

const run = (over: Partial<LocalScore> = {}) => ({
  mode: 'speed' as const,
  difficulty: 'hard' as const,
  day: TODAY,
  score: 1000,
  hits: 10,
  achievedAt: `${TODAY}T10:00:00.000Z`,
  ...over,
})

const entry = (over: Partial<LocalScore> = {}): LocalScore => ({
  ...run(),
  status: 'pending',
  attempts: 0,
  ...over,
})

const slot = { mode: 'speed' as const, difficulty: 'hard' as const, day: TODAY }

describe('recordRun', () => {
  it('records a run on an empty store, waiting to publish', () => {
    expect(recordRun([], run({ score: 700 }))).toEqual([
      entry({ score: 700, status: 'pending', attempts: 0 }),
    ])
  })

  it('keeps the higher score for the same board and day', () => {
    const store = recordRun([entry({ score: 700 })], run({ score: 900 }))
    expect(store).toEqual([entry({ score: 900 })])
  })

  it('returns the store unchanged when the run beats nothing', () => {
    const store = [entry({ score: 900 })]
    expect(recordRun(store, run({ score: 400 }))).toBe(store)
  })

  it('returns the store unchanged when the run only equals the best', () => {
    const store = [entry({ score: 900 })]
    expect(recordRun(store, run({ score: 900 }))).toBe(store)
  })

  // ── A session measured by hits ──
  //
  // NO SLIP: a run is as good as it was long, so more hits wins whatever it scored, and
  // two runs as long are told apart by the score. Asked of the mode's measure, since an
  // entry on a hits session carries no time to tell it from a score one.
  it('keeps the longer run on a hits session, whatever it scored', () => {
    const NO_SLIP = challengeId('no-slip')
    const on = (over: Partial<LocalScore>) =>
      run({ mode: NO_SLIP, sessionId: 's', ...over })
    const held = [
      { ...on({ score: 500, hits: 7 }), status: 'pending' as const, attempts: 0 },
    ]
    expect(recordRun(held, on({ score: 2000, hits: 5 }))).toBe(held)
    expect(recordRun(held, on({ score: 100, hits: 9 }))[0]?.hits).toBe(9)
    expect(recordRun(held, on({ score: 800, hits: 7 }))[0]?.score).toBe(800)
    expect(recordRun(held, on({ score: 400, hits: 7 }))).toBe(held)
  })

  // ── A session measured by the clock ──
  //
  // The device has to keep the better row by the same rule the server does, or a player
  // sees one best on their own phone and another on the standings. The rule: if both
  // runs carry a time, the faster wins; otherwise the higher score does. Asked of the
  // slot's measure, so these are HABIT runs: a time on any other mode means nothing.
  const SESSION = 'a-session-id'
  const RACE = { mode: challengeId('habit'), sessionId: SESSION }
  const timed = (score: number, timeMs: number) => run({ ...RACE, score, timeMs })
  const timedEntry = (score: number, timeMs: number) => entry({ ...RACE, score, timeMs })

  it('keeps the faster run on a timed slot even when it scored less', () => {
    // The case the shared no-downgrade rule got wrong: a better run, refused for
    // scoring less, with nothing anywhere saying why.
    const store = recordRun([timedEntry(900, 14000)], timed(400, 11000))
    expect(store).toEqual([timedEntry(400, 11000)])
  })

  it('refuses a slower run on a timed slot however well it scored', () => {
    const store = [timedEntry(400, 11000)]
    expect(recordRun(store, timed(9000, 20000))).toBe(store)
  })

  it('refuses a run that only equals the held time', () => {
    const store = [timedEntry(400, 11000)]
    expect(recordRun(store, timed(9000, 11000))).toBe(store)
  })

  it('lets a finished run replace a quicker one that was left part-way', () => {
    // One hit and END RUN stood at 3.1″ and refused every run that went the distance.
    const quit = entry({ ...RACE, score: 75, hits: 1, timeMs: 3100 })
    const finished = run({ ...RACE, score: 6200, hits: 9, timeMs: 8500 })
    expect(recordRun([quit], finished)).toEqual([entry(finished)])
  })

  it('refuses a quicker run that went less far', () => {
    const store = [entry({ ...RACE, score: 6200, hits: 9, timeMs: 8500 })]
    const quit = run({ ...RACE, score: 75, hits: 1, timeMs: 3100 })
    expect(recordRun(store, quit)).toBe(store)
  })

  it('lets a timed run replace an untimed entry whatever it scored', () => {
    // An older build's mid-run post left a score and no time; the finish that followed
    // scored less and was never sent.
    const store = recordRun([entry({ ...RACE, score: 6500 })], timed(6200, 8500))
    expect(store).toEqual([timedEntry(6200, 8500)])
  })

  it('never lets an untimed run replace a timed entry', () => {
    const store = [timedEntry(6200, 8500)]
    expect(recordRun(store, run({ ...RACE, score: 9000 }))).toBe(store)
  })

  it('leaves a board run judged by its score alone', () => {
    // No session and no time, which is every board run ever played. The timed rule must
    // not reach them.
    expect(recordRun([entry({ score: 900 })], run({ score: 400 }))).toEqual([
      entry({ score: 900 }),
    ])
  })

  it('reopens a published slot when the run beats it', () => {
    // The server holds the old number and has not been told about this one.
    const store = recordRun(
      [entry({ score: 700, status: 'published' })],
      run({ score: 900 }),
    )
    expect(store).toEqual([entry({ score: 900, status: 'pending' })])
  })

  it('keeps another day on the same board separate', () => {
    const store = recordRun(
      [entry({ day: '2026-08-11', score: 500 })],
      run({ score: 800 }),
    )
    expect(store).toHaveLength(2)
  })

  it('keeps the same day on another board separate', () => {
    const store = recordRun([entry({ score: 900 })], run({ difficulty: 'easy' }))
    expect(store).toHaveLength(2)
  })
})

describe('pendingOf', () => {
  it('is the publish queue', () => {
    const store = [
      entry({ score: 900 }),
      entry({ day: '2026-08-11', score: 800, status: 'published' }),
      entry({ day: '2026-08-10', score: 700, status: 'rejected' }),
    ]
    expect(pendingOf(store)).toEqual([entry({ score: 900 })])
  })

  it('drops an entry once it publishes', () => {
    const store = markPublished([entry()], slot)
    expect(pendingOf(store)).toEqual([])
  })

  it('leaves other slots alone when one publishes', () => {
    const store = markPublished([entry(), entry({ difficulty: 'easy' })], slot)
    expect(pendingOf(store)).toEqual([entry({ difficulty: 'easy' })])
  })
})

describe('noteRefusal', () => {
  it('counts a refusal without giving up straight away', () => {
    const store = noteRefusal([entry()], slot)
    expect(store).toEqual([entry({ attempts: 1, status: 'pending' })])
    expect(pendingOf(store)).toHaveLength(1)
  })

  it('gives up once the server has refused enough times', () => {
    let store = [entry()]
    for (let i = 0; i < MAX_PUBLISH_ATTEMPTS; i++) store = noteRefusal(store, slot)
    expect(store[0]?.status).toBe('rejected')
    // The point of giving up: it stops being retried forever.
    expect(pendingOf(store)).toEqual([])
  })
})

describe('bestFor', () => {
  it('returns null when the device has nothing on the board', () => {
    expect(bestFor([], 'speed', 'hard', 'today', TODAY)).toBeNull()
  })

  it('takes only today for the today period', () => {
    const store = [entry({ day: '2026-08-11', score: 5000 }), entry({ score: 800 })]
    expect(bestFor(store, 'speed', 'hard', 'today', TODAY)).toBe(800)
  })

  it('takes the whole calendar week for the week period', () => {
    // Monday the 10th is in the week; Sunday the 9th is the week before.
    const store = [
      entry({ day: '2026-08-09', score: 5000 }),
      entry({ day: '2026-08-10', score: 1200 }),
      entry({ score: 800 }),
    ]
    expect(bestFor(store, 'speed', 'hard', 'week', TODAY)).toBe(1200)
  })

  it('counts every status — all of them happened', () => {
    const store = [
      entry({ score: 800 }),
      entry({ day: '2026-08-11', score: 1500, status: 'rejected' }),
      entry({ day: '2026-08-10', score: 1200, status: 'published' }),
    ]
    expect(bestFor(store, 'speed', 'hard', 'forever', TODAY)).toBe(1500)
  })

  it('ignores other boards', () => {
    const store = [
      entry({ mode: 'accuracy', score: 5000 }),
      entry({ difficulty: 'easy', score: 4000 }),
      entry({ score: 800 }),
    ]
    expect(bestFor(store, 'speed', 'hard', 'forever', TODAY)).toBe(800)
  })
})

describe('bestPending', () => {
  it('ignores what already published', () => {
    const store = [
      entry({ score: 800 }),
      entry({ day: '2026-08-11', score: 5000, status: 'published' }),
    ]
    expect(bestPending(store, 'speed', 'hard', 'forever', TODAY)).toBe(800)
  })

  it('ignores what was refused — it is not on its way anywhere', () => {
    const store = [
      entry({ score: 800 }),
      entry({ day: '2026-08-11', score: 5000, status: 'rejected' }),
    ]
    expect(bestPending(store, 'speed', 'hard', 'forever', TODAY)).toBe(800)
  })

  it('is null when nothing is waiting', () => {
    const store = [entry({ status: 'published' })]
    expect(bestPending(store, 'speed', 'hard', 'today', TODAY)).toBeNull()
  })
})

describe('pruneLocalScores', () => {
  it('keeps the last fourteen days, today included', () => {
    const store = [
      entry({ day: '2026-07-30', score: 100 }),
      entry({ day: '2026-07-29', score: 90 }),
      entry({ score: 5000 }),
    ]
    expect(pruneLocalScores(store, TODAY).map((e) => e.day)).toEqual([
      '2026-07-30',
      TODAY,
    ])
  })

  it('keeps an old record that still leads the board, however old', () => {
    // Without this the all-time board would lose the one entry worth publishing.
    const store = [entry({ day: '2025-01-01', score: 9000 }), entry({ score: 100 })]
    expect(pruneLocalScores(store, TODAY)).toHaveLength(2)
  })

  it('keeps one all-time survivor per board', () => {
    const store = [
      entry({ day: '2025-01-01', score: 9000 }),
      entry({ day: '2025-01-02', score: 8000 }),
      entry({ day: '2025-01-03', score: 7000, difficulty: 'easy' }),
    ]
    expect(pruneLocalScores(store, TODAY).map((e) => e.score)).toEqual([9000, 7000])
  })

  it('bounds a store built from a year of daily play', () => {
    const store: LocalScore[] = []
    for (let i = 0; i < 365; i++) {
      const day = new Date(`${TODAY}T00:00:00Z`)
      day.setUTCDate(day.getUTCDate() - i)
      store.push(entry({ day: day.toISOString().slice(0, 10), score: 100 + i }))
    }
    // Fourteen days in the window, plus the single best of all time behind it.
    expect(pruneLocalScores(store, TODAY)).toHaveLength(15)
  })
})

describe('a session run in the store', () => {
  const run = {
    mode: 'challenge/four-keys',
    difficulty: 'hard' as const,
    day: '2026-10-12',
    score: 1200,
    hits: 9,
    achievedAt: '2026-10-12T12:00:00.000Z',
  }

  it('reads an entry with no sessionId as not a session run', () => {
    // Every entry written before the field existed, and every board run after it. The
    // storage key does not move, so this is the shape most of the queue is in.
    const [entry] = recordRun([], run)
    expect(entry?.sessionId).toBeUndefined()
  })

  it('keeps the session on an entry that has one', () => {
    const [entry] = recordRun([], { ...run, sessionId: 'abc-123' })
    expect(entry?.sessionId).toBe('abc-123')
  })

  it('survives the round trip through JSON', () => {
    // The store is read back with a bare `JSON.parse`, so a widened optional field has
    // to need nothing — this is what says so.
    const stored = recordRun([], { ...run, sessionId: 'abc-123' })
    expect((JSON.parse(JSON.stringify(stored)) as typeof stored)[0]?.sessionId).toBe(
      'abc-123',
    )
  })

  it('keeps the better of two runs in one slot, session and all', () => {
    // A session run slots by mode × difficulty × day like any other, so a second run of
    // the same challenge on the same day replaces the first only if it beat it.
    const first = recordRun([], { ...run, sessionId: 'abc-123' })
    const worse = recordRun(first, { ...run, score: 400, sessionId: 'abc-123' })
    expect(worse).toBe(first)
    const better = recordRun(first, { ...run, score: 2000, sessionId: 'abc-123' })
    expect(better).toHaveLength(1)
    expect(better[0]?.score).toBe(2000)
    expect(better[0]?.sessionId).toBe('abc-123')
  })
})

describe('two airings of one challenge inside a day', () => {
  // What production actually schedules: one session running to 05:00 and the next
  // opening at 06:00, both inside one Prague day. The planner permits it — it only
  // refuses sessions of the same challenge that overlap.
  const run = (sessionId: string, score: number) => ({
    mode: 'challenge/four-keys',
    difficulty: 'hard' as const,
    day: '2026-10-15',
    score,
    hits: 10,
    achievedAt: '2026-10-15T08:00:00.000Z',
    sessionId,
  })

  it('keeps a score for each, even when the later one is worse', () => {
    // The bug this fixes: with the session out of the slot the second run beat nothing
    // the store held, `recordRun` returned it unchanged, and `submitScore` returned
    // before sending — so the later session never saw a score at all.
    const first = recordRun([], run('session-a', 1037))
    const both = recordRun(first, run('session-b', 400))
    expect(both).not.toBe(first)
    expect(both).toHaveLength(2)
    expect(both.map((entry) => entry.score).sort((a, b) => b - a)).toEqual([1037, 400])
  })

  it('still keeps only the best within one airing', () => {
    const first = recordRun([], run('session-a', 1037))
    expect(recordRun(first, run('session-a', 400))).toBe(first)
    expect(recordRun(first, run('session-a', 2000))).toHaveLength(1)
    expect(recordRun(first, run('session-a', 2000))[0]?.score).toBe(2000)
  })

  it('leaves a board run slotting exactly as it did', () => {
    const board = {
      mode: 'accuracy' as const,
      difficulty: 'hard' as const,
      day: '2026-10-15',
      score: 500,
      hits: 10,
      achievedAt: '2026-10-15T08:00:00.000Z',
    }
    const first = recordRun([], board)
    // Two entries with no session are the same slot, as they always were.
    expect(recordRun(first, { ...board, score: 400 })).toBe(first)
    expect(recordRun(first, { ...board, score: 900 })).toHaveLength(1)
  })

  it('does not confuse a session run with a board run on the same day', () => {
    const board = recordRun([], {
      mode: 'challenge/four-keys',
      difficulty: 'hard' as const,
      day: '2026-10-15',
      score: 900,
      hits: 10,
      achievedAt: '2026-10-15T08:00:00.000Z',
    })
    // The same mode and day, this time inside a session — a different contest.
    expect(recordRun(board, run('session-a', 100))).toHaveLength(2)
  })
})
