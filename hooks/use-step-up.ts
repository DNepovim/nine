import { useCallback, useEffect, useRef, useState } from 'react'

import {
  initialStepUp,
  stepUpMessage,
  stepUpReducer,
  type StepUpMessage,
} from '@/lib/step-up'
import type { HitBatch, Mode } from '@/machines/game'
import { cleanHitReason } from '@/machines/scoring'

// How long the toast holds before it withdraws on its own. Longer than a praise line,
// which has nothing to press — this one is asking a question, and the player is watching
// the board rather than the top of the screen.
const HOLD_MS = 8000

// Trainee's invitation to a scored board: whether to make it, and the words for it.
//
// The offer is made at most once per run and never at all to someone who has already
// posted a scored score — the whole point is introducing the boards to a player who has
// not found them, and there is nothing to introduce twice.
export function useStepUp({
  inRun,
  mode,
  batch,
  hits,
  playedScored,
  fromTutorial,
}: {
  // Playing, not paused. A frozen run should not be interrupted by an offer.
  inRun: boolean
  mode: Mode
  batch: HitBatch
  hits: number
  playedScored: boolean
  // Whether this run began on the tutorial's closing CTA, which lowers the bar to a
  // hit count — see TUTORIAL_HITS in lib/step-up.ts.
  fromTutorial: boolean
}): { message: StepUpMessage | null; dismiss: () => void } {
  const [message, setMessage] = useState<StepUpMessage | null>(null)
  const stateRef = useRef(initialStepUp())
  const startedAtRef = useRef(0)
  // Seeded from the batch on screen rather than from zero, so a remount mid-run replays
  // nothing already counted.
  const lastSeqRef = useRef(batch.seq)

  const active = inRun && mode === 'trainee'

  // A run's own clock, so the floor is time actually spent playing rather than time
  // since the app opened.
  useEffect(() => {
    if (!active) {
      stateRef.current = initialStepUp()
      setMessage(null)
      return
    }
    startedAtRef.current = Date.now()
  }, [active])

  useEffect(() => {
    // The baseline advances even while inactive: `seq` climbs across games and modes, so
    // one that only moved during a Trainee run would let another mode's last hit look
    // fresh the moment one started.
    const fresh = batch.seq !== lastSeqRef.current
    lastSeqRef.current = batch.seq
    if (!active || !fresh) return

    const result = stepUpReducer(stateRef.current, {
      clean: cleanHitReason(batch.hits) !== null,
      hits,
      elapsedMs: Date.now() - startedAtRef.current,
      playedScored,
      fromTutorial,
    })
    stateRef.current = result.state
    if (result.offer === null) return
    // Rolled once here rather than at render, so a re-render cannot reword the offer
    // while the player is reading it. The reason picks the pool: only one of them has
    // watched the player do something worth mentioning.
    setMessage(stepUpMessage(result.offer, Math.random(), Math.random()))
  }, [active, batch, hits, playedScored, fromTutorial])

  useEffect(() => {
    if (message === null) return
    const timer = setTimeout(() => {
      setMessage(null)
    }, HOLD_MS)
    return () => {
      clearTimeout(timer)
    }
  }, [message])

  const dismiss = useCallback(() => {
    setMessage(null)
  }, [])

  return { message, dismiss }
}
