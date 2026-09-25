import { describe, expect, it } from 'vitest'

import type { Grid, Target } from '@/machines/game'
import type { Position } from '@/types/game'

import {
  parseSavedRun,
  restoreRun,
  savedPositions,
  toSavedRun,
  type RunSnapshot,
  type SavedRun,
} from './saved-run'

// What the run looks like after a trip through storage, which is the only shape
// `parseSavedRun` is ever handed.
const roundTrip = (saved: SavedRun): unknown => {
  const parsed: unknown = JSON.parse(JSON.stringify(saved))
  return parsed
}

const GRID: Grid = [
  [1, 2, 3],
  [4, 5, 6],
  [7, 8, 9],
]

const target = (over: Partial<Target> = {}): Target => ({
  id: 3,
  value: 42,
  spawnedAt: 1_000,
  duration: 8_000,
  refAt: 1_500,
  refGrid: GRID,
  par: 4,
  userSteps: 1,
  ...over,
})

// Where the display list had the one target sitting. Handed in rather than read off the
// run: the machine never knows where a card is.
const SPOTS: ReadonlyMap<number, Position> = new Map([[3, { x: 40, y: 120 }]])
const NOWHERE: ReadonlyMap<number, Position> = new Map()

const snapshot = (over: Partial<RunSnapshot> = {}): RunSnapshot => ({
  grid: GRID,
  hits: 7,
  score: 1234,
  mode: 'accuracy',
  difficulty: 'hard',
  lives: 2,
  streak: 3,
  maxStreak: 5,
  strikes: 4,
  accSum: 5.5,
  spdSum: 4.25,
  targets: [target()],
  nextTargetId: 9,
  elapsedMs: 20_000,
  runSeq: 2,
  playingSince: null,
  ...over,
})

describe('toSavedRun', () => {
  it('stores a target as ages rather than moments', () => {
    const saved = toSavedRun(snapshot(), SPOTS, 5_000)
    expect(saved.targets[0]?.age).toBe(4_000)
    expect(saved.targets[0]?.refAge).toBe(3_500)
  })

  it('banks the stretch a run was still playing through', () => {
    const saved = toSavedRun(snapshot({ playingSince: 4_000 }), SPOTS, 5_000)
    expect(saved.elapsedMs).toBe(21_000)
  })

  it('leaves the clock of a paused run where it stood', () => {
    expect(toSavedRun(snapshot(), SPOTS, 9_999).elapsedMs).toBe(20_000)
  })

  it('writes infinite lives down as nothing', () => {
    const saved = toSavedRun(
      snapshot({ mode: 'trainee', lives: Number.POSITIVE_INFINITY }),
      SPOTS,
      5_000,
    )
    expect(saved.lives).toBeNull()
  })

  it('clamps an age taken against a clock that moved backwards', () => {
    const saved = toSavedRun(snapshot(), SPOTS, 500)
    expect(saved.targets[0]?.age).toBe(0)
  })
})

describe('restoreRun', () => {
  it('lays the ages back against the clock it comes back to', () => {
    const saved = toSavedRun(snapshot(), SPOTS, 5_000)
    const restored = restoreRun(saved, 1_000_000)
    expect(restored.targets[0]?.spawnedAt).toBe(996_000)
    expect(restored.targets[0]?.refAt).toBe(996_500)
  })

  it('gives a target back the share of its clock it had left', () => {
    const saved = toSavedRun(snapshot(), SPOTS, 5_000)
    const restored = restoreRun(saved, 1_000_000)
    const put = restored.targets[0]
    expect(put).toBeDefined()
    if (put === undefined) return
    expect(put.duration - (1_000_000 - put.spawnedAt)).toBe(4_000)
  })

  it('fills infinite lives back in from the mode', () => {
    const saved = toSavedRun(
      snapshot({ mode: 'trainee', lives: Number.POSITIVE_INFINITY }),
      SPOTS,
      5_000,
    )
    expect(restoreRun(saved, 5_000).lives).toBe(Number.POSITIVE_INFINITY)
  })

  it('carries the run through a full round trip', () => {
    const saved = toSavedRun(snapshot(), SPOTS, 5_000)
    const parsed = parseSavedRun(roundTrip(saved))
    expect(parsed).not.toBeNull()
    if (parsed === null) return
    const restored = restoreRun(parsed, 5_000)
    expect(restored.score).toBe(1234)
    expect(restored.grid).toEqual(GRID)
    expect(restored.targets).toEqual(snapshot().targets)
  })
})

