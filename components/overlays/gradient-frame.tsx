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

import { RuleChip } from './rule-chip'
import { TurningEdge } from './turning-edge'

// The edge's own measurements, as the challenge card wants them — the one caller so far.
// Thin, because the thing framed is a two-line row rather than a card of its own, and a
// rule any heavier reads as a box drawn around a box. The radius is `rounded-2xl`, which
// is what the card wore before it had an edge, so the shape has not changed.
const EDGE = 2
const RADIUS = 16

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

// The lift. Lighter than the pills' in `board-badges.tsx` — opacity 0.2 at a 6pt radius —
// and deliberately so: that shadow is carried by a shape about as wide as a word, where
// this one is a card the width of the screen. The same settings under a surface this size
// read as the box having come loose from the screen rather than as sitting just above it.
//
// It cannot go on the box itself. That box is `overflow-hidden`, which is what keeps the
// gradient inside its corners, and a clipped layer casts no shadow — so this rides a
// wrapper around it, which is the same arrangement the pills use and for the same reason.
const SHADOW = {
  shadowColor: '#000',
  shadowOpacity: 0.12,
  shadowOffset: { width: 0, height: 2 },
  shadowRadius: 5,
  elevation: 2,
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
  edge,
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
  // Two stops to paint the edge in, instead of the game spectrum.
  //
  // **The challenge card is the caller that asked for this**, and the reason is that a
  // challenge now has colours of its own. The default is still the four game stops, which
  // is the app speaking rather than any one mode — see the note on `BAND`. A challenge
  // wants the opposite: the edge is the loudest thing the card has, and the near-black and
  // the hue it is paired with are what tell one challenge from another.
  //
  // It also sweeps differently, and it has to. The spectrum band slides, which only loops
  // because the band is periodic — `[...SPECTRUM, ...SPECTRUM, SPECTRUM[0]]`. Making a
  // two-stop pair periodic means repeating it as `[a, b, a, b, a]`, and the edge then
  // reads as three stops rather than two: a bright middle with the dark stop at both ends.
  // So a two-stop edge turns instead, which keeps it the one clean sweep from a to b that
  // it is, and moves for the same reason the band does.
  edge?: readonly [string, string]
}) {
  // Measured rather than given in percentages: a translate in percent is newer than the
  // oldest platform this ships to, and the width is wanted for the band anyway.
  const [width, setWidth] = useState(0)

  // How tall each thing standing in the rule is, so each can be lifted by half of itself.
  // Two numbers rather than one: the word and the board are different heights, and what
  // they share is the line through their middles rather than an edge.
  // The box's own height, wanted only by a rotating edge: a square turned inside a
  // rectangle has to be as wide as the rectangle's diagonal or its corners swing clear of
  // the shape they are meant to be filling.
  const [height, setHeight] = useState(0)

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
      {/* The shadow's own view, between the root and the clipped box.
        
        Not the root, which the chips standing in the rule are also children of — a shadow
        there would be cast by a rectangle the full height of the overhang as well, with
        the chips' halves hanging outside the shape casting it. And not the box, which is
        clipped and so casts nothing.

        Its background has to be opaque for iOS to have a shape to draw from, and the box
        on top of it covers it completely — so the colour is only ever the one the edge
        itself opens on, and none of it is ever seen. */}
      <View
        style={{
          ...SHADOW,
          borderRadius: RADIUS,
          backgroundColor: edge === undefined ? SPECTRUM[0] : edge[0],
        }}
      >
        {/* `isolate` and `backfaceVisibility` are not decoration — they are what makes the
          clip below actually hold.

          A rotating child is promoted to its own compositing layer by the browser, and on
          iOS Safari a promoted layer stops being clipped by an ancestor's
          `overflow: hidden` + `border-radius`. The symptom is the whole rotating square —
          as wide as this box's diagonal — appearing tilted across the screen, and it is
          intermittent because promotion happens when the compositor decides rather than
          when the code asks. Forcing this element to create a stacking context and its
          own layer puts the clip and the rotation back in the same place.

          Both are no-ops on native, where the clip was never in question. */}
        <View
          className="w-full isolate overflow-hidden"
          style={{
            borderRadius: RADIUS,
            padding: EDGE,
            backfaceVisibility: 'hidden',
          }}
          onLayout={(e) => {
            setWidth(e.nativeEvent.layout.width)
            setHeight(e.nativeEvent.layout.height)
          }}
        >
          {edge !== undefined && width > 0 && height > 0 && (
            <TurningEdge edge={edge} width={width} height={height} />
          )}

          {edge === undefined && width > 0 && (
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
      </View>

      {/* Both of these are last, so they are over the band and the white box alike: what
        breaks the rule under them is their own ground, and a ground can only do that from
        on top. */}
      {legend !== undefined && (
        <RuleChip
          side="left"
          inset={RADIUS}
          below="bg-elevated"
          height={legendHeight}
          onHeight={setLegendHeight}
        >
          <Text selectable={false} className={cn(TYPE.sectionLabel, 'text-dim')}>
            {legend}
          </Text>
        </RuleChip>
      )}

      {badge !== undefined && (
        <RuleChip
          side="right"
          inset={RADIUS}
          below="bg-elevated"
          height={badgeHeight}
          onHeight={setBadgeHeight}
        >
          {badge}
        </RuleChip>
      )}
    </View>
  )
}
