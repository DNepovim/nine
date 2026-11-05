import { describe, expect, it } from 'vitest'

import { fallMs, roadside } from '@/lib/plane'

describe('fallMs', () => {
  it('is nothing for a plane already at the ground', () => {
    expect(fallMs(700, 0, 700)).toBe(0)
  })

  it('takes longer from higher up', () => {
    expect(fallMs(100, 0, 700)).toBeGreaterThan(fallMs(400, 0, 700))
  })

  it('takes longer for a plane still climbing than for one already falling', () => {
    expect(fallMs(300, -300, 700)).toBeGreaterThan(fallMs(300, 300, 700))
  })

  it('is a second or two from the top of a phone screen', () => {
    const ms = fallMs(80, 0, 750)
    expect(ms).toBeGreaterThan(1000)
    expect(ms).toBeLessThan(3000)
  })
})

describe('roadside', () => {
  it('is the same ground for the same seed', () => {
    expect(roadside(3, 8, 2000)).toEqual(roadside(3, 8, 2000))
    expect(roadside(3, 8, 2000)).not.toEqual(roadside(4, 8, 2000))
  })

  it('spreads its things along the track in order, none on the edge of it', () => {
    const items = roadside(3, 8, 2000)
    expect(items).toHaveLength(8)
    const at = items.map((item) => item.at)
    expect(at).toEqual([...at].sort((a, b) => a - b))
    expect(Math.min(...at)).toBeGreaterThan(0)
    expect(Math.max(...at)).toBeLessThan(2000)
  })

  it('never puts one kind next to the same kind', () => {
    const kinds = roadside(9, 12, 3000).map((item) => item.kind)
    kinds.slice(1).forEach((kind, index) => {
      expect(kind).not.toBe(kinds[index])
    })
  })
})
