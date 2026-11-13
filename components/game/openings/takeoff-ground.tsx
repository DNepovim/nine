import { useMemo } from 'react'
import { View } from 'react-native'
import Animated, { useAnimatedStyle, type SharedValue } from 'react-native-reanimated'
import Svg, { Path } from 'react-native-svg'

import { GROUND_SPEED, TakeoffPasser } from '@/components/game/openings/takeoff-passer'
import { SKY } from '@/constants/colors'
import { useViewport } from '@/hooks/use-viewport'
import { roadside } from '@/lib/plane'

// How much of the screen is ground, as a share of its height.
export const GROUND = 0.07

// What stands along the ground: how many things on a track how many screens long.
const ROADSIDE_COUNT = 7

const ROADSIDE_SCREENS = 4

// How wide one tile of the hills is: every wave of them divides it, so the hills come round
// again exactly.
const TILE = 360

// The ground along the foot: soil under a lip of grass with soft hills, all going by, and trees,
// houses and the odd cow standing on it as it does.
export function TakeoffGround({ clock }: { clock: SharedValue<number> }) {
  const { width, height } = useViewport()
  const depth = height * GROUND
  const track = width * ROADSIDE_SCREENS
  const things = useMemo(() => roadside(11, ROADSIDE_COUNT, track), [track])
  const hills = useMemo(() => {
    const points: string[] = []
    for (let x = 0; x <= width + TILE; x += 8) {
      const y =
        6 +
        3 * Math.sin((x / TILE) * 2 * Math.PI * 9) +
        2 * Math.sin((x / TILE) * 2 * Math.PI * 21 + 1.3)
      points.push(`${x === 0 ? 'M' : 'L'}${x} ${Math.round(y * 10) / 10}`)
    }
    return `${points.join(' ')} L${width + TILE} ${depth} L0 ${depth} Z`
  }, [width, depth])
  const slide = useAnimatedStyle(() => ({
    transform: [{ translateX: -(((clock.value * GROUND_SPEED) / 1000) % TILE) }],
  }))
  return (
    <View
      pointerEvents="none"
      style={{ position: 'absolute', left: 0, right: 0, bottom: 0, height: depth }}
    >
      <View style={{ position: 'absolute', left: 0, right: 0, bottom: depth - 8 }}>
        {things.map((thing) => (
          <TakeoffPasser key={thing.at} thing={thing} clock={clock} track={track} />
        ))}
      </View>
      <Animated.View style={[{ position: 'absolute', left: 0, top: 0 }, slide]}>
        <Svg width={width + TILE} height={depth}>
          <Path
            d={`M0 ${depth * 0.55} L${width + TILE} ${depth * 0.55} L${width + TILE} ${depth} L0 ${depth} Z`}
            fill={SKY.soil}
          />
          <Path d={hills} fill={SKY.grass} stroke={SKY.grassEdge} strokeWidth={2} />
        </Svg>
      </Animated.View>
    </View>
  )
}
