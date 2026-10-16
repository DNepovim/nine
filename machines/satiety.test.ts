import { describe, expect, it } from 'vitest'

import {
  BITE_MAX,
  BITE_MIN,
  biteFor,
  FULL,
  RETREAT_BITE,
  SATIETY_DIRE,
  SATIETY_LOW,
  spent,
  starving,
} from './satiety'

describe('biteFor', () => {
  it('takes the smallest bite from a leg answered in par presses', () => {
    expect(biteFor(3, 3)).toBeCloseTo(BITE_MIN)
    expect(biteFor(4, 4)).toBeCloseTo(BITE_MIN)
  })

  it('takes the largest bite once the accuracy is gone', () => {
    expect(biteFor(3, 50)).toBeCloseTo(BITE_MAX)
  })

  it('costs more with every press over par', () => {
    const bites = [3, 4, 5, 6, 7, 8].map((presses) => biteFor(3, presses))
    for (let i = 1; i < bites.length; i++) {
      const before = bites[i - 1] ?? 0
      const after = bites[i] ?? 0
      expect(after).toBeGreaterThan(before)
    }
  })

  it('never leaves the band, however badly a leg is answered', () => {
    for (let presses = 0; presses < 60; presses++) {
      const bite = biteFor(3, presses)
      expect(bite).toBeGreaterThanOrEqual(BITE_MIN)
      expect(bite).toBeLessThanOrEqual(BITE_MAX)
    }
  })

  it('survives a par of nought, which is what an unreachable sum answers', () => {
    expect(biteFor(0, 0)).toBeCloseTo(BITE_MIN)
    expect(Number.isFinite(biteFor(0, 9))).toBe(true)
  })

  it('charges a leg answered under par as if it were par', () => {
    expect(biteFor(4, 2)).toBeCloseTo(BITE_MIN)
  })
})

describe('spent', () => {
  it('takes the bite off what is left', () => {
    expect(spent(FULL, BITE_MIN)).toBeCloseTo(FULL - BITE_MIN)
  })

  it('stops at empty rather than going below it', () => {
    expect(spent(0.05, BITE_MAX)).toBe(0)
    expect(spent(0, BITE_MAX)).toBe(0)
  })

  it('stops at full, so a feast on a full belly is still a full belly', () => {
    expect(spent(FULL, -FULL)).toBe(FULL)
  })
})

describe('starving', () => {
  it('is true at empty', () => {
    expect(starving(0)).toBe(true)
  })

  it('is false while there is a crumb left', () => {
    expect(starving(0.01)).toBe(false)
    expect(starving(FULL)).toBe(false)
  })
})

// The two bands the bar reads, and the one thing that has to stay true about them: they
// are warnings, and the pulse is not one of them. A band that overlapped `starving` would
// put the loudest mark the row has on a run with food still in it.
describe('the bands the bar warns in', () => {
  it('warns before the hearts go, twice, and in order', () => {
    expect(SATIETY_LOW).toBeGreaterThan(SATIETY_DIRE)
    expect(SATIETY_DIRE).toBeGreaterThan(0)
    expect(SATIETY_LOW).toBeLessThan(FULL)
  })

  it('leaves the pulse to nought alone', () => {
    expect(starving(SATIETY_DIRE)).toBe(false)
    expect(starving(SATIETY_LOW)).toBe(false)
  })

  // The loaves are five because a bite divides into them — half a one at par, a whole one
  // at worst — and that is the whole of why the row is readable. If a bite stops landing on
  // a half or a whole, five loaves become a count nobody can read and the drawing has to be
  // reconsidered rather than the figures quietly retuned. See satiety-loaves.tsx.
  it('divides into the five loaves the row is drawn as', () => {
    const LOAVES = 5
    expect(BITE_MIN * LOAVES).toBeCloseTo(0.5)
    expect(BITE_MAX * LOAVES).toBeCloseTo(1)
    expect(RETREAT_BITE * LOAVES).toBeCloseTo(1)
    // And both bands are a countable number of them, which is what lets the guide say
    // "down to one" and "down to half of one" rather than quoting percentages.
    expect(SATIETY_LOW * LOAVES).toBeCloseTo(1)
    expect(SATIETY_DIRE * LOAVES).toBeCloseTo(0.5)
  })

  it('is reachable on the tidiest run there is', () => {
    // A full bar spent one par leg at a time passes through both bands rather than
    // stepping over either — which is what makes them worth drawing at all.
    const legs: number[] = []
    for (let left = FULL; left > 0; left = spent(left, BITE_MIN)) legs.push(left)
    expect(legs.some((left) => left < SATIETY_LOW && left >= SATIETY_DIRE)).toBe(true)
    expect(legs.some((left) => left < SATIETY_DIRE)).toBe(true)
  })
})
