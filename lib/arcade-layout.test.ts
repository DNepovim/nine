import { describe, expect, it } from 'vitest'

import { AMBUSH_AT, GROUND_MIN } from '@/constants/ambush'
import { ANCHOR } from '@/constants/arcade'
import { HERO_AT, SIEGE_ZOOM, SKY, WALL_AT } from '@/constants/siege'
import { horizonOf, type Sheet } from '@/lib/arcade-tilt'
import { UP } from '@/machines/arcade'

import {
  ambushFrame,
  mouthStub,
  pitchFor,
  pointsOf,
  siegeFrame,
  splineFor,
  splinePath,
  splinePoint,
} from './arcade-layout'

const way = { to: '1.2', angle: UP + 0.3, reach: 1, value: 120, clockMs: 11000 }
const pitch = 132

describe('pitchFor', () => {
  it('takes a share of the canvas', () => {
    expect(pitchFor(330)).toBeCloseTo(132)
  })
})

describe('siegeFrame', () => {
  // Where the wall's foot line actually lands on the canvas: the anchor the camera would
  // have put the village on, plus whatever the lift carried the sheet by.
  const wallAt = (height: number, reach: number): number =>
    height * ANCHOR + siegeFrame(height, reach).lift

  // And where the hero ends up, which is the wall plus the ground the stand-off left in
  // front of it, read back through the camera the fight is fought under.
  const heroAt = (height: number, reach: number): number => {
    const { standoff } = siegeFrame(height, reach)
    return wallAt(height, reach) + (1 - standoff) * reach * pitchFor(height) * SIEGE_ZOOM
  }

  it('lifts the wall to the top of the canvas', () => {
    expect(wallAt(700, 1)).toBeCloseTo(700 * WALL_AT)
    expect(siegeFrame(700, 1).lift).toBeLessThan(0)
  })

  it('stands the hero at the foot of it, whatever the way in is worth', () => {
    for (const reach of [0.86, 1, 1.14]) {
      expect(heroAt(700, reach)).toBeCloseTo(700 * HERO_AT)
    }
  })

  it('keeps the sky the towers need on a canvas too short to spare it', () => {
    expect(wallAt(300, 1)).toBeCloseTo(SKY * SIEGE_ZOOM)
    expect(wallAt(300, 1)).toBeGreaterThan(300 * WALL_AT)
  })

  it('holds the hero on the way in rather than behind it', () => {
    for (const height of [300, 500, 700, 1200]) {
      for (const reach of [0.86, 1, 1.14]) {
        const { standoff } = siegeFrame(height, reach)
        expect(standoff).toBeGreaterThan(0)
        expect(standoff).toBeLessThan(1)
      }
    }
  })

  it('leaves the ground alone on a canvas with no height at all', () => {
    expect(Number.isFinite(siegeFrame(0, 1).standoff)).toBe(true)
  })
})

describe('ambushFrame', () => {
  // Where the hero is actually drawn: the anchor the camera would have put the way's far
  // village on, plus the lift, plus however much of the way is still in front of it — read
  // through the zoom the fight is fought under, which is the siege's own.
  const heroAt = (width: number, height: number, reach: number): number => {
    const frame = ambushFrame(width, height, reach)
    return (
      height * ANCHOR +
      frame.lift +
      (1 - frame.standoff) * reach * pitchFor(height) * SIEGE_ZOOM
    )
  }

  it('stands the hero in the middle of the canvas, whatever the way is worth', () => {
    for (const reach of [0.86, 1, 1.14]) {
      expect(heroAt(390, 700, reach)).toBeCloseTo(700 * AMBUSH_AT)
    }
  })

  it('stands it there on a short screen too', () => {
    expect(heroAt(320, 480, 1)).toBeCloseTo(480 * AMBUSH_AT)
  })

  it('springs the fight partway along the way rather than at either end of it', () => {
    const { standoff } = ambushFrame(390, 700, 1)
    expect(standoff).toBeGreaterThan(0.2)
    expect(standoff).toBeLessThan(0.5)
  })

  it('leaves a ring of ground that fits inside the canvas', () => {
    for (const [width, height] of [
      [390, 700],
      [320, 480],
      [768, 1024],
    ]) {
      const { ground } = ambushFrame(width ?? 0, height ?? 0, 1)
      // Drawn at the zoom, the ring either side of the hero has to fit the shorter side.
      expect(ground * 2 * SIEGE_ZOOM).toBeLessThanOrEqual(
        Math.min(width ?? 0, height ?? 0),
      )
      expect(ground).toBeGreaterThan(0)
    }
  })

  it('keeps a ring to fight in on a canvas with no room for one', () => {
    expect(ambushFrame(120, 120, 1).ground).toBe(GROUND_MIN)
  })
})

