import { useEffect } from 'react'
import Animated, {
  Easing,
  FadeOut,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withTiming,
  type SharedValue,
} from 'react-native-reanimated'
import Svg, { G, Path } from 'react-native-svg'

import { drawFeature } from '@/lib/map-marks'
import type { LandFeature } from '@/machines/arcade-land'

// One feature of the land, drawn and inked.
//
// Each mark is filled with the surface colour before it is stroked, in the order the
// generator put them in — back to front — which is what makes a range of mountains read as
// a range rather than as a thicket of outlines. The fill is the same colour as the ground, so
// it is invisible except where it covers something.
//
// One `<Svg>` per feature rather than one for the whole canvas: a feature can then fade in
// on its own, be moved by the camera with everything else, and leave when the hero has
// walked far enough that nobody is looking at it.
//
// And stand up on its own. The country is the one thing drawn on the sheet that does not turn
// with it: a mark drawn in profile has an up — a mountain on its side is not a mountain, and
// a fir hanging off the top of the sheet is a mistake rather than a tree — so the sheet's turn
// is taken straight back out again. A town keeps turning, because a town is drawn in plan and
// has no up to lose.
//
// Taken out about the feature's foot, which is the ground its elements stand on: the whole
// patch of country holds the place it was put, and turns rigidly about it, so a range still
// runs where the generator ran it and still clears the ways it was told to clear.

const IN_MS = 420
const SETTLE = 0.95

// How far apart the marks of a stretch of country arrive, and how many steps the stagger
// has. Taken from the feature's own key rather than from its place in the list: the list is
// reordered as the window moves, and a delay that moved with it would re-animate a feature
// that has been standing there for three crossroads.
const STEPS = 9
const STEP_MS = 45

function scatter(key: string): number {
  let hash = 2166136261
  for (let i = 0; i < key.length; i++) {
    hash = ((hash ^ key.charCodeAt(i)) * 16777619) >>> 0
  }
  return (hash % STEPS) * STEP_MS
}

export function LandMark({
  feature,
  pitch,
  turn,
  line,
  hatch,
  knockout,
}: {
  feature: LandFeature
  pitch: number
  // How far the sheet has been turned, as it is turning. Taken back out of this feature, so
  // what it moves is where the country *is* and never which way up it is drawn.
  turn: SharedValue<number>
  line: string
  hatch: string
  // The ground's own colour. What every mark fills itself with before it is inked.
  knockout: string
}) {
  const drawn = drawFeature(feature, pitch)
  const delay = scatter(feature.key)
  const opacity = useSharedValue(0)
  const scale = useSharedValue(SETTLE)

  useEffect(() => {
    opacity.value = withDelay(delay, withTiming(1, { duration: IN_MS }))
    scale.value = withDelay(
      delay,
      withTiming(1, { duration: IN_MS, easing: Easing.out(Easing.cubic) }),
    )
  }, [delay])

  // The foot, as a view's transform has to have it: as far off the centre as it is, because
  // that centre is the only point React Native will turn a view about. Bringing the foot
  // there, turning, and putting it back is a turn about the foot — the same two-step the
  // sheet itself is built out of.
  const offX = drawn.foot.x - drawn.width / 2
  const offY = drawn.foot.y - drawn.height / 2

  // One style for the arrival and the turn together, rather than a view each: the scale is
  // innermost, so it is still about the box's own centre, and the turn is wrapped round it.
  const style = useAnimatedStyle(() => ({
    opacity: opacity.value,
    transform: [
      { translateX: offX },
      { translateY: offY },
      { rotate: `${-turn.value}rad` },
      { translateX: -offX },
      { translateY: -offY },
      { scale: scale.value },
    ],
  }))

  return (
    <Animated.View
      pointerEvents="none"
      // The exit is a layout animation, because nothing else can delay an unmount — and a
      // patch of country blinking out of existence reads as a bug rather than as distance.
      exiting={FadeOut.duration(300)}
      style={[
        {
          position: 'absolute',
          left: drawn.left,
          top: drawn.top,
          width: drawn.width,
          height: drawn.height,
        },
        style,
      ]}
    >
      <Svg width={drawn.width} height={drawn.height}>
        {/* A mark's own hachures go on immediately after its body, not after every body on
            the feature: a peak in front has to cover the shading of the one behind it, and
            drawing all the bodies and then all the shading puts the far peak's hachures back
            on top of the near peak's face. */}
        {drawn.marks.map((mark, i) => (
          // The index is the identity: a mark is the i-th shape of a feature that never
          // changes shape, so there is nothing else for it to be keyed on.
          <G key={i}>
            <Path
              d={mark.body}
              fill={knockout}
              stroke={line}
              strokeWidth={1.05}
              strokeLinejoin="round"
              strokeLinecap="round"
            />
            <Path
              d={mark.detail}
              fill="none"
              stroke={hatch}
              strokeWidth={0.75}
              strokeLinecap="round"
            />
          </G>
        ))}
      </Svg>
    </Animated.View>
  )
}
