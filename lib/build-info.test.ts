import { describe, expect, it } from 'vitest'

import { parseBuildId } from './build-info'

describe('parseBuildId', () => {
  it('reads the sha and timestamp from a well-formed stamp', () => {
    const info = parseBuildId('1e3fc8a-260810.1247')
    expect(info.sha).toBe('1e3fc8a')
    expect(info.label).toBe('1e3fc8a · 10 Aug 2026, 12:47')
  })

  it('keeps the stamp as the digits it arrived as', () => {
    expect(parseBuildId('1e3fc8a-260810.1247').stamp).toBe('260810.1247')
  })

  // A gated reply is held until the caller's stamp compares `>=` the one the answer
  // names, as plain text and on the server — so text order has to be build order.
  it('gives stamps that compare as text in the order the builds were made', () => {
    const stamp = (made: string) => parseBuildId(`abcdef0-${made}`).stamp ?? ''

    expect(stamp('260810.0903') < stamp('260810.1247')).toBe(true)
    expect(stamp('251231.2359') < stamp('260101.0001')).toBe(true)
    // The build named by a gate qualifies itself, so the comparison has to be `>=`.
    expect(stamp('260924.1430')).toBe('260924.1430')
  })

  it('builds a date in local time', () => {
    const { builtAt } = parseBuildId('1e3fc8a-260810.1247')
    expect(builtAt?.getFullYear()).toBe(2026)
    expect(builtAt?.getMonth()).toBe(7) // August, zero-indexed
    expect(builtAt?.getDate()).toBe(10)
    expect(builtAt?.getHours()).toBe(12)
    expect(builtAt?.getMinutes()).toBe(47)
  })

  it('pads single-digit times', () => {
    expect(parseBuildId('abcdef0-260105.0903').label).toBe('abcdef0 · 5 Jan 2026, 09:03')
  })

  it('accepts a full-length sha', () => {
    const info = parseBuildId('1e3fc8a8067e1e3fc8a8067e1e3fc8a8067e1e3f-260810.1247')
    expect(info.sha).toBe('1e3fc8a8067e1e3fc8a8067e1e3fc8a8067e1e3f')
  })

  it('falls back to dev when the variable is missing', () => {
    const dev = { sha: null, stamp: null, builtAt: null, label: 'dev' }
    expect(parseBuildId(undefined)).toEqual(dev)
    expect(parseBuildId('')).toEqual(dev)
  })

  it('shows an unrecognised stamp verbatim rather than hiding it', () => {
    const info = parseBuildId('something-else')
    expect(info.label).toBe('something-else')
    expect(info.sha).toBeNull()
    expect(info.stamp).toBeNull()
    expect(info.builtAt).toBeNull()
  })
})
