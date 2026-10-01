import { describe, expect, it } from 'vitest'

import type { Grid } from '@/machines/game'
import { computePar } from '@/machines/scoring'

import {
  crossroadClock,
  idSeed,
  newMap,
  openCrossroad,
  rngFor,
  seeded,
  START,
  trail,
  UP,
  wayInto,
  wayValues,
  type Crossroad,
} from './arcade'

const zeros: Grid = [
  [0, 0, 0],
  [0, 0, 0],
  [0, 0, 0],
]

const busy: Grid = [
  [3, 7, 1],
  [9, 2, 4],
  [0, 6, 8],
]

describe('seeded', () => {
  it('gives the same sequence for the same seed', () => {
    const a = seeded(42)
    const b = seeded(42)
    expect([a(), a(), a()]).toEqual([b(), b(), b()])
  })

  it('stays inside [0, 1)', () => {
    const rng = seeded(7)
    for (let i = 0; i < 500; i++) {
      const value = rng()
      expect(value).toBeGreaterThanOrEqual(0)
      expect(value).toBeLessThan(1)
    }
  })
})

describe('idSeed', () => {
  it('answers the same for the same crossroad', () => {
    expect(idSeed('1.2.0')).toBe(idSeed('1.2.0'))
  })

  it('answers differently for crossroads beside each other', () => {
    expect(idSeed('1.0')).not.toBe(idSeed('1.1'))
  })
})

describe('newMap', () => {
  it('starts on one crossroad, pointing up, with nothing grown yet', () => {
    const map = newMap()
    expect(Object.keys(map)).toEqual([START])
    expect(map[START]).toEqual({
      id: START,
      from: null,
      depth: 0,
      heading: UP,
      pos: { x: 0, y: 0 },
      ways: [],
    })
  })
})

describe('wayValues', () => {
  it('only offers targets inside the par band', () => {
    const values = wayValues(busy, 4, seeded(3))
    expect(values).toHaveLength(4)
    for (const value of values) {
      const par = computePar(busy, value)
      expect(par).toBeGreaterThanOrEqual(3)
      expect(par).toBeLessThanOrEqual(4)
    }
  })

  it('never repeats a target at one crossroad', () => {
    for (let seed = 0; seed < 30; seed++) {
      const values = wayValues(zeros, 4, seeded(seed))
      expect(new Set(values).size).toBe(values.length)
    }
  })

  it('reaches past the lowest sums in the band', () => {
    // Taken in order rather than shuffled, every crossroad would offer the same few small
    // numbers — this is what says it does not.
    const seen = new Set<number>()
    for (let seed = 0; seed < 40; seed++) {
      for (const value of wayValues(zeros, 4, seeded(seed))) seen.add(value)
    }
    expect(seen.size).toBeGreaterThan(20)
    expect(Math.max(...seen)).toBeGreaterThan(100)
  })
})

describe('openCrossroad', () => {
  it('grows two to four ways, each with a crossroad at its end', () => {
    for (let seed = 0; seed < 25; seed++) {
      const map = openCrossroad(newMap(), START, zeros, seeded(seed))
      const ways = map[START]?.ways ?? []
      expect(ways.length).toBeGreaterThanOrEqual(2)
      expect(ways.length).toBeLessThanOrEqual(4)
      for (const way of ways) {
        const next = map[way.to]
        expect(next?.from).toBe(START)
        expect(next?.depth).toBe(1)
        expect(next?.ways).toEqual([])
      }
    }
  })

  it('climbs: every way out of a crossroad points upward', () => {
    for (let seed = 0; seed < 25; seed++) {
      const map = openCrossroad(newMap(), START, zeros, seeded(seed))
      for (const way of map[START]?.ways ?? []) {
        // y grows downward, so a way that climbs has a negative y component — and its end
        // sits above where it started.
        expect(Math.sin(way.angle)).toBeLessThan(0)
        expect(map[way.to]?.pos.y).toBeLessThan(0)
      }
    }
  })

  it('keeps a crossroad it has already answered for', () => {
    const grown = openCrossroad(newMap(), START, zeros, seeded(11))
    // A retreat comes back with a different grid; the ways it finds are the ones it left.
    const again = openCrossroad(grown, START, busy, seeded(99))
    expect(again).toBe(grown)
  })

  it('leaves a crossroad it has never heard of alone', () => {
    const map = newMap()
    expect(openCrossroad(map, 'nowhere', zeros, seeded(1))).toBe(map)
  })
})

describe('rngFor', () => {
  it('grows the same crossroad the same way, however often it is asked', () => {
    const once = openCrossroad(newMap(), START, zeros, rngFor(99, START))
    const twice = openCrossroad(newMap(), START, zeros, rngFor(99, START))
    expect(twice).toEqual(once)
  })

  it('gives two crossroads of one run fans of their own', () => {
    const elsewhere: Crossroad = {
      id: '7',
      from: null,
      depth: 0,
      heading: UP,
      pos: { x: 0, y: 0 },
      ways: [],
    }
    const first = openCrossroad(newMap(), START, zeros, rngFor(99, START))[START]?.ways
    const second = openCrossroad(
      { ...newMap(), '7': elsewhere },
      '7',
      zeros,
      rngFor(99, '7'),
    )['7']?.ways
    expect(second).not.toEqual(first)
  })
})

describe('wayInto', () => {
  it('has nothing to answer at the start', () => {
    expect(wayInto(openCrossroad(newMap(), START, zeros, seeded(5)), START)).toBeNull()
  })

  it('names the way that reached a crossroad', () => {
    const map = openCrossroad(newMap(), START, zeros, seeded(5))
    const first = map[START]?.ways[0]
    expect(wayInto(map, first?.to ?? '')).toEqual(first)
  })
})

describe('trail', () => {
  it('walks back from the hero, most recent way first', () => {
    let map = openCrossroad(newMap(), START, zeros, seeded(2))
    const one = map[START]?.ways[0]?.to ?? ''
    map = openCrossroad(map, one, busy, seeded(3))
    const two = map[one]?.ways[0]?.to ?? ''
    map = openCrossroad(map, two, zeros, seeded(4))

    const steps = trail(map, two, 4)
    expect(steps).toHaveLength(2)
    expect(steps[0]?.from.id).toBe(one)
    expect(steps[0]?.way.to).toBe(two)
    expect(steps[1]?.from.id).toBe(START)
    expect(steps[1]?.way.to).toBe(one)
  })

  it('stops at the depth it was asked for', () => {
    let map = openCrossroad(newMap(), START, zeros, seeded(2))
    let at = START
    for (let i = 0; i < 5; i++) {
      const next = map[at]?.ways[0]?.to ?? ''
      map = openCrossroad(map, next, busy, seeded(10 + i))
      at = next
    }
    expect(trail(map, at, 3)).toHaveLength(3)
  })

  it('has nothing behind the start', () => {
    expect(trail(newMap(), START, 3)).toEqual([])
  })
})

describe('crossroadClock', () => {
  it('gives Easy the longest and Extreme the shortest', () => {
    expect(crossroadClock(0, 'easy')).toBeGreaterThan(crossroadClock(0, 'hard'))
    expect(crossroadClock(0, 'hard')).toBeGreaterThan(crossroadClock(0, 'extreme'))
  })

  it('tightens as the run climbs, without ever reaching nothing', () => {
    const start = crossroadClock(0, 'hard')
    expect(crossroadClock(24, 'hard')).toBeLessThan(start)
    // The curve decays toward 55% of where it began and never past it.
    expect(crossroadClock(500, 'hard')).toBeGreaterThan(start * 0.54)
  })
})
