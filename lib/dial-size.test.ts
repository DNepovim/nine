import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

// Every tutorial surface that draws a dial, and the one hook all of them size from.
//
// The game and multiplayer are deliberately absent. They measure their own laid-out
// area with `onLayout`, and an attempt to move them onto this hook shipped a dial small
// enough to stack nine buttons in a column — the arithmetic here models the layout
// rather than observing it, and on a real device the model was wrong. Measuring is the
// behaviour that works; this hook is the tutorial's way of asking what the game will
// measure, and it is an approximation, which is the honest description of it.
//
// What this still pins is the regression that started it: a lesson passing
// `extraChrome` so its heading had room, which put the tutorial's button at 30pt
// against the game's 78pt on a 667pt screen.
const DRAWS_A_DIAL = [
  'components/overlays/tutorial/lessons/controls-lesson.tsx',
  'components/overlays/tutorial/lessons/goal-lesson.tsx',
  'components/overlays/tutorial/lessons/strategy-lesson.tsx',
  'components/overlays/tutorial/lessons/swipe-lesson.tsx',
  'components/overlays/tutorial/lessons/weights-lesson.tsx',
]

const read = (path: string): string => readFileSync(path, 'utf8')

describe('every lesson sizes its dial the same way', () => {
  it('sizes every dial from the shared hook', () => {
    for (const path of DRAWS_A_DIAL) {
      expect(read(path), path).toContain('useGameDialSize()')
    }
  })

  it('takes no argument, so nothing can ask for a smaller one', () => {
    // The regression this exists for: `useGameDialSize(LESSON_HEADER_SHRINK)`.
    for (const path of DRAWS_A_DIAL) {
      expect(read(path), path).not.toMatch(/useGameDialSize\(\s*[^)\s]/)
    }
    expect(read('hooks/use-game-dial-size.ts')).toMatch(
      /export function useGameDialSize\(\): number/,
    )
  })

  it('measures no dial of its own', () => {
    // A lesson cannot measure: its own chrome is what makes its space differ from the
    // game's, so measuring is exactly how the two drift apart.
    for (const path of DRAWS_A_DIAL) {
      expect(read(path), path).not.toContain('setDialSize')
    }
  })
})
