import { describe, expect, it } from 'vitest'

import { isDesktopViewport } from './desktop'

describe('isDesktopViewport', () => {
  it('calls a laptop window a desktop', () => {
    expect(isDesktopViewport(1440, 900)).toBe(true)
  })

  it('does not call a phone a desktop', () => {
    expect(isDesktopViewport(390, 844)).toBe(false)
  })

  it('does not call a phone held sideways a desktop — it is wide but not tall', () => {
    expect(isDesktopViewport(844, 390)).toBe(false)
  })

  it('does not call a narrow browser window a desktop, however tall it is', () => {
    expect(isDesktopViewport(500, 1200)).toBe(false)
  })

  it('counts a window sitting exactly on both thresholds', () => {
    expect(isDesktopViewport(700, 520)).toBe(true)
  })
})
