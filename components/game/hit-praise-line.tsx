import { useEffect, useState } from 'react'
import { Text } from 'react-native'
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated'

import { MODE_GRADIENT } from '@/machines/game'

// Trainee's colour, the same one the tips panel and its border wear.
const TINT = MODE_GRADIENT.trainee[0]

const FADE_MS = 220
const RISE_PX = 4

// Reserved whether or not there is anything to say, so praise arriving and
// leaving never nudges the board below it.
const HEIGHT = 14

// Says what the confetti was for. Without it a learner sees a celebration and has
// to guess which half of the hit earned it, which is the one thing Trainee exists
// to teach.
export function HitPraiseLine({ message }: { message: string | null }) {
  // Held past the message going null so the words fade out rather than vanishing
  // the instant the celebration ends.
  const [shown, setShown] = useState('')
  const fade = useSharedValue(0)
  const rise = useSharedValue(RISE_PX)

  useEffect(() => {
    if (message !== null) setShown(message)
  }, [message])

  useEffect(() => {
    const visible = message !== null
    // Rises into place and fades away flat — entrances move, exits do not.
    fade.value = withTiming(visible ? 1 : 0, {
      duration: FADE_MS,
      easing: visible ? Easing.out(Easing.quad) : Easing.in(Easing.quad),
    })
    rise.value = visible
      ? withTiming(0, { duration: FADE_MS, easing: Easing.out(Easing.quad) })
      : RISE_PX
  }, [message, fade, rise])

  const style = useAnimatedStyle(() => ({
    opacity: fade.value,
    transform: [{ translateY: rise.value }],
  }))

  return (
    <Animated.View style={[{ height: HEIGHT, justifyContent: 'center' }, style]}>
      <Text
        selectable={false}
        className="text-center font-mono text-[10px] font-bold tracking-[0.3px]"
        style={{ color: TINT }}
      >
        {shown}
      </Text>
    </Animated.View>
  )
}
