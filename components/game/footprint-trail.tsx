import { useEffect } from 'react'
import { View } from 'react-native'
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withTiming,
} from 'react-native-reanimated'
import Svg, { Ellipse, Path } from 'react-native-svg'

import { STRIKE_COLORS } from '@/constants/colors'
import { useScheme } from '@/hooks/use-scheme'
import type { Leg } from '@/hooks/use-strike-shots'
import { legOpacity, printsOf, type Print, type Side } from '@/lib/footprints'
import { BEAM_END_CLEARANCE } from '@/lib/strike-shot'

// The `steps` shot: the footprints of the route, kept. Every hit lays a leg of them from the target
// taken before to the one just taken, and they stay on the floor for the run, so the ninth hit
// leaves the whole choreography on it. A strike's leg is the one that slides on fire. See `ShotKind`.
//
// One layer under the cards rather than over them, like the dial's flames: it is the floor the
// targets stand on, and a print drawn over a number would be reading as a mark on it.

const FOOT_WIDTH = 20
const FOOT_HEIGHT = 42
// How solid a print is at its freshest, kept off the embers under the burning ones; the leg's age
// takes it down from there.
const PRINT_OPACITY = 0.7

// How long the prints of a leg take to land, first to last. A hit lands them almost at once; a
// strike slides, and takes long enough for the slide to be seen.
const LAND_MS = 160
const SLIDE_MS = 340
const PRINT_IN_MS = 120
// How long a burning print takes to cool from the fire to the floor.
const COOL_MS = 600
// The flame at the head of a slide, and how wide the ember a print leaves is.
const HEAD = 16
const EMBER = 34

// A right shoe's print, toe up, in two pieces as a dance diagram draws it: the sole, a broad ball with
// the waist drawn in on the inside (left) edge, and the heel standing clear of it. Asymmetric on
// purpose — it is what tells a left print from a right one, and the left is this one mirrored.
const SOLE =
  'M10 1 C15.6 1 18.6 5.6 18.2 11.6 C17.9 16 15.8 19.4 15.2 23 C14.9 25 15.2 26.4 14.6 27.6 L7.2 27.6 C6.6 25.6 7.6 23.4 7.4 20.6 C7.2 17 2 15.6 2 9 C2 4.2 5.6 1 10 1 Z'

function Foot({ color }: { color: string }) {
  return (
    <Svg width={FOOT_WIDTH} height={FOOT_HEIGHT} viewBox="0 0 20 42">
      <Path d={SOLE} fill={color} />
      <Ellipse cx={11} cy={36} rx={4.4} ry={4.8} fill={color} />
    </Svg>
  )
}

// One print: it lands when the leg's slide reaches it, and a burning one leaves an ember that
// cools away under it.
function FootPrint({
  print,
  burning,
  span,
  color,
}: {
  print: Print
  burning: boolean
  span: number
  color: string
}) {
  const landed = useSharedValue(0)
  const ember = useSharedValue(0)

  useEffect(() => {
    const delay = print.at * span
    landed.value = withDelay(delay, withTiming(1, { duration: PRINT_IN_MS }))
    if (burning) {
      ember.value = withDelay(
        delay,
        withTiming(1, { duration: 40 }, (done) => {
          if (done) ember.value = withTiming(0, { duration: COOL_MS })
        }),
      )
    }
  }, [])

  const footStyle = useAnimatedStyle(() => ({ opacity: landed.value * PRINT_OPACITY }))
  const emberStyle = useAnimatedStyle(() => ({
    opacity: ember.value,
    transform: [{ scale: 0.6 + ember.value * 0.6 }],
  }))

  return (
    <View
      pointerEvents="none"
      style={{
        position: 'absolute',
        left: print.x - EMBER / 2,
        top: print.y - EMBER / 2,
        width: EMBER,
        height: EMBER,
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      {burning && (
        <Animated.View
          style={[
            {
              position: 'absolute',
              width: EMBER,
              height: EMBER,
              borderRadius: EMBER / 2,
              backgroundColor: STRIKE_COLORS.hot,
              shadowColor: STRIKE_COLORS.cool,
              shadowOpacity: 0.9,
              shadowRadius: 8,
              shadowOffset: { width: 0, height: 0 },
            },
            emberStyle,
          ]}
        />
      )}
      <Animated.View
        style={[
          // The foot points along the leg: drawn toe up, so a leg at angle 0 (to the right)
          // turns a quarter. The right foot is the left's mirror.
          { transform: [{ rotate: `${print.angle + 90}deg` }, { scaleX: print.side }] },
          footStyle,
        ]}
      >
        <Foot color={color} />
      </Animated.View>
    </View>
  )
}

// The flame running ahead of a strike's prints, from the card it left to the card it took.
function SlideHead({ leg }: { leg: Leg }) {
  const run = useSharedValue(0)
  useEffect(() => {
    run.value = withTiming(1, { duration: SLIDE_MS, easing: Easing.in(Easing.quad) })
  }, [])
  const style = useAnimatedStyle(() => ({
    opacity: run.value < 1 ? 1 : 0,
    transform: [
      { translateX: (leg.to.x - leg.from.x) * run.value },
      { translateY: (leg.to.y - leg.from.y) * run.value },
    ],
  }))
  return (
    <Animated.View
      pointerEvents="none"
      style={[
        {
          position: 'absolute',
          left: leg.from.x - HEAD / 2,
          top: leg.from.y - HEAD / 2,
          width: HEAD,
          height: HEAD,
          borderRadius: HEAD / 2,
          backgroundColor: STRIKE_COLORS.hot,
          shadowColor: STRIKE_COLORS.cool,
          shadowOpacity: 1,
          shadowRadius: 10,
          shadowOffset: { width: 0, height: 0 },
        },
        style,
      ]}
    />
  )
}

function FootprintLeg({
  leg,
  firstSide,
  age,
  color,
}: {
  leg: Leg
  firstSide: Side
  age: number
  color: string
}) {
  const fade = useSharedValue(1)
  useEffect(() => {
    fade.value = withTiming(legOpacity(age), { duration: 300 })
  }, [age])
  const style = useAnimatedStyle(() => ({ opacity: fade.value }))

  const gap = leg.radius + BEAM_END_CLEARANCE
  const prints = printsOf(leg.from, leg.to, gap, gap, firstSide)
  const span = leg.burning ? SLIDE_MS : LAND_MS

  return (
    <Animated.View
      pointerEvents="none"
      style={[{ position: 'absolute', left: 0, top: 0, right: 0, bottom: 0 }, style]}
    >
      {prints.map((print, index) => (
        <FootPrint
          key={index}
          print={print}
          burning={leg.burning}
          span={span}
          color={color}
        />
      ))}
      {leg.burning && <SlideHead leg={leg} />}
    </Animated.View>
  )
}

export function FootprintTrail({ legs }: { legs: readonly Leg[] }) {
  const { ink } = useScheme().inks
  return (
    <View pointerEvents="none" className="absolute inset-0 overflow-visible">
      {legs.map((leg, index) => (
        <FootprintLeg
          key={leg.id}
          leg={leg}
          // Legs alternate the foot they start on, so a route reads as one walk rather than a stamp.
          firstSide={index % 2 === 0 ? 1 : -1}
          age={legs.length - 1 - index}
          color={ink}
        />
      ))}
    </View>
  )
}
