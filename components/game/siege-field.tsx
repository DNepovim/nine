import { useEffect, useState } from 'react'
import Animated, { useAnimatedStyle, type SharedValue } from 'react-native-reanimated'

import { SiegeBlow } from '@/components/game/siege-blow'
import { SiegeRampart } from '@/components/game/siege-rampart'
import { SiegeTower, TOWER_DISC, TowerNumber } from '@/components/game/siege-tower'
import { SiegeWarrior } from '@/components/game/siege-warrior'
import {
  BLOW_MS,
  GATE_DROP,
  GATE_WIDE,
  LANE_REACH,
  SIEGE_ZOOM,
  WALL_BOW,
  WALL_OVER,
} from '@/constants/siege'
import { idSeed } from '@/machines/arcade'
import type { Blow, Siege, Tower } from '@/machines/siege'

// Everything a siege puts on the sheet: the wall above, the towers standing on it, the gate
// in the middle of it, and whatever is crossing the ground between that and the hero.
//
// A component of its own because arcade-game.tsx is already the longest file in the app, and
// because this is the one part of the screen that is a *place* rather than the map.
//
// The place is a field in front of a wall, and the whole of this file is that one decision.
// The village is not drawn from above and the wall is not a ring around it: what the camera
// holds is a stretch of its near side, lifted to the top of the canvas, with everything
// under it left empty for the men coming out. See `siegeFrame` in lib/arcade-layout.ts for
// the camera's half of it — the lift that puts the wall up there and the stand-off that
// keeps the hero at the bottom.
//
// One turned-back view holds all of it, and that is what makes the layout inside simple
// enough to read. The sheet is turned under a siege so that the way in points up the screen,
// so inside this view "down" is the ground the hero is standing on and "across" is the wall:
// a tower is at a plain x, a man walks down a plain y, and nothing in here has to carry a
// pair of basis vectors about. The view is placed on the village itself, which is the middle
// of the wall and the gate.

// How near the middle of the wall a tower may stand: the gate's own half, the disc the
// tower's number sits in, and a point of air. The gate is the one stretch of the wall
// nothing may be built on — a tower there would cover the arch and the men would come out
// from under it.
const GATE_ROOM = GATE_WIDE / 2 + TOWER_DISC + 1

// And how near each other two of them may stand. Between their numbers rather than between
// their blocks, the discs being the wider of the two: a digit lost to a neighbour's disc is
// a tower nobody will risk dialling, which is the one thing this layout may not do.
const BAY_MIN = TOWER_DISC * 2 + 1

// A point or two of air at the edge of the sheet. The wall runs off it; a number does not.
const EDGE = 2

// How far up a tower a stone is aimed. Its middle rather than its crown, so the dust comes
// off the block itself — a stone passing over the merlons of a tower already knocked down to
// a stump would be a shot that missed.
const STRUCK_AT = 14

// Every blow the fight has struck that is still being drawn.
//
// A list rather than the one the siege is carrying, because a blow is a moment and the
// state only ever holds the last of them: two hits a fifth of a second apart are two stones
// in the air at once, and keying a single effect on the latest would cut the first one's
// dust off mid-roll. Each is dropped on its own timer, `BLOW_MS` after it landed.
const without = (id: number) => (list: readonly Blow[]) =>
  list.filter((each) => each.id !== id)

function useBlows(blow: Blow | null): readonly Blow[] {
  const [struck, setStruck] = useState<readonly Blow[]>([])
  const id = blow?.id ?? null

  useEffect(() => {
    if (blow === null || id === null) return
    setStruck((list) => [...list, blow])
    const over = setTimeout(() => {
      setStruck(without(id))
    }, BLOW_MS)
    return () => {
      clearTimeout(over)
    }
  }, [id])

  return struck
}

// Where the towers stand along the wall, measured out from the gate.
//
// Evenly, wherever the wall is wide enough to be even — a wall is of one build, and a
// player looking for a number should find it about where it was in the last fight. Where it
// is not wide enough, which is six towers on a narrow phone, the bays pack out from the gate
// at the width a number needs and the wall gives up its evenness rather than its numbers.
//
// Out from the gate rather than in from the ends, because that is the end of the wall that
// has to hold: the gate's room is the one measure here with nothing to spare in it.
const placedFrom = (
  gateward: readonly Tower[],
  reach: number,
): { tower: Tower; x: number }[] => {
  let nearest = GATE_ROOM
  return gateward.map((tower) => {
    const even = Math.abs(tower.at - 0.5) * 2 * reach
    const out = Math.min(reach, Math.max(even, nearest))
    nearest = out + BAY_MIN
    return { tower, x: tower.at < 0.5 ? -out : out }
  })
}

