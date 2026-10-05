import { useEffect } from 'react'
import { Text } from 'react-native'
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withSpring,
  withTiming,
  type SharedValue,
} from 'react-native-reanimated'

import { TOWN_BOX, TownMark } from '@/components/game/town-mark'
import { WALK_MS, WITHER_MS } from '@/constants/arcade'
import { mapLabel } from '@/constants/theme'

// The target at a way's end.
//
// A disc on the card colour with the numeral in the countdown's own ink, rather than in the
// amber the way is drawn in: amber on the parchment surface is about 2:1, so arcade's colour
// may be the line and the edge but never the number. It is the same pairing every target in
// the game is read off, which is the point — the dial answers this the way it answers any
// other target.
//
// No clock on it. The crossroad has one clock for all of its ways, drawn on the way behind
// the hero, so a bud is only ever a number.

export type BudState = 'growing' | 'withering' | 'absorbing'

export function WayBud({
  x,
  y,
  value,
  name,
  seed,
  named,
  fortified,
  state,
  delay,
  turn,
  edge,
  ink,
  line,
  hatch,
  face,
}: {
  x: number
  y: number
  value: number
  // What the place at the end of this way is called — see lib/place-names.ts.
  name: string
  // The crossroad's seed, which is how many merlons its wall has.
  seed: number
  // Whether there is room for the name. Two towns on the same fan can stand close enough
  // that their names would cross, and a crossed name is worse than no name — the place is
  // named again under the flame the moment the hero arrives there.
  named: boolean
  // Whether the village at this way's end has walls worth the name. A walled village is a
  // fight, and the fan has to say so before it is chosen — which is what makes a crossroad
  // a decision rather than four numbers.
  fortified: boolean
  state: BudState
  delay: number
  // How far the sheet has been turned. The village turns with it — it is drawn on the map —
  // but the number and the name are read rather than drawn, so they are turned back.
  turn: SharedValue<number>
  edge: string
  ink: string
  line: string
  hatch: string
  // The town's own face, which is also what it knocks the country out with.
  face: string
}) {
  const scale = useSharedValue(state === 'growing' ? 0 : 1)
  const opacity = useSharedValue(state === 'growing' ? 0 : 1)

  useEffect(() => {
    if (state === 'growing') {
      scale.value = withDelay(delay, withSpring(1, { damping: 13, stiffness: 190 }))
      opacity.value = withDelay(delay, withTiming(1, { duration: 200 }))
      return
    }
    // Refused: gone with the way it was hung on.
    if (state === 'withering') {
      scale.value = withTiming(0, { duration: WITHER_MS, easing: Easing.in(Easing.quad) })
      opacity.value = withTiming(0, { duration: WITHER_MS })
      return
    }
    // Chosen: it shrinks away over exactly the walk, so it is gone at the moment the hero
    // lands on it. A bud the hero reaches was never a thing to collect — it is the next
    // crossroad, and this is it becoming one.
    scale.value = withTiming(0, { duration: WALK_MS, easing: Easing.in(Easing.quad) })
    opacity.value = withDelay(WALK_MS * 0.55, withTiming(0, { duration: WALK_MS * 0.45 }))
  }, [state, delay])

  const style = useAnimatedStyle(() => ({
    opacity: opacity.value,
    transform: [{ scale: scale.value }],
  }))

  // Rotated about its own centre, which for a zero-size anchor is the point it stands on —
  // so a disc turned back stays exactly where it was.
  const upright = useAnimatedStyle(() => ({
    transform: [{ rotate: `${-turn.value}rad` }],
  }))

  return (
    // A zero-size anchor at the end of the way, with the three parts of a settlement hung
    // off it: the village it is, the number it is worth and the name it goes by. One
    // animated wrapper, so the three arrive and leave as one thing.
    <Animated.View
      pointerEvents="none"
      style={[{ position: 'absolute', left: x, top: y }, style]}
    >
      {/* The town, and the number inside its walls. Upright as one thing: a wall with its
          gate at the top would be a wall nobody drew, and the number is read rather than
          drawn whichever way the sheet is lying. */}
      <Animated.View
        className="absolute items-center justify-center"
        style={[
          { left: -TOWN_BOX / 2, top: -TOWN_BOX / 2, width: TOWN_BOX, height: TOWN_BOX },
          upright,
        ]}
      >
        <TownMark
          seed={seed}
          fortified={fortified}
          face={face}
          line={line}
          hatch={hatch}
          edge={edge}
        />
        {/* The number is the thing being read on this whole sheet, so it gets the room:
            large enough to be answered at a glance from the far side of a fan. */}
        <Text
          selectable={false}
          className="absolute font-mono text-[17px] font-black"
          style={{ color: ink }}
        >
          {value}
        </Text>
      </Animated.View>
      {named && (
        <Animated.View
          className="absolute"
          style={[{ left: -54, top: TOWN_BOX / 2 + 2, width: 108 }, upright]}
        >
          <Text
            selectable={false}
            numberOfLines={1}
            // The map's own lettering — a serif, upper case and tracked, which is how a
            // sheet like this has always named a place. In the `dim` token rather than the
            // map ink, because it is text and so the one piece of this held to a text
            // contrast.
            className="text-center text-[9px] font-semibold tracking-[1.2px] text-dim"
            style={{ fontFamily: mapLabel }}
          >
            {name.toUpperCase()}
          </Text>
        </Animated.View>
      )}
    </Animated.View>
  )
}
