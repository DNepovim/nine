import { useEffect, type ComponentProps } from 'react'
import { View } from 'react-native'
import Animated, {
  cancelAnimation,
  Easing,
  FadeIn,
  FadeOut,
  useAnimatedStyle,
  useDerivedValue,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated'

import { TargetCard } from '@/components/game/target-card'
import { WaxBlob } from '@/components/game/wax-blob'
import { LAVA } from '@/constants/colors'
import { PIE_SIZE } from '@/constants/game'
import { useDriftedValue } from '@/hooks/use-drifted-value'
import { isFresh, msToNextStep } from '@/lib/target-drift'
import { waxHeat } from '@/lib/wax'

// A target as a lump of lava-lamp wax: the `blobs` **target form**, DRIFT's. No disc and no ring —
// the card is only its number (`bare`), written on the wax it floats in. Behind it the wax
// (`WaxBlob`) breathes, leans the way the number is going and is coloured on the scale from purple
// to pink by the number it shows now, so a rising target warms and a falling one cools.
//
// The whole bubble, number and all, **drifts** the way its number does — a rising one up the screen
// and a falling one down it, slowly, from the moment its number first moves. And the wax is the
// clock: it keeps all of its size when the target arrives and shrinks as its ring runs down, the
// ring itself being left running and undrawn.

// How far a bubble travels a second, in px: slow enough that a number is still where the player
// aimed at it, and over a ring's whole run — 16.5 s at DRIFT's rung — still the better part of a
// card's height.
const CREEP = 4
// How much of its size the wax keeps by the time its ring has run out.
const LEAST = 0.62
// How much bigger than the card the wax is drawn, so a lump has room to swell and stretch.
const SPREAD = 1.9

// A phase that is this card's own, so no two lumps breathe in step. From the target's sequence
// number rather than a random draw, so a card put back from storage breathes as it did.
const phaseOf = (seq: number): number => seq * 2.4

export function BlobTarget(props: ComponentProps<typeof TargetCard>) {
  const {
    target,
    maxValue,
    duration,
    size = PIE_SIZE,
    driftStep = null,
    dying = false,
    frozen = false,
  } = props
  const leaving = target.exit !== null || dying
  const running = !leaving && !frozen
  const reading = useDriftedValue(target, driftStep, running)
  const shown = target.takenAt ?? reading
  const side = size * SPREAD
  const step = driftStep ?? 0

  // How much of the ring has gone, in ms: run up the way the pie runs its clock down — linear, held
  // where it stands while the run is paused or the card is leaving, and picked up from there.
  const age = useSharedValue(duration * (1 - target.startProgress))
  useEffect(() => {
    if (!running) {
      cancelAnimation(age)
      return
    }
    age.value = withTiming(duration, {
      duration: Math.max(0, duration - age.value),
      easing: Easing.linear,
    })
  }, [running])

  const heading = target.drift
  // The bubble's drift and the wax's size are both read off `age`, so they cannot disagree.
  const shrink = useDerivedValue(
    () => 1 - (1 - LEAST) * Math.min(1, age.value / duration),
  )
  const style = useAnimatedStyle(() => ({
    transform: [
      { translateY: (-heading * CREEP * Math.max(0, age.value - step)) / 1000 },
    ],
  }))

  const fresh = isFresh(target, Date.now(), driftStep)
  return (
    <Animated.View
      entering={FadeIn.duration(260)}
      exiting={FadeOut.duration(260)}
      pointerEvents="none"
      style={[{ position: 'absolute', left: 0, top: 0 }, style]}
    >
      <View
        pointerEvents="none"
        style={{
          position: 'absolute',
          left: target.position.x + size / 2 - side / 2,
          top: target.position.y + size / 2 - side / 2,
        }}
      >
        <WaxBlob
          size={side}
          phase={phaseOf(target.seq)}
          heading={heading}
          heat={waxHeat(shown, maxValue)}
          step={shown}
          wakeIn={
            fresh && driftStep !== null ? msToNextStep(target, Date.now(), driftStep) : 0
          }
          shrink={shrink}
        />
      </View>
      <TargetCard {...props} bare={{ ink: LAVA.numeral }} />
    </Animated.View>
  )
}
