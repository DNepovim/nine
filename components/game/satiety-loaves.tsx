import { useLingui } from '@lingui/react/macro'
import { useEffect } from 'react'
import { View } from 'react-native'
import Animated, {
  Easing,
  interpolate,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
  type SharedValue,
} from 'react-native-reanimated'
import Svg, { Path } from 'react-native-svg'

import { WALK_MS } from '@/constants/arcade'
import { SATIETY_INK, SURFACE } from '@/constants/colors'
import { SATIETY_DIRE, SATIETY_LOW } from '@/machines/satiety'

// How fed the hero is, as five loaves of bread: the one reading an arcade run has where a
// scored run keeps its score.
//
// Handed a fraction and a boolean rather than the run, so it knows nothing about bites,
// villages or hearts — see machines/satiety.ts for all three.
//
// It was a bar, and the loaves are the whole of what changed its mind. A bar needed the word
// SATIETY written over it, because a draining rule could be a clock, a charge or a score —
// and this screen already says "time running out" twice in that language, in the red
// creeping up the way behind and in every village's ring. Loaves need no word. They also say
// the thing a bar hid: a leg costs a tenth of the belly at par and a fifth at worst, so five
// loaves are **half a loaf a walk** when the dialling is clean and a whole one when it is
// not. The player counts walks instead of reading a percentage.
//
// Which makes the two colour bands countable too, and that is the happy part of the
// arithmetic rather than a coincidence: `SATIETY_LOW` is one loaf left and `SATIETY_DIRE` is
// half of one.

// How many there are. Five because a bite is a tenth or a fifth, so five loaves land a par
// leg on exactly half of one and a wasted leg on exactly one — any other count makes the
// commonest thing that happens to this row a fraction nobody can read.
const LOAVES = 5

// The box one loaf is drawn in, and the gap between two. Wider than tall because a loaf is:
// the row reads as bread on a board rather than as a row of buttons.
//
// Smaller than the hearts opposite, which are 22. This row holds two counts and they are not
// equal — the hearts are what there is to lose and the loaves are how long until losing
// starts, so the loaves give way. Five of them also stay narrower than the pause button
// above, which is what the column was sized to.
const BOX_W = 16
const BOX_H = 11
const GAP = 3

// The loaf itself: a scored country boule, settled on the board and domed over, which is
// the one bread shape that is unmistakable at sixteen points. The icon fonts offer a
// sandwich slice, a baguette and a croissant; the first is American, the second is a
// diagonal stick at this size and the third is pastry. None of the three reads as *stores*,
// which is what five of these are.
//
// Drawn rather than taken from an icon font, like every other mark this mode puts on the
// screen: see `AmbushMark` and `TownMark`, whose geometry is named the same way for the same
// reason, which is that a shape with its numbers spelled out can be nudged by someone who
// was not there when it was drawn.
// Nothing here is flat and nothing meets at a corner, and both of those are the drawing
// rather than fussiness: the first attempt had straight sides on a flat base, which on a
// screen that also draws ramparts and towers read as an archway. A loaf is widest at its
// waist, domes over the top, and settles onto the board — so every one of the four corners
// is a curve, and the bottom is the gentlest of them.
const CRUST =
  'M0.6 7.4 C0.6 4.3 3.85 2.8 8 2.8 ' +
  'C12.15 2.8 15.4 4.3 15.4 7.4 ' +
  'C15.4 9.3 12.48 10 8 10 ' +
  'C3.52 10 0.6 9.3 0.6 7.4 Z'

// The baker's three cuts across the crust. Parallel, evenly spaced along the loaf, and the
// middle one set a touch higher because the crust stands highest there — which is the whole
// of what makes a dome read as a dome rather than as a hill.
const SCORES = [
  'M4.86 7.6 L6.32 5.4',
  'M7.27 7.9 L8.73 5.5',
  'M9.68 7.6 L11.14 5.4',
] as const

