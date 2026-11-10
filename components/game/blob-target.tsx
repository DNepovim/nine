import { useEffect, useState, type ComponentProps } from 'react'
import Animated, {
  cancelAnimation,
  Easing,
  useAnimatedStyle,
  useDerivedValue,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated'

import { TARGET_EXIT_MS } from '@/components/game/pie-countdown'
import { TargetCard } from '@/components/game/target-card'
import { WaxBlob } from '@/components/game/wax-blob'
import { LAVA } from '@/constants/colors'
import { PIE_SIZE } from '@/constants/game'
import { useDriftedValue } from '@/hooks/use-drifted-value'
import { isFresh, msToNextStep } from '@/lib/target-drift'
import { waxHeat } from '@/lib/wax'
import type { TargetExit } from '@/types/game'

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

// How far the wax swells or sinks as its target leaves, by how it left, while it fades. A hit lets
// the number out of the ring that was timing it, swelling it; the wax goes with it, so the number
// is never a white numeral left standing on the glass. A loss presses the number flat, and the
// wax sinks with it.
const EXIT_REACH = {
  hit: 1.6,
  failed: 0.4,
} as const satisfies Record<TargetExit, number>
// How long the wax takes to go when the run ends under it, as the card's own fade does.
const DYING_MS = 500
// How long the wax takes to come in.
const ARRIVE_MS = 260

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

  // The wax arrives as the card does and leaves with it: both ends run off one clock each, so it is
  // never left full-strength after its number has faded, nor faded before.
  const arrive = useSharedValue(0)
  const gone = useSharedValue(0)
  const reach = useSharedValue(1)
  useEffect(() => {
    arrive.value = withTiming(1, { duration: ARRIVE_MS, easing: Easing.out(Easing.quad) })
  }, [])
  useEffect(() => {
    if (dying) {
      reach.value = EXIT_REACH.failed
      gone.value = withTiming(1, { duration: DYING_MS, easing: Easing.in(Easing.quad) })
      return
    }
    if (target.exit === null) return
    reach.value = EXIT_REACH[target.exit]
    gone.value = withTiming(1, {
      duration: TARGET_EXIT_MS,
      easing: Easing.out(Easing.quad),
    })
  }, [target.exit, dying])
  const waxStyle = useAnimatedStyle(() => ({
    opacity: arrive.value * (1 - gone.value),
    transform: [{ scale: 1 + (reach.value - 1) * gone.value }],
  }))

  // Only read once, as the wax is made: the first-second stillness is its own clock after that.
  const [wakeIn] = useState(() =>
    isFresh(target, Date.now(), driftStep) && driftStep !== null
      ? msToNextStep(target, Date.now(), driftStep)
      : 0,
  )
  return (
    <Animated.View
      pointerEvents="none"
      style={[{ position: 'absolute', left: 0, top: 0 }, style]}
    >
      <Animated.View
        pointerEvents="none"
        style={[
          {
            position: 'absolute',
            left: target.position.x + size / 2 - side / 2,
            top: target.position.y + size / 2 - side / 2,
          },
          waxStyle,
        ]}
      >
        <WaxBlob
          size={side}
          phase={phaseOf(target.seq)}
          heading={heading}
          heat={waxHeat(shown, maxValue)}
          step={shown}
          wakeIn={wakeIn}
          shrink={shrink}
          held={!running}
        />
      </Animated.View>
      <TargetCard {...props} bare={{ ink: LAVA.numeral }} />
    </Animated.View>
  )
}
