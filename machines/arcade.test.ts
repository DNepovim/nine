import { describe, expect, it } from 'vitest'

import { computePar } from '@/machines/scoring'
import { NINE_DIAL, type Grid } from '@/modes'

import {
  crossroadClock,
  idSeed,
  isStrike,
  newMap,
  openCrossroad,
  seeded,
  START,
  straightestWay,
  trail,
  UP,
  wayInto,
  wayValues,
  type Crossroad,
} from './arcade'

const zeros: Grid = [0, 0, 0, 0, 0, 0, 0, 0, 0]

const busy: Grid = [3, 7, 1, 9, 2, 4, 0, 6, 8]

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
    const map = newMap(1)
    expect(Object.keys(map)).toEqual([START])
    const start = map[START]
    // Named when it is created, like every crossroad — see lib/place-names.ts. The name
    // itself is the generator's business, so this only asks that there is one.
    expect(start?.name).toMatch(/^[A-Z][a-z]+( [A-Z][a-z]+)?$/)
    expect({ ...start, name: '' }).toEqual({
      id: START,
      name: '',
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
      const par = computePar(NINE_DIAL, busy, value)
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
      const map = openCrossroad(newMap(1), START, zeros, seed)
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
      const map = openCrossroad(newMap(1), START, zeros, seed)
      for (const way of map[START]?.ways ?? []) {
        // y grows downward, so a way that climbs has a negative y component — and its end
        // sits above where it started.
        expect(Math.sin(way.angle)).toBeLessThan(0)
        expect(map[way.to]?.pos.y).toBeLessThan(0)
      }
    }
  })

  it('keeps a crossroad it has already answered for', () => {
    const grown = openCrossroad(newMap(1), START, zeros, 11)
    // A retreat comes back with a different grid; the ways it finds are the ones it left.
    const again = openCrossroad(grown, START, busy, 99)
    expect(again).toBe(grown)
  })

  it('leaves a crossroad it has never heard of alone', () => {
    const map = newMap(1)
    expect(openCrossroad(map, 'nowhere', zeros, 1)).toBe(map)
  })
})

describe('rngFor', () => {
  it('grows the same crossroad the same way, however often it is asked', () => {
    const once = openCrossroad(newMap(1), START, zeros, 99)
    const twice = openCrossroad(newMap(1), START, zeros, 99)
    expect(twice).toEqual(once)
  })

  it('gives two crossroads of one run fans of their own', () => {
    const elsewhere: Crossroad = {
      id: '7',
      name: 'Elsewhere',
      from: null,
      depth: 0,
      heading: UP,
      pos: { x: 0, y: 0 },
      ways: [],
    }
    const first = openCrossroad(newMap(1), START, zeros, 99)[START]?.ways
    const second = openCrossroad({ ...newMap(1), '7': elsewhere }, '7', zeros, 99)['7']
      ?.ways
    expect(second).not.toEqual(first)
  })
})

describe('wayInto', () => {
  it('has nothing to answer at the start', () => {
    expect(wayInto(openCrossroad(newMap(1), START, zeros, 5), START)).toBeNull()
  })

  it('names the way that reached a crossroad', () => {
    const map = openCrossroad(newMap(1), START, zeros, 5)
    const first = map[START]?.ways[0]
    expect(wayInto(map, first?.to ?? '')).toEqual(first)
  })
})

describe('trail', () => {
  it('walks back from the hero, most recent way first', () => {
    let map = openCrossroad(newMap(1), START, zeros, 2)
    const one = map[START]?.ways[0]?.to ?? ''
    map = openCrossroad(map, one, busy, 3)
    const two = map[one]?.ways[0]?.to ?? ''
    map = openCrossroad(map, two, zeros, 4)

    const steps = trail(map, two, 4)
    expect(steps).toHaveLength(2)
    expect(steps[0]?.from.id).toBe(one)
    expect(steps[0]?.way.to).toBe(two)
    expect(steps[1]?.from.id).toBe(START)
    expect(steps[1]?.way.to).toBe(one)
  })

  it('stops at the depth it was asked for', () => {
    let map = openCrossroad(newMap(1), START, zeros, 2)
    let at = START
    for (let i = 0; i < 5; i++) {
      const next = map[at]?.ways[0]?.to ?? ''
      map = openCrossroad(map, next, busy, 10 + i)
      at = next
    }
    expect(trail(map, at, 3)).toHaveLength(3)
  })

  it('has nothing behind the start', () => {
    expect(trail(newMap(1), START, 3)).toEqual([])
  })
})

describe('crossroadClock', () => {
  it('gives the first crossroad the whole clock', () => {
    expect(crossroadClock(0)).toBe(11000)
  })

  it('tightens as the run climbs, without ever reaching nothing', () => {
    const start = crossroadClock(0)
    expect(crossroadClock(24)).toBeLessThan(start)
    // The curve decays toward 55% of where it began and never past it, so a deep run is
    // the hardest the mode gets and is still playable.
    expect(crossroadClock(500)).toBeGreaterThan(start * 0.54)
  })
})

describe('isStrike', () => {
  it('is a crossroad answered with most of its clock still full', () => {
    expect(isStrike(9000, 12000)).toBe(true)
  })

  it('is not one answered at leisure', () => {
    expect(isStrike(6000, 12000)).toBe(false)
  })

  it('holds to the bar Speed’s streak already uses', () => {
    // 0.6 of the clock left, exactly — the bar is `more than`, so this is not a strike.
    expect(isStrike(7200, 12000)).toBe(false)
    expect(isStrike(7300, 12000)).toBe(true)
  })

  it('answers no for a crossroad with no clock at all', () => {
    expect(isStrike(0, 0)).toBe(false)
  })
})

describe('straightestWay', () => {
  it('carries straight on, taking the way closest to the heading it arrived on', () => {
    const at: Crossroad = {
      id: '0',
      name: 'Testbury',
      from: START,
      depth: 1,
      heading: UP,
      pos: { x: 0, y: -1 },
      ways: [
        { to: '0.0', angle: UP - 0.5, reach: 1, value: 10 },
        { to: '0.1', angle: UP + 0.08, reach: 1, value: 20 },
        { to: '0.2', angle: UP + 0.4, reach: 1, value: 30 },
      ],
    }
    expect(straightestWay(at)?.to).toBe('0.1')
  })

  it('measures the bend the short way round the circle', () => {
    // A heading just past the half-turn and a way just short of it are neighbours, however
    // far apart the two numbers look.
    const at: Crossroad = {
      id: '0',
      name: 'Testbury',
      from: START,
      depth: 1,
      heading: Math.PI - 0.05,
      pos: { x: 0, y: 0 },
      ways: [
        { to: '0.0', angle: -Math.PI + 0.05, reach: 1, value: 10 },
        { to: '0.1', angle: Math.PI - 0.9, reach: 1, value: 20 },
      ],
    }
    expect(straightestWay(at)?.to).toBe('0.0')
  })

  it('has nothing to answer for a crossroad with no ways, or none at all', () => {
    expect(straightestWay(newMap(1)[START])).toBeNull()
    expect(straightestWay(undefined)).toBeNull()
  })
})
