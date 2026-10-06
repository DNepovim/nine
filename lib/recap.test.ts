import { setupI18n } from '@lingui/core'
import type { MessageDescriptor } from '@lingui/core'
import { describe, expect, it } from 'vitest'

import { POOLS, simulateWeek, weekForShape, type PoolKey } from '@/dev/weekly-recap/facts'
import type { Translate } from '@/lib/prose'
import {
  BOARDS,
  composeRecap,
  dayWinners,
  factsFromRows,
  hasAnyWinner,
  periodLabel,
  weekShape,
  type DayWinner,
  type RecapRow,
  type ShapeKind,
  type WeekFacts,
} from '@/lib/recap'
import { ALL_PHRASINGS } from '@/lib/recap-lines'
import { messages as cs } from '@/locales/cs/messages'
import { messages as en } from '@/locales/en/messages'

// The composer takes its resolver, so a test can hand it one. English is the source locale,
// which makes `en` the identity pass and `cs` the one that can actually be wrong.
//
// An instance per locale rather than activating one on the shared `i18n`: two resolvers are
// alive at once here, and a shared instance would mean the last `activate` decided what
// *both* of them returned. The app never has that problem — it has one active locale — so
// this is a fact about the test, not about the feature.
const resolverFor = (locale: 'en' | 'cs'): Translate => {
  const scoped = setupI18n({ locale, messages: { en, cs } })
  return (descriptor: MessageDescriptor) => scoped._(descriptor)
}

const t = resolverFor('en')

// Boards are ordered accuracy easy/hard/extreme, then speed easy/hard/extreme.
const boardIndex = (mode: string, difficulty: string): number =>
  BOARDS.findIndex((board) => board.mode === mode && board.difficulty === difficulty)

// A week of nulls, to be filled in one cell at a time by the tests that need it.
const emptyCells = (): (string | null)[][] =>
  Array.from({ length: 7 }, () => BOARDS.map(() => null))

const winnersOf = (names: readonly (string | null)[]): (DayWinner | null)[] =>
  names.map((nickname) => (nickname === null ? null : { nickname, boards: 1 }))

const textOf = (facts: WeekFacts, seed: string, resolve: Translate = t): string =>
  composeRecap(facts, seed, resolve)
    .sentences.map((sentence) => sentence.map((segment) => segment.text).join(''))
    .join(' ')

describe('factsFromRows', () => {
  const MONDAY = '2026-09-21'

  it('puts a cell on the day and the board it names', () => {
    const rows: RecapRow[] = [
      {
        kind: 'cell',
        mode: 'speed',
        difficulty: 'extreme',
        day: '2026-09-23',
        nickname: 'ADA',
      },
    ]
    const facts = factsFromRows(rows, MONDAY)
    expect(facts.cells[2]?.[boardIndex('speed', 'extreme')]).toBe('ADA')
    expect(hasAnyWinner(facts)).toBe(true)
  })

  it('collects takeovers separately from cells', () => {
    const rows: RecapRow[] = [
      {
        kind: 'takeover',
        mode: 'accuracy',
        difficulty: 'hard',
        day: '2026-09-27',
        nickname: 'BEN',
      },
    ]
    const facts = factsFromRows(rows, MONDAY)
    expect(facts.takeovers).toEqual([
      {
        board: { mode: 'accuracy', difficulty: 'hard' },
        boardIndex: boardIndex('accuracy', 'hard'),
        dayIndex: 6,
        nickname: 'BEN',
      },
    ])
    // A takeover alone is not somebody topping a board on a day.
    expect(hasAnyWinner(facts)).toBe(false)
  })

  it('drops a row this build does not recognise', () => {
    const rows: RecapRow[] = [
      { kind: 'cell', mode: 'trainee', difficulty: 'easy', day: MONDAY, nickname: 'A' },
      { kind: 'cell', mode: 'speed', difficulty: 'brutal', day: MONDAY, nickname: 'B' },
      { kind: 'rumour', mode: 'speed', difficulty: 'easy', day: MONDAY, nickname: 'C' },
      // Outside the window — a server that answered a different question than it was asked.
      {
        kind: 'cell',
        mode: 'speed',
        difficulty: 'easy',
        day: '2026-09-28',
        nickname: 'D',
      },
    ]
    const facts = factsFromRows(rows, MONDAY)
    expect(hasAnyWinner(facts)).toBe(false)
    expect(facts.takeovers).toEqual([])
  })

  it('gives back a seven-day week whatever the server sent', () => {
    expect(factsFromRows([], MONDAY).cells).toHaveLength(7)
  })
})

describe('periodLabel', () => {
  it('names the month once when the week sits inside one', () => {
    expect(periodLabel('2026-09-22', '2026-09-28', t)).toBe('22 – 28 SEPTEMBER')
  })

  it('names both months when the week crosses one', () => {
    expect(periodLabel('2026-09-29', '2026-10-05', t)).toBe('29 SEPTEMBER – 5 OCTOBER')
  })

  it('crosses a year without losing either end', () => {
    expect(periodLabel('2025-12-29', '2026-01-04', t)).toBe('29 DECEMBER – 4 JANUARY')
  })
})

