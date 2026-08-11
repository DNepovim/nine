import { LinearGradient } from 'expo-linear-gradient'
import { useEffect, useState } from 'react'
import { Text, View } from 'react-native'
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated'
import { scheduleOnRN } from 'react-native-worklets'

// Unhurried: the wipe is the whole effect, and at 14px tall it needs the time to be
// read as a movement rather than a flicker.
const SWEEP_MS = 750
// A gentle start, then a long glide out — the edge gets going, then settles rather
// than stopping dead.
const SWEEP_EASING = Easing.bezier(0.33, 0, 0.15, 1)
// How much of the leading edge is a fade rather than a cut.
const FEATHER = 28

const TRANSPARENT = 'transparent'

// The best-scores bar wearing the announcement's own gradient, wiped on and off left to
// right. Fills its parent, which sits over the scores row.
//
// The message is *clipped* to a moving window rather than covered by one, so the scores
// underneath stay visible until the edge passes over them. A feather — a short gradient
// from the bar's colour to transparent — rides that edge so it reads as a fade rather
// than a cut, and rides off the end of the bar when the wipe completes, leaving the
// message solid.
//
//   entering  the window grows from the left, feather leading
//   leaving   the window's left edge advances right, feather trailing
//
// One value drives both: `edge` runs 0 → width either way, so the travel is always left
// to right. `leaving` is owned by the parent, which keeps this mounted through the exit
// and drops it when onExited fires.
export function AnnouncementBar({
  message,
  from,
  to,
  ink,
  leaving,
  onExited,
}: {
  message: string
  from: string
  to: string
  ink: string
  leaving: boolean
  onExited: () => void
}) {
  // The wipe needs a pixel width to travel across, so it waits for one layout pass.
  const [width, setWidth] = useState(0)
  const edge = useSharedValue(0)

  useEffect(() => {
    if (width === 0) return
    edge.value = 0
    edge.value = withTiming(
      width,
      { duration: SWEEP_MS, easing: SWEEP_EASING },
      (finished) => {
        if (finished && leaving) scheduleOnRN(onExited)
      },
    )
  }, [width, leaving, edge, onExited])

  // Entering, the window is [0, edge]; leaving, it is [edge, width] — so the message is
  // uncovered left-first on the way in and covered left-first on the way out.
  const windowStyle = useAnimatedStyle(() =>
    leaving
      ? { left: edge.value, width: Math.max(0, width - edge.value) }
      : { left: 0, width: edge.value },
  )

  // The gradient and the text sit at full width inside the window and are pushed back
  // by however far the window starts in, so they stay put on screen while it moves.
  const contentStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: leaving ? -edge.value : 0 }],
  }))

  // Leading edge on the way in, trailing edge on the way out — either way it sits at
  // `edge` and fades away from the solid part.
  const featherStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: leaving ? edge.value - FEATHER : edge.value }],
  }))

  return (
    <View
      // Clips the feather, which parks just past the bar's edge once the wipe lands
      // and would otherwise show as a stray block beside the message.
      style={{
        position: 'absolute',
        top: 0,
        right: 0,
        bottom: 0,
        left: 0,
        overflow: 'hidden',
      }}
      onLayout={(e) => {
        setWidth(e.nativeEvent.layout.width)
      }}
    >
      <Animated.View
        style={[
          { position: 'absolute', top: 0, bottom: 0, overflow: 'hidden' },
          windowStyle,
        ]}
      >
        <Animated.View
          style={[{ position: 'absolute', top: 0, bottom: 0, width }, contentStyle]}
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
              // Sentence case, so the wide tracking the app gives its caps labels
              // would read as airy here. The rival's name is the only thing shouting.
              className="font-mono text-[9px] font-black tracking-[0.3px]"
              style={{ color: ink }}
            >
              {message}
            </Text>
          </LinearGradient>
        </Animated.View>
      </Animated.View>

      {width > 0 && (
        <Animated.View
          pointerEvents="none"
          style={[
            { position: 'absolute', top: 0, bottom: 0, left: 0, width: FEATHER },
            featherStyle,
          ]}
        >
          <LinearGradient
            colors={leaving ? [TRANSPARENT, from] : [to, TRANSPARENT]}
            start={{ x: 0, y: 0.5 }}
            end={{ x: 1, y: 0.5 }}
            style={{ flex: 1 }}
          />
        </Animated.View>
      )}
    </View>
  )
}
