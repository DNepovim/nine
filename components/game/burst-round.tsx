import { useEffect } from 'react'
import { View } from 'react-native'
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withSequence,
  withTiming,
} from 'react-native-reanimated'

import {
  BURST_COLOR,
  BURST_ROUND_MS,
  ROUND_FROM,
  ROUND_LENGTH,
  ROUND_TO,
} from '@/lib/strike-shot'

const THICKNESS = 3
const PEAK_OPACITY = 0.9

// How far through its travel a round is when it lands, and how long the mark it leaves
// lasts. The round is still in the air when its spark lights: the two overlap the way a
// tracer and its impact do.
const LANDS_AT = 0.7
const SPARK_SIZE = 8
const SPARK_MS = 160
const SPARK_FROM = 0.4
const SPARK_TO = 1.5

// One round of Speed's strike: a short streak crossing the gap, and the mark it leaves
// on the target's face. It never joins the two ends — five lines that each reached the
// target would read as a fan of beams, where five that cross part of the way read as
// rounds in the air.
//
// Same anchor idiom as StrikeBeam: the parent puts a zero-size anchor at the muzzle,
// this turns it to its own ray, and everything runs along +X from there.
export function BurstRound({
  length,
  angle,
  delay,
}: {
  // The full distance to this round's aim point. What is drawn is a fraction of it —
  // see ROUND_LENGTH — travelling from ROUND_FROM to ROUND_TO along the way.
  length: number
  angle: number
  delay: number
}) {
  const travel = useSharedValue(ROUND_FROM)
  const opacity = useSharedValue(0)
  const sparkScale = useSharedValue(SPARK_FROM)
  const sparkOpacity = useSharedValue(0)

  useEffect(() => {
    travel.value = withDelay(
      delay,
      withTiming(ROUND_TO, { duration: BURST_ROUND_MS, easing: Easing.out(Easing.quad) }),
    )
    opacity.value = withDelay(
      delay,
      withSequence(
        withTiming(PEAK_OPACITY, { duration: BURST_ROUND_MS * 0.25 }),
        withTiming(0, {
          duration: BURST_ROUND_MS * 0.75,
          easing: Easing.in(Easing.quad),
        }),
      ),
    )
    const lands = delay + BURST_ROUND_MS * LANDS_AT
    sparkScale.value = withDelay(
      lands,
      withTiming(SPARK_TO, { duration: SPARK_MS, easing: Easing.out(Easing.quad) }),
    )
    sparkOpacity.value = withDelay(
      lands,
      withSequence(
        withTiming(PEAK_OPACITY, { duration: 40 }),
        withTiming(0, { duration: SPARK_MS - 40, easing: Easing.in(Easing.quad) }),
      ),
    )
  }, [delay, travel, opacity, sparkScale, sparkOpacity])

  const roundStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: length * travel.value }],
    opacity: opacity.value,
  }))

  const sparkStyle = useAnimatedStyle(() => ({
    transform: [{ scale: sparkScale.value }],
    opacity: sparkOpacity.value,
  }))

  return (
    <View
      pointerEvents="none"
      style={{
        position: 'absolute',
        width: 0,
        height: 0,
        transform: [{ rotate: `${angle}deg` }],
      }}
    >
      <Animated.View
        style={[
          {
            position: 'absolute',
            left: 0,
            top: -THICKNESS / 2,
            width: length * ROUND_LENGTH,
            height: THICKNESS,
            borderRadius: THICKNESS / 2,
            backgroundColor: BURST_COLOR,
          },
          roundStyle,
        ]}
      />
      {/* Where this round lands, which is a different part of the face for every round
          in the burst — the spread is what tells five rounds apart from one thick line. */}
      <Animated.View
        style={[
          {
            position: 'absolute',
            left: length - SPARK_SIZE / 2,
            top: -SPARK_SIZE / 2,
            width: SPARK_SIZE,
            height: SPARK_SIZE,
            borderRadius: SPARK_SIZE / 2,
            backgroundColor: BURST_COLOR,
          },
          sparkStyle,
        ]}
      />
    </View>
  )
}
