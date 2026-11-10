import { Text, View } from 'react-native'
import Svg, { Circle, Line } from 'react-native-svg'

import { DRAFTING_LETTERING, PRIMARY_INK } from '@/constants/colors'
import { pointName, type Drawing, type SegmentPoint } from '@/lib/segments'

// The segments a drafting board's player has ruled on its targets area, each with its two
// ends marked and lettered — A and B, then C and D, and so on up to five. Drawn over the
// targets and never in the way of a tap: the taps are heard by the area's own gesture.
//
// Pencil, like everything else on the board: a graphite line with a fainter stroke laid beside
// it, a dot at each end, and the letter set off the end along the line it closes.
const INK = PRIMARY_INK
const GHOST = { offset: 0.9, opacity: 0.4 } as const
const DOT = 3

// How far a letter stands from its point, and the box it is centred in.
const LABEL_REACH = 13
const LABEL = { width: 16, height: 14 } as const

// Where the letter for `point` goes: out along the line, away from the segment's other end. A
// point with no other end yet — the first tap of a segment — gets it above.
function labelAt(point: SegmentPoint, other: SegmentPoint | null): SegmentPoint {
  const dx = other === null ? 0 : point.x - other.x
  const dy = other === null ? -1 : point.y - other.y
  const length = Math.hypot(dx, dy) || 1
  return {
    x: point.x + (dx / length) * LABEL_REACH,
    y: point.y + (dy / length) * LABEL_REACH,
  }
}

function Marked({
  point,
  other,
  name,
}: {
  point: SegmentPoint
  other: SegmentPoint | null
  name: string
}) {
  const at = labelAt(point, other)
  return (
    <Text
      selectable={false}
      style={{
        position: 'absolute',
        left: at.x - LABEL.width / 2,
        top: at.y - LABEL.height / 2,
        width: LABEL.width,
        height: LABEL.height,
        textAlign: 'center',
        fontFamily: DRAFTING_LETTERING,
        fontSize: 13,
        lineHeight: LABEL.height,
        color: INK,
      }}
    >
      {name}
    </Text>
  )
}

export function DraftedSegments({ drawing }: { drawing: Drawing }) {
  const { segments, pending, made } = drawing
  return (
    <View
      pointerEvents="none"
      style={{ position: 'absolute', top: 0, right: 0, bottom: 0, left: 0 }}
    >
      <Svg width="100%" height="100%" pointerEvents="none">
        {segments.map(({ from, to, at }) => (
          <SegmentLine key={at} from={from} to={to} />
        ))}
        {pending !== null && <Circle cx={pending.x} cy={pending.y} r={DOT} fill={INK} />}
      </Svg>
      {segments.map(({ from, to, at }) => (
        <View key={at} pointerEvents="none">
          <Marked point={from} other={to} name={pointName(at * 2)} />
          <Marked point={to} other={from} name={pointName(at * 2 + 1)} />
        </View>
      ))}
      {pending !== null && (
        <Marked point={pending} other={null} name={pointName(made * 2)} />
      )}
    </View>
  )
}

function SegmentLine({ from, to }: { from: SegmentPoint; to: SegmentPoint }) {
  return (
    <>
      <Line
        x1={from.x + GHOST.offset}
        y1={from.y + GHOST.offset}
        x2={to.x + GHOST.offset}
        y2={to.y + GHOST.offset}
        stroke={INK}
        strokeOpacity={GHOST.opacity}
        strokeWidth={1}
        strokeLinecap="round"
      />
      <Line
        x1={from.x}
        y1={from.y}
        x2={to.x}
        y2={to.y}
        stroke={INK}
        strokeOpacity={0.9}
        strokeWidth={1.5}
        strokeLinecap="round"
      />
      <Circle cx={from.x} cy={from.y} r={DOT} fill={INK} />
      <Circle cx={to.x} cy={to.y} r={DOT} fill={INK} />
    </>
  )
}
