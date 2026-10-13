import { useEffect, useState } from 'react'
import Animated, { useAnimatedStyle, type SharedValue } from 'react-native-reanimated'

import { BanditCut } from '@/components/game/bandit-cut'
import { BanditMark } from '@/components/game/bandit-mark'
import { CUT_MS } from '@/constants/ambush'
import type { Ambush, Cut } from '@/machines/ambush'

// Everything an ambush puts on the sheet: the men standing round the hero, and whichever of
// them are still going down.
//
// A component of its own for the reason siege-field.tsx is one — arcade-game.tsx is already
// the longest file in the app — and laid out the same way, inside a single view that takes
// the sheet's turn back out. Inside it, up the screen is the way the hero was walking, which
// is what lets a man's place be a bearing and a distance and nothing else.
//
// What it is *not* is a place. A siege is a field in front of a wall, with a near side and a
// far one and a gate to come out of; this is a stretch of open road with the hero in the
// middle of it, and everything here follows from there being no favoured direction. The men
// are on a ring, not a slope. There is no ground drawn under them and no wall over them —
// the road is already on the sheet, the country behind it is faded, and the band is the
// whole of the picture.

// Every cut the fight has made that is still being drawn.
//
// A list rather than the one the ambush is carrying, because a cut is a moment and the state
// only ever holds the last of them: two answers a fifth of a second apart are two men going
// down at once, and keying a single view on the latest would snap the first one upright
// again. Each is dropped on its own timer, `CUT_MS` after it landed. The same shape the
// siege keeps its blows in.
const without = (id: number) => (list: readonly Cut[]) =>
  list.filter((each) => each.id !== id)

function useCuts(cut: Cut | null): readonly Cut[] {
  const [falling, setFalling] = useState<readonly Cut[]>([])
  const id = cut?.id ?? null

  useEffect(() => {
    if (cut === null || id === null) return
    setFalling((list) => [...list, cut])
    const over = setTimeout(() => {
      setFalling(without(id))
    }, CUT_MS)
    return () => {
      clearTimeout(over)
    }
  }, [id])

  return falling
}

export function AmbushField({
  ambush,
  now,
  turn,
  heroX,
  heroY,
  ground,
  ink,
  line,
  face,
}: {
  ambush: Ambush
  // The wall clock, sampled on every frame — the clock a bandit's `spawnedAt` is stamped on.
  // See the note where it is taken, in arcade-game.tsx.
  now: SharedValue<number>
  // The sheet's own turn, taken back out. One rotation for the whole band rather than one
  // per man: they are a ring round one point, and turning each about its own feet would
  // leave the ring the right shape and every man in it leaning.
  turn: SharedValue<number>
  // Where the hero is *drawn*, which is the middle of this fight and the point every man
  // in it is walking at.
  heroX: number
  heroY: number
  // How far the furthest man stands, in map points — see `ambushFrame`, which fits it to
  // the canvas.
  ground: number
  ink: string
  line: string
  face: string
}) {
  const upright = useAnimatedStyle(() => ({
    transform: [{ rotate: `${-turn.value}rad` }],
  }))
  const falling = useCuts(ambush.cut)

  return (
    <Animated.View
      pointerEvents="none"
      className="absolute"
      style={[{ left: heroX, top: heroY, width: 0, height: 0 }, upright]}
    >
      {/* The men who are down first, so a man still walking is never behind one who has
          already fallen in front of him. */}
      {falling.map((cut) => (
        <BanditCut
          key={cut.id}
          cut={cut}
          ground={ground}
          ink={ink}
          line={line}
          face={face}
        />
      ))}
      {ambush.bandits.map((bandit) => (
        <BanditMark
          key={bandit.id}
          bandit={bandit}
          now={now}
          ground={ground}
          ink={ink}
          line={line}
          face={face}
        />
      ))}
    </Animated.View>
  )
}
