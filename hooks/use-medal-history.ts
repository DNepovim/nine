import AsyncStorage from '@react-native-async-storage/async-storage'
import { isEmptyArray } from 'narrowland'
import { useEffect, useRef, useState } from 'react'

import { MEDAL_HISTORY_KEY } from '@/constants/storage'
import { readPersisted } from '@/lib/hydration'
import { dayInPrague } from '@/lib/leaderboard-period'
import type { MedalLoss, Taker } from '@/lib/lost-medals'
import { prunedHistory, recordTaken, toMedalHistory } from '@/lib/medal-history'
import type { TakenMedal } from '@/lib/medal-history'

// Adds this launch's losses to the week's list, and prunes whatever has fallen out of it.
//
// Read-modify-write rather than an append, because the pruning has to happen on a launch
// that lost nothing too — a week rolls on without any help from the player.
//
// Not a hook: the one caller is `useLostMedals`, which already holds the losses and the
// names that go with them, and asking it to route them through a second hook's state
// would put a render between noticing a loss and writing it down.
export async function recordTakenMedals(
  losses: readonly { loss: MedalLoss; taker: Taker | null }[],
): Promise<void> {
  const hydration = await readPersisted<unknown>(
    AsyncStorage.getItem.bind(AsyncStorage),
    MEDAL_HISTORY_KEY,
  )
  // A read that failed knows nothing about what is stored, so writing on the strength of
  // it would drop a week of losses to keep one — the same rule the standings snapshot
  // follows, and for the same reason.
  if (!hydration.mayPersist) return
  const next = recordTaken(toMedalHistory(hydration.value), losses, dayInPrague())
  await AsyncStorage.setItem(MEDAL_HISTORY_KEY, JSON.stringify(next))
}

// The medals taken off the player in the last week, newest first — what the medals screen
// shows under what they still hold.
//
// Read once, when the screen that wants it opens. The writing happens at launch, long
// before there is anything to tap, so there is nothing here to keep in sync: this is a
// record of what was already said, and it does not change while it is being looked at.
export function useMedalHistory(): readonly TakenMedal[] {
  const [history, setHistory] = useState<readonly TakenMedal[]>([])
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
        MEDAL_HISTORY_KEY,
      )
      if (!live.current) return
      const stored = toMedalHistory(hydration.value)
      // Pruned on the way out as well as on the way in: a device left closed over a
      // weekend comes back with rows that have aged past the window, and the launch that
      // would have swept them only runs when something was actually lost.
      setHistory(isEmptyArray(stored) ? stored : prunedHistory(stored, dayInPrague()))
    })()
  }, [])

  return history
}
