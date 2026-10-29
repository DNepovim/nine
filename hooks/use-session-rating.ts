import { useCallback, useEffect } from 'react'

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
  // Whether this player reaches **ratings**. Handed in for the reason `useSessionSummaries`
  // is handed `canSee`: the provider is not above the hook that calls this.
  canRate: boolean,
): {
  asking: SessionSummary | null
  send: (rating: Rating) => void
  done: () => void
} {
  const asking = canRate ? told : null

  // Told while this player could not be asked — a role preview without the feature — is
  // let go rather than kept: otherwise ending the preview would put up a rating for a
  // session closed long before, with nothing on screen to say why.
  useEffect(() => {
    if (!canRate && told !== null) take()
  }, [canRate, told, take])

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
