// The feedback bookmark: where it is drawn, and what a message written beside it carries.

import { gameSnapshot } from '@/lib/feedback-state'

// The run as the machine holds it, for a message written from the pause screen — see
// lib/feedback-state.ts. Nothing from the intro or the game over screen: neither has a
// run in flight to describe, and a snapshot of the menu would only make a report look
// like it carried something.
//
// Asked of the state value itself rather than handed a flag, so the one thing that knows
// a run is paused is the machine.
export function feedbackGameState(
  value: string | Readonly<Record<string, unknown>>,
  context: Readonly<Record<string, unknown>>,
): unknown {
  return value === 'paused' ? gameSnapshot(value, context) : null
}

// Every screen but a live run gets the bookmark — except game over, which holds it
// back until the death cinematic has actually landed (see gameOverBookmarkReady).
//
// The archive keeps its DONE button exactly where the bookmark would land, so it takes
// the tab away for as long as it is up.
//
// `resuming` counts as a live run: the board is already back, and a tab appearing for
// half a second and then leaving again is worse than one that never came.
export function showFeedbackBookmark({
  isPlaying,
  resuming,
  showMultiGame,
  inArcade,
  feedbackOpen,
  isGameOver,
  gameOverBookmarkReady,
  inArchive,
}: {
  isPlaying: boolean
  resuming: boolean
  showMultiGame: boolean
  // An arcade run is a live run too, and the one screen in the app a stray tab could be
  // grazed on is a dial somebody is dialling.
  inArcade: boolean
  feedbackOpen: boolean
  isGameOver: boolean
  gameOverBookmarkReady: boolean
  inArchive: boolean
}): boolean {
  if (isPlaying || resuming || showMultiGame || inArcade || feedbackOpen || inArchive) {
    return false
  }
  return !isGameOver || gameOverBookmarkReady
}
