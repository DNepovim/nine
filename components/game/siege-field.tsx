import { View } from 'react-native'
import type { SharedValue } from 'react-native-reanimated'

import { SiegeTower, TOWER_DISC, TowerNumber } from '@/components/game/siege-tower'
import { SiegeWarrior } from '@/components/game/siege-warrior'
import { BUD_SIZE, HERO_SIZE } from '@/constants/arcade'
import { TOWERS_DEEP } from '@/constants/siege'
import type { Siege } from '@/machines/siege'

// Everything a siege puts on the sheet: the towers on the wall above, and whatever is
// crossing the ground between them and the hero.
//
// A component of its own because arcade-game.tsx is already the longest file in the app,
// and because this is the one part of the screen that is a *place* rather than the map.

// The ring the towers stand on, at its widest: the town's own wall, which is the circle
// town-mark.tsx puts its four quarter-towers on. The bud is gone by the time a siege
// starts — a crossroad under siege has no ways out yet, so nothing draws it — and this is
// the mark that stands in its place, built out of the same radius so a village is the same
// size whether you are looking at it or fighting it.
const WALL = BUD_SIZE / 2 - 1

// How wide the hero actually is where it is opaque.
//
// Not half of `HERO_SIZE`, which is what the flame's own size means and what this used to
// take. The hero is a stack of coats and the one that covers anything is `body`, at 0.78 of
// that size and 92% opaque — see COATS in arcade-hero.tsx. The coats outside it are a wisp
// at three tenths and read as glow rather than as cover.
const HERO_BODY = HERO_SIZE * 0.78

// How much ground the nearest tower's number has to keep between itself and the hero: its
// own disc, the hero's body coat, and a point of air. The hero is drawn over this whole
// field — it stands in front of the walls, which is right — so a tower *body* under it
// costs nothing. A number under it costs the player a number they cannot dial, which is the
// one thing this layout is not allowed to do. Measured against the body coat because a
// digit under 92% amber is a digit nobody will risk dialling, even though it is strictly
// still there.
const CLEAR = TOWER_DISC + HERO_BODY + 1

// The smallest wall that still fits the numbers standing on it: enough circumference for
// every tower's disc and a point between them. Below it the discs start crossing and a
// three-digit number loses its last digit to its neighbour, which is a fight nobody can
// read — and the cure costs nothing, because what gives instead is the wall standing a
// little further up the way, where there is room to spare.
//
// Across the chord between two neighbours rather than round the arc: the arc is the longer
// of the two and would have let a six-tower wall close by most of a point.
const least = (towers: number): number =>
  (TOWER_DISC * 2 + 1) / (2 * Math.sin(Math.PI / towers))

export function SiegeField({
  siege,
  now,
  turn,
  villageX,
  villageY,
  heroX,
  heroY,
  ink,
  line,
  face,
}: {
  siege: Siege
  // The wall clock, sampled on every frame — the clock a warrior's `spawnedAt` is stamped
  // on. See the note where it is taken, in arcade-game.tsx.
  now: SharedValue<number>
  turn: SharedValue<number>
  villageX: number
  villageY: number
  // Where the hero is *drawn*, not where the way it is standing on begins.
  heroX: number
  heroY: number
  ink: string
  line: string
  face: string
}) {
  const awayX = heroX - villageX
  const awayY = heroY - villageY
  const ground = Math.hypot(awayX, awayY) || 1

  // A deeper siege has more towers and a wider wall to hang them on, up to the town's own.
  // Six of them round a ring of `WALL` is about twenty-one points apiece, which is a tower
  // and a little air; the same spacing is what a four-tower wall gets by being smaller.
  const ring = Math.max(
    least(siege.towers.length),
    Math.min((WALL * siege.towers.length) / TOWERS_DEEP, ground - CLEAR),
  )

  // How far back from the crossroad the wall has to stand to keep that clearance.
  //
  // Nought almost always: on a phone of any size the stand-off leaves twenty-five points
  // or more between the hero and the village, and a wall of thirteen to twenty sits inside
  // that with room to spare. It is a short way on a small screen that bites — the ground
  // is measured in pitches and the wall is not — and there the ring slides up the way the
  // hero came until its near side clears. Nothing says where the middle of a village is
  // while a siege is on, because the bud that would have said it was absorbed on the walk
  // in, so the only thing this moves is the picture.
  //
  // The men still leave from the crossroad itself, which is now the near side of the wall:
  // the gate, which is exactly where a man should come out of.
  const back = Math.max(0, ring + CLEAR - ground)
  const wallX = villageX - (awayX / ground) * back
  const wallY = villageY - (awayY / ground) * back

  // Back to front. The wall is drawn standing up on a sheet that is a plan, so the near
  // side of the ring stands in front of the far side — and because every tower knocks the
  // ground out behind it, drawing them in that order is all it takes for the overlap to
  // read as depth rather than as a collision. Sorted on the map's own y rather than the
  // screen's: the sheet's turn is a fraction of a radian at a crossroad and would not
  // reorder a pair, and ordering that changed as the sheet came round would be a flicker.
  const wall = siege.towers
    .map((tower) => ({
      tower,
      x: wallX + Math.cos(tower.angle) * ring,
      y: wallY + Math.sin(tower.angle) * ring,
    }))
    .sort((a, b) => a.y - b.y)

  return (
    <View className="absolute inset-0" pointerEvents="none">
      {wall.map(({ tower, x, y }) => (
        <SiegeTower
          key={tower.id}
          tower={tower}
          x={x}
          y={y}
          turn={turn}
          line={line}
          face={face}
        />
      ))}
      {/* Every number over every wall — see the note at the top of siege-tower.tsx. */}
      {wall.map(({ tower, x, y }) => (
        <TowerNumber
          key={tower.id}
          tower={tower}
          x={x}
          y={y}
          turn={turn}
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
          fromX={villageX}
          fromY={villageY}
          toX={heroX}
          toY={heroY}
          turn={turn}
          ink={ink}
          line={line}
          face={face}
        />
      ))}
    </View>
  )
}
