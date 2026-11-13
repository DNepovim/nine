import Svg, { Circle, Ellipse, Path, Polygon } from 'react-native-svg'

import { SKY } from '@/constants/colors'
import type { RoadsideKind } from '@/lib/plane'

// A thing's natural size, which the box it is drawn in has and `scale` multiplies.
export const THING = 64

const rectPath = (x: number, y: number, w: number, h: number) =>
  `M${x} ${y} h${w} v${h} h${-w} Z`

// One thing that stands on the ground, in a 64 px box with its feet on the foot of it.
export function TakeoffRoadside({ kind }: { kind: RoadsideKind }) {
  return (
    <Svg width={THING} height={THING} viewBox="0 0 64 64">
      {kind === 'tree' && (
        <>
          <Path d={rectPath(28, 38, 8, 26)} fill={SKY.trunk} />
          <Circle cx={32} cy={28} r={20} fill={SKY.leaf} />
          <Circle cx={21} cy={37} r={12} fill={SKY.leafDark} />
          <Circle cx={43} cy={37} r={12} fill={SKY.leaf} />
        </>
      )}
      {kind === 'pine' && (
        <>
          <Path d={rectPath(29, 46, 6, 18)} fill={SKY.trunk} />
          <Polygon points="32,4 48,28 16,28" fill={SKY.leafDark} />
          <Polygon points="32,16 52,46 12,46" fill={SKY.leaf} />
        </>
      )}
      {kind === 'house' && (
        <>
          <Path d={rectPath(8, 30, 48, 34)} fill={SKY.wall} />
          <Polygon points="3,33 32,8 61,33" fill={SKY.roof} />
          <Path d={rectPath(26, 44, 12, 20)} fill={SKY.trunk} />
          <Path d={rectPath(12, 38, 10, 10)} fill={SKY.glass} />
          <Path d={rectPath(42, 38, 10, 10)} fill={SKY.glass} />
        </>
      )}
      {kind === 'cow' && (
        <>
          <Path d={rectPath(18, 48, 4, 16)} fill={SKY.spot} />
          <Path d={rectPath(26, 48, 4, 16)} fill={SKY.spot} />
          <Path d={rectPath(40, 48, 4, 16)} fill={SKY.spot} />
          <Path d={rectPath(48, 48, 4, 16)} fill={SKY.spot} />
          <Ellipse cx={34} cy={42} rx={20} ry={11} fill={SKY.cow} />
          <Ellipse cx={26} cy={40} rx={5} ry={4} fill={SKY.spot} />
          <Ellipse cx={42} cy={45} rx={4.5} ry={3.5} fill={SKY.spot} />
          <Ellipse cx={56} cy={34} rx={8} ry={7} fill={SKY.cow} />
          <Circle cx={58} cy={32} r={1.4} fill={SKY.spot} />
          <Path d="M52 28 L50 22 L55 26 Z" fill={SKY.spot} />
          <Path
            d="M14 38 C10 40 10 46 12 50"
            stroke={SKY.spot}
            strokeWidth={2}
            fill="none"
          />
        </>
      )}
    </Svg>
  )
}
