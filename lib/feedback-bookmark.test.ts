import { describe, expect, it } from 'vitest'

import { feedbackGameState, showFeedbackBookmark } from './feedback-bookmark'

// The intro: nothing in play, nothing open.
const AT_INTRO = {
  isPlaying: false,
  resuming: false,
  showMultiGame: false,
  inArcade: false,
  feedbackOpen: false,
  isGameOver: false,
  gameOverBookmarkReady: false,
  inArchive: false,
}

describe('showFeedbackBookmark', () => {
  it('shows on the intro and on the pause screen', () => {
    expect(showFeedbackBookmark(AT_INTRO)).toBe(true)
  })

  it.each([
    ['a live run', { isPlaying: true }],
    ['the beat after CONTINUE', { resuming: true }],
    ['a multiplayer game', { showMultiGame: true }],
    ['an arcade run', { inArcade: true }],
    ['its own dialog', { feedbackOpen: true }],
    ['the news archive', { inArchive: true }],
  ])('hides during %s', (_, over) => {
    expect(showFeedbackBookmark({ ...AT_INTRO, ...over })).toBe(false)
  })

  it('waits on game over until the cinematic has landed', () => {
    expect(showFeedbackBookmark({ ...AT_INTRO, isGameOver: true })).toBe(false)
    expect(
      showFeedbackBookmark({
        ...AT_INTRO,
        isGameOver: true,
        gameOverBookmarkReady: true,
      }),
    ).toBe(true)
  })
})

describe('feedbackGameState', () => {
  it('carries the run from the pause screen', () => {
    expect(feedbackGameState('paused', { score: 10 })).toEqual({
      state: 'paused',
      context: { score: 10 },
    })
  })

  it('carries nothing from anywhere else', () => {
    expect(feedbackGameState('menu', { score: 10 })).toBeNull()
    expect(feedbackGameState('gameOver', { score: 10 })).toBeNull()
  })
})
