import AsyncStorage from '@react-native-async-storage/async-storage'
import { useCallback, useEffect, useRef, useState } from 'react'

import { SEEN_RECAP_KEY } from '@/constants/storage'
import { useFlag } from '@/hooks/use-flags'
import { fetchWeeklyRecap } from '@/lib/leaderboard'
import { previousWeek, todayISO } from '@/lib/leaderboard-period'
import { factsFromRows, hasAnyWinner, type WeekFacts } from '@/lib/recap'

// What last week on the boards came to, ready to be told.
//
// Shaped like `useWinnings`, and for the same reasons: `ready` is false until the storage
// read has answered, so anything queueing behind this waits rather than painting first and
// being covered a moment later.
export function useWeeklyRecap() {
  const canSee = useFlag('recap')
  const [facts, setFacts] = useState<WeekFacts | null>(null)
  const [ready, setReady] = useState(false)
  // The window, derived once at mount and then held. `previousWeek` is already Monday to
  // Sunday on the Prague clock, and this is the only place the recap decides which week it
  // is speaking for: the marker is compared against it, the request is bounded by it, and
  // the card seeds its phrasings on its Monday. A second derivation anywhere else is how
  // those four would come to disagree.
  const [week] = useState(() => previousWeek(todayISO()))
  // The marker is only advanced once the recap has actually been seen, so a launch killed
  // before the dialog is dismissed tells the player again next time.
  const pendingMarker = useRef<string | null>(null)

  useEffect(() => {
    // The feature gates the read, not just the card. A player who will never be shown this
    // has no business asking the server about it once a launch.
    if (!canSee) {
      setReady(true)
      return
    }
    void (async () => {
      try {
        const marker = await AsyncStorage.getItem(SEEN_RECAP_KEY)

        // No record at all is a first-ever launch. Mark last week told and say nothing: a
        // new player should meet the game, not a report on a week they were not here for.
        if (marker === null) {
          await AsyncStorage.setItem(SEEN_RECAP_KEY, week.from)
          return
        }
        // Already told, which is every launch but the first of a week. ISO days compare
        // correctly as strings. A player away for a month gets last week once rather than
        // four recaps in a row — a recap speaks for the week that just closed, and the
        // older ones expired unheard.
        if (marker >= week.from) return

        const { rows, error } = await fetchWeeklyRecap(week)
        // A failed read is not an empty week. Leaving the marker where it is costs one
        // repeated request; moving it would lose the recap for good.
        if (error !== null) return

        const found = factsFromRows(rows, week.from)
        pendingMarker.current = week.from
        // A week in which nobody topped a board on any day is not worth opening a dialog
        // for — "nobody played" is not news to the person who also did not play. The marker
        // still advances, so the question is not re-asked on every launch for seven days.
        if (!hasAnyWinner(found)) {
          await AsyncStorage.setItem(SEEN_RECAP_KEY, week.from)
          pendingMarker.current = null
          return
        }
        setFacts(found)
      } catch {
        // Storage unavailable. Telling a week that cannot be recorded as told would repeat
        // it on every launch, so stay quiet.
      } finally {
        setReady(true)
      }
    })()
  }, [canSee, week])

  const dismiss = useCallback(() => {
    setFacts(null)
    const marker = pendingMarker.current
    pendingMarker.current = null
    if (marker === null) return
    AsyncStorage.setItem(SEEN_RECAP_KEY, marker).catch(() => {})
  }, [])

  return { facts, from: week.from, to: week.to, visible: facts !== null, ready, dismiss }
}
