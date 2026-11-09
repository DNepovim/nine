import { useCallback } from 'react'

import type { Rating } from '@/lib/session-rating'
import { rateSession, remarkSession } from '@/lib/session-ratings'
import type { SessionSummary } from '@/lib/session-summary'

// The session's own dialog: the **summary** owed and, on the back of it, the **rating**.
// Which session it is about, and the ways the asking ends.
//
// Rides on the summary's own once-ness rather than keeping a marker of its own. A summary
// is told once — its watermark moves when the dialog closes, however it closes — so the
// rating asked on the back of that telling is asked once too, and a player who closes
// early has declined it without anything written down to make it so.
export function useSessionRating(
  summary: SessionSummary | null,
  // Closes the dialog and moves the summary's watermark — `useSessionSummaries.dismiss`.
  dismiss: () => void,
): {
  asking: SessionSummary | null
  send: (rating: Rating) => void
  // The **remark**: the rating's written half, from the dialog's second step.
  remark: (text: string) => void
  done: () => void
} {
  // No gate of its own: whoever is owed a summary is asked about it, and only a player
  // who reaches **challenges** is ever owed one.
  const asking = summary

  // Fire and forget. The dialog closes on the press whether or not the write lands — see
  // `rateSession` — so there is nothing here to wait for.
  const send = useCallback(
    (rating: Rating) => {
      if (asking === null) return
      void rateSession(asking.sessionId, rating)
    },
    [asking],
  )

  // Fire and forget, for the reason `send` is.
  const remark = useCallback(
    (text: string) => {
      if (asking === null) return
      void remarkSession(asking.sessionId, text)
    },
    [asking],
  )

  return { asking, send, remark, done: dismiss }
}
