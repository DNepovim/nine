import { useEffect, type ComponentProps } from 'react'
import { View } from 'react-native'
import Animated, {
  cancelAnimation,
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated'

import { TargetCard } from '@/components/game/target-card'
import { PIE_SIZE } from '@/constants/game'
import { heartbeatScale } from '@/lib/ecg'

// A target as a disc that beats like a heart: the `beating` **target form**, NO SLIP's.
//
// The disc is the ordinary one. What this form adds is a heartbeat — two quick, smooth
// zooms and a rest, over most of a second — that every disc on the board keeps together, because it
// is the wall clock's and not the disc's own. Held still while the run is paused and while the
// disc is leaving, so a hit's exit is the card's alone. Drawing only.

const BEAT_MS = 800

export function HeartTarget(props: ComponentProps<typeof TargetCard>) {
  const { target, size = PIE_SIZE, frozen = false, dying = false } = props
  const active = target.exit === null && !dying && !frozen
  const phase = useSharedValue(0)

  useEffect(() => {
    if (!active) {
      cancelAnimation(phase)
      phase.value = 0
      return
    }
    phase.value = (Date.now() % BEAT_MS) / BEAT_MS
    phase.value = withSequence(
      withTiming(1, { duration: (1 - phase.value) * BEAT_MS, easing: Easing.linear }),
      withRepeat(
        withSequence(
          withTiming(0, { duration: 0 }),
          withTiming(1, { duration: BEAT_MS, easing: Easing.linear }),
        ),
        -1,
      ),
    )
  }, [active])

  // A box exactly the disc's size, scaled about its own middle. The card places itself by its
  // own position, so it is drawn inside the box shifted back by that position.
  const { x, y } = target.position
  const style = useAnimatedStyle(() => ({
    transform: [{ scale: heartbeatScale(phase.value) }],
  }))
  return (
    <Animated.View
      pointerEvents="box-none"
      style={[
        { position: 'absolute', left: x, top: y, width: size, height: size },
        style,
      ]}
    >
      <View pointerEvents="box-none" style={{ position: 'absolute', left: -x, top: -y }}>
        <TargetCard {...props} />
      </View>
    </Animated.View>
  )
}
