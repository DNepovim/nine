import { describe, expect, it } from 'vitest'

import { defineDial, NINE_DIAL } from '@/modes'

import { targetBand } from './target-band'

describe('targetBand', () => {
  it('puts values under 100 in band 0', () => {
    expect(targetBand(0, NINE_DIAL.maxSum)).toBe(0)
    expect(targetBand(99, NINE_DIAL.maxSum)).toBe(0)
  })

  it('bands by hundreds digit', () => {
    expect(targetBand(100, NINE_DIAL.maxSum)).toBe(1)
    expect(targetBand(123, NINE_DIAL.maxSum)).toBe(1)
    expect(targetBand(223, NINE_DIAL.maxSum)).toBe(2)
    expect(targetBand(300, NINE_DIAL.maxSum)).toBe(3)
  })

  it('clamps the top of the range to the top band that board reaches', () => {
    expect(targetBand(324, NINE_DIAL.maxSum)).toBe(3)
    expect(targetBand(999, NINE_DIAL.maxSum)).toBe(3)
  })

  it('clamps negatives to band 0', () => {
    expect(targetBand(-50, NINE_DIAL.maxSum)).toBe(0)
  })

  // The widest dial in the app: four rows of four, reaching 900. Every band above 3
  // exists for this, and the whole of what went wrong before they did is the first
  // assertion here — `BANDS` stopped at 3, the lookup missed, and the `?? 0` drew a 457
  // in the track that means *under a hundred*.
  describe('on a dial that reaches further than the nine', () => {
    const wide = defineDial({ id: 'test-four-by-four', rows: 4, cols: 4 })

    it('bands the higher hundreds as themselves, not as band 0', () => {
      expect(targetBand(457, wide.maxSum)).toBe(4)
      expect(targetBand(500, wide.maxSum)).toBe(5)
      expect(targetBand(699, wide.maxSum)).toBe(6)
      expect(targetBand(880, wide.maxSum)).toBe(8)
    })

    it('reads the top of that dial as band 9', () => {
      expect(wide.maxSum).toBe(900)
      expect(targetBand(900, wide.maxSum)).toBe(9)
    })

    it('still bands the low hundreds the way every other board does', () => {
      // A wide dial does not re-scale the bands — a 123 is a 123 wherever it is dialled,
      // and wears the same track on both boards.
      expect(targetBand(99, wide.maxSum)).toBe(0)
      expect(targetBand(123, wide.maxSum)).toBe(targetBand(123, NINE_DIAL.maxSum))
    })
  })
})
