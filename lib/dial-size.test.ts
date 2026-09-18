import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

// Every surface that draws a dial button, and the one hook all of them must size from.
//
// A button is the same size wherever it is drawn. That used to be a comment and an
// approximation: the game measured its own laid-out area with `onLayout` while the
// tutorial reconstructed the same number from constants, so the two agreed only as
// closely as the constants happened to be right — and when a lesson was given an
// `extraChrome` argument to make room for its heading, the tutorial's button fell to
// 30pt against the game's 78pt on a 667pt screen.
//
// So this is asserted rather than described. Reading the files is the point: a new
// screen that measures its own dial, or an argument creeping back into the hook, is
// exactly the kind of change that looks harmless in review.
const DRAWS_A_DIAL = [
  'app/(tabs)/index.tsx',
  'components/game/multiplayer-game.tsx',
  'components/overlays/tutorial/lessons/controls-lesson.tsx',
  'components/overlays/tutorial/lessons/goal-lesson.tsx',
  'components/overlays/tutorial/lessons/strategy-lesson.tsx',
  'components/overlays/tutorial/lessons/swipe-lesson.tsx',
  'components/overlays/tutorial/lessons/weights-lesson.tsx',
]

const read = (path: string): string => readFileSync(path, 'utf8')

describe('the dial button is one size everywhere', () => {
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
    // A screen that sets its own dial size from `onLayout` is back to two sources.
    for (const path of DRAWS_A_DIAL) {
      expect(read(path), path).not.toContain('setDialSize')
    }
  })
})