// How thick a cut is drawn, and in what. The surface's own colour rather than a darker ink:
// a score in a loaf is a gap in the crust, and drawn as a dark line it would read as icing.
// Thin — at a point and a half the three of them read as racing stripes.
const SCORE_WIDTH = 0.9

// Every layer of a loaf sits exactly on the one under it.
const LAYER = { position: 'absolute', top: 0, left: 0, height: BOX_H } as const

// What an eaten loaf leaves: the same hollow an empty heart leaves, so the row's two counts
// are spent in one visual language. The hearts' own value, which arcade-game.tsx hands them
// as well — named here because two copies of a hex is how the row would drift.
export const EMPTY_LOAF = '#FDFCFA'

// How long the row takes to reach a new reading. The hero's own walk, so the loaves are
// eaten as the leg is travelled rather than snapping the instant the key is pressed — the
// cost reads as the journey rather than as the press.
//
// The same figure serves a feast. A village fills the row over about as long as the walls
// take to come down, and one duration for both is what keeps this a single moving thing
// rather than two animations wearing the same shape.
const FILL_MS = WALK_MS

// The pulse an empty row carries: how far down it dips, and how long one breath takes. Slow
// enough to read as breathing rather than as flashing — a board with no bread on it is
// already the loudest thing in the bar, and a fast blink on top is alarm on alarm.
//
// Nought and nothing else. Red arrives a loaf early; a pulse arriving with it would spend
// the loudest mark the row has on a run that is not yet in trouble.
const PULSE_TO = 0.35
const PULSE_MS = 620

// And how long the empty board takes to redden when the hearts start going, and to cool
// again when the hero eats.
const STARVE_MS = 240

// How much of one loaf a colour change is spread over.
//
// The bands are read off what is actually *drawn* rather than off the reading the row is
// heading for, which is what keeps one bite one movement: the loaves are eaten over
// `FILL_MS`, and the colour turns as the band is crossed rather than when the key was
// pressed. A village taken is the case that makes it obvious — the row refills from half a
// red loaf, and a colour driven off the prop would have gone brown while the board was
// still bare.
//
// So a hard step would be a hard cut, which nothing in this app does. A fiftieth of the
// belly either side of each band — a quarter of a loaf — reads as a turn rather than a snap,
// and it settles a knife edge too: a row at exactly one loaf is already on its way to
// orange, which matters because the bites are tenths and floating point does not land on a
// fifth exactly.
const BLEND = 0.02

// One loaf, in one ink. Module level like everything else drawn here, and a component rather
// than a function returning paths because it is rendered five times over four layers.
function Loaf({ ink, scored }: { ink: string; scored: boolean }) {
  return (
    <Svg width={BOX_W} height={BOX_H}>
      <Path d={CRUST} fill={ink} />
      {/* The cuts, and only on a loaf still standing: an eaten one is a hollow, and detail
          inside a hollow would read as a loaf after all. */}
      {scored &&
        SCORES.map((d) => (
          <Path
            key={d}
            d={d}
            fill="none"
            stroke={SURFACE}
            strokeWidth={SCORE_WIDTH}
            strokeLinecap="round"
          />
        ))}
    </Svg>
  )
}

