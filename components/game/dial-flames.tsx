import { useEffect, useRef } from 'react'
import Animated, {
  Easing,
  useAnimatedStyle,
  useDerivedValue,
  useSharedValue,
  withDelay,
  withSequence,
  withTiming,
  type SharedValue,
} from 'react-native-reanimated'
import Svg, { G } from 'react-native-svg'

import { FlameCoat } from '@/components/game/flame-coat'
import { STRIKE_COLORS } from '@/constants/colors'
import type { DialMetrics } from '@/lib/dial-metrics'
import { cellsOf, type DialSpec } from '@/modes'

// The `flame` shot: every key on the dial catching fire at once when a strike lands, the
// fire burning up from behind the pill and dying back under it. See `ShotKind`.
//
// The arcade hero's own flame (`FlameCoat`, `tonguePath`), drawn out upwards rather than
// behind a walk, in the strike palette rather than arcade's amber — so it is the same fire
// the app already has, and the same colours every other strike is drawn in.
//
// One layer under the whole dial rather than a flame inside each key: a bottom-row flame
// licking upward reaches the key above it, and drawn inside its own key it would be
// painted over that one. Down here every key sits on top of every flame.

// Coats outermost first, in multiples of the key's radius. Every coat is wider than the
// key, since whatever is inside the pill is never seen: the red is the outer fire and the
// gold the hot ring nearest the key. `reach` is how far each licks upward at full heat.
//
// Kept to a rim rather than a blaze: the fire says the key is hot, and the key turning
// warm (see `useBurn`) says the rest. A flame half a key tall was louder than the hit.
const COATS = [
  {
    key: 'halo',
    fill: STRIKE_COLORS.cool,
    radius: 1.26,
    reach: 0.45,
    grain: 0.5,
    amp: 1.1,
    opacity: 0.18,
  },
  {
    key: 'body',
    fill: STRIKE_COLORS.cool,
    radius: 1.16,
    reach: 0.34,
    grain: 1,
    amp: 1.2,
    opacity: 0.7,
  },
  {
    key: 'core',
    fill: STRIKE_COLORS.hot,
    radius: 1.08,
    reach: 0.22,
    grain: 1.6,
    amp: 1.1,
    opacity: 0.9,
  },
] as const

// Straight up the screen. `tonguePath` takes the direction the flame is drawn out in.
const UP = -Math.PI / 2

// How far the layer reaches past the dial's box, as a multiple of a key: the halo's radius
// and its reach, less the key's own radius, with some air for the ruffle.
const MARGIN = 0.5

// Up fast, held a beat, and down slowly — the flame lands with the hit and has died back
// under the keys before the next one at the hardest cadence a challenge runs.
const RISE_MS = 120
const HOLD_MS = 80
const FALL_MS = 480
const BURN_MS = RISE_MS + HOLD_MS + FALL_MS

// How small the flame shrinks at the end of its fall, as a share of full size. Not nought:
// the layer fades out at the same time, and a flame that shrank all the way would be gone
// under the pill before the fade had anything to fade.
const EMBER = 0.75

// Where each key's flame is offset in the ruffle, in milliseconds of its clock, so four
// keys burning together are four fires rather than one shape stamped four times.
const PHASE_MS = 211

// One burn per strike: `heat` rises, holds and falls, and `clock` runs the ruffle for as
// long as it does. Owned by the dial rather than by the flames, because the keys read the
// same heat to warm their own fill — the fire and the key turning hot are one event.
//
// `seq` counts the strikes that have set the dial alight. A change is a strike; the first
// value is one that has already been shown, or none at all.
export function useBurn(seq: number | null): Burn {
  const heat = useSharedValue(0)
  const clock = useSharedValue(0)
  const seen = useRef(seq)

  useEffect(() => {
    if (seq === null || seq === seen.current) return
    seen.current = seq
    heat.value = withSequence(
      withTiming(1, { duration: RISE_MS, easing: Easing.out(Easing.quad) }),
      withDelay(
        HOLD_MS,
        withTiming(0, { duration: FALL_MS, easing: Easing.in(Easing.quad) }),
      ),
    )
    // The ruffle only moves while something is burning, so the clock runs for the length
    // of one burn and stops — nothing is rebuilt on a frame where no flame is showing.
    clock.value = withTiming(clock.value + BURN_MS, {
      duration: BURN_MS,
      easing: Easing.linear,
    })
  }, [seq])

  return { heat, clock }
}

export type Burn = { heat: SharedValue<number>; clock: SharedValue<number> }

export function DialFlames({
  dial,
  metrics,
  burn: { heat, clock },
}: {
  dial: DialSpec
  metrics: DialMetrics
  burn: Burn
}) {
  const pulse = useDerivedValue(() => EMBER + (1 - EMBER) * heat.value)
  const blaze = useSharedValue(0)
  const tail = useSharedValue(UP)

  const fade = useAnimatedStyle(() => ({ opacity: heat.value }))

  const radius = metrics.button / 2
  const margin = metrics.button * MARGIN
  const width = metrics.width + margin * 2
  const height = metrics.height + margin * 2
  const pitch = metrics.button + metrics.gap

  return (
    <Animated.View
      pointerEvents="none"
      style={[{ position: 'absolute', left: -margin, top: -margin, width, height }, fade]}
    >
      <Svg width={width} height={height}>
        {cellsOf(dial).map((index) => (
          <G
            key={index}
            transform={`translate(${margin + (index % dial.cols) * pitch + radius}, ${
              margin + Math.floor(index / dial.cols) * pitch + radius
            })`}
          >
            <KeyFlame
              index={index}
              radius={radius}
              clock={clock}
              pulse={pulse}
              blaze={blaze}
              tail={tail}
              speed={heat}
            />
          </G>
        ))}
      </Svg>
    </Animated.View>
  )
}

// One key's fire: the coats, on that key's own place in the ruffle. A component rather
// than a loop above because the offset clock is a hook.
function KeyFlame({
  index,
  radius,
  clock,
  pulse,
  blaze,
  tail,
  speed,
}: {
  index: number
  radius: number
  clock: SharedValue<number>
  pulse: SharedValue<number>
  blaze: SharedValue<number>
  tail: SharedValue<number>
  speed: SharedValue<number>
}) {
  const own = useDerivedValue(() => clock.value + index * PHASE_MS)
  return COATS.map((coat) => (
    <FlameCoat
      key={coat.key}
      size={radius}
      radius={coat.radius}
      reach={coat.reach}
      grain={coat.grain}
      amp={coat.amp}
      fill={coat.fill}
      opacity={coat.opacity}
      clock={own}
      pulse={pulse}
      blaze={blaze}
      tail={tail}
      speed={speed}
    />
  ))
}
