import Animated, { useAnimatedProps, type SharedValue } from 'react-native-reanimated'
import { Defs, Path, RadialGradient, Stop } from 'react-native-svg'

import { HERO_SIZE } from '@/constants/arcade'
import { ribbonPath, type Trail } from '@/lib/smoke'

const AnimatedPath = Animated.createAnimatedComponent(Path)

// SVG ids are global in react-native-svg. There is one hero, so one fixed id is safe here —
// unlike a way's gradient, which has to be keyed on its crossroad.
const FADE = 'arcade-smoke'

// How strong the smoke is where it leaves the wick, and at half its reach. Faint: this is
// ink on a map, and smoke that could be read as a drawn feature would be a second map.
const NEAR = 0.26
const MID = 0.17

// A path that closes on the point it opens at, which is the shortest way to draw nothing.
const EMPTY = 'M0 0Z'

export function HeroSmoke({
  trail,
  clock,
  atX,
  atY,
  reach,
  ink,
}: {
  trail: SharedValue<Trail>
  clock: SharedValue<number>
  // Where the hero is, in the canvas's own frame. The ribbon is held in world positions —
  // that is the whole trick — and drawn against this.
  atX: SharedValue<number>
  atY: SharedValue<number>
  // How far the smoke carries before it is gone. The box it is drawn in is twice this, so
  // the gradient reaches nothing exactly where the box runs out: what would have been a
  // straight cut across the plume is instead the point it had already faded to.
  reach: number
  ink: string
}) {
  const ribbon = useAnimatedProps(() => {
    const d = ribbonPath(trail.value, clock.value, HERO_SIZE, atX.value, atY.value)
    // A trail with nothing in it draws nothing, and a path with nothing in it is a string
    // the parser on the other side has no reason to be handed.
    return { d: d === '' ? EMPTY : d }
  })

  return (
    <>
      <Defs>
        {/* Centred on the hero rather than run along the plume: distance from the fire is
            what a ribbon's age amounts to, and a radial fade needs nothing animated to
            follow a trail round a corner. */}
        <RadialGradient id={FADE} cx="0" cy="0" r={reach} gradientUnits="userSpaceOnUse">
          <Stop offset="0" stopColor={ink} stopOpacity={NEAR} />
          <Stop offset="0.5" stopColor={ink} stopOpacity={MID} />
          <Stop offset="1" stopColor={ink} stopOpacity={0} />
        </RadialGradient>
      </Defs>
      <AnimatedPath animatedProps={ribbon} fill={`url(#${FADE})`} />
    </>
  )
}
