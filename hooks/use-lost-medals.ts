import AsyncStorage from '@react-native-async-storage/async-storage'
import { isNonEmptyArray } from 'narrowland'
import { useCallback, useEffect, useRef, useState } from 'react'

import { SEEN_STANDINGS_KEY } from '@/constants/storage'
import { recordTakenMedals } from '@/hooks/use-medal-history'
import { readPersisted } from '@/lib/hydration'
import { fetchTop5 } from '@/lib/leaderboard'
import { dayInPrague } from '@/lib/leaderboard-period'
import {
  announcedLosses,
  lostMedals,
  PERIOD_TABS,
  takerOf,
  toSeenStandings,
  type MedalLoss,
  type SeenStandings,
  type Taker,
} from '@/lib/lost-medals'
import type { BoardStanding } from '@/lib/medals'

// What the read of the device's snapshot came back with. `null` until it has answered at
// all, which is not the same as answering that there is nothing there.
type Snapshot = { seen: SeenStandings | null; mayPersist: boolean }

// A medal that was taken, and who has it now.
export type LostMedalNews = { loss: MedalLoss; taker: Taker | null }

// Every medal a rival took while the app was closed, for the line under the title, said
// one after another in the order they are worth hearing.
//
// This is the away half of what `useRivalRecords` says during a run: that one watches the
// board live and cannot see the hours nobody was watching, and it deliberately drops its
// baseline on every board change so a first load is never mistaken for an overtake. The
// gap between two visits is exactly what it throws away, and exactly what this keeps —
// by writing down where the player stood and holding the next answer against it.
//
// Compared once per launch, then written over. A loss is news the first time the player
// comes back to it and nothing at all the second, so `dismiss` spends it: without that,
// the same medal would be taken from them again after every run, since this hook outlives
// the intro screen that shows it.
export function useLostMedals({
  standings,
  loaded,
  userId,
}: {
  standings: readonly BoardStanding[]
  loaded: boolean
  // Whose standings these are — needed to read the rival's name off the board without
  // mistaking the player's own row for the one that took the place from them.
  userId: string | null
}): { news: readonly LostMedalNews[]; dismiss: () => void } {
  const [news, setNews] = useState<readonly LostMedalNews[]>([])
  const [snapshot, setSnapshot] = useState<Snapshot | null>(null)
  const compared = useRef(false)
  // A screen that has gone has no line to say this in, and the name arrives a request
  // later than the loss does.
  const live = useRef(true)
  useEffect(
    () => () => {
      live.current = false
    },
    [],
  )

  useEffect(() => {
    void (async () => {
      const hydration = await readPersisted<unknown>(
        AsyncStorage.getItem.bind(AsyncStorage),
        SEEN_STANDINGS_KEY,
      )
      if (!live.current) return
      setSnapshot({
        seen: toSeenStandings(hydration.value),
        mayPersist: hydration.mayPersist,
      })
    })()
  }, [])

  // Named in the same breath as announced, rather than shown and then filled in: each
  // name is a second request, and a line that said TAKEN for half a second before a name
  // appeared under it would rewrite itself while being read.
  //
  // All of them at once, and the sequence waits for the slowest. Three boards is three
  // requests either way; asking one at a time would only mean the second line stalling
  // mid-sequence, which is the one thing a sequence must not do. And they are asked for
  // only on a launch that actually lost something, which is not most launches.
  const announce = useCallback(
    async (losses: readonly MedalLoss[]) => {
      const announced = await Promise.all(
        losses.map(async (loss) => {
          const { rows } = await fetchTop5(
            loss.mode,
            loss.difficulty,
            PERIOD_TABS[loss.period],
          )
          // A board that would not answer still leaves the loss worth saying — the medal
          // is gone whether or not this build can name who has it.
          return { loss, taker: takerOf(rows, loss, userId) }
        }),
      )
      // Written down before anything is shown, and whether or not this screen is still
      // here to show it — the line under the title says each of these once and hands the
      // slot back, and the medals screen behind it is where they are kept afterwards.
      void recordTakenMedals(announced)
      if (!live.current) return
      setNews(announced)
    },
    [userId],
  )

  useEffect(() => {
    // Both halves have to be in: an empty list from a request that has not come back
    // would read as every medal at once being taken, and then be written down as the
    // truth. Nothing is compared, and nothing is written, until the server has answered.
    if (snapshot === null || !loaded) return

    if (!compared.current) {
      compared.current = true
      const losses =
        snapshot.seen === null
          ? []
          : announcedLosses(lostMedals(snapshot.seen, standings))
      if (isNonEmptyArray(losses)) void announce(losses)
    }

    // A read that failed knows nothing about what is stored, so writing on the strength
    // of it would put this launch's standings where a richer snapshot was — see
    // hydrateFrom. The day is stamped here rather than inside the diff because it is the
    // day these standings were *true*, which is what makes them comparable later.
    if (!snapshot.mayPersist) return
    const next: SeenStandings = { day: dayInPrague(), standings: [...standings] }
    AsyncStorage.setItem(SEEN_STANDINGS_KEY, JSON.stringify(next)).catch(() => {})
  }, [snapshot, loaded, standings, announce])

  const dismiss = useCallback(() => {
    setNews([])
  }, [])

  return { news, dismiss }
}
