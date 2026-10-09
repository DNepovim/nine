import AsyncStorage from '@react-native-async-storage/async-storage'
import { useCallback, useEffect, useRef, useState } from 'react'

import { ASKED_WINNINGS_KEY } from '@/constants/storage'
import { acceptWinnings, fetchUnpaidWinnings } from '@/lib/leaderboard'
import { todayISO } from '@/lib/leaderboard-period'
import { askedToday, awardBlocks, type AwardBlock } from '@/lib/winnings-announcement'

// What the player is owed, ready to be offered — and the press that turns it into fortune.
//
// Shaped like `useWhatsNew`, and for the same reasons: `ready` is false until the storage
// read has answered, so anything queueing behind this waits rather than painting first and
// being covered a moment later.
//
// Where the boundary falls is no longer this hook's business. It used to hold the marker
// that decided which windows were owed, which meant a wiped device could forfeit a reward
// nobody had paid; the watermark on the player's profile holds it now. What is left here
// is a brake on asking — see `ASKED_WINNINGS_KEY` — and the accept.
export function useWinnings(userId: string | null) {
  const [blocks, setBlocks] = useState<readonly AwardBlock[]>([])
  // Whether this launch's offer has been taken. The card and the deck's button both read
  // it: a page that has been settled says so and stops asking to be pressed.
  const [accepted, setAccepted] = useState(false)
  const [ready, setReady] = useState(false)
  // One write per press. Two presses are free at the database — the watermark only moves
  // forward — but they are still two requests for one answer.
  const accepting = useRef(false)
  // The day the offer was drawn for, kept so the accept can be settled against the same
  // one. Reading the clock twice is not the same as reading it once: the offer asks for
  // windows *before* today, so a launch left open across midnight would accept against a
  // day whose own window had since closed — telling the server to settle a window that was
  // never offered and never shown. The watermark only moves forward, so that reward would
  // be gone rather than deferred.
  const offeredFor = useRef<string | null>(null)

  useEffect(() => {
    if (userId === null) {
      setReady(true)
      return
    }
    void (async () => {
      // `ready` is released in a `finally` and nowhere else. Every exit below has to set
      // it, and a throw is an exit too — this hook's `ready` is one of the three the deck
      // waits on, and the install prompt and the session-recording ask both sit behind
      // that same gate. One unforeseen throw and a player is never asked either, for the
      // life of the session, with nothing on screen to say why.
      try {
        const today = todayISO()
        // A storage read that fails reads as never having asked, which costs one request.
        // Unlike the old marker, nothing about being paid lives here, so there is nothing
        // for a failure to lose.
        const stored = await AsyncStorage.getItem(ASKED_WINNINGS_KEY).catch(() => null)
        if (askedToday(stored, today)) return

        const { awards, error } = await fetchUnpaidWinnings(today)
        // A failed read is not an empty week. Leaving the brake off costs one repeated
        // request on the next launch; setting it would stay quiet about a real reward
        // until tomorrow.
        if (error !== null) return

        const found = awardBlocks(awards)
        // Nothing owed is still an answer, and one worth recording — otherwise every
        // launch re-asks the server about the same quiet days.
        if (found.length === 0) {
          await AsyncStorage.setItem(ASKED_WINNINGS_KEY, today).catch(() => {})
          return
        }
        offeredFor.current = today
        setBlocks(found)
      } finally {
        setReady(true)
      }
    })()
  }, [userId])

  // The blocks deliberately stay where they are. The launch popup builds its pages from
  // them, so clearing them here would take a page out of the deck underneath the index the
  // dialog is holding — and the player would land on the card after the one they expected.
  // The page stays, settled, until the dialog closes — which is what `dismiss` below is.
  const accept = useCallback(() => {
    if (accepting.current) return
    const today = offeredFor.current
    // Nothing was offered, so there is nothing to settle. Unreachable from the dialog,
    // which only draws the button over a page built from `blocks`.
    if (today === null) return
    accepting.current = true
    void acceptWinnings(today)
      .then(({ error }) => {
        // The reward is still the player's: the watermark did not move, so the next launch
        // offers it again. The page has already advanced either way, because the press is
        // the only thing on that page that acts and trapping somebody on a failed request
        // would be worse than asking them to press again tomorrow.
        //
        // But advancing the page and telling the player they have been paid are two
        // different claims, and only the first survives a failure. `accepted` is what the
        // footer reads to say ADDED TO YOUR FORTUNE, so it is set here rather than on the
        // press: a card that announced a payment the server refused would be contradicted by
        // the player's own profile a moment later.
        if (error !== null) return
        setAccepted(true)
        void AsyncStorage.setItem(ASKED_WINNINGS_KEY, today).catch(() => {})
      })
      // Released however the request ended, including a rejection rather than an error in
      // hand. The guard exists to stop two writes, not to stop a second attempt: the button
      // is still offering CLAIM after a failure, and a latch left closed would make that
      // offer a dead one for the rest of the session.
      .finally(() => {
        accepting.current = false
      })
  }, [])

  // The dialog has closed. Emptying `blocks` is the whole of it — and it is not optional:
  // the deck's `visible` is `cards.length > 0`, and the overlay that reads it is what
  // unmounts the dialog. Left full, the dialog never unmounts, and what it leaves on screen
  // is a transparent full-screen layer over the intro that goes on taking every press.
  //
  // What this must *not* do is move the watermark, which is the whole point of the change
  // that removed its predecessor: being shown a reward is no longer the same as having it.
  // A player who closes without pressing is offered the same reward on the next launch,
  // because nothing but `accept` settles anything.
  const dismiss = useCallback(() => {
    setBlocks([])
  }, [])

  return { blocks, accepted, visible: blocks.length > 0, ready, accept, dismiss }
}
