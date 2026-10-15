import { useEffect, useState } from 'react'

import { useFlag } from '@/hooks/use-flags'
import { countMessagesOwed } from '@/lib/admin/feedback'

// How many messages are waiting for an answer, for the two places that draw a dot about
// it: the ADMIN link on the intro, and the MESSAGES tile on the admin hub.
//
// Asked once per mount rather than kept live. A message arriving is not an event the
// person reading this screen has to be interrupted by — the dot is there so that the next
// time they open the app they go and look, and a subscription for that would be a socket
// held open for a handful of people.
//
// **Nothing is asked unless the caller holds `admin`.** The function behind it refuses
// anybody else, so a read on a player's launch would be a guaranteed round trip to a
// guaranteed refusal.
export function useFeedbackOwed(): number {
  const isAdmin = useFlag('admin')
  const [owed, setOwed] = useState(0)

  useEffect(() => {
    if (!isAdmin) return
    void (async () => {
      setOwed(await countMessagesOwed())
    })()
  }, [isAdmin])

  return owed
}
