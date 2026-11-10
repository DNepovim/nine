import { describe, expect, it } from 'vitest'

import {
  dropPending,
  EMPTY_DRAWING,
  MAX_SEGMENTS,
  plotPoint,
  pointName,
  type Drawing,
} from '@/lib/segments'

const at = (x: number, y: number) => ({ x, y })

describe('plotPoint', () => {
  it('keeps the first tap and draws nothing yet', () => {
    const drawing = plotPoint(EMPTY_DRAWING, at(10, 20))
    expect(drawing.pending).toEqual(at(10, 20))
    expect(drawing.segments).toHaveLength(0)
  })

  it('rules a segment between the first tap and the second', () => {
    const drawing = plotPoint(plotPoint(EMPTY_DRAWING, at(10, 20)), at(90, 40))
    expect(drawing.segments).toEqual([{ from: at(10, 20), to: at(90, 40), at: 0 }])
    expect(drawing.pending).toBeNull()
  })

  it('holds five segments at once', () => {
    let drawing: Drawing = EMPTY_DRAWING
    for (let i = 0; i < MAX_SEGMENTS * 2 + 4; i++) drawing = plotPoint(drawing, at(i, i))
    expect(drawing.segments).toHaveLength(MAX_SEGMENTS)
  })

  it('rubs out the oldest to make room for a sixth, and goes on from where it left off', () => {
    let drawing: Drawing = EMPTY_DRAWING
    for (let i = 0; i < (MAX_SEGMENTS + 1) * 2; i++)
      drawing = plotPoint(drawing, at(i, 0))
    // The first is gone; the second to the sixth stand, each with the number it was ruled as.
    expect(drawing.segments.map((segment) => segment.at)).toEqual([1, 2, 3, 4, 5])
    expect(drawing.made).toBe(MAX_SEGMENTS + 1)
  })

  it('numbers a segment by how many were ruled before it', () => {
    const drawing = plotPoint(plotPoint(EMPTY_DRAWING, at(0, 0)), at(1, 1))
    expect(drawing.segments[0]?.at).toBe(0)
    expect(drawing.made).toBe(1)
  })
})

describe('dropPending', () => {
  it('takes back a half-made segment and nothing else', () => {
    const drawn = plotPoint(plotPoint(EMPTY_DRAWING, at(1, 1)), at(2, 2))
    const half = plotPoint(drawn, at(3, 3))
    expect(dropPending(half)).toEqual(drawn)
  })

  it('leaves a drawing with nothing waiting as it is', () => {
    expect(dropPending(EMPTY_DRAWING)).toBe(EMPTY_DRAWING)
  })
})

describe('pointName', () => {
  it('goes on through the alphabet, two to a segment', () => {
    expect([0, 1, 2, 3, 8, 9].map(pointName)).toEqual(['A', 'B', 'C', 'D', 'I', 'J'])
  })

  it('carries on past J, and begins again after Z', () => {
    expect([10, 11, 25, 26].map(pointName)).toEqual(['K', 'L', 'Z', 'A'])
  })
})
