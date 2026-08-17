import { describe, expect, it } from 'vitest'

import { IDLE, stepRun, type RunInput, type RunPhase } from './announcement-run'
import type { RecordTargets } from './announcements'

const targets = (over: Partial<RecordTargets> = {}): RecordTargets => ({
  record: 1000,
  today: 2000,
  week: 3000,
  ever: 4000,
  todayEmpty: false,
  weekEmpty: false,
  ...over,
})

const input = (over: Partial<RunInput> = {}): RunInput => ({
  inRun: true,
  ready: true,
  score: 0,
  targets: targets(),
  ...over,
})

// Drives a sequence of inputs through the machine, as the hook does across renders.
const play = (inputs: RunInput[], from: RunPhase = IDLE) =>
  inputs.reduce<{ phase: RunPhase; announced: (string | null)[]; published: number }>(
    (acc, next) => {
      const step = stepRun(acc.phase, next)
      return {
        phase: step.phase,
        announced: [...acc.announced, step.announce],
        published: acc.published + (step.publish ? 1 : 0),
      }
    },
    { phase: from, announced: [], published: 0 },
  )

describe('stepRun — waiting for the boards', () => {
  it('freezes nothing while the boards are still loading', () => {
    const step = stepRun(IDLE, input({ ready: false, score: 5000 }))
    expect(step.phase.started).toBe(false)
    expect(step.announce).toBeNull()
  })

  it('does not freeze the nulls a loading board reports', () => {
    // The bug this replaces: a run begun on a cold start snapshotted all-null targets
    // and went the whole way without a single announcement.
    const loading = targets({ record: 0, today: null, week: null, ever: null })
    const step = stepRun(IDLE, input({ ready: false, score: 100, targets: loading }))
    expect(step.phase).toBe(IDLE)
  })

  it('catches up on the score already reached when the boards land mid-run', () => {
    const result = play([
      input({ ready: false, score: 0 }),
      input({ ready: false, score: 2500 }),
      // The boards arrive with the run already past today's record.
      input({ ready: true, score: 2500 }),
    ])
    expect(result.announced).toEqual([null, null, 'today'])
    expect(result.published).toBe(1)
  })

  it('says nothing when the run has not passed anything by the time they land', () => {
    const result = play([input({ ready: false, score: 500 }), input({ score: 500 })])
    expect(result.announced).toEqual([null, null])
  })
})

describe('stepRun — the frozen bar', () => {
  it('ignores targets that move once the run is under way', () => {
    // A rival taking today's record mid-run must not raise the bar being chased.
    const result = play([
      input({ score: 0 }),
      input({ score: 2500, targets: targets({ today: 9000 }) }),
    ])
    expect(result.announced).toEqual([null, 'today'])
  })

  it('keeps a board it opened open for the rest of the run', () => {
    const empty = targets({ today: null, todayEmpty: true })
    const result = play([
      input({ score: 0, targets: empty }),
      // The board is no longer empty — our own score put something there.
      input({ score: 200, targets: targets({ today: 100 }) }),
    ])
    expect(result.announced).toEqual([null, 'todayFirst'])
  })
})

describe('stepRun — crossing records', () => {
  it('announces a crossing once, however many hits follow', () => {
    const result = play([
      input({ score: 1500 }),
      input({ score: 1600 }),
      input({ score: 1700 }),
    ])
    expect(result.announced).toEqual(['record', null, null])
  })

  it('announces the biggest when one hit clears two tiers', () => {
    const result = play([input({ score: 2500 })])
    expect(result.announced).toEqual(['today'])
    // Both are marked, so the smaller one does not fire on the next hit.
    expect(result.phase.fired).toContain('record')
  })

  it('escalates as the run passes each further record', () => {
    const result = play([
      input({ score: 1500 }),
      input({ score: 2500 }),
      input({ score: 3500 }),
      input({ score: 4500 }),
    ])
    expect(result.announced).toEqual(['record', 'today', 'week', 'ever'])
  })

  it('publishes for a board record but not for a personal best alone', () => {
    expect(
      stepRun({ ...IDLE, started: true, targets: targets() }, input({ score: 1500 }))
        .publish,
    ).toBe(false)
    expect(
      stepRun({ ...IDLE, started: true, targets: targets() }, input({ score: 2500 }))
        .publish,
    ).toBe(true)
  })
})

describe('stepRun — between runs', () => {
  it('goes back to idle when the run ends', () => {
    const started = play([input({ score: 2500 })])
    expect(stepRun(started.phase, input({ inRun: false, score: 2500 })).phase).toBe(IDLE)
  })

  it('re-freezes for the next run, so it sees what the last one scored', () => {
    // Report 2/3: PLAY AGAIN used to reuse the previous run's snapshot, so a board its
    // own first run had opened still read as empty.
    const first = play([
      input({ score: 0, targets: targets({ today: null, todayEmpty: true }) }),
      input({ score: 900, targets: targets({ today: null, todayEmpty: true }) }),
      input({ inRun: false, score: 900 }),
    ])
    expect(first.announced).toContain('todayFirst')

    // The next run starts against a board that now knows about the 900.
    const second = play(
      [
        input({ score: 0, targets: targets({ today: 900 }) }),
        input({ score: 500, targets: targets({ today: 900 }) }),
      ],
      first.phase,
    )
    expect(second.announced).toEqual([null, null])
  })

  it('starts the next run with a clean slate of crossings', () => {
    const first = play([input({ score: 2500 }), input({ inRun: false, score: 2500 })])
    const second = play([input({ score: 2500 })], first.phase)
    expect(second.announced).toEqual(['today'])
  })
})