// One place on the board: the loaf that stood there, and however much of it is left.
//
// `Place` rather than `Loaf`, which is the drawing above — a place keeps its outline once
// the loaf on it has been eaten, and that outline is half of what the row says.
//
// Module level, like every animated sub-component in this app: declared inside the row it
// would remount on each render and lose the eating mid-bite.
//
// The bands are a stack of layers rather than one shape with an interpolated colour, and
// that is the drawing's doing rather than a preference. A fill is an SVG *prop* and not a
// style a worklet can reach — the same reason `HeartIcon` draws its heart twice. So each
// band is drawn in its own fixed ink and the ones above fade off it: with the row full the
// brown covers both, at one loaf the brown is gone and the orange shows, and under half a
// loaf the red underneath is all that is left.
function Place({
  index,
  fill,
  starved,
  slot,
}: {
  index: number
  // How fed the hero is, animated — the whole row's, not this loaf's. Each one works out its
  // own share: loaf `i` is whole while the belly is past `(i + 1)` fifths of full, and is
  // eaten through that fifth on the way down.
  fill: SharedValue<number>
  // Nought to one as the hearts start going, for the bare board to redden by.
  starved: SharedValue<number>
  // What an eaten loaf leaves behind.
  slot: string
}) {
  // What is left of this loaf, nought to one. Eaten from the right, so the loaves go in the
  // order the hearts do — the rightmost first, the leftmost last.
  const eaten = useAnimatedStyle(() => ({
    width: `${Math.min(1, Math.max(0, fill.value * LOAVES - index)) * 100}%`,
  }))

  // The two inks that fade off the red beneath them, each over its own band.
  const fed = useAnimatedStyle(() => ({
    opacity: interpolate(
      fill.value,
      [SATIETY_LOW - BLEND, SATIETY_LOW + BLEND],
      [0, 1],
      'clamp',
    ),
  }))
  const low = useAnimatedStyle(() => ({
    opacity: interpolate(
      fill.value,
      [SATIETY_DIRE - BLEND, SATIETY_DIRE + BLEND],
      [0, 1],
      'clamp',
    ),
  }))
  const dire = useAnimatedStyle(() => ({ opacity: starved.value }))

  return (
    <View style={{ width: BOX_W, height: BOX_H }}>
      {/* The place on the board, in the colour of nothing, which is what an eaten loaf
          leaves behind. It reddens while the hearts are going, because by then it is the
          only part of this row still drawn. */}
      <Loaf ink={slot} scored={false} />
      <Animated.View style={[LAYER, dire]}>
        <Loaf ink={SATIETY_INK.spent} scored={false} />
      </Animated.View>
      {/* And what is left of the loaf, clipped to the bite. The inner view holds the drawing
          at its own width so the clip cuts it rather than squeezing it. */}
      <Animated.View style={[LAYER, { overflow: 'hidden' }, eaten]}>
        <View style={{ width: BOX_W, height: BOX_H }}>
          <Loaf ink={SATIETY_INK.spent} scored />
          <Animated.View style={[LAYER, low]}>
            <Loaf ink={SATIETY_INK.low} scored />
          </Animated.View>
          <Animated.View style={[LAYER, fed]}>
            <Loaf ink={SATIETY_INK.fed} scored />
          </Animated.View>
        </View>
      </Animated.View>
    </View>
  )
}

export function SatietyLoaves({
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
  const starved = useSharedValue(starving ? 1 : 0)
  const pulse = useSharedValue(1)

  useEffect(() => {
    fill.value = withTiming(satiety, {
      duration: FILL_MS,
      easing: Easing.out(Easing.quad),
    })
  }, [satiety, fill])

  useEffect(() => {
    starved.value = withTiming(starving ? 1 : 0, { duration: STARVE_MS })
  }, [starving, starved])

  // The pulse runs only while there is something to be alarmed about, and is put back to
  // full rather than left wherever the repeat happened to stop — a row fed back up while
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

  const breathing = useAnimatedStyle(() => ({ opacity: pulse.value }))
  const { t } = useLingui()

  return (
    // Named rather than captioned. Five loaves say food without a word — which is the whole
    // reason they are loaves — but a reading drawn and not written is a reading somebody
    // cannot get at, so the row carries the name the caption used to.
    <Animated.View
      accessibilityRole="progressbar"
      accessibilityLabel={t`Satiety`}
      accessibilityValue={{ min: 0, max: LOAVES, now: Math.round(satiety * LOAVES) }}
      className="flex-row items-end"
      style={[{ gap: GAP }, breathing]}
    >
      {Array.from({ length: LOAVES }, (_, i) => (
        <Place key={i} index={i} fill={fill} starved={starved} slot={EMPTY_LOAF} />
      ))}
    </Animated.View>
  )
}
