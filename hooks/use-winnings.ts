import AsyncStorage from '@react-native-async-storage/async-storage'
import { useCallback, useEffect, useRef, useState } from 'react'

import { SEEN_WINNINGS_KEY } from '@/constants/storage'
import { fetchMyWinnings } from '@/lib/leaderboard'
import { todayISO } from '@/lib/leaderboard-period'
import {
  announcementRange,
  awardBlocks,
  markerAfter,
  type AwardBlock,
} from '@/lib/winnings-announcement'

// What the player won while they were away, ready to be told.
//
// Shaped like `useWhatsNew`, and for the same reasons: `ready` is false until the storage
// read has answered, so anything queueing behind this waits rather than painting first and
// being covered a moment later.
export function useWinnings(userId: string | null) {
  const [blocks, setBlocks] = useState<readonly AwardBlock[]>([])
  const [ready, setReady] = useState(false)
  // The marker is only advanced once the announcement has actually been seen, so a launch
  // that is killed before the dialog is dismissed tells the player again next time.
  const pendingMarker = useRef<string | null>(null)

  useEffect(() => {
    if (userId === null) {
      setReady(true)
      return
    }
    void (async () => {
      try {
        const today = todayISO()
        const marker = await AsyncStorage.getItem(SEEN_WINNINGS_KEY)

        // No record at all is a first-ever launch. Start from yesterday and say nothing:
        // a new player should meet the game, not a ledger of days they were not here for.
        if (marker === null) {
          await AsyncStorage.setItem(SEEN_WINNINGS_KEY, markerAfter(today))
          return
        }

        const range = announcementRange(marker, today)
        if (range === null) return

        const { awards, error } = await fetchMyWinnings(userId, range)
        // A failed read is not an empty week. Leaving the marker where it is costs one
        // repeated request; moving it would lose the announcement for good.
        if (error !== null) return

        const found = awardBlocks(awards)
        pendingMarker.current = markerAfter(today)
        // Nothing won is still an answer, and one worth recording — otherwise every
        // launch re-asks the server about the same quiet days.
        if (found.length === 0) {
          await AsyncStorage.setItem(SEEN_WINNINGS_KEY, markerAfter(today))
          pendingMarker.current = null
          return
        }
        setBlocks(found)
      } catch {
        // Storage unavailable. Announcing something that cannot be recorded as seen would
        // repeat it on every launch, so stay quiet.
      } finally {
        setReady(true)
      }
    })()
  }, [userId])

  const dismiss = useCallback(() => {
    setBlocks([])
    const marker = pendingMarker.current
    pendingMarker.current = null
    if (marker === null) return
    AsyncStorage.setItem(SEEN_WINNINGS_KEY, marker).catch(() => {})
  }, [])

  return { blocks, visible: blocks.length > 0, ready, dismiss }
}
