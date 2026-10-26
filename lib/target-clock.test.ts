import { describe, expect, it } from 'vitest'

import { CARD_ENTER_MS, GLIMPSE_FADE_MS } from '@/constants/game'
import type { Target } from '@/machines/game'

import { glimpseLeft, remainingFraction } from './target-clock'

const target = (over: Partial<Target> = {}): Target => ({
  id: 1,
  seq: 1,
  value: 42,
  spawnedAt: 1_000,
  duration: 8_000,
  refAt: 1_000,
  refGrid: [0, 0, 0, 0, 0, 0, 0, 0, 0],
  par: 3,
  userSteps: 0,
  ...over,
})

describe('remainingFraction', () => {
  it('reads a target that has just arrived as a full ring', () => {
    expect(remainingFraction(target(), 1_000)).toBe(1)
  })

  it('reads half a clock as half a ring', () => {
    expect(remainingFraction(target(), 5_000)).toBe(0.5)
  })

  it('never reports more than a full ring', () => {
    expect(remainingFraction(target(), 0)).toBe(1)
  })

  it('never reports less than an empty one', () => {
    expect(remainingFraction(target(), 100_000)).toBe(0)
  })

  it('treats a target with no clock as already run out', () => {
    expect(remainingFraction(target({ duration: 0 }), 1_000)).toBe(0)
  })
})

describe('glimpseLeft', () => {
  it('hides nothing where the run has no glimpse', () => {
    expect(glimpseLeft(null, 0.2, 8_000)).toBeNull()
  })

  it('holds the whole glimpse after the card has come in', () => {
    expect(glimpseLeft(500, 1, 8_000)).toBe(500 + CARD_ENTER_MS)
  })

  it('takes off only the moments already gone, not the whole glimpse', () => {
    // A live card is drawn a hair after its target is dealt, so its ring starts a hair
    // under full. That hair is all it loses.
    expect(glimpseLeft(500, 0.999, 8_000)).toBe(492 + CARD_ENTER_MS)
  })

  it('draws a card put back long after its arrival already hidden', () => {
    expect(glimpseLeft(500, 0.5, 8_000)).toBe(0)
  })

  it('draws hidden a card with less left than the fade, rather than flashing it', () => {
    // 495 ms gone of 500: five left, under the fade, so nothing is shown again.
    expect(glimpseLeft(500, 1 - 495 / 8_000, 8_000)).toBe(0)
    // Exactly the fade is still worth a look.
    expect(glimpseLeft(500, 1 - 350 / 8_000, 8_000)).toBe(GLIMPSE_FADE_MS + CARD_ENTER_MS)
  })

  it('still shows a fresh card in a mode whose glimpse is shorter than the fade', () => {
    // A floor of the whole fade would hide every card of a 120 ms glimpse from the start.
    expect(glimpseLeft(120, 0.999, 8_000)).toBe(112 + CARD_ENTER_MS)
    // But one put back with most of it gone is still drawn hidden.
    expect(glimpseLeft(120, 1 - 100 / 8_000, 8_000)).toBe(0)
  })
})
