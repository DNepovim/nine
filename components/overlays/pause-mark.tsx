import { LinearGradient } from 'expo-linear-gradient'
import { useEffect } from 'react'
import { View } from 'react-native'
import Animated, {
  Easing,
  useAnimatedStyle,
  useDerivedValue,
  useSharedValue,
  withRepeat,
  withTiming,
  type SharedValue,
} from 'react-native-reanimated'

import {
  GLASS_FAR_ALPHA,
  GLASS_FAR_PX,
  GLASS_FAR_SHADE,
  GLASS_PANE_SHADOW,
  GLASS_RIM_ALPHA,
  GLASS_RIM_LIFT,
  GLASS_RIM_PX,
  GLASS_SHEEN_ALPHA,
  GLASS_SHEEN_UNTIL,
  GLASS_TINT,
  rgbaWorklet,
} from '@/lib/glass'
import { mixHex } from '@/lib/mix-hex'
import { gradientOf, type ModeId } from '@/modes'

// Two bars, the universal sign for "stopped", where the game-over screen has its title.
//
// The pause screen used to open on a line of small caps naming the board, which said
// where you were but not what had happened. A mark this size says "stopped" before
// anything is read, and leaves the board to the badges under it — the same badges the
// game-over screen wears, so the two screens differ by the mark alone.
//
// Square-cut, and sized to stand where the game-over title stands rather than to sit
// above the content like an icon: that title is two rows of 56px letters, so this comes
// to about the same height in a single mark.
const BAR_HEIGHT = 120
const BAR_WIDTH = 38

// The same glass the title letters are cut from: a pane with the mode's colour behind
// it, a sheen down its top, a lit rim along the top edge and a darker far edge along the
// foot.
//
// And the same **moving** colour. Each bar tracks its own position in a gradient that
// cycles, exactly as a letter does — so the pair sweeps through the mode's pair rather
// than holding one shade, and the mark reads as the same material as the title it stands
// in place of. It floated before this and did not cycle, which made it the one large
// glass mark in the app that was alive but not lit.
//
// The period the NINE letters and the game-over title both cycle on. Shared by eye
// rather than imported: each of the three owns its own clock, and two marks are never on
// screen together.
const CYCLE_MS = 2000

// White rather than the bar's colour, since a reflection is the light's colour and not
// the thing's — which is also why this one does not cycle with the rest.
const CLEAR = 'rgba(255, 255, 255, 0)'
const SHEEN = [`rgba(255, 255, 255, ${GLASS_SHEEN_ALPHA})`, CLEAR] as const

// One bar.
//
// At module level because it holds animated styles: a component defined inside a render
// is a new type every frame, which remounts it and restarts whatever it was animating.
function PauseBar({
  from,
  to,
  tBase,
  phase,
  float,
}: {
  from: string
  to: string
  // Where this bar sits in the cycle, 0–1. The two are half a turn apart, so the pair
  // reads as one gradient passing through rather than as two bars changing together.
  tBase: number
  phase: SharedValue<number>
  // Which of the two float clocks it rides — the same pair the first two title letters
  // use. In step they would pump; out of step they wander.
  float: string
}) {
  const colour = useDerivedValue(() => mixHex(from, to, (tBase + phase.value) % 1))

  const paneStyle = useAnimatedStyle(() => ({
    backgroundColor: rgbaWorklet(colour.value, GLASS_TINT),
  }))
  const rimStyle = useAnimatedStyle(() => ({
    backgroundColor: rgbaWorklet(
      mixHex(colour.value, '#ffffff', GLASS_RIM_LIFT),
      GLASS_RIM_ALPHA,
    ),
  }))
  const farStyle = useAnimatedStyle(() => ({
    backgroundColor: rgbaWorklet(
      mixHex(colour.value, '#000000', GLASS_FAR_SHADE),
      GLASS_FAR_ALPHA,
    ),
  }))

  return (
    // The shadow outside the clip, since what is cast falls beyond the pane.
    <View className={float} style={GLASS_PANE_SHADOW}>
      <View className="overflow-hidden" style={{ width: BAR_WIDTH, height: BAR_HEIGHT }}>
        {/* The pane. A flat colour rather than a gradient down the bar, which is what
          lets it move at all: a colour is a style and rides the UI thread, where the two
          stops of a `LinearGradient` are plain props and would cost a React render every
          frame. It is also how a letter is built, and this is meant to read as one. */}
        <Animated.View style={[{ flex: 1 }, paneStyle]} />
        {/* The sheen, fading out before the middle. */}
        <LinearGradient
          colors={SHEEN}
          start={{ x: 0, y: 0 }}
          end={{ x: 0, y: GLASS_SHEEN_UNTIL }}
          style={{ position: 'absolute', left: 0, right: 0, top: 0, bottom: 0 }}
        />
        {/* The two edges. Absolute strips rather than gradient stops: an edge is where
          the glass stops, and a stop soft enough to interpolate is a glow. */}
        <Animated.View
          style={[
            { position: 'absolute', left: 0, right: 0, top: 0, height: GLASS_RIM_PX },
            rimStyle,
          ]}
        />
        <Animated.View
          style={[
            {
              position: 'absolute',
              left: 0,
              right: 0,
              bottom: 0,
              height: GLASS_FAR_PX,
            },
            farStyle,
          ]}
        />
      </View>
    </View>
  )
}

// Arcade as well as the three modes, and a challenge: none of them is named here, only
// asked for its pair.
export function PauseMark({ gameMode }: { gameMode: ModeId }) {
  const [from, to] = gradientOf(gameMode)
  const phase = useSharedValue(0)

  useEffect(() => {
    phase.value = withRepeat(
      withTiming(1, { duration: CYCLE_MS, easing: Easing.linear }),
      -1,
      false,
    )
  }, [phase])

  return (
    <View className="mb-6 flex-row gap-5">
      {[0, 1].map((bar) => (
        <PauseBar
          key={bar}
          from={from}
          to={to}
          // Half a turn apart. Nought and one would be the same point of the cycle, so
          // the two bars would hold the same colour all the way round.
          tBase={bar / 2}
          phase={phase}
          float={`letter-float-${bar}`}
        />
      ))}
    </View>
  )
}
