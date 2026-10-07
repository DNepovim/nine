import { Text } from 'react-native'
import Animated, { useAnimatedStyle, type SharedValue } from 'react-native-reanimated'

import { SiegeSoldier } from '@/components/game/siege-soldier'
import { LANE_REACH, WARRIOR_SIZE } from '@/constants/siege'
import { mapLabel } from '@/constants/theme'
import type { Warrior } from '@/machines/siege'

// One warrior crossing the ground between the gate and the hero.
//
// Nothing about this is React state. The hook knows only when a warrior left and how long
// it takes; where it *is* comes off the wall clock on the UI thread, which is what keeps
// a fight with three of them on the ground from re-rendering the whole map sixty times a
// second. The only three things React hears about are the spawn, the kill and the arrival.
//
// Straight down the field, because the field is straight: this is drawn inside the one
// turned-back view the whole fight sits in — see the note at the top of siege-field.tsx —
// where the wall is across the top and the hero is at the bottom. So a man's walk is a `y`
// and his lane is an `x`, and nothing in here has to know which way the sheet is lying.

// A man, in map points — about 30 on the screen at the siege zoom, which is half again
// under the hero he is walking at. Three digits is as long as a sum on this dial gets, and
// at this size they clear the inside of the disc with a couple of points to spare.
//
// In constants/siege.ts rather than here, because the blow that cuts him down has to draw
// him too: by the time the screen hears about a kill he is out of the list, so what the
// arrow arrives at is a copy — see siege-blow.tsx.
const SIZE = WARRIOR_SIZE
const FONT = 6.5

// How far off the straight a lane carries a man at the middle of his walk — and the same
// number the blow that cuts him down places him by, which is why it is a constant rather
// than a local.
//
// `lane` is in radians off straight and runs over `LANE_SPREAD`. At the two ends of that
// spread two men pass four or five men apart, well out towards the sides of the ground.
// That is the *widest* they are ever drawn, not the closest — the lane is rolled uniformly,
// so two men can come out of the gate on lines a hair apart and nothing here would hold
// them off each other. What does hold them apart is the gate's own gap: they leave seconds
// rather than frames apart, so two on near-identical lines are still at different points
// along it. The lane is what stops that gap from being the *only* thing keeping them apart
// as it decays with the depth — and what keeps three men from coming down the field in
// single file when the field is most of the screen.
//
// In points rather than as a fraction of the walk, because the walk is as long as the
// screen is tall and the two are not the same measure: a fraction of it would fan the men
// wider on a tall phone, where they already have the ground to be apart on, and bring them
// together on a short one, where they do not.

// How long a man takes to be on the ground. Not a fade — he grows out of the gate, which is
// the same beat a tower takes to settle after a hit.
const OUT_MS = 220

export function SiegeWarrior({
  warrior,
  now,
  from,
  to,
  ink,
  line,
  face,
}: {
  warrior: Warrior
  // The wall clock, sampled on every frame. The one clock a warrior can be measured
  // against: `spawnedAt` is a `Date.now()` and a pause moves it by a `Date.now()`
  // difference, so anything counting frames would have to be rebased onto this one — and a
  // rebase taken once goes wrong the first time the phone sleeps. See arcade-game.tsx.
  now: SharedValue<number>
  // How far down the field he steps out of the gate, and how far down it the hero is
  // standing. Both measured from the wall's own foot line.
  from: number
  to: number
  ink: string
  line: string
  face: string
}) {
  const bow = warrior.lane * LANE_REACH

  const walk = useAnimatedStyle(() => {
    const elapsed = now.value - warrior.spawnedAt
    const t = Math.min(1, Math.max(0, elapsed / warrior.walkMs))
    // Nought at both ends and widest in the middle: they leave the one gate and arrive at
    // the one hero, and what differs is the ground they take to get there.
    const off = Math.sin(t * Math.PI) * bow
    return {
      transform: [
        { translateX: off },
        { translateY: from + (to - from) * t },
        { scale: Math.min(1, Math.max(0, elapsed / OUT_MS)) },
      ],
    }
  })

  return (
    <Animated.View
      pointerEvents="none"
      className="absolute items-center justify-center"
      style={[{ left: -SIZE / 2, top: -SIZE / 2, width: SIZE, height: SIZE }, walk]}
    >
      {/* The man himself, drawn once in siege-soldier.tsx and drawn again by the blow
          that cuts him down. He hangs his shield on this box's centre, so the number
          below still lands on it. */}
      <SiegeSoldier line={line} face={face} />
      <Text
        selectable={false}
        className="font-semibold"
        style={{ fontFamily: mapLabel, color: ink, fontSize: FONT }}
      >
        {warrior.value}
      </Text>
    </Animated.View>
  )
}
