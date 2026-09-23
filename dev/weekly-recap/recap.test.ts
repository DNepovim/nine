import { describe, expect, it } from 'vitest'

import { BOARDS, DAYS, POOLS, simulateWeek, type PoolKey } from '@/dev/weekly-recap/facts'
import {
  composeRecap,
  dayWinners,
  weekForShape,
  weekShape,
  type DayWinner,
  type ShapeKind,
} from '@/dev/weekly-recap/recap'

// Boards are ordered accuracy easy/hard/extreme, then speed easy/hard/extreme.
const boardIndex = (mode: string, difficulty: string): number =>
  BOARDS.findIndex((board) => board.mode === mode && board.difficulty === difficulty)

// A week of nulls, to be filled in one cell at a time by the tests that need it.
const emptyCells = (): (string | null)[][] => DAYS.map(() => BOARDS.map(() => null))

const winnersOf = (names: readonly (string | null)[]): (DayWinner | null)[] =>
  names.map((nickname) => (nickname === null ? null : { nickname, boards: 1 }))

describe('dayWinners', () => {
  it('gives the day to whoever topped the most boards', () => {
    const cells = emptyCells()
    const monday = cells[0] ?? []
    monday[boardIndex('accuracy', 'easy')] = 'ADA'
    monday[boardIndex('accuracy', 'hard')] = 'ADA'
    monday[boardIndex('speed', 'extreme')] = 'BEN'

    expect(dayWinners({ cells, records: [] })[0]).toEqual({ nickname: 'ADA', boards: 2 })
  })

  it('breaks a tie with the hardest board held', () => {
    const cells = emptyCells()
    const monday = cells[0] ?? []
    monday[boardIndex('accuracy', 'easy')] = 'ADA'
    monday[boardIndex('speed', 'extreme')] = 'BEN'

    expect(dayWinners({ cells, records: [] })[0]).toEqual({ nickname: 'BEN', boards: 1 })
  })

  it('reports no winner for a day nobody played', () => {
    expect(dayWinners({ cells: emptyCells(), records: [] })[0]).toBeNull()
  })
})

describe('weekShape', () => {
  it('calls a week nobody played empty', () => {
    expect(weekShape(winnersOf([null, null, null, null, null, null, null])).kind).toBe(
      'empty',
    )
  })

  it('calls three days or fewer quiet, however they fell', () => {
    expect(
      weekShape(winnersOf(['ADA', 'BEN', 'CHLOE', null, null, null, null])).kind,
    ).toBe('quiet')
  })

  it('calls one name across every played day a sweep', () => {
    const shape = weekShape(winnersOf(['ADA', 'ADA', 'ADA', 'ADA', 'ADA', 'ADA', 'ADA']))
    expect(shape.kind).toBe('sweep')
    expect(shape.exceptions).toEqual([])
  })

  it('names the day and the player behind a single exception', () => {
    const shape = weekShape(winnersOf(['ADA', 'ADA', 'ADA', 'BEN', 'ADA', 'ADA', 'ADA']))
    expect(shape.kind).toBe('sweepBut')
    expect(shape.exceptions).toEqual([{ day: 'Thursday', nickname: 'BEN' }])
  })

  it('keeps both exceptions when two days got away', () => {
    const shape = weekShape(
      winnersOf(['ADA', 'BEN', 'ADA', 'ADA', 'CHLOE', 'ADA', 'ADA']),
    )
    expect(shape.kind).toBe('sweepBut')
    expect(shape.exceptions.map((e) => e.day)).toEqual(['Tuesday', 'Friday'])
  })

  it('calls two names with three exceptions a split', () => {
    const shape = weekShape(winnersOf(['ADA', 'BEN', 'ADA', 'BEN', 'ADA', 'BEN', 'ADA']))
    expect(shape.kind).toBe('split')
  })

  it('calls three or more names with no holder scattered', () => {
    const shape = weekShape(
      winnersOf(['ADA', 'BEN', 'CHLOE', 'DAN', 'ADA', 'BEN', 'CHLOE']),
    )
    expect(shape.kind).toBe('scattered')
    expect(shape.ranked.length).toBeGreaterThan(2)
  })
})

const POOL_KEYS = Object.keys(POOLS) as PoolKey[]
const SHAPES: ShapeKind[] = ['empty', 'quiet', 'sweep', 'sweepBut', 'split', 'scattered']

describe('composeRecap', () => {
  it('leaves no placeholder unfilled and no segment empty, across every pool', () => {
    for (const poolKey of POOL_KEYS) {
      for (let week = 0; week < 150; week++) {
        const seed = `${poolKey}-${week}`
        const { sentences } = composeRecap(simulateWeek(seed, poolKey), seed)
        expect(sentences.length).toBeGreaterThan(0)
        for (const sentence of sentences) {
          const text = sentence.map((segment) => segment.text).join('')
          expect(text).not.toMatch(/\{\w+\}/)
          expect(text.trim().length).toBeGreaterThan(0)
          expect(text).not.toMatch(/undefined|NaN/)
        }
      }
    }
  })

  it('says nothing about records on a week nobody played', () => {
    const facts = weekForShape('empty', 'empty-test')
    expect(facts).not.toBeNull()
    if (facts === null) return
    expect(composeRecap(facts, 'seed').sentences).toHaveLength(1)
  })

  it('tells the same week the same way twice', () => {
    const facts = simulateWeek('stable', 'medium')
    const render = () =>
      composeRecap(facts, 'fixed')
        .sentences.map((s) => s.map((seg) => seg.text).join(''))
        .join(' ')
    expect(render()).toBe(render())
  })

  it('names the exception day in the prose of a sweepBut week', () => {
    const facts = weekForShape('sweepBut', 'but-test')
    expect(facts).not.toBeNull()
    if (facts === null) return
    const recap = composeRecap(facts, 'but-test')
    const [exception] = recap.shape.exceptions
    expect(exception).toBeDefined()
    if (exception === undefined) return
    const opener = recap.sentences[0]?.map((segment) => segment.text).join('') ?? ''
    // The opener either names the day it lost or, with two exceptions, names both.
    expect(opener).toContain(exception.day)
  })
})

describe('name colours', () => {
  it('never gives two people in one recap the same colour', () => {
    for (const poolKey of POOL_KEYS) {
      for (let week = 0; week < 200; week++) {
        const seed = `${poolKey}-colour-${week}`
        const { sentences } = composeRecap(simulateWeek(seed, poolKey), seed)
        const byName = new Map<string, string>()
        for (const sentence of sentences) {
          for (const segment of sentence) {
            if (segment.kind !== 'name') continue
            expect(segment.color, `${segment.text} has no colour`).toBeDefined()
            const held = byName.get(segment.text)
            // The same person keeps one colour through the whole paragraph.
            if (held !== undefined) expect(segment.color).toBe(held)
            byName.set(segment.text, segment.color ?? '')
          }
        }
        const colours = [...byName.values()]
        expect(
          new Set(colours).size,
          `clash in ${seed}: ${JSON.stringify([...byName])}`,
        ).toBe(colours.length)
      }
    }
  })
})

describe('weekForShape', () => {
  it('finds a week of every shape the gallery offers', () => {
    for (const kind of SHAPES) {
      const facts = weekForShape(kind, `find-${kind}`)
      expect(facts, `no ${kind} week found`).not.toBeNull()
      if (facts === null) continue
      expect(weekShape(dayWinners(facts)).kind).toBe(kind)
    }
  })
})
