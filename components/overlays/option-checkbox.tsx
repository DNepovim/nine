import { useEffect } from 'react'
import { View } from 'react-native'
import Animated, {
  Easing,
  useAnimatedProps,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated'
import Svg, { Path } from 'react-native-svg'

const BOX = 28
const TICK_COLOR = '#D8D2F4'

// The tick, drawn rather than placed: one stroke down into the corner and back up.
//
// Its coordinates are the pixels it is rendered at — no viewBox, so nothing is scaled
// between here and the screen. Through a 24-unit box mapped onto 17px, a 3-wide stroke
// arrived as a 2px hairline; at this size the number in the source is the width on the
// glass, and it matches the weight of the icon this replaced.
const TICK_BOX = 18
const TICK_PATH = 'M3.5 9.5 L7.5 13.5 L14.5 4.5'
const TICK_WIDTH = 2.6

// The stroke's own length, which is what the dash is measured in: √(4²+4²) down, then
// √(7²+9²) up, giving 17.06. Rounded up — a dash longer than the line it hides is
// invisible, one short of it leaves a stub showing before the draw begins.
const TICK_LENGTH = 18

// Checking draws the mark on; unchecking pulls it back off the way it came, faster,
// because undoing is not the moment worth dwelling on.
const DRAW_MS = 260
const ERASE_MS = 140

// The fill arrives ahead of the stroke, so the mark is drawn onto a filled box rather
// than racing it, and starts a little under size so it blooms out of the middle.
const FILL_LEAD = 2.5
const FILL_FROM = 0.7

const AnimatedPath = Animated.createAnimatedComponent(Path)

export function OptionCheckbox({ checked }: { checked: boolean }) {
  const progress = useSharedValue(checked ? 1 : 0)

  useEffect(() => {
    progress.value = checked
      ? withTiming(1, { duration: DRAW_MS, easing: Easing.out(Easing.cubic) })
      : withTiming(0, { duration: ERASE_MS, easing: Easing.in(Easing.quad) })
  }, [checked, progress])

  const fillStyle = useAnimatedStyle(() => ({
    opacity: Math.min(1, progress.value * FILL_LEAD),
    transform: [{ scale: FILL_FROM + (1 - FILL_FROM) * progress.value }],
  }))

  // The whole stroke is one dash as long as the line itself, so the offset alone
  // decides how much of it has been drawn: a full length hidden at 0, none at 1.
  const tickProps = useAnimatedProps(() => ({
    strokeDashoffset: TICK_LENGTH * (1 - progress.value),
  }))

  return (
    <View
      className="items-center justify-center rounded-lg bg-card"
      style={{ width: BOX, height: BOX }}
    >
      <Animated.View
        className="absolute inset-0 rounded-lg bg-strong"
        style={fillStyle}
      />
      {/* Over the fill, not under it: the fill is absolutely positioned, and on the web
          a positioned box paints above a static sibling whatever the source order says. */}
      <Svg width={TICK_BOX} height={TICK_BOX} style={{ position: 'absolute' }}>
        <AnimatedPath
          d={TICK_PATH}
          stroke={TICK_COLOR}
          strokeWidth={TICK_WIDTH}
          strokeLinecap="round"
          strokeLinejoin="round"
          fill="none"
          strokeDasharray={TICK_LENGTH}
          animatedProps={tickProps}
        />
      </Svg>
    </View>
  )
}
