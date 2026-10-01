import { Trans } from '@lingui/react/macro'
import { useEffect } from 'react'
import { Text } from 'react-native'
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withSequence,
  withTiming,
} from 'react-native-reanimated'

import { STRIKE_MS } from '@/constants/arcade'

// The word, over the crossroad that earned it. Rises and fades as the hero leaves.
//
// It exists because the rule needs saying once. A player watching the depth jump by two
// could read it as a bug; the same jump with STRIKE over the crossroad it left is a rule
// being explained in the only moment it is relevant.
//
// Mounted per strike — the screen keys it on the run's beat — so it plays once and goes.
const RISE = 26

export function ArcadeStrike({ x, y, ink }: { x: number; y: number; ink: string }) {
  const lift = useSharedValue(0)
  const opacity = useSharedValue(0)

  useEffect(() => {
    lift.value = withTiming(-RISE, {
      duration: STRIKE_MS,
      easing: Easing.out(Easing.cubic),
    })
    // In quickly, out over the rest of the flight, so it is readable while the hero is
    // still on the first way and gone by the time it lands.
    opacity.value = withSequence(
      withTiming(1, { duration: STRIKE_MS * 0.18 }),
      withTiming(0, { duration: STRIKE_MS * 0.82 }),
    )
  }, [])

  const style = useAnimatedStyle(() => ({
    opacity: opacity.value,
    transform: [{ translateY: lift.value }],
  }))

  return (
    <Animated.View
      pointerEvents="none"
      style={[{ position: 'absolute', left: x - 60, top: y - 34, width: 120 }, style]}
    >
      <Text
        selectable={false}
        className="text-center font-mono text-[11px] font-black tracking-[3px]"
        style={{ color: ink }}
      >
        <Trans>STRIKE</Trans>
      </Text>
    </Animated.View>
  )
}
