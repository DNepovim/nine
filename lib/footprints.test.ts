import { describe, expect, it } from 'vitest'

import { legOpacity, printsOf, STRIDE } from '@/lib/footprints'

describe('printsOf', () => {
  it('stands a print every stride along the line, between the two gaps', () => {
    const prints = printsOf({ x: 0, y: 0 }, { x: 300, y: 0 }, 20, 20, 1)
    expect(prints).toHaveLength(Math.floor(260 / STRIDE))
    expect(prints.every((print) => print.angle === 0)).toBe(true)
  })

  it('alternates sides, starting on the one it is given', () => {
    const prints = printsOf({ x: 0, y: 0 }, { x: 300, y: 0 }, 0, 0, -1)
    expect(prints.map((print) => print.side).slice(0, 4)).toEqual([-1, 1, -1, 1])
  })

  it('lands the prints in order along the leg', () => {
    const prints = printsOf({ x: 0, y: 0 }, { x: 0, y: 200 }, 10, 10, 1)
    const order = prints.map((print) => print.at)
    expect(order).toEqual([...order].sort((a, b) => a - b))
  })

  it('keeps one print on a leg too short for two', () => {
    expect(printsOf({ x: 0, y: 0 }, { x: 30, y: 0 }, 8, 8, 1)).toHaveLength(1)
  })
})

describe('legOpacity', () => {
  it('draws the newest leg solid and fades the older ones to a floor', () => {
    expect(legOpacity(0)).toBe(1)
    expect(legOpacity(3)).toBeLessThan(legOpacity(1))
    expect(legOpacity(50)).toBeGreaterThan(0)
  })
})
