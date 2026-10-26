import { describe, expect, it } from 'vitest'

import { runBeats, type SessionFigures } from './session-order'

const run = (over: Partial<SessionFigures> = {}): SessionFigures => ({
  score: 500,
  hits: 5,
  timeMs: null,
  ...over,
})

describe('runBeats', () => {
  it('orders a score session by the score alone, a tie going to the run standing', () => {
    expect(runBeats('score', run({ score: 600, hits: 1 }), run())).toBe(true)
    expect(runBeats('score', run(), run())).toBe(false)
  })

  it('orders a hits session by hits, then the score', () => {
    expect(runBeats('hits', run({ hits: 6, score: 100 }), run())).toBe(true)
    expect(runBeats('hits', run({ hits: 4, score: 9000 }), run())).toBe(false)
    expect(runBeats('hits', run({ score: 501 }), run())).toBe(true)
    expect(runBeats('hits', run(), run())).toBe(false)
  })

  it('orders a race by finishing, then hits, then the clock', () => {
    const timed = (timeMs: number, hits = 9) => run({ timeMs, hits })
    expect(runBeats('time', timed(40000), timed(41000))).toBe(true)
    expect(runBeats('time', timed(40000, 8), timed(60000))).toBe(false)
    expect(runBeats('time', timed(90000), run({ score: 9000 }))).toBe(true)
    expect(runBeats('time', run({ score: 9000 }), timed(90000))).toBe(false)
    expect(runBeats('time', run({ score: 600 }), run())).toBe(true)
  })
})
