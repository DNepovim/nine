import { useEffect, type ComponentProps } from 'react'
import Animated, {
  cancelAnimation,
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated'

import { DancerFigure } from '@/components/game/dancer-figure'
import { TargetCard } from '@/components/game/target-card'
import { PIE_SIZE } from '@/constants/game'
import { dancerOf } from '@/lib/dancers'

// A target as a dancer seen from above: the `dancers` **target form**, CHA CHA's. The card is the
// ordinary one — its number and its ring — and it is the dancer's head; behind it
// (`DancerFigure`) are the shoulders and arms, turned a different way for each target and
// swaying a few degrees, so the board reads as a floor of couples rather than a field of discs.
// Drawing only, and the sway held still while the run is paused and while a target is leaving.

// How much wider than the card the figure is drawn. Wide enough for the shoulders and arms to show
// round the head, no wider than the board's spacing can bear — a drilled run stands nine of them.
const SPREAD = 1.7
const SWAY_DEG = 7
const SWAY_MS = 900

export function DancerTarget(props: ComponentProps<typeof TargetCard>) {
  const { target, size = PIE_SIZE, frozen = false, dying = false } = props
  const dancer = dancerOf(target.seq)
  const active = target.exit === null && !dying && !frozen
  const sway = useSharedValue(0)

  useEffect(() => {
    if (!active) {
      cancelAnimation(sway)
      sway.value = withTiming(0, { duration: 200 })
      return
    }
    sway.value = withRepeat(
      withSequence(
        withTiming(dancer.leads, { duration: SWAY_MS, easing: Easing.inOut(Easing.sin) }),
        withTiming(-dancer.leads, {
          duration: SWAY_MS,
          easing: Easing.inOut(Easing.sin),
        }),
      ),
      -1,
    )
  }, [active])

  const side = size * SPREAD
  const style = useAnimatedStyle(() => ({
    transform: [{ rotate: `${dancer.turn + sway.value * SWAY_DEG}deg` }],
  }))
  return (
    <>
      <Animated.View
        pointerEvents="none"
        style={[
          {
            position: 'absolute',
            left: target.position.x + size / 2 - side / 2,
            top: target.position.y + size / 2 - side / 2,
          },
          style,
        ]}
      >
        <DancerFigure side={side} outfit={dancer.outfit} />
      </Animated.View>
      <TargetCard {...props} />
    </>
  )
}
