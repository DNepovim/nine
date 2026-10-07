import { describe, expect, it } from 'vitest'

import { ANCHOR } from '@/constants/arcade'

import { horizonOf, tiltedAt, tiltedWindow, type Sheet } from './arcade-tilt'

const CANVAS = { width: 390, height: 700 }
const ANCHOR_Y = CANVAS.height * ANCHOR

// A sheet with the hero's crossroad at the origin and nothing else going on: no pan, no
// turn, no zoom, the tilt fully on.
const flat: Sheet = {
  x: 0,
  y: 0,
  turn: 0,
  scale: 1,
  tilt: 1,
  horizon: horizonOf(CANVAS.height),
}

describe('tiltedAt', () => {
  it('leaves the row the hero stands on exactly where it is', () => {
    const lie = tiltedAt(flat, 0, 0)
    expect(lie.x).toBeCloseTo(0)
    expect(lie.y).toBeCloseTo(0)
    expect(lie.scale).toBeCloseTo(1)
  })

  it('draws what is further up the sheet smaller', () => {
    const near = tiltedAt(flat, 0, -100)
    const far = tiltedAt(flat, 0, -400)
    expect(near.scale).toBeLessThan(1)
    expect(far.scale).toBeLessThan(near.scale)
  })

  it('draws what is below the reader larger', () => {
    expect(tiltedAt(flat, 0, 120).scale).toBeGreaterThan(1)
  })

  it('pulls what is further up closer to its neighbours', () => {
    // Two marks a pitch apart, twice: once under the reader and once well up the sheet. The
    // far pair has to be drawn closer together than the near one — that is the whole effect.
    const pitch = 280
    const near = tiltedAt(flat, 0, 0).y - tiltedAt(flat, 0, -pitch).y
    const far = tiltedAt(flat, 0, -pitch * 3).y - tiltedAt(flat, 0, -pitch * 4).y
    expect(far).toBeLessThan(near)
    expect(far).toBeGreaterThan(0)
  })

  it('pulls what is further up towards the centre line', () => {
    const near = tiltedAt(flat, 200, 0)
    const far = tiltedAt(flat, 200, -500)
    expect(near.x).toBeCloseTo(200)
    expect(Math.abs(far.x)).toBeLessThan(200)
  })

  it('never crosses its own horizon', () => {
    for (const up of [1e3, 1e4, 1e6]) {
      expect(tiltedAt(flat, 0, -up).y).toBeGreaterThan(-flat.horizon)
    }
  })

  it('leaves the sheet alone when the tilt is off', () => {
    const level: Sheet = { ...flat, tilt: 0 }
    const lie = tiltedAt(level, 140, -320)
    expect(lie.x).toBeCloseTo(140)
    expect(lie.y).toBeCloseTo(-320)
    expect(lie.scale).toBeCloseTo(1)
  })

  it('reads depth off the screen rather than off the sheet, whichever way it is turned', () => {
    // The same mark, with the sheet turned a quarter: it now lies off to the side of the
    // reader rather than up the screen, so it is drawn at full size.
    const up = tiltedAt(flat, 0, -300)
    const across = tiltedAt({ ...flat, turn: Math.PI / 2 }, 0, -300)
    expect(up.scale).toBeLessThan(1)
    expect(across.scale).toBeCloseTo(1)
  })

  it('follows the pan: a mark is as far off as the camera has left it', () => {
    // The camera has drifted a pitch up the sheet, so the mark a pitch above the origin is
    // now under the reader and drawn at full size.
    const panned: Sheet = { ...flat, y: 280 }
    expect(tiltedAt(panned, 0, -280).scale).toBeCloseTo(1)
  })

  it('answers in sheet points, so the zoom is taken back off', () => {
    const zoomed: Sheet = { ...flat, scale: 2 }
    const lie = tiltedAt(zoomed, 0, -100)
    // Drawn at the depth two hundred screen points away rather than one hundred.
    expect(lie.scale).toBeCloseTo(tiltedAt(flat, 0, -200).scale)
  })
})

describe('tiltedWindow', () => {
  const window = tiltedWindow(CANVAS)

  it('sees further up the sheet than the canvas is tall', () => {
    expect(window.up).toBeGreaterThan(ANCHOR_Y)
  })

  it('sees less below the reader than the canvas has room for', () => {
    expect(window.down).toBeLessThan(CANVAS.height - ANCHOR_Y)
    expect(window.down).toBeGreaterThan(0)
  })

  it('reaches wider than the canvas, the sheet running out past its own edges', () => {
    expect(window.wide).toBeGreaterThan(CANVAS.width / 2)
  })

  it('reaches exactly the edges of the canvas it was measured from', () => {
    // The top of the window is drawn on the top edge, and the bottom of it on the bottom
    // edge: the window and the projection are the same sum run in opposite directions.
    expect(tiltedAt(flat, 0, -window.up).y).toBeCloseTo(-ANCHOR_Y)
    expect(tiltedAt(flat, 0, window.down).y).toBeCloseTo(CANVAS.height - ANCHOR_Y)
  })

  it('reaches the side of the canvas at its furthest row', () => {
    const lie = tiltedAt(flat, window.wide, -window.up)
    expect(lie.x).toBeCloseTo(CANVAS.width / 2)
  })
})
