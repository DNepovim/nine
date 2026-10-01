import { useEffect } from 'react'
import Animated, {
  Easing,
  useAnimatedProps,
  useSharedValue,
  withDelay,
  withTiming,
  type SharedValue,
} from 'react-native-reanimated'
import Svg, { Defs, LinearGradient, Path, Stop } from 'react-native-svg'

import { GROW_MS, WITHER_MS } from '@/constants/arcade'
import { splinePath, type Spline } from '@/lib/arcade-layout'

const AnimatedPath = Animated.createAnimatedComponent(Path)

// One way, drawn: a cubic curve that breathes, draws itself on out of the crossroad, and
// trims back into it when the hero goes somewhere else.
//
// Both the drawing on and the trimming are one dash pattern as long as the way itself, slid
// along it: at an offset of a whole length the dash has moved off the curve and nothing
// shows, and at nought it covers all of it. Negative, so the end that appears first is the
// crossroad's — a way grows outward, and withers back the same way.
//
// `d` comes from `animatedProps` rather than from a prop, so the sway is computed on the UI
// thread. A way goes on breathing while React is busy, which it is on every press.

// How much of the way is showing, as an offset into that dash.
const dashOffset = (open: number, length: number): number => {
  'worklet'
  return -(1 - open) * length
}

const AHEAD_WIDTH = 2.4
const LIT_WIDTH = 3.6

// The soft edge a lit way carries, standing in for the tapering stroke the design asked for
// — SVG gives a path one width, so what says "this one is lit" is a wider, fainter copy of
// it underneath rather than a thicker end.
const GLOW_WIDTH = 10
const GLOW_ALPHA = '26'

export type StemState = 'growing' | 'steady' | 'withering'

export function WayStem({
  x,
  y,
  box,
  spline,
  lit,
  state,
  delay,
  clock,
  creepMs,
  fade,
  gradientId,
  aheadInk,
  amber,
  ember,
}: {
  // Where the crossroad this way leaves sits on the canvas.
  x: number
  y: number
  // The square the curve is drawn in, with that crossroad at its centre.
  box: number
  spline: Spline
  // Walked, or still only offered.
  lit: boolean
  state: StemState
  // The way's place in its fan, as a wait — so a crossroad blooms rather than appears.
  delay: number
  // The screen's frame clock, which every way's sway is read off.
  clock: SharedValue<number>
  // The clock, on the one way that carries it — the way behind the hero. Three states:
  // a number is how long the red has to creep from the far end up to the hero, `held`
  // leaves it where it got to, and null clears it. Held rather than cleared while the
  // retreat runs, because a way that turned red is the way doing the dragging; snapping
  // it back to amber mid-pull would take the reason away.
  creepMs: number | 'held' | null
  fade: number
  gradientId: string
  aheadInk: string
  amber: string
  ember: string
}) {
  const open = useSharedValue(state === 'growing' ? 0 : 1)
  const creep = useSharedValue(0)
  const half = box / 2

  useEffect(() => {
    if (state === 'growing') {
      // Back to nothing first, which matters for a way that has been here before: the way
      // the hero just failed at is still a way, and when the retreat lands it is offered
      // again — so it has to draw itself on with the rest of the fan rather than simply
      // still being there.
      open.value = 0
      open.value = withDelay(
        delay,
        withTiming(1, { duration: GROW_MS, easing: Easing.out(Easing.cubic) }),
      )
      return
    }
    if (state === 'withering') {
      open.value = withTiming(0, { duration: WITHER_MS, easing: Easing.in(Easing.quad) })
      return
    }
    open.value = withTiming(1, { duration: GROW_MS, easing: Easing.out(Easing.cubic) })
  }, [state, delay])

  // The clock, cooling the way behind the hero from its far end inward. Linear, because it
  // is the one thing on this screen that is not expression — a clock that eased would be
  // lying about how much time is left.
  useEffect(() => {
    if (creepMs === 'held') return
    creep.value = 0
    if (creepMs === null) return
    creep.value = withTiming(1, { duration: creepMs, easing: Easing.linear })
  }, [creepMs])

  const dash = [spline.length, spline.length]

  const baseProps = useAnimatedProps(() => ({
    d: splinePath(spline, clock.value, half, half),
    strokeDashoffset: dashOffset(open.value, spline.length),
  }))

  const creepProps = useAnimatedProps(() => ({
    d: splinePath(spline, clock.value, half, half),
    strokeDashoffset: dashOffset(creep.value, spline.length),
  }))

  return (
    <Svg
      width={box}
      height={box}
      pointerEvents="none"
      style={{ position: 'absolute', left: x - half, top: y - half }}
    >
      {lit && (
        <Defs>
          {/* Along the way rather than across its box, so the cool end is the far one
              however the way is turned: amber where the hero stands, red behind it. */}
          <LinearGradient
            id={gradientId}
            x1={half}
            y1={half}
            x2={half + spline.toX}
            y2={half + spline.toY}
            gradientUnits="userSpaceOnUse"
          >
            <Stop offset="0" stopColor={ember} />
            <Stop offset="1" stopColor={amber} />
          </LinearGradient>
        </Defs>
      )}
      {lit && (
        <AnimatedPath
          animatedProps={baseProps}
          stroke={`${amber}${GLOW_ALPHA}`}
          strokeWidth={GLOW_WIDTH}
          strokeLinecap="round"
          strokeDasharray={dash}
          opacity={fade}
          fill="none"
        />
      )}
      <AnimatedPath
        animatedProps={baseProps}
        stroke={lit ? `url(#${gradientId})` : aheadInk}
        strokeWidth={lit ? LIT_WIDTH : AHEAD_WIDTH}
        strokeLinecap="round"
        strokeDasharray={dash}
        opacity={fade}
        fill="none"
      />
      {lit && (
        <AnimatedPath
          animatedProps={creepProps}
          stroke={ember}
          strokeWidth={LIT_WIDTH}
          strokeLinecap="round"
          strokeDasharray={dash}
          opacity={fade}
          fill="none"
        />
      )}
    </Svg>
  )
}
