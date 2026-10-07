import { describe, expect, it } from 'vitest'

import { BITE_MAX, BITE_MIN, biteFor, FULL, spent, starving } from './satiety'

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
