import { useEffect, useMemo } from 'react'
import { View } from 'react-native'
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSequence,
  withTiming,
} from 'react-native-reanimated'
import Svg, { Polyline } from 'react-native-svg'

import { STORM } from '@/constants/colors'
import { boltPath, boltPoints } from '@/lib/storm'

// How wide the bolt's box is, which is how far it may wander either side of its line.
const BOLT_BOX = 64
const FLASH_STEPS = [
  { to: 1, ms: 30 },
  { to: 0.3, ms: 50 },
  { to: 1, ms: 40 },
  { to: 0, ms: 240 },
] as const

// Storm's strike: a flash of lightning from the sum to the target it took, a jagged line that
// is there at once rather than drawn out, and flickers as it goes.
//
// Laid out like `StrikeBeam`: the parent puts a zero-size anchor at the muzzle, this turns it
// to the angle, and the bolt runs along +X from there. `offset` and `length` are the inset
// line, so the flash clears the digits it leaves and the rim it lands on.
export function StrikeBolt({
  seed,
  offset,
  length,
  angle,
}: {
  seed: number
  offset: number
  length: number
  angle: number
}) {
  const opacity = useSharedValue(0)

  useEffect(() => {
    opacity.value = withSequence(
      ...FLASH_STEPS.map(({ to, ms }) => withTiming(to, { duration: ms })),
    )
  }, [opacity])

  // `boltPoints` falls down a box; turned on its side it runs along the ray.
  const points = useMemo(
    () =>
      boltPath(boltPoints(seed, BOLT_BOX, length).map(({ x, y }) => ({ x: y, y: x }))),
    [seed, length],
  )
  const style = useAnimatedStyle(() => ({ opacity: opacity.value }))

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
            left: offset,
            top: -BOLT_BOX / 2,
            width: length,
            height: BOLT_BOX,
          },
          style,
        ]}
      >
        <Svg width={length} height={BOLT_BOX}>
          <Polyline
            points={points}
            fill="none"
            stroke={STORM.boltEdge}
            strokeWidth={8}
            strokeOpacity={0.55}
            strokeLinejoin="round"
          />
          <Polyline
            points={points}
            fill="none"
            stroke={STORM.bolt}
            strokeWidth={2.5}
            strokeLinejoin="round"
          />
        </Svg>
      </Animated.View>
    </View>
  )
}
