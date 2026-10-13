import { LinearGradient } from 'expo-linear-gradient'
import { useEffect, useState, type ReactNode } from 'react'
import { Text, View } from 'react-native'
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated'

import { SPECTRUM } from '@/constants/colors'
import { TYPE } from '@/constants/typography'
import { cn } from '@/lib/cn'

// The edge's own measurements, as the challenge card wants them — the one caller so far.
// Thin, because the thing framed is a two-line row rather than a card of its own, and a
// rule any heavier reads as a box drawn around a box. The radius is `rounded-2xl`, which
// is what the card wore before it had an edge, so the shape has not changed.
const EDGE = 2
const RADIUS = 16

// What is set into the top edge, and where: the legend at the left of the rule, a badge at
// the right, each in from its corner by enough that the curve is finished before the gap
// starts, and each with a breath of white either side so the edge is plainly interrupted
// rather than crowded.
// The corner's own radius, which is the smallest gap that leaves the curve whole: a chip
// set in any closer would cut across the arc, and a corner clipped mid-turn reads as a
// drawing error rather than as an interruption.
const CHIP_X = RADIUS
const CHIP_PAD = 6

// The band that paints the edge: the game scale, laid end to end and swept sideways.
//
// The four game stops rather than the framed thing's own colour — see the `design-guide`
// skill. A challenge is a mode the app has never shown before and will not show again
// after today, so the frame is the app speaking rather than the mode: it says *there is
// something here*, which is a different job from the mode's own accent on the title
// inside it. Those two wanting different colours is the point.
//
// Repeated, with the first colour closing the sequence, so the band is periodic over half
// its width: colour at x and at x + width/2 are the same, which is what lets one linear
// translation loop with no seam to hide.
const BAND: readonly [string, string, ...string[]] = [
  ...SPECTRUM,
  ...SPECTRUM,
  SPECTRUM[0],
]

// How long the band takes to travel one period. Slow on purpose: the NINE letters above
// it cycle their own gradient every two seconds, and an edge drifting at that rate would
// read as a second thing happening rather than as one thing being alive.
const SWEEP_MS = 8000

// One thing standing in the top rule, with the rule broken behind it.
//
// Its ground is two colours and not one, which is the whole of this component. A chip
// centred on the rule has half of itself outside the box and half inside, and those two
// halves stand on different things: the app's surface above, the box's own white below.
// Painted all white it was a white tab stuck on the parchment; painted in halves it is
// not a tab at all — it is the rule simply stopping, with whatever was already on each
// side of the line carrying on through the gap.
//
// Which means this assumes the box stands on the app's surface. Everything with a
// `GradientFrame` around it does, and a frame on some other ground would want the colour
// passed in rather than assumed.
//
// Lifted by half of its own measured height, which is the only way two chips of different
// heights sit on one line — a constant would centre the word and leave the board low, or
// the other way about. Rounded, so the seam between the two halves lands on a whole pixel
// and does not show as a hairline. Hidden until it has been measured, since the frame
// before that is the one frame it would be in the wrong place.
//
// `pointerEvents` is off: a card that is one big button should not have the things
// standing on its rule taking presses out of it.
function RuleChip({
  side,
  height,
  onHeight,
  children,
}: {
  side: 'left' | 'right'
  height: number
  onHeight: (height: number) => void
  children: ReactNode
}) {
  const lift = Math.round(height / 2)
  return (
    <View
      pointerEvents="none"
      className="absolute"
      style={{
        top: -lift,
        [side]: CHIP_X,
        paddingHorizontal: CHIP_PAD,
        opacity: height === 0 ? 0 : 1,
      }}
      onLayout={(e) => {
        onHeight(e.nativeEvent.layout.height)
      }}
    >
      <View
        className="absolute left-0 right-0 top-0 bg-surface"
        style={{ height: lift }}
      />
      <View
        className="absolute bottom-0 left-0 right-0 bg-elevated"
        style={{ top: lift }}
      />
      {children}
    </View>
  )
}

