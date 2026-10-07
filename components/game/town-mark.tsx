import Svg, { Circle, G, Path } from 'react-native-svg'

import { BUD_SIZE } from '@/constants/arcade'

// The target, drawn as a walled town.
//
// The number a player dials has always sat in a disc. This is that disc with the map's own
// hand put to it: a wall around it, merlons along the top of the wall, towers at the
// quarters and a gate at the foot — so a target reads as a place on the sheet rather than as
// a chip laid over one, while the number inside it stays exactly as legible as it was.
//
// The face is the ground's own colour, which is also the knockout every other mark on this
// map fills itself with: a town covers the country behind it and the sheet shows through its
// walls, which is how a map draws one. The number on that ground is the strongest contrast
// the theme has.
//
// A walled village is this same town built up rather than a mark of its own: the same wall,
// the same merlons, the same four towers, drawn heavier and with the towers a third larger.
// That is deliberate twice over. It is how a sheet like this has always said *fortified* —
// more of the town, not a different symbol — and it is the one thing a player has to be able
// to read across a fan before dialling, because choosing that way is choosing a fight.

// The box has to hold the merlons and the towers, which stand outside the wall.
export const TOWN_BOX = BUD_SIZE + 12

const MID = TOWN_BOX / 2
const WALL = BUD_SIZE / 2 - 1
// How far a merlon stands off the wall, and how wide one is.
const MERLON = 2.6
const MERLON_HALF = 0.055

// The gate: a little arch at the foot of the wall, which is where a road would come in.
const GATE =
  `M-2.6 ${WALL - 0.4} L-2.6 ${WALL - 3.4} ` +
  `Q0 ${WALL - 5.6} 2.6 ${WALL - 3.4} L2.6 ${WALL - 0.4}`

// The pennant a walled village flies, off the top of its north tower: a staff standing
// clear of the wall and a swallow-tailed flag on the windward side of it.
//
// Sized to finish inside TOWN_BOX, which the merlons and towers already reach most of the
// way across — SVG clips what leaves the box, and a flag with its top cut off reads as a
// drawing error rather than as a flag.
const STAFF = WALL + 6
const PENNANT =
  `M0 ${-WALL - 1} L0 ${-STAFF} ` +
  `L7 ${-STAFF + 2} L5 ${-STAFF + 3.1} L7 ${-STAFF + 4.2} L0 ${-STAFF + 5} Z`

const n = (v: number): string => (Math.round(v * 10) / 10).toString()

// How heavily the town is drawn, and how far its towers stand out of the wall. The walled
// build is the plain one turned up — every line of it at once, so nothing reads as an
// addition — and the towers carry most of the difference, being the part of a town that is
// still legible at the size a bud is drawn at.
const BUILD = {
  plain: { wall: 1.2, merlon: 0.7, tower: 0.9, towers: 1 },
  walled: { wall: 2.2, merlon: 1.3, tower: 1.4, towers: 4 / 3 },
} as const

// The crenellations, as one path: a block of wall standing proud at every step round it.
function merlons(count: number): string {
  let d = ''
  for (let i = 0; i < count; i++) {
    const a = (i / count) * Math.PI * 2 - Math.PI / 2
    const at = (radius: number, offset: number) => ({
      x: Math.cos(a + offset) * radius,
      y: Math.sin(a + offset) * radius,
    })
    const p1 = at(WALL - 0.5, -MERLON_HALF)
    const p2 = at(WALL + MERLON, -MERLON_HALF)
    const p3 = at(WALL + MERLON, MERLON_HALF)
    const p4 = at(WALL - 0.5, MERLON_HALF)
    d += `M${n(p1.x)} ${n(p1.y)} L${n(p2.x)} ${n(p2.y)} L${n(p3.x)} ${n(p3.y)} L${n(p4.x)} ${n(p4.y)} Z`
  }
  return d
}

export function TownMark({
  // The crossroad's own seed: how many merlons this town's wall has, and whether its towers
  // are capped. Enough that no two towns in sight are the same wall, and not so much that a
  // town stops reading as a town.
  seed,
  // Whether this village has walls worth the name — see the note above. The crossroad is
  // the one that knows; all this does is draw it.
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
  const count = 12 + (seed % 3) * 2
  const capped = Math.floor(seed / 5) % 2 === 0
  const build = BUILD[fortified ? 'walled' : 'plain']
  const towers = [1, 3, 5, 7].map((i) => {
    const a = (i / 8) * Math.PI * 2 - Math.PI / 2
    return { x: Math.cos(a) * WALL, y: Math.sin(a) * WALL }
  })

  return (
    <Svg width={TOWN_BOX} height={TOWN_BOX} pointerEvents="none">
      <G transform={`translate(${MID}, ${MID})`}>
        <Path d={merlons(count)} fill={face} stroke={line} strokeWidth={build.merlon} />
        <Circle r={WALL} fill={face} stroke={line} strokeWidth={build.wall} />
        {towers.map((tower, i) => (
          <Circle
            key={i}
            cx={tower.x}
            cy={tower.y}
            r={(capped ? 2.9 : 2.3) * build.towers}
            fill={face}
            stroke={line}
            strokeWidth={build.tower}
          />
        ))}
        <Path d={GATE} fill="none" stroke={hatch} strokeWidth={0.8} />
        {/* The pennant, on a walled village and nowhere else: a staff off the north tower
            with a flag flying from it.

            The heavier build says *fortified* to anyone comparing two towns side by side,
            which across a fan is exactly what a player cannot do — they are reading three
            at once, at a glance, under a clock. A flag needs no comparison. It is also how
            a sheet like this has always marked a place that is held, so it costs the map
            nothing to say it. */}
        {fortified && (
          <Path
            d={PENNANT}
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
