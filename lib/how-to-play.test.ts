import { describe, expect, it } from 'vitest'

import { parseGuideRead, serializeGuideRead } from './how-to-play'

describe('parseGuideRead', () => {
  it('treats a missing value as never opened', () => {
    expect(parseGuideRead(null)).toBe(false)
  })

  it('reads the flag', () => {
    expect(parseGuideRead('{"read":true}')).toBe(true)
  })

  it('falls back to not read for malformed JSON', () => {
    expect(parseGuideRead('{oops')).toBe(false)
  })

  it('falls back to not read for a value of the wrong shape', () => {
    expect(parseGuideRead('{"read":"yes"}')).toBe(false)
  })

  it('round-trips through serialize', () => {
    expect(parseGuideRead(serializeGuideRead(true))).toBe(true)
  })
})
