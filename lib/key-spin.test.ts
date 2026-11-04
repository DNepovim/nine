import { describe, expect, it } from 'vitest'

import { keySpinDegrees } from './key-spin'

describe('keySpinDegrees', () => {
  it('holds a key still until the edge is nearly on it', () => {
    expect(keySpinDegrees(0, 0.3)).toBe(0)
  })

  it('is half way round when the edge is on it', () => {
    expect(keySpinDegrees(0.5, 0.5)).toBeCloseTo(90)
  })

  it('ends back to front once the edge has gone past', () => {
    expect(keySpinDegrees(1, 0.8)).toBe(180)
  })

  it('turns a key further left sooner than one further right', () => {
    expect(keySpinDegrees(0.4, 0.3)).toBeGreaterThan(keySpinDegrees(0.4, 0.7))
  })
})
