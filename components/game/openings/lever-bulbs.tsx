import Svg, { Circle, Defs, RadialGradient, Stop } from 'react-native-svg'

import { CASINO } from '@/constants/colors'

const HALO_ID = 'casino-halo'

// A set of bulbs: each a hot core in a ring of its own, with a soft light round it. `lit` draws
// them shining; unlit they are the same bulbs gone dim, so the rim of the screen is always a
// row of bulbs and the chase is only which of them are on.
export function LeverBulbs({
  bulbs,
  width,
  height,
  lit,
}: {
  bulbs: readonly { x: number; y: number }[]
  width: number
  height: number
  lit: boolean
}) {
  return (
    <Svg width={width} height={height}>
      <Defs>
        <RadialGradient id={HALO_ID} cx="50%" cy="50%" r="50%">
          <Stop offset="0%" stopColor={CASINO.bulb} stopOpacity={0.85} />
          <Stop offset="45%" stopColor={CASINO.bulb} stopOpacity={0.3} />
          <Stop offset="100%" stopColor={CASINO.bulb} stopOpacity={0} />
        </RadialGradient>
      </Defs>
      {lit &&
        bulbs.map(({ x, y }) => (
          <Circle key={`h-${x}-${y}`} cx={x} cy={y} r={14} fill={`url(#${HALO_ID})`} />
        ))}
      {bulbs.map(({ x, y }) => (
        <Circle
          key={`b-${x}-${y}`}
          cx={x}
          cy={y}
          r={4.4}
          fill={lit ? CASINO.flash : CASINO.bulbOff}
          stroke={lit ? CASINO.bulb : CASINO.bulbRim}
          strokeWidth={1.6}
        />
      ))}
    </Svg>
  )
}