// A white box inside a moving gradient edge.
//
// The gradient is painted rather than stroked — React Native has no gradient border — so
// this is two boxes: the band fills the outer one, clipped to its corners, and the white
// inner box sits on top inset by `EDGE`, leaving the band showing as a rule around it.
//
// The motion is a transform rather than a change of colours. `expo-linear-gradient` takes
// its colours and locations as plain props, so animating those means a React render per
// frame — the splash screen does bridge them that way for its two locations, and says so.
// Here the band is twice as wide as the box and slides by half itself, which is the same
// picture arrived at on the UI thread for nothing.
//
// Lays out nothing of its own: the padding inside the white box is the caller's, through
// `inner`, because the caller is what knows how close its own words may come to an edge.
export function GradientFrame({
  children,
  inner = '',
  legend,
  badge,
}: {
  children: ReactNode
  // Classes for the white box — the padding, and anything else about the ground the
  // content stands on. Never the shape: the two radii are this component's, and they
  // have to agree or the corners separate.
  inner?: string
  // A word set into the top edge, interrupting it: what the box is, said on the box
  // rather than above it. The caller's node, because it is a translated string. Centred,
  // which is where a legend goes when the box has only one thing to be called.
  //
  // Costs the content nothing. It rides the rule rather than standing inside the box, so
  // a caller keeps whatever padding it would have had without one.
  legend?: ReactNode
  // The same, at the right-hand end of the rule: the one figure about the box that is
  // worth reading before its contents. Anything, rather than a string — the challenge
  // card sets its countdown here.
  badge?: ReactNode
}) {
  // Measured rather than given in percentages: a translate in percent is newer than the
  // oldest platform this ships to, and the width is wanted for the band anyway.
  const [width, setWidth] = useState(0)

  // How tall each thing standing in the rule is, so each can be lifted by half of itself.
  // Two numbers rather than one: the word and the board are different heights, and what
  // they share is the line through their middles rather than an edge.
  const [legendHeight, setLegendHeight] = useState(0)
  const [badgeHeight, setBadgeHeight] = useState(0)
  const overhang = Math.max(legendHeight, badgeHeight) / 2

  const sweep = useSharedValue(0)
  useEffect(() => {
    sweep.value = withRepeat(
      withTiming(1, { duration: SWEEP_MS, easing: Easing.linear }),
      -1,
      false,
    )
  }, [sweep])

  // One period of the band, which is exactly the box's own width — so the edge at the end
  // of a cycle is the edge at the start of it and the loop cannot be seen.
  const bandStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: -sweep.value * width }],
  }))

  return (
    // Two boxes and not one: the clip the band needs lives on the inner one, so what sits
    // in the rule over it is never cut by the same `overflow: hidden` that keeps the
    // gradient inside the corners.
    //
    // The root is pushed down by whatever hangs above it. Nothing here would clip that
    // overhang, but the thing this stands in might — the intro's paging panels clip to
    // their own bounds so the two tabs can slide past each other, and a chip lifted out
    // of the first row came back cropped along its cap line. A margin is the fix that
    // does not need the parent's help: the box gives up the room, and the halves standing
    // above its rule are inside the parent either way.
    <View className="w-full" style={{ marginTop: overhang }}>
      <View
        className="w-full overflow-hidden"
        style={{ borderRadius: RADIUS, padding: EDGE }}
        onLayout={(e) => {
          setWidth(e.nativeEvent.layout.width)
        }}
      >
        {width > 0 && (
          <Animated.View
            pointerEvents="none"
            style={[
              { position: 'absolute', top: 0, bottom: 0, left: 0, width: width * 2 },
              bandStyle,
            ]}
          >
            <LinearGradient
              colors={BAND}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={{ flex: 1 }}
            />
          </Animated.View>
        )}

        {/* `elevated` and not a literal white: it is the whitest surface the theme has
          (#fdfcfa), and against the warm surface the intro is drawn on it reads as white
          without being the one colour in the app that came from outside the tokens. It is
          also a step away from the `bg-card` the mode pills under it wear, which is what
          stops the announcement reading as one more row of the same list. */}
        <View
          className={cn('w-full bg-elevated', inner)}
          style={{ borderRadius: RADIUS - EDGE }}
        >
          {children}
        </View>
      </View>

      {/* Both of these are last, so they are over the band and the white box alike: what
        breaks the rule under them is their own ground, and a ground can only do that from
        on top. */}
      {legend !== undefined && (
        <RuleChip side="left" height={legendHeight} onHeight={setLegendHeight}>
          <Text selectable={false} className={cn(TYPE.sectionLabel, 'text-dim')}>
            {legend}
          </Text>
        </RuleChip>
      )}

      {badge !== undefined && (
        <RuleChip side="right" height={badgeHeight} onHeight={setBadgeHeight}>
          {badge}
        </RuleChip>
      )}
    </View>
  )
}