describe('splineFor', () => {
  it('ends where the way ends', () => {
    const s = splineFor(way, UP, pitch)
    expect(Math.hypot(s.toX, s.toY)).toBeCloseTo(pitch * way.reach)
    expect(Math.atan2(s.toY, s.toX)).toBeCloseTo(way.angle)
  })

  it('measures the curve, which is never shorter than the straight line', () => {
    const s = splineFor(way, UP + 0.6, pitch)
    const chord = Math.hypot(s.toX, s.toY)
    expect(s.length).toBeGreaterThanOrEqual(chord - 0.001)
    expect(s.length).toBeLessThan(chord * 1.5)
  })

  // A way is a road on a map: the camera moves it and nothing else does. Two readings of
  // the same way, any number of frames apart, are the same curve.
  it('holds still', () => {
    const a = splineFor(way, UP, pitch)
    const b = splineFor(way, UP, pitch)
    expect(a).toEqual(b)
  })
})

describe('splinePoint', () => {
  it('starts on the crossroad and ends on the bud', () => {
    const s = splineFor(way, UP, pitch)
    const start = splinePoint(s, 0)
    expect(start.x).toBeCloseTo(0)
    expect(start.y).toBeCloseTo(0)
    const end = splinePoint(s, 1)
    expect(end.x).toBeCloseTo(s.toX)
    expect(end.y).toBeCloseTo(s.toY)
  })

  it('climbs the whole way there', () => {
    const s = splineFor(way, UP, pitch)
    let last = 0
    for (let i = 1; i <= 10; i++) {
      const y = splinePoint(s, i / 10).y
      expect(y).toBeLessThan(last)
      last = y
    }
  })
})

// The sheet read flat on, which is every sum in here but the last two.
const level: Sheet = {
  x: 0,
  y: 0,
  turn: 0,
  scale: 1,
  tilt: 0,
  horizon: horizonOf(330),
}

describe('splinePath', () => {
  it('draws from the crossroad in the box to the way’s end', () => {
    const s = splineFor(way, UP, pitch)
    const d = splinePath(s, 200, 200, level, 0, 0)
    expect(d.startsWith('M200 200 C')).toBe(true)
    expect(d.endsWith(`${200 + s.toX} ${200 + s.toY}`)).toBe(true)
  })

  it('draws a way running up the tilted sheet short of its own length', () => {
    const s = splineFor(way, UP, pitch)
    const tilted: Sheet = { ...level, tilt: 1 }
    const flat = splinePath(s, 200, 200, level, 0, 0)
    const lean = splinePath(s, 200, 200, tilted, 0, 0)
    expect(lean).not.toEqual(flat)
    // The tip, which is the last pair of numbers in the path.
    const tip = (d: string): number => Number(d.split(' ').slice(-1)[0])
    // Drawn nearer the crossroad than the flat sheet put it: both are above the box's own
    // middle, and the tilted one is the less far above it.
    expect(tip(flat)).toBeLessThan(200)
    expect(tip(lean)).toBeGreaterThan(tip(flat))
    expect(tip(lean)).toBeLessThan(200)
  })

  it('still leaves the crossroad from the middle of its own box', () => {
    // The box is carried to the crossroad's drawn place by the view it is in, so the curve
    // in it always starts where it always did, however far off the crossroad is.
    const s = splineFor(way, UP, pitch)
    const tilted: Sheet = { ...level, tilt: 1 }
    const d = splinePath(s, 200, 200, tilted, 0, -900)
    expect(d.startsWith('M200 200 C')).toBe(true)
  })
})

describe('mouthStub', () => {
  it('hangs straight down, and shorter than a way', () => {
    const s = mouthStub(pitch)
    expect(s.toX).toBeCloseTo(0)
    expect(s.toY).toBeGreaterThan(0)
    expect(s.toY).toBeLessThan(pitch)
  })
})

describe('pointsOf', () => {
  it('turns pitches into points', () => {
    expect(pointsOf({ x: 1, y: -2.5 }, 100)).toEqual({ x: 100, y: -250 })
  })
})
