import { describe, expect, it } from 'vitest'

import {
  coachReducer,
  initialCoachState,
  noteResolved,
  pressFacts,
  type CoachState,
  type PressFacts,
} from './coach'
import { buildPressGrid, type Grid, type Target } from './game'
import { computePar } from './scoring'

const ZEROS: Grid = [
  [0, 0, 0],
  [0, 0, 0],
  [0, 0, 0],
]

// Defaults describe a press that helped nothing, mid-route, on the ×1 key. Note
// that repeating one unchanged `facts()` builds a tap run as well as an unhelpful
// streak — vary the index or set `improved` when a test means to exercise one rule
// and not the other.
const facts = (over: Partial<PressFacts> = {}): PressFacts => ({
  index: 0,
  delta: 1,
  improved: false,
  opening: false,
  gap: 0,
  routing: true,
  ...over,
})

const target = (over: Partial<Target> & { value: number }): Target => ({
  id: 0,
  spawnedAt: 0,
  duration: 10_000,
  refAt: 0,
  refGrid: ZEROS,
  par: 1,
  userSteps: 0,
  ...over,
})

// Feeds a sequence of presses through the reducer and reports every verdict it
// produced, so a test can say what a run of presses earned.
const run = (state: CoachState, sequence: readonly PressFacts[]) =>
  sequence.reduce<{ state: CoachState; verdicts: (string | null)[] }>(
    (acc, next) => {
      const result = coachReducer(acc.state, next)
      return { state: result.state, verdicts: [...acc.verdicts, result.verdict] }
    },
    { state, verdicts: [] },
  )

describe('pressFacts', () => {
  it('calls a press helpful when it advances any target, not just the nearest', () => {
    // The ×9 key up to 1 puts the sum at 9. The nearest target, 1, is now further
    // off — that key has to come back down — but 10 is one press closer than it was.
    // A press like this must not be called a mistake.
    const after = buildPressGrid(ZEROS, 8, 1)
    expect(computePar(ZEROS, 1)).toBe(1)
    expect(computePar(after, 1)).toBe(2)
    expect(computePar(ZEROS, 10)).toBe(2)
    expect(computePar(after, 10)).toBe(1)

    const result = pressFacts({
      index: 8,
      delta: 1,
      gridBefore: ZEROS,
      gridAfter: after,
      targets: [target({ id: 0, value: 1 }), target({ id: 1, value: 10 })],
    })
    expect(result.improved).toBe(true)
  })

  it('calls a press unhelpful when it advances nothing', () => {
    // The ×1 key up to 1 while the only target is 9: a swipe on the ×9 key still
    // lands it in one, so the route is no shorter than it was.
    const after = buildPressGrid(ZEROS, 0, 1)
    expect(computePar(ZEROS, 9)).toBe(1)
    expect(computePar(after, 9)).toBe(1)

    const result = pressFacts({
      index: 0,
      delta: 1,
      gridBefore: ZEROS,
      gridAfter: after,
      targets: [target({ value: 9 })],
    })
    expect(result.improved).toBe(false)
  })

  it('measures the gap to the nearest target by value', () => {
    const result = pressFacts({
      index: 0,
      delta: 1,
      gridBefore: ZEROS,
      gridAfter: buildPressGrid(ZEROS, 0, 1),
      targets: [target({ id: 0, value: 40 }), target({ id: 1, value: 7 })],
    })
    expect(result.gap).toBe(7)
  })

  it('calls a press an opening only while the nearest target has taken none', () => {
    const opening = pressFacts({
      index: 0,
      delta: 1,
      gridBefore: ZEROS,
      gridAfter: buildPressGrid(ZEROS, 0, 1),
      targets: [target({ value: 40, userSteps: 0 })],
    })
    expect(opening.opening).toBe(true)

    const midRoute = pressFacts({
      index: 0,
      delta: 1,
      gridBefore: ZEROS,
      gridAfter: buildPressGrid(ZEROS, 0, 1),
      targets: [target({ value: 40, userSteps: 2 })],
    })
    expect(midRoute.opening).toBe(false)
  })

  it('reports nothing to route toward on an empty board', () => {
    const result = pressFacts({
      index: 0,
      delta: 1,
      gridBefore: ZEROS,
      gridAfter: buildPressGrid(ZEROS, 0, 1),
      targets: [],
    })
    expect(result.routing).toBe(false)
    expect(result.improved).toBe(false)
  })
})

describe('lost', () => {
  // Alternating keys, so these presses build an unhelpful streak without also
  // building a tap run — this block is about `lost` alone.
  const miss = (index: number, over: Partial<PressFacts> = {}) =>
    facts({ index, ...over })

  it('says nothing after two presses that helped nothing', () => {
    expect(run(initialCoachState(), [miss(0), miss(1)]).verdicts).toEqual([null, null])
  })

  it('speaks on the third', () => {
    expect(run(initialCoachState(), [miss(0), miss(1), miss(0)]).verdicts).toEqual([
      null,
      null,
      'lost',
    ])
  })

  it('says it once, not again on the fourth', () => {
    const { verdicts } = run(initialCoachState(), [miss(0), miss(1), miss(0), miss(1)])
    expect(verdicts[3]).toBeNull()
  })

  it('is reset by a press that helped', () => {
    const { verdicts } = run(initialCoachState(), [
      miss(0),
      miss(1),
      miss(0, { improved: true }),
      miss(1),
      miss(0),
    ])
    expect(verdicts).toEqual([null, null, null, null, null])
  })

  it('is reset by a target leaving the board', () => {
    const twoIn = run(initialCoachState(), [miss(0), miss(1)])
    expect(run(noteResolved(twoIn.state, 1), [miss(0), miss(1)]).verdicts).toEqual([
      null,
      null,
    ])
  })
})

