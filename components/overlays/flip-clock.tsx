import { LinearGradient } from 'expo-linear-gradient'
import { useEffect, useRef, useState } from 'react'
import { StyleSheet, Text, View } from 'react-native'
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withSequence,
  withTiming,
} from 'react-native-reanimated'
import { scheduleOnRN } from 'react-native-worklets'

import { TYPE } from '@/constants/typography'
import { cn } from '@/lib/cn'
import { mixHex } from '@/lib/mix-hex'

// The flap itself: a card with a seam across its waist, which is the whole of what makes a
// split-flap board look like one.
const TILE_RADIUS = 2
const TILE_PAD_X = 2
const TILE_PAD_Y = 0
const TILE_GAP = 1.5

// The seam, in white at the strength a shadow line reads at on that near-black: visible as
// the line two flaps meet along, and nowhere near a rule the eye reads as a border.
const SEAM = 'rgba(255, 255, 255, 0.14)'

// Half a flip, twice: the standing flap falls away, and the next one comes up in its
// place. Fast, because this is a second hand — a flap that took a quarter of a second
// would still be moving when the next second arrived.
const HALF_MS = 90

// How far the card is from the eye. Small enough that the fall is foreshortened — without
// a perspective the rotation is a card squashing flat rather than one tipping over.
const PERSPECTIVE = 320

// One digit, flipped when it changes.
//
// A whole card turning rather than the four layers a real split flap has — two halves, one
// hinged, one static behind it. At this size the hinge is a hairline: what reads is the
// fall and the seam, and the halves would be three more views per digit for a detail
// nobody can see on a tile this small.
//
// The swap happens at the moment the card is edge-on, where there is nothing to see: the
// old digit falls from flat to ninety degrees, the state changes behind the edge, and the
// new one rises from ninety back to flat.
function FlipDigit({
  char,
  from,
  to,
  role,
}: {
  char: string
  from: string
  to: string
  role: string
}) {
  const [shown, setShown] = useState(char)
  const flip = useSharedValue(0)
  // What this digit was last asked to show, which is the one thing that may arm a flip.
  // A ref rather than a comparison against `shown`, which changes in the middle of the
  // very animation it would be read by — the same shape `HitSync` uses to tell a new hit
  // from the sequence it inherited.
  const asked = useRef(char)

  useEffect(() => {
    if (asked.current === char) return
    asked.current = char
    flip.value = withSequence(
      withTiming(1, { duration: HALF_MS, easing: Easing.in(Easing.quad) }, (done) => {
        'worklet'
        if (done) scheduleOnRN(setShown, char)
      }),
      withTiming(2, { duration: HALF_MS, easing: Easing.out(Easing.quad) }),
    )
  }, [char, flip])

  const style = useAnimatedStyle(() => {
    // 0 → 1 is the old card falling away, 1 → 2 the new one coming up. Both halves are
    // the same quarter turn, and the digit under them has been swapped at the crossing.
    const angle = flip.value <= 1 ? -90 * flip.value : 90 * (2 - flip.value)
    return {
      transform: [{ perspective: PERSPECTIVE }, { rotateX: `${angle}deg` }],
    }
  })

  return (
    <Animated.View style={[{ borderRadius: TILE_RADIUS, overflow: 'hidden' }, style]}>
      {/* The card's own face, painted rather than classed, and painted the way the app's
        primary buttons are: the CTA pair, read left to right. The two stops handed in are
        this flap's slice of that sweep rather than the whole of it — see `sliceOf` — so
        the board carries one gradient across all of its cards instead of each repeating
        the same one. A stop-to-stop ramp inside a tile this small is a flat colour. */}
      <LinearGradient
        colors={[from, to]}
        start={{ x: 0, y: 0.5 }}
        end={{ x: 1, y: 0.5 }}
        style={StyleSheet.absoluteFill}
      />
      {/* The digits in the screen's own colour rather than the ink the CTA scale usually
        carries: on a flap the numeral reads as cut out of the card, and the parchment the
        whole app is drawn on is what should be showing through it. It is also the plainer
        of the two — `on-strong` carries a violet cast that belonged to the one button it
        was cut for — and about 12:1 on this gradient's darkest end. */}
      <Text
        selectable={false}
        className={cn(role, 'text-surface')}
        style={{ paddingHorizontal: TILE_PAD_X, paddingVertical: TILE_PAD_Y }}
      >
        {shown}
      </Text>
      {/* The waist, drawn over the digit: on a real board the digit is cut in half by the
        gap between the two flaps, and a seam that stopped short of the numeral would read
        as a scratch on the card instead. */}
      <View
        pointerEvents="none"
        className="absolute left-0 right-0"
        style={{ top: '50%', height: 1, backgroundColor: SEAM }}
      />
    </Animated.View>
  )
}

// A figure as a row of flaps: every digit on a card of its own, and the colon between the
// two orders left standing between them as plain type.
//
// Row-sized rather than headline-sized, because the one caller sets this into the rule
// around its card: a board standing in a 2px line has to be short enough that what hangs
// below the line is a chip rather than a second row of content.
//
// That split is what the board does: a split-flap unit carries digits and the fixed marks
// are painted on the housing. It is also what keeps the row still, since the marks are the
// one part of the figure that never changes.

// The pair of stops one flap shows, given where it stands in the row: the slice of the
// whole sweep between its left edge and its right. The colon between the two orders is
// counted as a position of its own, so the two halves of the figure are not pulled
// together where it sits — the band runs the width of the board, not the width of the
// digits in it.
const sliceOf = (
  gradient: readonly [string, string],
  index: number,
  total: number,
): readonly [string, string] => [
  mixHex(gradient[0], gradient[1], index / total),
  mixHex(gradient[0], gradient[1], (index + 1) / total),
]

export function FlipClock({
  text,
  gradient,
  large = false,
  className,
}: {
  text: string
  // What the flaps are painted with, resolved by the caller: the challenge card hands over
  // its own mode's CTA pair — the gradient that mode's PLAY GAME button is cut from — so
  // the board belongs to the challenge it is counting down and reads as the same material
  // as the button under it.
  gradient: readonly [string, string]
  // The board as the thing a dialog is about rather than a cell in a rule: the challenge
  // dialog's countdown to a session that has not opened yet, where the wait is the only
  // news there is. Set in `figureLarge` — an existing role, not a size picked here.
  large?: boolean
  // Placement only, as everywhere else: the size is the role below.
  className?: string
}) {
  const cells = Array.from(text).length
  const role = large ? TYPE.figureLarge : TYPE.figure

  return (
    <View className={cn('flex-row items-center', className)} style={{ gap: TILE_GAP }}>
      {/* `Array.from` and not a spread or a split: the marks are single code points, but
        this is how every other string in the app is stepped — see lib/motto.ts. */}
      {Array.from(text).map((char, i) => {
        if (!/\d/.test(char)) {
          return (
            <Text
              key={i}
              selectable={false}
              className={cn(role, 'text-dim')}
              style={{ marginHorizontal: 1 }}
            >
              {char}
            </Text>
          )
        }
        const [from, to] = sliceOf(gradient, i, cells)
        return <FlipDigit key={i} char={char} from={from} to={to} role={role} />
      })}
    </View>
  )
}
