import { useEffect } from 'react'
import { Text } from 'react-native'
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated'

import { SiegeSoldier } from '@/components/game/siege-soldier'
import { CUT_MS } from '@/constants/ambush'
import { WARRIOR_SIZE } from '@/constants/siege'
import { mapLabel } from '@/constants/theme'
import type { Cut } from '@/machines/ambush'

// A bandit going down, where he was standing when the press landed.
//
// A component of its own because by the time the screen hears about a cut the man is out of
// the band: what is drawn here is a copy, held for exactly as long as it takes him to fall.
// The same arrangement the siege has for a warrior an arrow reaches — see the `Falling` half
// of siege-blow.tsx — and the same drawing, so a man does not change shape at the moment he
// is answered.
//
// He is not struck by anything crossing the ground. A siege looses an arrow because the
// hero is standing a field away from what it is shooting at and the player has to see the
// cause reach the effect; in an ambush the man is already within reach, and a shot would be
// a second thing happening in the moment the player is reading their own answer land.

const SIZE = WARRIOR_SIZE
const FONT = 6.5

// How far he drops as he goes, in map points. Enough to read as falling rather than fading.
const DROP = 5

export function BanditCut({
  cut,
  ground,
  ink,
  line,
  face,
}: {
  cut: Cut
  ground: number
  ink: string
  line: string
  face: string
}) {
  const fall = useSharedValue(0)

  useEffect(() => {
    fall.value = withTiming(1, { duration: CUT_MS, easing: Easing.in(Easing.quad) })
  }, [])

  // Where he stood: his own bearing, at what was left of his walk when the sum arrived.
  const out = ground * cut.from * (1 - cut.at)
  const x = Math.sin(cut.bearing) * out
  const y = -Math.cos(cut.bearing) * out

  const going = useAnimatedStyle(() => ({
    opacity: 1 - fall.value,
    transform: [
      { translateX: x },
      { translateY: y + fall.value * DROP },
      { scale: 1 - fall.value * 0.25 },
    ],
  }))

  return (
    <Animated.View
      pointerEvents="none"
      className="absolute items-center justify-center"
      style={[{ left: -SIZE / 2, top: -SIZE / 2, width: SIZE, height: SIZE }, going]}
    >
      <SiegeSoldier line={line} face={face} />
      <Text
        selectable={false}
        className="font-semibold"
        style={{ fontFamily: mapLabel, color: ink, fontSize: FONT }}
      >
        {cut.value}
      </Text>
    </Animated.View>
  )
}