describe('parseSavedRun', () => {
  const stored = (): SavedRun => toSavedRun(snapshot(), SPOTS, 5_000)

  it('accepts what toSavedRun wrote', () => {
    expect(parseSavedRun(roundTrip(stored()))).not.toBeNull()
  })

  it('refuses anything that is not an object', () => {
    expect(parseSavedRun(null)).toBeNull()
    expect(parseSavedRun(7)).toBeNull()
    expect(parseSavedRun([])).toBeNull()
  })

  it('refuses a mode no longer in the game', () => {
    expect(parseSavedRun({ ...stored(), mode: 'arcade' })).toBeNull()
  })

  it('refuses a difficulty no longer in the game', () => {
    expect(parseSavedRun({ ...stored(), difficulty: 'medium' })).toBeNull()
  })

  it('refuses a grid that is not three rows of digits', () => {
    expect(parseSavedRun({ ...stored(), grid: [[1, 2, 3]] })).toBeNull()
    expect(
      parseSavedRun({
        ...stored(),
        grid: [
          [1, 2, 3],
          [4, 5, 6],
          [7, 8, 10],
        ],
      }),
    ).toBeNull()
  })

  it('discards the whole run when one target will not parse', () => {
    const run = stored()
    expect(parseSavedRun({ ...run, targets: [...run.targets, { id: 1 }] })).toBeNull()
  })

  it('reads null lives back as null rather than as a bad value', () => {
    expect(parseSavedRun({ ...stored(), lives: null })?.lives).toBeNull()
  })

  it('refuses a figure that did not survive the round trip', () => {
    expect(parseSavedRun({ ...stored(), score: null })).toBeNull()
    expect(parseSavedRun({ ...stored(), elapsedMs: 'soon' })).toBeNull()
  })

  it('keeps a run with an empty board', () => {
    expect(parseSavedRun({ ...stored(), targets: [] })?.targets).toEqual([])
  })
})

describe('target positions', () => {
  it('writes down where the display list had each card', () => {
    expect(toSavedRun(snapshot(), SPOTS, 5_000).targets[0]?.position).toEqual({
      x: 40,
      y: 120,
    })
  })

  it('records a target the list had not placed yet as having no spot', () => {
    expect(toSavedRun(snapshot(), NOWHERE, 5_000).targets[0]?.position).toBeNull()
  })

  it('hands the spots back by id', () => {
    const saved = toSavedRun(snapshot(), SPOTS, 5_000)
    expect(savedPositions(saved).get(3)).toEqual({ x: 40, y: 120 })
  })

  it('leaves an unplaced target out of the lookup entirely', () => {
    const saved = toSavedRun(snapshot(), NOWHERE, 5_000)
    expect(savedPositions(saved).size).toBe(0)
  })

  it('survives the trip through storage', () => {
    const parsed = parseSavedRun(roundTrip(toSavedRun(snapshot(), SPOTS, 5_000)))
    expect(parsed).not.toBeNull()
    if (parsed === null) return
    expect(savedPositions(parsed).get(3)).toEqual({ x: 40, y: 120 })
  })

  it('keeps the run when a spot will not parse, and only loses the spot', () => {
    const run = toSavedRun(snapshot(), SPOTS, 5_000)
    const [target] = run.targets
    expect(target).toBeDefined()
    if (target === undefined) return
    const parsed = parseSavedRun({
      ...run,
      targets: [{ ...target, position: { x: 'left', y: 120 } }],
    })
    expect(parsed).not.toBeNull()
    expect(parsed?.targets[0]?.position).toBeNull()
  })
})
