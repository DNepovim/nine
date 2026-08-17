import { LinearGradient } from 'expo-linear-gradient'
import { useEffect, useState, type ReactElement } from 'react'
import { View, type ViewStyle } from 'react-native'
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated'

import { Confetti } from '@/components/game/confetti'
import { Fireworks } from '@/components/game/fireworks'
import { Hyperspace } from '@/components/game/hyperspace'
import { GOLD_SCALE, PALE_GOLD } from '@/constants/colors'
import type { Period } from '@/lib/announcements'
import type { RecordScreen } from '@/lib/champions'
import { DARK_MODE_GRADIENT, MODE_GRADIENT, type Mode } from '@/machines/game'

// Mounted inside Screen, which pads its children — and Yoga lays absolute children out
// inside that padding, so a plain inset-0 fill would leave a bare frame around the gold.
// Bleeding past the padding costs nothing: none of this is interactive.
const BLEED: ViewStyle = {
  position: 'absolute',
  top: -16,
  left: -16,
  right: -16,
  bottom: -16,
}

const FILL: ViewStyle = { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }

// The background arrives rather than being there: the screen crossfades in from the run
// behind it, and a sheet of colour snapping on at full strength lands ahead of
// everything else.
const GOLD_FADE_MS = 900

// How solid each screen's wash is. A reign and a mode's Extreme record own the screen;
// an all-time record on an easier board tints it, so the celebration still reads as the
// difference from an ordinary game over without pretending to be a coronation.
// Low, because this screen keeps the ordinary inks: the tint has to read as a change of
// mood without dropping dim text onto a mid-tone.
const WASH_ALPHA = '4D'

// The same effect the announcement played mid-run, so a record celebrates the same way
// wherever the player meets it — the day's confetti, the week's fireworks, the jump to
// lightspeed for all time.
const EFFECTS = {
  today: (colors) => <Confetti colors={colors} />,
  week: (colors) => <Fireworks colors={colors} />,
  ever: (colors) => <Hyperspace colors={colors} />,
} as const satisfies Record<
  Period,
  (colors: readonly [string, ...string[]]) => ReactElement
>

// How long to leave each cycle running before starting the next — measured from each
// effect's own longest path, not guessed. Confetti: 2000ms of staggered starts plus a
// 2500ms fall and its fade. Fireworks: nine bursts 340ms apart plus 1200ms of flight.
// Hyperspace: 1400ms of stars lighting up, then 600 + 1000 + 1600 to appear, stretch
// and fly out.
//
// Every one is rounded up, because cutting a cycle short is what makes an effect look
// like it broke: re-keying mid-flight snatches the streaks off the screen. A short lull
// between cycles reads as waves instead.
const CYCLE_MS = {
  today: 5200,
  week: 4400,
  ever: 5000,
} as const satisfies Record<Period, number>

// Every effect here is one-shot by design — mounting plays it, and the announcement bar
// unmounts it when the moment passes. A game-over screen has no such moment, so the
// cycle counter re-keys the effect instead, which replays it from the start exactly as
// a new announcement would. No effect had to learn how to loop.
export function RecordBackdrop({
  record,
  screen,
  gameMode,
}: {
  record: Period
  screen: RecordScreen
  gameMode: Mode
}) {
  const [cycle, setCycle] = useState(0)
  const goldIn = useSharedValue(0)

  useEffect(() => {
    const id = setInterval(() => {
      setCycle((n) => n + 1)
    }, CYCLE_MS[record])
    return () => {
      clearInterval(id)
    }
  }, [record])

  useEffect(() => {
    goldIn.value = withTiming(1, { duration: GOLD_FADE_MS })
  }, [goldIn])

  const goldStyle = useAnimatedStyle(() => ({ opacity: goldIn.value }))

  // A reign takes the gold the announcement bar wears. A mode's own record takes the
  // mode's colours, at full strength for Extreme and tinted for anything easier.
  const [from, to] = MODE_GRADIENT[gameMode]
  const [darkFrom, darkTo] = DARK_MODE_GRADIENT[gameMode]
  const wash =
    screen === 'crown'
      ? ([GOLD_SCALE[1], GOLD_SCALE[0]] as const)
      : screen === 'bird'
        ? ([darkFrom, darkTo] as const)
        : screen === 'wash'
          ? ([`${from}${WASH_ALPHA}`, `${to}${WASH_ALPHA}`] as const)
          : null

  // Particles have to survive their own background: the gold scale on gold and the mode
  // scale on the mode's own colours would each vanish, so anything that paints the
  // screen gets the pale set instead.
  // The tinted screen keeps the ordinary look, so its celebration keeps the ordinary
  // gold particles too. The two painted screens need the pale set to stay visible.
  const particles = screen === 'crown' || screen === 'bird' ? PALE_GOLD : GOLD_SCALE

  return (
    <View pointerEvents="none" style={BLEED}>
      {wash !== null && (
        <Animated.View style={[FILL, goldStyle]}>
          <LinearGradient
            colors={[wash[0], wash[1]]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={FILL}
          />
        </Animated.View>
      )}
      <View key={cycle} style={FILL}>
        {EFFECTS[record](particles)}
      </View>
    </View>
  )
}
