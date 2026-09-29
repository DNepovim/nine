import { describe, expect, it } from 'vitest'

import { PIE_SIZE } from '@/constants/game'
import { tipForTarget } from '@/lib/tutorial-tip'

const CARD = 44
const CANVAS = 300

describe('tipForTarget', () => {
  it('sits under a target with room below it, pointing up', () => {
    const tip = tipForTarget({ x: 40, y: 20 }, CANVAS, CARD)
    expect(tip.beak).toBe('up')
    expect(tip.top).toBe(20 + PIE_SIZE + 6)
  })

  it('flips over a target with no room below it, pointing down', () => {
    const low = CANVAS - PIE_SIZE - 10
    const tip = tipForTarget({ x: 40, y: low }, CANVAS, CARD)
    expect(tip.beak).toBe('down')
    expect(tip.top).toBe(low - CARD - 6)
  })

  it('never lands the card clear of the target it points at', () => {
    // Whichever side it takes, the card and the target must not share any rows — the
    // whole defect this function exists for is a card drawn across its own subject.
    for (let y = 0; y + PIE_SIZE <= CANVAS; y += 5) {
      const tip = tipForTarget({ x: 0, y }, CANVAS, CARD)
      const cardBottom = tip.top + CARD
      const targetBottom = y + PIE_SIZE
      const overlaps = tip.top < targetBottom && cardBottom > y
      // A canvas too short to hold both is the one case where they must overlap; a real
      // one is several times this tall.
      if (CANVAS >= PIE_SIZE + CARD + 6) expect(overlaps).toBe(false)
    }
  })

  it('stays inside the canvas when the target is against the top edge', () => {
    expect(tipForTarget({ x: 0, y: 0 }, PIE_SIZE + 10, CARD).top).toBeGreaterThanOrEqual(
      0,
    )
  })

  it('aims the beak at the middle of the target', () => {
    expect(tipForTarget({ x: 100, y: 0 }, CANVAS, CARD).beakAt).toBe(100 + PIE_SIZE / 2)
  })
})
