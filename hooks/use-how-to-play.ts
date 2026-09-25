import AsyncStorage from '@react-native-async-storage/async-storage'
import { useCallback, useEffect, useState } from 'react'

import { HOW_TO_PLAY_KEY } from '@/constants/storage'
import { parseGuideRead, serializeGuideRead } from '@/lib/how-to-play'

// Whether the player has read How to Play, for the one thing that asks: the GRADUATE
// achievement. Nothing else hangs off it — the guide itself is always available from the
// intro and from the pause screen, read or not.
export function useHowToPlay() {
  const [read, setRead] = useState(false)

  // Hydrate once. A read failure leaves it false, which at worst withholds an achievement
  // the next visit hands over anyway.
  useEffect(() => {
    void (async () => {
      try {
        setRead(parseGuideRead(await AsyncStorage.getItem(HOW_TO_PLAY_KEY)))
      } catch {
        // ignore — not read yet
      }
    })()
  }, [])

  // Closing the guide is what counts as having read it: there is no last page to reach,
  // and a player who scrolled to what they came for and left has been taught either way.
  const markRead = useCallback(() => {
    AsyncStorage.setItem(HOW_TO_PLAY_KEY, serializeGuideRead(true)).catch(() => {})
    setRead(true)
  }, [])

  return { read, markRead }
}
