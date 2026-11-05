import Svg, { Circle, Path } from 'react-native-svg'

import { MUTED_INK } from '@/constants/colors'

// A pie of the vote: one slice per option, in its own colour, starting at twelve o'clock and
// running clockwise in the order given. Plain SVG rather than a chart library, for a figure of
// two slices.
//
// Nobody having voted is a faint full ring rather than nothing, so the dialog still has a
// shape to hang its legend on; one option holding every vote is a full disc, because an arc
// from a point back to itself has no length to draw.
export type PieSlice = { value: number; color: string }

export function VotePie({ slices, size }: { slices: readonly PieSlice[]; size: number }) {
  const r = size / 2
  const total = slices.reduce((sum, slice) => sum + slice.value, 0)
  const whole = slices.find((slice) => slice.value === total && total > 0)

  // Each slice's wedge: from the end of the one before it, round by its share of the circle.
  const wedges = slices.reduce<{ path: string; color: string; end: number }[]>(
    (done, slice) => {
      const start = done.at(-1)?.end ?? 0
      const end = start + (slice.value / total) * Math.PI * 2
      const point = (angle: number) =>
        `${r + r * Math.sin(angle)} ${r - r * Math.cos(angle)}`
      const large = end - start > Math.PI ? 1 : 0
      const path = `M ${r} ${r} L ${point(start)} A ${r} ${r} 0 ${large} 1 ${point(end)} Z`
      return [...done, { path, color: slice.color, end }]
    },
    [],
  )

  return (
    <Svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
      {total === 0 ? (
        <Circle cx={r} cy={r} r={r - 1} fill="none" stroke={MUTED_INK} strokeWidth={2} />
      ) : whole !== undefined ? (
        <Circle cx={r} cy={r} r={r} fill={whole.color} />
      ) : (
        wedges.map((wedge, index) => (
          <Path key={index} d={wedge.path} fill={wedge.color} />
        ))
      )}
    </Svg>
  )
}
