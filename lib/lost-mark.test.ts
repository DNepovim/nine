import { describe, expect, it } from 'vitest'

import { firstToRunOut, lostMark } from './lost-mark'

describe('lostMark', () => {
  it('is the middle of the target', () => {
    expect(lostMark({ position: { x: 10, y: 20 } }, 80)).toEqual({ x: 50, y: 60 })
  })
})

describe('firstToRunOut', () => {
  it('is nobody on an empty board', () => {
    expect(firstToRunOut([])).toBeNull()
  })

  it('goes by when the clock ends, not when the target arrived', () => {
    const early = { spawnedAt: 0, duration: 9000 }
    const short = { spawnedAt: 1000, duration: 2000 }
    expect(firstToRunOut([early, short])).toBe(short)
  })
})