describe('tapping', () => {
  const tap = () => facts({ index: 4, delta: 1, improved: true })
  const tapped = (sequence: readonly PressFacts[]) =>
    run(initialCoachState(), sequence).verdicts.filter((verdict) => verdict === 'tapping')

  it('speaks on the fourth press of a run on one key', () => {
    expect(run(initialCoachState(), [tap(), tap(), tap(), tap()]).verdicts).toEqual([
      null,
      null,
      null,
      'tapping',
    ])
  })

  it('is broken by a swipe', () => {
    expect(
      tapped([
        tap(),
        tap(),
        facts({ index: 4, delta: null, improved: true }),
        tap(),
        tap(),
      ]),
    ).toEqual([])
  })

  it('is broken by another key', () => {
    expect(
      tapped([tap(), tap(), facts({ index: 0, delta: 1, improved: true }), tap(), tap()]),
    ).toEqual([])
  })

  it('is broken by reversing direction on the same key', () => {
    expect(
      tapped([
        tap(),
        tap(),
        tap(),
        facts({ index: 4, delta: -1, improved: true }),
        tap(),
      ]),
    ).toEqual([])
  })
})

describe('coarse', () => {
  // Index 0 carries weight 1 — a fine key. Index 8 carries weight 9.
  const opener = (over: Partial<PressFacts> = {}) =>
    facts({ index: 0, opening: true, gap: 40, ...over })

  it('speaks when a fine key opens a route across a wide gap', () => {
    expect(coachReducer(initialCoachState(), opener()).verdict).toBe('coarse')
  })

  it('stays quiet below the gap that makes a fine key wrong', () => {
    expect(coachReducer(initialCoachState(), opener({ gap: 11 })).verdict).toBeNull()
  })

  it('speaks exactly at the threshold', () => {
    expect(coachReducer(initialCoachState(), opener({ gap: 12 })).verdict).toBe('coarse')
  })

  it('stays quiet when a coarse key opens the route', () => {
    expect(coachReducer(initialCoachState(), opener({ index: 8 })).verdict).toBeNull()
  })

  it('stays quiet mid-route, where a fine key is the right call', () => {
    expect(
      coachReducer(initialCoachState(), opener({ opening: false })).verdict,
    ).toBeNull()
  })
})

describe('habit cool-down', () => {
  const openFine = () => facts({ index: 0, opening: true, gap: 40 })

  it('does not name the same habit twice inside eight resolved targets', () => {
    const first = coachReducer(initialCoachState(), openFine())
    expect(first.verdict).toBe('coarse')
    expect(coachReducer(noteResolved(first.state, 7), openFine()).verdict).toBeNull()
  })

  it('names it again once eight targets have gone', () => {
    const first = coachReducer(initialCoachState(), openFine())
    expect(coachReducer(noteResolved(first.state, 8), openFine()).verdict).toBe('coarse')
  })
})

describe('one verdict per press', () => {
  it('prefers the tapping habit when a tap run reaches an opening press', () => {
    // A run of taps can survive a hit and land on the next target's opening press,
    // so both habits qualify at once. Several presses of evidence beat one.
    const tapping = run(initialCoachState(), [
      facts({ index: 0, delta: 1, improved: true }),
      facts({ index: 0, delta: 1, improved: true }),
      facts({ index: 0, delta: 1, improved: true }),
    ])
    expect(
      coachReducer(tapping.state, facts({ index: 0, delta: 1, opening: true, gap: 40 }))
        .verdict,
    ).toBe('tapping')
  })

  it('prefers a habit to lost', () => {
    const twoUnhelpful = run(initialCoachState(), [facts(), facts()])
    expect(
      coachReducer(twoUnhelpful.state, facts({ index: 0, opening: true, gap: 40 }))
        .verdict,
    ).toBe('coarse')
  })
})

describe('an empty board', () => {
  it('judges nothing', () => {
    const idle = facts({ routing: false })
    expect(run(initialCoachState(), [idle, idle, idle, idle]).verdicts).toEqual([
      null,
      null,
      null,
      null,
    ])
  })

  it('drops a tap run rather than letting it span the gap', () => {
    const { verdicts } = run(initialCoachState(), [
      facts({ index: 4, delta: 1 }),
      facts({ index: 4, delta: 1 }),
      facts({ index: 4, delta: 1, routing: false }),
      facts({ index: 4, delta: 1 }),
      facts({ index: 4, delta: 1 }),
    ])
    expect(verdicts.filter((verdict) => verdict === 'tapping')).toEqual([])
  })
})
