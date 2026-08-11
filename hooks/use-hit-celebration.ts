import { useEffect, useRef, useState } from 'react'

import { praiseFor } from '@/lib/hit-praise'
import type { HitBatch, Mode } from '@/machines/game'
import { cleanHitReason } from '@/machines/scoring'

// Long enough for the last piece to finish falling. Confetti spreads its starts
// across two seconds and each piece falls for about two more, so unmounting
// sooner would cut pieces out of the air mid-fall. The praise line shares the
// window, so the words and the shower arrive and leave together.
const SHOWER_MS = 4000

export type HitCelebration = {
  // Keys the confetti — a fresh one restarts it, so two clean hits in a row each
  // get their own rather than the second reusing a shower already in flight.
  seq: number | null
  // What the shower is for, in words. Null when nothing is being celebrated.
  message: string | null
}

const NOTHING: HitCelebration = { seq: null, message: null }

// Which hit earns a shower, what to call it, and how long both stay up.
//
// Always returns an object rather than null-or-value: the caller reads two fields
// off it, and an optional shape would push two more branches into a screen
// already at its cognitive-complexity ceiling.
export function useHitCelebration(
  inRun: boolean,
  mode: Mode,
  batch: HitBatch,
): HitCelebration {
  const [current, setCurrent] = useState<HitCelebration>(NOTHING)
  const lastSeqRef = useRef(0)
  // Trainee only. The other modes celebrate the run, and a shower per clean hit
  // would drown the record celebration that actually means something there.
  const active = inRun && mode === 'trainee'

  useEffect(() => {
    if (!active) {
      setCurrent(NOTHING)
      return
    }
    if (batch.seq === lastSeqRef.current) return
    lastSeqRef.current = batch.seq

    // A batch holds every target one press cleared. Any clean hit among them
    // earns the shower; there is only ever one shower to give.
    const reason = cleanHitReason(batch.hits)
    if (reason === null) return
    // Rolled once here rather than at render, so a re-render cannot reword the
    // praise while the player is reading it.
    setCurrent({ seq: batch.seq, message: praiseFor(reason, Math.random()) })
  }, [active, batch])

  useEffect(() => {
    if (current.seq === null) return
    const timer = setTimeout(() => {
      setCurrent(NOTHING)
    }, SHOWER_MS)
    return () => {
      clearTimeout(timer)
    }
  }, [current])

  return current
}
