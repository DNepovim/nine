import Svg, { Circle, Defs, LinearGradient, Path, Stop } from 'react-native-svg'

import { MUTED_INK } from '@/constants/colors'

// A pie of the vote: one slice per option, in its own gradient, running clockwise in the
// order given from `from` — twelve o'clock unless a caller says otherwise. The results
// dialog starts at six, which puts the first option's slice on the left, over the name that
// stands on the left under the pie. Plain SVG rather than a chart library, for a figure of
// two slices.
//
// Nobody having voted is a faint full ring rather than nothing, so the dialog still has a
// shape to hang its legend on; one option holding every vote is a full disc, because an arc
// from a point back to itself has no length to draw.
export type PieSlice = { value: number; colors: readonly [string, string] }

export function VotePie({
  slices,
  size,
  from = 0,
}: {
  slices: readonly PieSlice[]
  size: number
  // The angle the first slice starts at, in radians clockwise from twelve o'clock.
  from?: number
}) {
  const r = size / 2
  const total = slices.reduce((sum, slice) => sum + slice.value, 0)
  const whole = slices.find((slice) => slice.value === total && total > 0)

  // Each slice's wedge: from the end of the one before it, round by its share of the circle.
  const wedges = slices.reduce<{ path: string; end: number }[]>((done, slice) => {
    const start = done.at(-1)?.end ?? from
    const end = start + (slice.value / total) * Math.PI * 2
    const point = (angle: number) =>
      `${r + r * Math.sin(angle)} ${r - r * Math.cos(angle)}`
    const large = end - start > Math.PI ? 1 : 0
    const path = `M ${r} ${r} L ${point(start)} A ${r} ${r} 0 ${large} 1 ${point(end)} Z`
    return [...done, { path, end }]
  }, [])

  return (
    <Svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
      {/* One gradient per slice, across its own bounding box, corner to corner as every
          challenge gradient in the app runs. */}
      <Defs>
        {slices.map((slice, index) => (
          <LinearGradient key={index} id={`slice${index}`} x1="0" y1="0" x2="1" y2="1">
            <Stop offset="0" stopColor={slice.colors[0]} />
            <Stop offset="1" stopColor={slice.colors[1]} />
          </LinearGradient>
        ))}
      </Defs>
      {total === 0 ? (
        <Circle cx={r} cy={r} r={r - 1} fill="none" stroke={MUTED_INK} strokeWidth={2} />
      ) : whole !== undefined ? (
        <Circle cx={r} cy={r} r={r} fill={`url(#slice${slices.indexOf(whole)})`} />
      ) : (
        wedges.map((wedge, index) => (
          <Path key={index} d={wedge.path} fill={`url(#slice${index})`} />
        ))
      )}
    </Svg>
  )
}
