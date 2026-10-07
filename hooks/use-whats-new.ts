import AsyncStorage from '@react-native-async-storage/async-storage'
import { useCallback, useEffect, useState } from 'react'

import { RELEASES } from '@/constants/news'
import { SEEN_NEWS_KEY } from '@/constants/storage'
import { allItems, catchUpItems, parseSeenIds, serializeSeenIds } from '@/lib/news'
import type { NewsItem } from '@/types/news'

export function useWhatsNew() {
  const [unseen, setUnseen] = useState<readonly NewsItem[]>([])
  // The storage read is async, so an empty `unseen` means "not yet known" until
  // this flips. Anything queueing behind the news — the install popup — waits
  // for it, otherwise it paints first and gets covered a moment later.
  const [ready, setReady] = useState(false)

  useEffect(() => {
    void (async () => {
      try {
        const seen = parseSeenIds(await AsyncStorage.getItem(SEEN_NEWS_KEY))

        // No record at all means a first-ever launch. Mark everything seen and
        // stay quiet: a new player should meet the game, not a list of features
        // they never lived without.
        if (seen === null) {
          const ids = allItems(RELEASES).map((item) => item.id)
          await AsyncStorage.setItem(SEEN_NEWS_KEY, serializeSeenIds(ids))
          return
        }

        // Oldest first: a player back after several releases catches up in
        // order and finishes on the newest, rather than starting there.
        const pending = catchUpItems(RELEASES, seen)
        if (pending.length === 0) return
        setUnseen(pending)
      } catch {
        // Storage unavailable — showing news we can't record as seen would
        // repeat it on every launch, so stay quiet.
      } finally {
        setReady(true)
      }
    })()
  }, [])

  // Emptying `unseen` is what closes the dialog: the popup deck is a list built from
  // this, so a dismissal that only recorded the ids would leave the card mounted — and
  // mounted after its exit animation means an invisible full-screen scrim swallowing
  // every tap on the intro.
  const dismiss = useCallback(() => {
    setUnseen([])
    const ids = allItems(RELEASES).map((item) => item.id)
    AsyncStorage.setItem(SEEN_NEWS_KEY, serializeSeenIds(ids)).catch(() => {})
  }, [])

  return { visible: unseen.length > 0, unseen, dismiss, ready }
}
