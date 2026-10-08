import { useCallback, useEffect, useRef, useState } from 'react'

import { offerAfterTutorial } from '@/lib/step-up'

// The tutorial's own invitation to a scored board: whether it is standing right now.
//
// The other end of the same ladder `use-step-up.ts` owns, and deliberately not part of
// it. That one watches a practice run for evidence the player has outgrown it, on a
// resolved batch at a time; this one has a script to go by, and asks only whether the
// script has finished and the practice after it has been played. Folding the two together
// would mean teaching the reducer about a lesson it otherwise never hears of.
//
// Once per run, and it holds until it is answered — the tutorial has no clock, so
// nothing is lost while the card is up.
export function useTaughtOffer({
  tutorial,
  isPlaying,
  taught,
  hits,
  playedScored,
  runSeq,
}: {
  tutorial: boolean
  // Live, not merely open. The game screen is drawn under the intro and under the pause
  // screen as well, so a run put back from storage with the lesson already behind it
  // would otherwise be asked over whichever of those is up — and the question would be
  // about a run nobody is playing.
  isPlaying: boolean
  // `taught` off the lesson: every step given and the sign-off read.
  taught: boolean
  hits: number
  playedScored: boolean
  // Which run this is. A fresh deal is a fresh tutorial, and may ask again.
  runSeq: number
}): { open: boolean; dismiss: () => void } {
  const [open, setOpen] = useState(false)
  // Asked, rather than open: a player who turned the offer down is not asked twice by
  // the rest of the same run, which a bare `open` could not tell from never having
  // asked at all.
  const asked = useRef(false)

  const dealt = useRef(runSeq)
  useEffect(() => {
    if (dealt.current === runSeq) return
    dealt.current = runSeq
    asked.current = false
    setOpen(false)
  }, [runSeq])

  useEffect(() => {
    if (asked.current) return
    if (!isPlaying) return
    if (!offerAfterTutorial({ tutorial, taught, hits, playedScored })) return
    asked.current = true
    setOpen(true)
  }, [tutorial, isPlaying, taught, hits, playedScored])

  const dismiss = useCallback(() => {
    setOpen(false)
  }, [])

  return { open, dismiss }
}
