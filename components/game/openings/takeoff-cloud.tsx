import Svg, { Circle, Ellipse } from 'react-native-svg'

import { SKY } from '@/constants/colors'

// One cloud: a few circles lumped together on a flat base, `width` wide.
export function TakeoffCloud({ width }: { width: number }) {
  const height = width * 0.5
  return (
    <Svg width={width} height={height}>
      <Circle cx={width * 0.28} cy={height * 0.62} r={height * 0.34} fill={SKY.cloud} />
      <Circle cx={width * 0.5} cy={height * 0.45} r={height * 0.42} fill={SKY.cloud} />
      <Circle cx={width * 0.74} cy={height * 0.6} r={height * 0.32} fill={SKY.cloud} />
      <Ellipse
        cx={width * 0.5}
        cy={height * 0.72}
        rx={width * 0.33}
        ry={height * 0.2}
        fill={SKY.cloud}
      />
    </Svg>
  )
}
