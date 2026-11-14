import { useEffect, useState } from 'react'

import { remainsHoldOf } from '@/components/game/opening-layer'
import { useBarColor } from '@/hooks/use-bar-color'
import { useDyingSequence, type DyingPhase } from '@/hooks/use-dying-sequence'
import { useLostMarks } from '@/hooks/use-lost-marks'
import type { ScreenField } from '@/hooks/use-play-field'
import type { ScreenControl } from '@/hooks/use-run-control'
import type { ScreenDialogs } from '@/hooks/use-screen-dialogs'

// How long the feedback bookmark waits after the game-over cinematic lands before
// sliding its label into view. The player's eyes are still on the title the instant
// the sequence hits `done` — a beat lets that settle before something else moves.
const BOOKMARK_REVEAL_DELAY_MS = 500

// The phone's bar, in the colour of the run's **scheme** for as long as that is what fills the
// screen: through play, and on through the last-life cinematic, which runs over the game screen
// until the game-over screen has landed. The screens over a run are drawn light, so they leave
// the bar to the app.
const systemBarOf = (
  color: string | null,
  inPlay: boolean,
  dying: DyingPhase,
): string | null =>
  inPlay || dying === 'waiting' || dying === 'dying' || dying === 'blend' ? color : null
// The last life going: the dying sequence, the phone's bar through it, the marks a run loses,
// and the beat before game over's bookmark comes back.
export function useLifeLoss({
  control,
  dialogs,
  field,
}: {
  control: ScreenControl
  dialogs: ScreenDialogs
  field: ScreenField
}) {
  const { isGameOver, lives, opening, runId } = control
  const { setBookmarkRevealed } = dialogs
  const { boardTargets } = field
  // ── Life-loss & dying sequence ──────────────────────────────────────────────

  const {
    phase: dyingPhase,
    flashStyle,
    titleStyle,
    overlayStyle,
    overlayOpacity,
    targetsAreaRef,
    setOverlayTitleY,
  } = useDyingSequence({ isGameOver, lives, hold: remainsHoldOf(opening.remains) })
  useBarColor(systemBarOf(opening.systemBar, opening.inPlay, dyingPhase))
  const lostMarks = useLostMarks({
    runId,
    targets: boardTargets,
    lives,
    boardRef: targetsAreaRef,
  })

  // The bookmark stays off the game-over screen entirely until the cinematic has
  // actually landed — not just hidden-then-revealed, mounted the instant it's
  // allowed to and already showing its label, so there is no icon sitting there
  // mid-flight and no separate step where the label slides out after it.
  const [gameOverBookmarkReady, setGameOverBookmarkReady] = useState(false)
  useEffect(() => {
    if (dyingPhase !== 'done') {
      setGameOverBookmarkReady(false)
      return
    }
    const timer = setTimeout(() => {
      setGameOverBookmarkReady(true)
      setBookmarkRevealed(true)
    }, BOOKMARK_REVEAL_DELAY_MS)
    return () => {
      clearTimeout(timer)
    }
  }, [dyingPhase])

  return {
    dyingPhase,
    flashStyle,
    gameOverBookmarkReady,
    lostMarks,
    overlayOpacity,
    overlayStyle,
    setOverlayTitleY,
    targetsAreaRef,
    titleStyle,
  }
}

export type ScreenLifeLoss = ReturnType<typeof useLifeLoss>
