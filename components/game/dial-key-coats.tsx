import { LinearGradient } from 'expo-linear-gradient'
import Animated, { useAnimatedStyle, type SharedValue } from 'react-native-reanimated'

import { TileFace } from '@/components/game/tile-face'
import { AZULEJO, PRIMARY_INK, STRIKE_COLORS } from '@/constants/colors'
import { PRESS_SCALE } from '@/hooks/use-key-motion'
import { TOP_LEVEL } from '@/lib/tile-motif'

// How dark the shading under a thumb is on a **sketched** key, which has no fill to squash.
const SKETCH_WASH = 0.07

// How far a key warms under a strike's flame — see `heat`. Short of the full colour, so the
// key still reads as itself turning hot rather than as a different key.
const FIRE_WASH = 0.75

// What a key wears between its fill and its digit: the CTA gradient at its top, the heat of
// a strike, a sketched key's shading under the thumb, and a tile's two coats of paint. Each
// is laid over the whole pill and under the digit — see `DialButton`.
export function DialKeyCoats({
  index,
  dark,
  sketched,
  tiled,
  keyRadius,
  peak,
  tileLevel,
  tileInk,
  peakProgress,
  scale,
  heat,
}: {
  index: number
  dark: boolean
  sketched: boolean
  tiled: boolean
  keyRadius: number
  peak: readonly [string, string] | readonly string[]
  tileLevel: number
  tileInk: string
  peakProgress: SharedValue<number>
  scale: SharedValue<number>
  heat: SharedValue<number> | null
}) {
  // Where a sketched key shows it is under the thumb: the squash above, read as a shading.
  const washStyle = useAnimatedStyle(() => ({
    opacity: (SKETCH_WASH * (1 - scale.value)) / (1 - PRESS_SCALE),
  }))

  // The CTA gradient crossfades in over the ramp — every tint change, including
  // the jump to and from 9, is a timed transition.
  const peakStyle = useAnimatedStyle(() => ({ opacity: peakProgress.value }))
  // A painted tile's two coats: cobalt on the glaze, glaze on the cobalt a key at its top is.
  const paintStyle = useAnimatedStyle(() => ({ opacity: 1 - peakProgress.value }))

  // How far the key has warmed under a strike, drawn as a red-to-gold coat.
  const fireStyle = useAnimatedStyle(() => ({ opacity: FIRE_WASH * (heat?.value ?? 0) }))

  return (
    <>
      {/* Rounded on its own rather than clipped by the pill — `overflow:
              hidden` on the parent would clip away the button's shadow too. */}
      {!dark && !sketched && (
        <Animated.View
          pointerEvents="none"
          style={[
            { position: 'absolute', top: 0, right: 0, bottom: 0, left: 0 },
            peakStyle,
          ]}
        >
          <LinearGradient
            colors={[peak[0], peak[1]]}
            start={{ x: 0, y: 0.5 }}
            end={{ x: 1, y: 0.5 }}
            style={{ flex: 1, borderRadius: keyRadius }}
          />
        </Animated.View>
      )}
      {/* The key turning hot under a strike: red at the crown, gold at the base where a
              fire burns hottest. Over the fill and under the digit, like the peak above. */}
      {heat !== null && (
        <Animated.View
          pointerEvents="none"
          style={[
            { position: 'absolute', top: 0, right: 0, bottom: 0, left: 0 },
            fireStyle,
          ]}
        >
          <LinearGradient
            colors={[STRIKE_COLORS.cool, STRIKE_COLORS.hot]}
            start={{ x: 0.5, y: 0 }}
            end={{ x: 0.5, y: 1 }}
            style={{ flex: 1, borderRadius: keyRadius }}
          />
        </Animated.View>
      )}
      {sketched && (
        <Animated.View
          pointerEvents="none"
          style={[
            {
              position: 'absolute',
              top: 0,
              right: 0,
              bottom: 0,
              left: 0,
              backgroundColor: PRIMARY_INK,
            },
            washStyle,
          ]}
        />
      )}
      {/* A tile of the panel: the pattern for the digit it shows, in the challenge's ink, over
              the glaze — and the fullest pattern in glaze over the ink, at the key's top. */}
      {tiled && !dark && (
        <>
          <Animated.View
            pointerEvents="none"
            style={[
              { position: 'absolute', top: 0, right: 0, bottom: 0, left: 0 },
              paintStyle,
            ]}
          >
            <TileFace index={index} level={tileLevel} ink={tileInk} />
          </Animated.View>
          <Animated.View
            pointerEvents="none"
            style={[
              { position: 'absolute', top: 0, right: 0, bottom: 0, left: 0 },
              peakStyle,
            ]}
          >
            <TileFace index={index} level={TOP_LEVEL} ink={AZULEJO.glaze} />
          </Animated.View>
        </>
      )}
    </>
  )
}