export function SiegeField({
  siege,
  now,
  turn,
  villageX,
  villageY,
  heroX,
  heroY,
  width,
  ink,
  line,
  hatch,
  blood,
  face,
}: {
  siege: Siege
  // The wall clock, sampled on every frame — the clock a warrior's `spawnedAt` is stamped
  // on. See the note where it is taken, in arcade-game.tsx.
  now: SharedValue<number>
  // The sheet's own turn, taken back out: a wall is drawn standing up, so the whole fight is
  // turned back for the same reason town-mark is on a bud. One rotation for the lot of it —
  // the wall and its towers are one rigid thing and would read as a collision if each of
  // them came back about its own foot.
  turn: SharedValue<number>
  villageX: number
  villageY: number
  // Where the hero is *drawn*, not where the way it is standing on begins.
  heroX: number
  heroY: number
  // How wide the canvas is, in screen points. What sets the wall's span: it has to leave the
  // sheet at both edges rather than end on it.
  width: number
  ink: string
  line: string
  // The hand the sheet draws its detail in: the courses on the wall, the shade on a tower,
  // and the dust a stone brings off one.
  hatch: string
  // Arcade's own red, which is the only red on this screen. What a man bleeds.
  blood: string
  face: string
}) {
  // How far the hero is standing from the gate, which is the depth of the field. Taken as a
  // distance rather than as a pair of offsets: the sheet is squared up under a siege, so the
  // hero is straight down the screen from the wall and the distance is the whole of it.
  const ground = Math.hypot(heroX - villageX, heroY - villageY) || 1
  // Both measures back through the camera, the canvas being a measure of the screen and
  // everything in here being drawn on the map.
  //
  // Two spans rather than one, and the wall's is the wider. The wall leaves the sheet at
  // both edges, which is what says the village goes on past it; a tower standing that far
  // out would take its number off the sheet with it, so the furthest one stands a disc and
  // a little air inside the edge.
  const half = width / SIEGE_ZOOM / 2 + WALL_OVER
  const reach = Math.max(GATE_ROOM, width / SIEGE_ZOOM / 2 - TOWER_DISC - EDGE)

  const upright = useAnimatedStyle(() => ({
    transform: [{ rotate: `${-turn.value}rad` }],
  }))
  const struck = useBlows(siege.blow)

  // The two halves of the wall, each laid out from the gate outward, and each tower set back
  // along the bow by as much as its own place on it asks for.
  const wall = [
    ...placedFrom(
      siege.towers.filter((tower) => tower.at < 0.5).sort((a, b) => b.at - a.at),
      reach,
    ),
    ...placedFrom(
      siege.towers.filter((tower) => tower.at >= 0.5).sort((a, b) => a.at - b.at),
      reach,
    ),
  ].map(({ tower, x }) => ({ tower, x, y: (-WALL_BOW * x * x) / (half * half) }))

  return (
    <Animated.View
      pointerEvents="none"
      className="absolute"
      style={[{ left: villageX, top: villageY, width: 0, height: 0 }, upright]}
    >
      <SiegeRampart
        half={half}
        bow={WALL_BOW}
        gate={GATE_WIDE}
        seed={idSeed(siege.at)}
        line={line}
        hatch={hatch}
        face={face}
      />
      {wall.map(({ tower, x, y }) => (
        <SiegeTower
          key={tower.id}
          tower={tower}
          x={x}
          y={y}
          seed={siege.seed + idSeed(`${siege.at}:${tower.id}`)}
          line={line}
          hatch={hatch}
          face={face}
        />
      ))}
      {/* Every number over every tower — see the note at the top of siege-tower.tsx. */}
      {wall.map(({ tower, x, y }) => (
        <TowerNumber
          key={tower.id}
          tower={tower}
          x={x}
          y={y}
          ink={ink}
          line={line}
          face={face}
        />
      ))}
      {siege.warriors.map((warrior) => (
        <SiegeWarrior
          key={warrior.id}
          warrior={warrior}
          now={now}
          from={GATE_DROP}
          to={ground}
          ink={ink}
          line={line}
          face={face}
        />
      ))}
      {/* The blows, over everything they were struck at. Each one is placed here rather
          than placing itself: where a tower stands is this file's own answer, and where a
          man had got to is the walk siege-warrior.tsx reads off the clock, taken at the
          moment of the press and carried on the blow because by now he is gone. */}
      {struck.map((blow) => {
        const cut = blow.warrior
        const stood = wall.find(({ tower }) => tower.id === blow.tower?.id)
        if (cut === null && stood === undefined) return null
        return (
          <SiegeBlow
            key={blow.id}
            blow={blow}
            x={
              cut !== null
                ? Math.sin(cut.at * Math.PI) * cut.lane * LANE_REACH
                : (stood?.x ?? 0)
            }
            y={
              cut !== null
                ? GATE_DROP + (ground - GATE_DROP) * cut.at
                : (stood?.y ?? 0) - STRUCK_AT
            }
            fromY={ground}
            ink={ink}
            line={line}
            dust={hatch}
            blood={blood}
            face={face}
          />
        )
      })}
    </Animated.View>
  )
}
