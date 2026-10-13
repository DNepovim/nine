import Svg, { G, Path } from 'react-native-svg'

import { TOWN_BOX, townMarks } from '@/lib/town-marks'

// The target, drawn as the settlement at the end of a way.
//
// The number a player dials has always sat in a disc. This is that disc with the map's own
// hand put to it — a place on the sheet rather than a chip laid over one — while the number
// inside it stays exactly as legible as it was.
//
// The face is the ground's own colour, which is also the knockout every other mark on this
// map fills itself with: a settlement covers the country behind it and the sheet shows
// through it, which is how a map draws one. The number on that ground is the strongest
// contrast the theme has.
//
// Two drawings with nothing in common — an open village is a cluster of buildings with no
// outline at all, and a walled one is a ring of wall: crenellated, towered, and flying a
// pennant. That difference is the one thing a player has to be able to read across a fan
// before dialling, because choosing that way is choosing a fight. The hand that draws both
// is lib/town-marks.ts, which is also where the reasoning about the pair of them lives.
//
// All this file does is put the inks to it.

const MID = TOWN_BOX / 2

export function TownMark({
  // The crossroad's own seed: which quarters a village has built on and how its houses
  // turned out, or how many merlons a wall has and whether its towers are capped. Enough
  // that no two places in sight are the same drawing.
  seed,
  // Whether this village has walls worth the name. The crossroad is the one that knows;
  // all this does is draw it.
  fortified,
  face,
  line,
  hatch,
}: {
  seed: number
  fortified: boolean
  face: string
  line: string
  hatch: string
}) {
  const town = townMarks(seed, fortified)

  return (
    <Svg width={TOWN_BOX} height={TOWN_BOX} pointerEvents="none">
      <G transform={`translate(${MID}, ${MID})`}>
        {/* The ground the number sits on. Filled and never inked: on a walled village the
            wall is drawn over it, and on an open one there is nothing round it at all —
            what the mark is for is to clear the country out from under the number. */}
        <Path d={town.knockout} fill={face} />
        {town.marks.map((mark, i) => (
          <Path
            key={i}
            d={mark.body}
            fill={face}
            stroke={mark.ink === 'hatch' ? hatch : line}
            strokeWidth={mark.width}
          />
        ))}
        {/* The gate of a wall. An open village has nothing to draw here. */}
        {town.detail !== '' && (
          <Path d={town.detail} fill="none" stroke={hatch} strokeWidth={0.8} />
        )}
        {/* The pennant, on a walled village and nowhere else.
            A wall drawn heavier says *fortified* to anyone comparing two towns side by
            side, which across a fan is exactly what a player cannot do — they are reading
            three at once, at a glance, under a clock. A flag needs no comparison. It is
            also how a sheet like this has always marked a place that is held, so it costs
            the map nothing to say it. */}
        {town.pennant !== null && (
          <Path
            d={town.pennant}
            fill={line}
            stroke={line}
            strokeWidth={0.6}
            strokeLinejoin="round"
          />
        )}
      </G>
    </Svg>
  )
}
