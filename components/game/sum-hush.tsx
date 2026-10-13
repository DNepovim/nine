import { useEffect, type ReactNode } from 'react'
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated'

import { LESSON_DIM, LESSON_DIM_MS } from '@/constants/tutorial'

// The same depth and clock the lesson dims a shut key by — see dial-button.tsx. Eased out
// on the way back up and in on the way down, the app's rule for anything arriving and
// anything leaving.
const DOWN = { duration: LESSON_DIM_MS, easing: Easing.in(Easing.quad) }
const UP = { duration: LESSON_DIM_MS, easing: Easing.out(Easing.quad) }

// The sum, stepped back while the lesson's first word is standing over the board.
//
// The word is set in the middle of a board with nothing else on it — the target is held
// back until it goes, for exactly this reason — and the sum row is the one thing the
// layout cannot take away, since the dial's height is reserved whatever is being said.
// So it dims instead: a zero at full strength under a sentence about what the run is
// reads as a score the player is already being kept, which is the one thing the word is
// there to deny.
//
// Wraps the digits rather than replacing them, so it composes with HitSync — the hush is
// how bright the sum is and the beat is how big, and neither has to know about the other.
export function SumHush({ hushed, children }: { hushed: boolean; children: ReactNode }) {
  // Starts where the sum already stands rather than at full, for the reason a dead key
  // does: a tutorial opens with the word already up, and the sum should be dim on the
  // first frame instead of fading down into it in front of the player.
  const lit = useSharedValue(hushed ? LESSON_DIM : 1)

  useEffect(() => {
    lit.value = hushed ? withTiming(LESSON_DIM, DOWN) : withTiming(1, UP)
  }, [hushed, lit])

  const style = useAnimatedStyle(() => ({ opacity: lit.value }))

  return <Animated.View style={style}>{children}</Animated.View>
}
