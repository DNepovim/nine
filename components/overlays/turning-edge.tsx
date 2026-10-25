import { LinearGradient } from 'expo-linear-gradient'
import { useEffect } from 'react'
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated'

// A two-stop gradient that turns, for the edge of something that wants to look alive.
//
// Drawn by the challenge banner on the intro and by the challenge dialog it opens, which
// is the whole of why it is a component: the two stand one press apart, and an edge that
// swept at one tempo on the row and another in the dialog would read as two different
// objects rather than as one thing opening.
//
// **It turns rather than slides.** A sliding band only loops because it is periodic —
// `GradientFrame`'s spectrum band is the four stops laid down twice — and making a
// two-stop pair periodic means repeating it as `[a, b, a, b, a]`, which reads as three
// stops: a bright middle with the dark one at both ends. Turning keeps it the single
// clean sweep from a to b that it is.
//
// This is the native half. On web the box does not turn at all — a rotated child escapes
// its parent's rounded clip in Safari — and the gradient's angle moves instead; see
// `turning-edge.web.tsx`.

// One turn. The tempo `GradientFrame`'s own band has always slid at — slow on purpose,
// since the NINE letters cycle every two seconds and an edge moving at that rate would
// read as a second thing happening rather than as one thing being alive.
const SWEEP_MS = 8000

export function TurningEdge({
  edge,
  width,
  height,
}: {
  edge: readonly [string, string]
  // The box being edged. Measured by the caller, because the caller is what has an
  // `onLayout` to measure with — this is absolutely positioned and has no size of its
  // own to report.
  width: number
  height: number
}) {
  const sweep = useSharedValue(0)

  useEffect(() => {
    sweep.value = withRepeat(
      withTiming(1, { duration: SWEEP_MS, easing: Easing.linear }),
      -1,
      false,
    )
  }, [sweep])

  const turnStyle = useAnimatedStyle(() => ({
    transform: [{ rotate: `${sweep.value * 360}deg` }],
  }))

  // The side of the square that turns: the box's own diagonal, so no corner ever swings
  // inside the edge it is painting. Centred by half the overhang on each axis.
  const span = Math.ceil(Math.sqrt(width * width + height * height))

  return (
    <Animated.View
      pointerEvents="none"
      style={[
        {
          position: 'absolute',
          width: span,
          height: span,
          left: (width - span) / 2,
          top: (height - span) / 2,
        },
        turnStyle,
      ]}
    >
      <LinearGradient
        colors={[edge[0], edge[1]]}
        // The diagonal: the pair reads across the corner rather than along a side, so
        // both stops are on every edge of the box at once.
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={{ flex: 1 }}
      />
    </Animated.View>
  )
}
