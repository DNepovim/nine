import { useCallback } from 'react'

import type { Rating } from '@/lib/session-rating'
import { rateSession } from '@/lib/session-ratings'
import type { SessionSummary } from '@/lib/session-summary'

// The **rating** owed after a **summary**: which session to ask about, and the two ways
// the asking ends.
//
// Rides on the summary's own once-ness rather than keeping a marker of its own. A summary
// is told once — its watermark has already moved by the time this asks — so the rating
// offered on the back of that telling is offered once too, and NOT NOW is final without
// anything written down to make it so.
export function useSessionRating(
  told: SessionSummary | null,
  take: () => void,
): {
  asking: SessionSummary | null
  send: (rating: Rating) => void
  done: () => void
} {
  // No gate of its own: whoever is told a summary is asked about it, and only a player
  // who reaches **challenges** is ever told one.
  const asking = told

  // Fire and forget. The dialog closes on the press whether or not the write lands — see
  // `rateSession` — so there is nothing here to wait for.
  const send = useCallback(
    (rating: Rating) => {
      if (asking === null) return
      void rateSession(asking.sessionId, rating)
    },
    [asking],
  )

  return { asking, send, done: take }
}
