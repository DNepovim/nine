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

const n = (v: number): string => (Math.round(v * 10) / 10).toString()

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
  face,
  line,
  hatch,
  edge,
}: {
  seed: number
  face: string
  line: string
  hatch: string
  // The amber the target ring is drawn in — the one part of this that is the game speaking
  // rather than the map.
  edge: string
}) {
  const count = 12 + (seed % 3) * 2
  const capped = Math.floor(seed / 5) % 2 === 0
  const towers = [1, 3, 5, 7].map((i) => {
    const a = (i / 8) * Math.PI * 2 - Math.PI / 2
    return { x: Math.cos(a) * WALL, y: Math.sin(a) * WALL }
  })

  return (
    <Svg width={TOWN_BOX} height={TOWN_BOX} pointerEvents="none">
      <G transform={`translate(${MID}, ${MID})`}>
        <Path d={merlons(count)} fill={face} stroke={line} strokeWidth={0.7} />
        <Circle r={WALL} fill={face} stroke={line} strokeWidth={1.2} />
        {towers.map((tower, i) => (
          <Circle
            key={i}
            cx={tower.x}
            cy={tower.y}
            r={capped ? 2.9 : 2.3}
            fill={face}
            stroke={line}
            strokeWidth={0.9}
          />
        ))}
        <Path d={GATE} fill="none" stroke={hatch} strokeWidth={0.8} />
        {/* The ring the number sits in: the game's own amber, inside the map's own wall.
            One ring rather than two — the merlons and the towers have already said wall,
            and a second line of it was only taking room off the number. */}
        <Circle r={WALL - 3.5} fill="none" stroke={edge} strokeWidth={1.6} />
      </G>
    </Svg>
  )
}
