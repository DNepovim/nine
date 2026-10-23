import { describe, expect, it } from 'vitest'

import { linesFor } from './stat-people'
import type { StatsPerson } from './stats'

const person = (over: Partial<StatsPerson>): StatsPerson => ({
  userId: 'u',
  nickname: null,
  joined: false,
  runs: 0,
  hits: 0,
  elapsedMs: 0,
  ...over,
})

const people: StatsPerson[] = [
  person({
    userId: 'a',
    nickname: 'ADA',
    joined: true,
    runs: 2,
    hits: 30,
    elapsedMs: 90_000,
  }),
  person({ userId: 'b', nickname: 'BO', runs: 5, hits: 10, elapsedMs: 30_000 }),
  person({ userId: 'c', joined: true }),
  person({ userId: 'd', joined: true, runs: 1, hits: 4, elapsedMs: 60_000 }),
]

describe('linesFor', () => {
  it('lists who joined, carrying their runs, with the unnamed folded in last', () => {
    expect(linesFor('joined', people)).toEqual([
      { userId: 'a', nickname: 'ADA', count: 1, figure: 2 },
      { userId: null, nickname: null, count: 2, figure: 1 },
    ])
  })

  it('counts only the named among the joined on NAMED', () => {
    expect(linesFor('named', people).map((line) => line.userId)).toEqual(['a'])
  })

  it('orders the run tiles by their own figure', () => {
    expect(linesFor('runs', people).map((line) => line.nickname)).toEqual([
      'BO',
      'ADA',
      null,
    ])
    expect(linesFor('hits', people).map((line) => line.nickname)).toEqual([
      'ADA',
      'BO',
      null,
    ])
  })

  it('leaves anybody who did not play off the run tiles', () => {
    expect(linesFor('played', people).some((line) => line.userId === 'c')).toBe(false)
  })

  it('gives minutes unrounded, so the list adds up to the tile', () => {
    expect(linesFor('minutes', people)[0]).toMatchObject({ nickname: 'ADA', figure: 1.5 })
  })
})
