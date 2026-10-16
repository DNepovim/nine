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
// `epoch` is the other half of that: a message *leaving* the pile is an event, because
// the person who answered it is two taps from the dot that counts it and would otherwise
// be told there is still one waiting. Bumping the counter asks again. The same counter
// the access screens pass their lists — see `refresh` in admin-access.tsx.
//
// **Nothing is asked unless the caller holds `admin`.** The function behind it refuses
// anybody else, so a read on a player's launch would be a guaranteed round trip to a
// guaranteed refusal.
export function useFeedbackOwed(epoch = 0): number {
  const isAdmin = useFlag('admin')
  const [owed, setOwed] = useState(0)

  useEffect(() => {
    if (!isAdmin) return
    void (async () => {
      setOwed(await countMessagesOwed())
    })()
  }, [isAdmin, epoch])

  return owed
}
