import { describe, expect, it } from 'vitest'

import { hydrateFrom } from './hydration'

const stored = JSON.stringify({ accuracy: { extreme: { score: 7308, hits: 18 } } })

describe('hydrateFrom', () => {
  it('hands back what was stored, and opens the gate on writing', () => {
    const { value, mayPersist } = hydrateFrom({ read: true, raw: stored })
    expect(value).toStrictEqual({ accuracy: { extreme: { score: 7308, hits: 18 } } })
    expect(mayPersist).toBe(true)
  })

  it('treats an empty key as a real answer', () => {
    // Nothing stored is something we know rather than something we failed to find
    // out — a first launch has nothing to lose by being written to.
    expect(hydrateFrom({ read: true, raw: null })).toStrictEqual({
      value: null,
      mayPersist: true,
    })
  })

  it('refuses to write over storage it could not read', () => {
    // The bug this exists for: the read threw, the gate opened anyway, and the next
    // stats change persisted defaults plus the current run over a real 7308.
    expect(hydrateFrom({ read: false })).toStrictEqual({
      value: null,
      mayPersist: false,
    })
  })

  it('refuses to write over a value that would not parse', () => {
    // Same loss, one layer down: whatever that text is, it is not ours to replace
    // on the strength of having failed to understand it.
    expect(hydrateFrom({ read: true, raw: '{ truncated' })).toStrictEqual({
      value: null,
      mayPersist: false,
    })
  })

  it('refuses a value that parses to something that is not an object', () => {
    // `JSON.parse` is happy with a bare number; HYDRATE_STATS would not be.
    expect(hydrateFrom({ read: true, raw: '7308' })).toStrictEqual({
      value: null,
      mayPersist: false,
    })
    expect(hydrateFrom({ read: true, raw: 'null' })).toStrictEqual({
      value: null,
      mayPersist: false,
    })
  })
})
