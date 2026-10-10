import { MaterialCommunityIcons } from '@expo/vector-icons'
import { useEffect, type ComponentProps } from 'react'
import Animated, {
  Easing,
  Extrapolation,
  interpolate,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated'

import { DIAL_COLORS } from '@/constants/colors'
import type { DialMetrics } from '@/lib/dial-metrics'
import type { HandGesture } from '@/machines/tutorial-lesson'
import type { DialSpec } from '@/modes'

// One pass of the thumb, and how much of that pass it is on screen for.
//
// Slow enough to be followed with the eyes rather than noticed out of the corner of one,
// and with a beat of nothing at the end so the loop reads as the same gesture made again
// rather than as a thumb circling. It repeats until the player makes the gesture, which is
// what ends the lesson — so the pause matters more than the speed.
const CYCLE_MS = 1800
const APPEAR = 0.1
const TRAVEL_FROM = 0.14
const TRAVEL_TO = 0.72
const FADE = 0.82

// How far a single swipe is mimed, as a share of one key. Past the key's own edge, because
// a gesture that stayed inside the pill would read as a press — and the dial takes a swipe
// on the way out of a key, which is the thing being shown.
const REACH = 0.8

// The glyph each gesture is shown by: a hand with the arrow the dial is waiting for. The
// drag wears the left one, which is the way it travels.
const GLYPH = {
  down: 'gesture-swipe-down',
  left: 'gesture-swipe-left',
  right: 'gesture-swipe-right',
  drag: 'gesture-swipe-left',
} as const satisfies Record<
  HandGesture,
  ComponentProps<typeof MaterialCommunityIcons>['name']
>

// How big the hand is drawn against one key, and the ink it is drawn in. The digit's own
// ink: it has to hold up over a pale key, over a key at nine, and over the surface between
// them, and that is the one colour in the dial's palette already chosen to.
const SIZE = 0.44
const INK = DIAL_COLORS.text

// Where one key's middle is, in the dial box's own coordinates.
const middleOf = (metrics: DialMetrics, row: number, col: number) => ({
  x: col * (metrics.button + metrics.gap) + metrics.button / 2,
  y: row * (metrics.button + metrics.gap) + metrics.button / 2,
})

// Which key the gesture is mimed on, and how far it travels from there.
//
// The three swipes are shown on the middle key, which is the neutral one: the lesson will
// take the gesture on any key, so the mime should not look like an instruction about a
// particular one. The drag is the exception — its board's route *is* a particular row, the
// bottom one, and the whole point of it is that one unbroken travel covers all three keys.
const mimeOf = (
  gesture: HandGesture,
  dial: DialSpec,
  metrics: DialMetrics,
): { from: { x: number; y: number }; dx: number; dy: number } => {
  const stride = metrics.button + metrics.gap
  const reach = metrics.button * REACH
  if (gesture === 'drag') {
    return {
      from: middleOf(metrics, dial.rows - 1, dial.cols - 1),
      dx: -(dial.cols - 1) * stride,
      dy: 0,
    }
  }
  const from = middleOf(
    metrics,
    Math.floor((dial.rows - 1) / 2),
    Math.floor((dial.cols - 1) / 2),
  )
  if (gesture === 'down') return { from, dx: 0, dy: reach }
  return { from, dx: gesture === 'left' ? -reach : reach, dy: 0 }
}

// The gesture the lesson is asking for, made over the dial until the player makes it.
//
// A line naming a swipe is a line about something the player has never done, and the three
// swipe lessons are the only places in the app where the words alone have to carry a move.
// So the words get a thumb beside them: it starts on a key, travels the way the dial wants
// to be swiped, and goes — then does it again.
//
// Drawn over the keys and deaf to every touch: what it is showing is a gesture the dial
// underneath has to be able to hear.
export function GestureHint({
  gesture,
  dial,
  metrics,
}: {
  gesture: HandGesture
  dial: DialSpec
  metrics: DialMetrics
}) {
  const pass = useSharedValue(0)

  useEffect(() => {
    pass.value = 0
    pass.value = withRepeat(
      withTiming(1, { duration: CYCLE_MS, easing: Easing.linear }),
      -1,
      false,
    )
  }, [gesture])

  const { from, dx, dy } = mimeOf(gesture, dial, metrics)
  const size = Math.round(metrics.button * SIZE)

  // One driver, three readings of it: the thumb arrives, travels, and goes. Eased inside
  // the travel rather than on the clock, so the pause at the end of each pass is the same
  // length however far the gesture is — and the curve is written out here rather than
  // taken from `Easing`, since what runs in a worklet has to be a worklet.
  const style = useAnimatedStyle(() => {
    const t = interpolate(
      pass.value,
      [TRAVEL_FROM, TRAVEL_TO],
      [0, 1],
      Extrapolation.CLAMP,
    )
    // Ease in and out, cubic: a thumb that starts and stops the way a real one does.
    const travel = t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2
    return {
      opacity: interpolate(
        pass.value,
        [0, APPEAR, FADE, 1],
        [0, 1, 0, 0],
        Extrapolation.CLAMP,
      ),
      transform: [{ translateX: dx * travel }, { translateY: dy * travel }],
    }
  })

  return (
    <Animated.View
      pointerEvents="none"
      style={[
        {
          position: 'absolute',
          left: from.x - size / 2,
          top: from.y - size / 2,
          width: size,
          height: size,
        },
        style,
      ]}
    >
      <MaterialCommunityIcons name={GLYPH[gesture]} size={size} color={INK} />
    </Animated.View>
  )
}
