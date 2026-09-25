import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

import { dialMetrics } from '@/lib/dial-metrics'

// Every file that draws a dial button, and the one hook all of them size from.
//
// This is asserted rather than described because two earlier attempts at it failed in
// production. The first let a screen pass `extraChrome` so its heading had room, which
// put that screen's button at 30pt against the game's 78pt. The second moved the game
// onto a hook that derived the dial from leftover *height* — the HUD, the score strip,
// the sum row, Trainee's stat block, four hand-maintained numbers modelling a layout
// nobody measured — and it was wrong by enough on a real phone that the buttons stopped
// fitting three to a row and the dial collapsed into a column.
//
// Width is what makes the third attempt hold: the dial spans it, and nothing stacked
// above the dial can change how wide the screen is. So a solo run and a shared one
// genuinely get the same number, and the guarantee is a property of the arithmetic
// rather than a hope about constants.
const DRAWS_A_DIAL = ['app/(tabs)/index.tsx', 'components/game/multiplayer-game.tsx']

const read = (path: string): string => readFileSync(path, 'utf8')
const hook = () => read('hooks/use-dial-metrics.ts')

describe('the dial button is one size everywhere', () => {
  it('sizes every dial from the shared hook', () => {
    for (const path of DRAWS_A_DIAL) {
      expect(read(path), path).toContain('useDialMetrics()')
    }
  })

  it('takes no argument, so nothing can ask for a smaller one', () => {
    for (const path of DRAWS_A_DIAL) {
      expect(read(path), path).not.toMatch(/useDialMetrics\(\s*[^)\s]/)
    }
    expect(hook()).toMatch(/export function useDialMetrics\(\)/)
  })

  it('measures no dial of its own', () => {
    // A screen that sets a dial size from `onLayout` is back to two sources, and the
    // one with more copy above it loses.
    for (const path of DRAWS_A_DIAL) {
      expect(read(path), path).not.toContain('setDialSize')
    }
  })

  it('reserves the sum row on every screen that draws a dial', () => {
    // The slot above the dial is a fixed height, not whatever the digits happen to
    // need. Two reasons, and the second is why this is asserted: the dial does not
    // shift when the sum goes from 0 to 324, and a shared run puts it at the same
    // height a solo one does — which is half of what "the same dial everywhere" means.
    // The other half is the button size above.
    for (const path of DRAWS_A_DIAL) {
      expect(read(path), path).toContain('SUM_ROW_HEIGHT')
    }
  })

  it('reads the viewport and nothing else', () => {
    // Height does reach the calculation now, as a cap for a sideways window. What broke
    // production twice was never height itself — it was *modelling* the chrome above the
    // dial, which meant importing that chrome's measurements and keeping four of them
    // true by hand. So the guard is on what the hook is allowed to know, not on a word.
    const sources = [...hook().matchAll(/from '([^']+)'/g)].map((m) => m[1] ?? '')
    const seen = [...new Set(sources)].sort((a, b) => a.localeCompare(b))
    expect(seen, 'the dial reads the viewport, nothing else') //
      .toEqual(['@/hooks/use-viewport', '@/lib/dial-metrics'])
    const arithmetic = readFileSync('lib/dial-metrics.ts', 'utf8')
    expect(
      [...arithmetic.matchAll(/from '([^']+)'/g)],
      'the arithmetic imports nothing',
    ).toEqual([])
  })
})

describe('the dial fits the screen it is drawn on', () => {
  // A quarter of the width, less the 12pt gap the button carries.
  it('gives the button a quarter of the width on a phone held upright', () => {
    expect(dialMetrics({ width: 375, height: 667 })).toEqual({
      button: 81,
      gap: 12,
      size: 267,
    })
    expect(dialMetrics({ width: 390, height: 844 })).toEqual({
      button: 85,
      gap: 12,
      size: 279,
    })
  })

  it('leaves every upright phone alone', () => {
    // The cap engages below an aspect ratio of about 1.5. Nothing the game is played on
    // upright comes close, so on all of them the width rule has to survive untouched.
    const PHONES = [
      { width: 320, height: 568 }, // the smallest still in the wild
      { width: 375, height: 667 },
      { width: 390, height: 844 },
      { width: 393, height: 852 },
      { width: 430, height: 932 },
    ]
    for (const phone of PHONES) {
      const width = Math.max(0, Math.floor(0.25 * phone.width) - 12)
      expect(dialMetrics(phone).button, `${phone.width}x${phone.height}`).toBe(width)
    }
  })

  it('shrinks the dial rather than running it off a sideways screen', () => {
    // 667x375 is a phone turned sideways in a browser — the native app is locked to
    // portrait, the web build is not. The width rule alone asked for 154pt buttons and
    // a 582pt square here: the rows overlapped by 58pt and two thirds of the dial hung
    // below the fold.
    const sideways = dialMetrics({ width: 667, height: 375 })
    expect(sideways.button).toBeLessThan(154)
    expect(sideways.size).toBeLessThanOrEqual(375)
  })

  it('keeps the square and the buttons in agreement at every size', () => {
    // The cap is applied to the button, not to the container. Capping the container on
    // its own leaves the buttons at their old width inside a box too small to hold
    // them, which is the overlap above rather than a fix for it.
    for (let width = 200; width <= 1200; width += 7) {
      for (const height of [375, 500, 667, 844, 1180]) {
        const { button, gap, size } = dialMetrics({ width, height })
        expect(size, `${width}x${height}`).toBe(button * 3 + gap * 2)
        expect(size, `${width}x${height}`).toBeLessThanOrEqual(height)
      }
    }
  })

  it('draws no square at all when the viewport has not been measured', () => {
    // WebKit reports a 0x0 window on the first render, and on a phone nothing ever
    // resizes to correct it. This shipped: nine zero-width buttons inside a 24pt box,
    // their digits running down the screen. `useViewport` no longer passes the zero
    // through, and this is the second lock — a dial with no button has no square.
    for (const blind of [
      { width: 0, height: 0 },
      { width: 0, height: 667 },
      { width: 10, height: 10 },
    ]) {
      const metrics = dialMetrics(blind)
      expect(metrics.button, `${blind.width}x${blind.height}`).toBe(0)
      expect(metrics.size, `${blind.width}x${blind.height}`).toBe(0)
    }
  })
})
