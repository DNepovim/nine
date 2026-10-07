import { useEffect } from 'react'
import { View } from 'react-native'
import Animated, {
  Easing,
  interpolateColor,
  useAnimatedStyle,
  useDerivedValue,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated'

import { WALK_MS } from '@/constants/arcade'
import { APP_RED, ARCADE_INK } from '@/constants/colors'

// How fed the hero is, as a bar: the one reading an arcade run has where a scored run
// keeps its score.
//
// Handed a fraction and a boolean rather than the run, so it knows nothing about bites,
// villages or hearts — see machines/satiety.ts for all three. Two props rather than one
// because the bar draws them differently: the fraction is a width, and starving is a
// colour and a pulse.

// How long the bar takes to reach a new reading. The hero's own walk, so the bar empties
// as the leg is travelled rather than snapping the instant the key is pressed — the cost
// reads as the journey rather than as the press.
//
// The same figure serves a feast. A village fills the bar over about as long as the walls
// take to come down, and one duration for both is what keeps the bar a single moving
// thing rather than two animations wearing the same shape.
const FILL_MS = WALK_MS

// The pulse an empty bar carries: how far down it dips, and how long one breath takes.
// Slow enough to read as breathing rather than as flashing — a bar at nought is already
// the loudest thing in the row by colour alone, and a fast blink on top of red is alarm
// on alarm.
const PULSE_TO = 0.35
const PULSE_MS = 620

export function SatietyBar({
  // Nought to one.
  satiety,
  // Whether the hearts are going. Not `satiety === 0` worked out here: the run owns that
  // question, and two answers to it would drift the day the threshold moves off nought.
  starving,
}: {
  satiety: number
  starving: boolean
}) {
  const fill = useSharedValue(satiety)
  const red = useSharedValue(starving ? 1 : 0)
  const pulse = useSharedValue(1)

  useEffect(() => {
    fill.value = withTiming(satiety, {
      duration: FILL_MS,
      easing: Easing.out(Easing.quad),
    })
  }, [satiety, fill])

  useEffect(() => {
    red.value = withTiming(starving ? 1 : 0, { duration: 240 })
  }, [starving, red])

  // The pulse runs only while there is something to be alarmed about, and is put back to
  // full rather than left wherever the repeat happened to stop — a bar fed back up while
  // mid-dip would otherwise sit dimmed for as long as it stayed full.
  useEffect(() => {
    if (!starving) {
      pulse.value = withTiming(1, { duration: PULSE_MS })
      return
    }
    pulse.value = withRepeat(
      withTiming(PULSE_TO, { duration: PULSE_MS, easing: Easing.inOut(Easing.sin) }),
      -1,
      true,
    )
  }, [starving, pulse])

  // Both animated values land on the same view, so they are read in one worklet rather
  // than stacked as two.
  const ink = useDerivedValue(() =>
    interpolateColor(red.value, [0, 1], [ARCADE_INK, APP_RED]),
  )

  const bar = useAnimatedStyle(() => ({
    width: `${Math.max(0, Math.min(1, fill.value)) * 100}%`,
    backgroundColor: ink.value,
    opacity: pulse.value,
  }))

  return (
    // The track, in the token that already carries the countdown pie's. A bar at nought
    // still has to read as a bar rather than as nothing at all, which is what the track
    // is for.
    //
    // Fills whatever it is given rather than claiming the row: the bar is short and sits
    // in a column of its own — see arcade-game.tsx, which is where its width is decided.
    <View className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
      <Animated.View className="h-full rounded-full" style={bar} />
    </View>
  )
}
