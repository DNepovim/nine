import AsyncStorage from '@react-native-async-storage/async-storage'
import { useCallback, useEffect, useState } from 'react'

import { FEEDBACK_ANSWERED_KEY } from '@/constants/storage'
import { parseFeedbackAnswered, serializeFeedbackAnswered } from '@/lib/feedback-answered'

// Whether an answer to this player's feedback has ever reached them, for the one thing
// that asks: the HEARD BACK achievement.
//
// The same shape as `useHowToPlay`, and for the same reason — a single bit the player
// cannot be asked about twice, hydrated once and written on the way past.
export function useFeedbackAnswered() {
  const [answered, setAnswered] = useState(false)

  // Hydrate once. A read failure leaves it false, which at worst withholds an
  // achievement until the next answer lands.
  useEffect(() => {
    void (async () => {
      try {
        setAnswered(
          parseFeedbackAnswered(await AsyncStorage.getItem(FEEDBACK_ANSWERED_KEY)),
        )
      } catch {
        // ignore — no answer recorded yet
      }
    })()
  }, [])

  // Dismissing the reply is what counts as having heard back: it is the same moment the
  // answer is marked seen on the server, so the two records agree about which replies
  // the player has actually been shown.
  const markAnswered = useCallback(() => {
    AsyncStorage.setItem(FEEDBACK_ANSWERED_KEY, serializeFeedbackAnswered(true)).catch(
      () => {},
    )
    setAnswered(true)
  }, [])

  return { answered, markAnswered }
}
