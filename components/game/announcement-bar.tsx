import { LinearGradient } from 'expo-linear-gradient'
import { useEffect } from 'react'
import { Text } from 'react-native'
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated'

const FADE_MS = 180

// The best-scores bar wearing the mode gradient, with a message in white. Fills its
// parent, so it covers the scores row for as long as it is mounted.
export function AnnouncementBar({
  message,
  from,
  to,
}: {
  message: string
  from: string
  to: string
}) {
  const opacity = useSharedValue(0)

  useEffect(() => {
    opacity.value = withTiming(1, { duration: FADE_MS, easing: Easing.out(Easing.quad) })
  }, [opacity])

  const fadeStyle = useAnimatedStyle(() => ({ opacity: opacity.value }))

  return (
    <Animated.View
      style={[{ position: 'absolute', top: 0, right: 0, bottom: 0, left: 0 }, fadeStyle]}
    >
      <LinearGradient
        colors={[from, to]}
        start={{ x: 0, y: 0.5 }}
        end={{ x: 1, y: 0.5 }}
        className="flex-1 items-center justify-center rounded-[3px]"
      >
        <Text
          selectable={false}
          numberOfLines={1}
          className="font-mono text-[9px] font-black tracking-[1.5px] text-white"
        >
          {message}
        </Text>
      </LinearGradient>
    </Animated.View>
  )
}
