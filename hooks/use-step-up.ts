import { useCallback, useEffect, useRef, useState } from 'react'

import {
  initialStepUp,
  stepUpMessage,
  stepUpReducer,
  type StepUpMessage,
} from '@/lib/step-up'
import type { HitBatch, Mode } from '@/machines/game'
import { cleanHitReason } from '@/machines/scoring'

// Trainee's invitation to a scored board: whether to make it, and the words for it.
//
// The offer holds until the player answers it. It used to withdraw itself after a few
// seconds, on the reasoning that a run gets one of these at most — but a player who is
// mid-target when it arrives has every reason to finish the target first, and a question
// that takes itself back while you are busy is one you never got asked. So it waits, and
// the toast carries its own way out.
//
// It is made at most once per run and never at all to someone who has already posted a
// scored score — the whole point is introducing the boards to a player who has not found
// them, and there is nothing to introduce twice.
export function useStepUp({
  inRun,
  mode,
  batch,
  hits,
  playedScored,
  fromWelcome,
}: {
  // Playing or paused, not the whole app being open. Pauses are deliberately inside the
  // run rather than outside it: a new offer can only arrive on a freshly resolved batch,
  // which never happens while frozen, and counting a pause as the end of the run would
  // let a dismissed toast come back the moment the player resumed.
  inRun: boolean
  mode: Mode
  batch: HitBatch
  hits: number
  playedScored: boolean
  // Whether this install opened with the welcome run, which lowers the bar to a hit
  // count — see WELCOME_HITS in lib/step-up.ts.
  fromWelcome: boolean
}): { message: StepUpMessage | null; dismiss: () => void } {
  const [message, setMessage] = useState<StepUpMessage | null>(null)
  const stateRef = useRef(initialStepUp())
  const startedAtRef = useRef(0)
  // Seeded from the batch on screen rather than from zero, so a remount mid-run replays
  // nothing already counted.
  const lastSeqRef = useRef(batch.seq)

  const active = inRun && mode === 'trainee'

  // A run's own clock, so the floor is time in this run rather than time since the app
  // opened. It keeps running through a pause, which is the honest reading anyway: a
  // player who stepped away and came back has been at this a while.
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
      fromWelcome,
    })
    stateRef.current = result.state
    if (result.offer === null) return
    // Rolled once here rather than at render, so a re-render cannot reword the offer
    // while the player is reading it. The reason picks the pool: only one of them has
    // watched the player do something worth mentioning.
    setMessage(stepUpMessage(result.offer, Math.random(), Math.random()))
  }, [active, batch, hits, playedScored, fromWelcome])

  const dismiss = useCallback(() => {
    setMessage(null)
  }, [])

  return { message, dismiss }
}
