import { Text } from 'react-native'
import Animated, { useAnimatedStyle, type SharedValue } from 'react-native-reanimated'

import { SiegeSoldier } from '@/components/game/siege-soldier'
import { WARRIOR_SIZE } from '@/constants/siege'
import { mapLabel } from '@/constants/theme'
import type { Bandit } from '@/machines/ambush'

// One bandit closing on the hero.
//
// Nothing about this is React state. The machine knows only when the band set off and how
// long each man takes; where one *is* comes off the wall clock on the UI thread, which is
// what keeps a fight with ten of them on the ground from re-rendering the whole map sixty
// times a second. The only two things React hears about are the cut and the arrival.
//
// Drawn by `SiegeSoldier`, which is the man a village sends out of its gate. The same
// drawing on purpose, and the one place this encounter leans on the siege rather than
// differing from it: a man with a sword and a number on his shield is a man with a sword and
// a number on his shield, and what tells a player which fight they are in is where the men
// are standing — a ring round the hero rather than a line coming down at it. Two drawings
// would be two answers to a question nobody was asking.
//
// He walks in along his own bearing rather than down a lane, which is the whole difference
// in the geometry: `bearing` is the direction out from the hero that he started in, taken
// inside the field's own turned-back view, where up the screen is the way the hero was
// walking. So a man at nought is standing on the road ahead and one at π is on the road
// behind, and the rest are spread round the two.

const SIZE = WARRIOR_SIZE
const FONT = 6.5

// How long a man takes to be there. Short: the band is whole from the first frame and this
// is only so that ten men do not appear between two of them — the camera has just landed,
// and something arriving with no motion at all under a camera that is still settling reads
// as a dropped frame.
const IN_MS = 220

export function BanditMark({
  bandit,
  now,
  ground,
  ink,
  line,
  face,
}: {
  bandit: Bandit
  // The wall clock, sampled every frame. The one clock a bandit can be measured against:
  // `spawnedAt` is a `Date.now()` and a pause moves it by a `Date.now()` difference, so
  // anything counting frames would have to be rebased onto this one — and a rebase taken
  // once goes wrong the first time the phone sleeps. See arcade-game.tsx.
  now: SharedValue<number>
  // How far the furthest man of this band stands, in map points. Each one stands at his own
  // share of it — see `from` on a bandit, which is his arrival read backwards.
  ground: number
  ink: string
  line: string
  face: string
}) {
  const walk = useAnimatedStyle(() => {
    const elapsed = now.value - bandit.spawnedAt
    const t = Math.min(1, Math.max(0, elapsed / bandit.walkMs))
    // Straight in. A warrior bows out and back because he leaves one gate and arrives at one
    // hero and the ground between is all he has to differ by; a band is already spread round
    // the whole circle, and a curve on top of that would only blur which man is nearest.
    const out = ground * bandit.from * (1 - t)
    return {
      opacity: Math.min(1, Math.max(0, elapsed / IN_MS)),
      transform: [
        { translateX: Math.sin(bandit.bearing) * out },
        { translateY: -Math.cos(bandit.bearing) * out },
      ],
    }
  })

  return (
    <Animated.View
      pointerEvents="none"
      className="absolute items-center justify-center"
      style={[{ left: -SIZE / 2, top: -SIZE / 2, width: SIZE, height: SIZE }, walk]}
    >
      <SiegeSoldier line={line} face={face} />
      <Text
        selectable={false}
        className="font-semibold"
        style={{ fontFamily: mapLabel, color: ink, fontSize: FONT }}
      >
        {bandit.value}
      </Text>
    </Animated.View>
  )
}