describe('dayWinners', () => {
  it('gives the day to whoever topped the most boards', () => {
    const cells = emptyCells()
    const monday = cells[0] ?? []
    monday[boardIndex('accuracy', 'easy')] = 'ADA'
    monday[boardIndex('accuracy', 'hard')] = 'ADA'
    monday[boardIndex('speed', 'extreme')] = 'BEN'

    expect(dayWinners({ cells, takeovers: [] })[0]).toEqual({
      nickname: 'ADA',
      boards: 2,
    })
  })

  it('breaks a tie with the hardest board held', () => {
    const cells = emptyCells()
    const monday = cells[0] ?? []
    monday[boardIndex('accuracy', 'easy')] = 'ADA'
    monday[boardIndex('speed', 'extreme')] = 'BEN'

    expect(dayWinners({ cells, takeovers: [] })[0]).toEqual({
      nickname: 'BEN',
      boards: 1,
    })
  })

  it('reports no winner for a day nobody played', () => {
    expect(dayWinners({ cells: emptyCells(), takeovers: [] })[0]).toBeNull()
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
    expect(shape.exceptions).toEqual([{ dayIndex: 3, nickname: 'BEN' }])
  })

  it('keeps both exceptions when two days got away', () => {
    const shape = weekShape(
      winnersOf(['ADA', 'BEN', 'ADA', 'ADA', 'CHLOE', 'ADA', 'ADA']),
    )
    expect(shape.kind).toBe('sweepBut')
    expect(shape.exceptions.map((e) => e.dayIndex)).toEqual([1, 4])
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
        const { sentences } = composeRecap(simulateWeek(seed, poolKey), seed, t)
        expect(sentences.length).toBeGreaterThan(0)
        for (const sentence of sentences) {
          const text = sentence.map((segment) => segment.text).join('')
          expect(text).not.toMatch(/\[\w+\]/)
          expect(text.trim().length).toBeGreaterThan(0)
          expect(text).not.toMatch(/undefined|NaN/)
        }
      }
    }
  })

  // The same sweep in Czech. The English pool cannot catch a translation that dropped a
  // token — only running the catalog can, and this is the one failure in the feature that
  // is silent on screen: the sentence simply loses its subject.
  it('leaves no placeholder unfilled in Czech either', () => {
    const czech = resolverFor('cs')
    for (const poolKey of POOL_KEYS) {
      for (let week = 0; week < 60; week++) {
        const seed = `${poolKey}-cs-${week}`
        const { sentences } = composeRecap(simulateWeek(seed, poolKey), seed, czech)
        for (const sentence of sentences) {
          const text = sentence.map((segment) => segment.text).join('')
          expect(text, `${seed}: ${text}`).not.toMatch(/\[\w+\]/)
          expect(text).not.toMatch(/undefined|NaN/)
        }
      }
    }
  })

  it('says nothing about takeovers on a week nobody played', () => {
    const facts = weekForShape('empty', 'empty-test')
    expect(facts).not.toBeNull()
    if (facts === null) return
    expect(composeRecap(facts, 'seed', t).sentences).toHaveLength(1)
  })

  it('tells the same week the same way twice', () => {
    const facts = simulateWeek('stable', 'medium')
    expect(textOf(facts, 'fixed')).toBe(textOf(facts, 'fixed'))
  })

  it('keeps the same variant when the language changes', () => {
    const facts = simulateWeek('stable', 'medium')
    const english = composeRecap(facts, 'fixed', t)
    const czech = composeRecap(facts, 'fixed', resolverFor('cs'))
    // Same week, same seed: the structure is the same sentence count and the same shape,
    // whatever language it is told in.
    expect(czech.sentences).toHaveLength(english.sentences.length)
    expect(czech.shape.kind).toBe(english.shape.kind)
  })

  it('names the exception day in the prose of a sweepBut week', () => {
    const facts = weekForShape('sweepBut', 'but-test')
    expect(facts).not.toBeNull()
    if (facts === null) return
    const recap = composeRecap(facts, 'but-test', t)
    const [exception] = recap.shape.exceptions
    expect(exception).toBeDefined()
    if (exception === undefined) return
    const opener = recap.sentences[0]?.map((segment) => segment.text).join('') ?? ''
    const WEEKDAY_NAMES = [
      'Monday',
      'Tuesday',
      'Wednesday',
      'Thursday',
      'Friday',
      'Saturday',
      'Sunday',
    ]
    // The opener either names the day it lost or, with two exceptions, names both.
    expect(opener).toContain(WEEKDAY_NAMES[exception.dayIndex])
  })
})

describe('the Czech catalog', () => {
  // Sorted so the comparison is about which tokens a variant carries, not the order it
  // uses them in — a Czech sentence puts them where Czech puts them.
  const tokensIn = (text: string): string[] =>
    [...text.matchAll(/\[(\w+)\]/g)]
      .map((match) => match[1] ?? '')
      .sort((a, b) => a.localeCompare(b))

  it('carries every token its English source does', () => {
    const english = resolverFor('en')
    const czech = resolverFor('cs')
    for (const phrasing of ALL_PHRASINGS) {
      const source = english(phrasing)
      expect(tokensIn(czech(phrasing)), `translation of: ${source}`).toEqual(
        tokensIn(source),
      )
    }
  })
})

describe('name colours', () => {
  it('never gives two people in one recap the same colour', () => {
    for (const poolKey of POOL_KEYS) {
      for (let week = 0; week < 200; week++) {
        const seed = `${poolKey}-colour-${week}`
        const { sentences } = composeRecap(simulateWeek(seed, poolKey), seed, t)
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
