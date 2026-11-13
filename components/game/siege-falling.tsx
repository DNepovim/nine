import { Text } from 'react-native'
import Animated, { useAnimatedStyle, type SharedValue } from 'react-native-reanimated'

import { SiegeSoldier } from '@/components/game/siege-soldier'
import { ARROW_MS, BLOW_MS, WARRIOR_SIZE } from '@/constants/siege'
import { mapLabel } from '@/constants/theme'

// How long the man stands after the arrow reaches him before he goes. Short — he is dead
// when it lands, and this is the beat it takes to fall rather than a stagger.
const FALL_MS = 180

// The man, for as long as it takes him to fall.
//
// He is already out of the fight — his number stopped answering the instant the press
// landed — so this is a drawing of someone who is no longer there. It has to be: without it
// he would vanish on the key and the arrow would arrive at open ground.
export function SiegeFalling({
  clock,
  value,
  ink,
  line,
  face,
}: {
  clock: SharedValue<number>
  value: number
  ink: string
  line: string
  face: string
}) {
  const hold = ARROW_MS / BLOW_MS
  const gone = (ARROW_MS + FALL_MS) / BLOW_MS

  const falling = useAnimatedStyle(() => {
    const k = Math.min(1, Math.max(0, (clock.value - hold) / (gone - hold)))
    return {
      opacity: 1 - k,
      transform: [{ scale: 1 + k * 0.4 }],
    }
  })

  return (
    <Animated.View
      pointerEvents="none"
      className="absolute items-center justify-center"
      style={[
        {
          left: -WARRIOR_SIZE / 2,
          top: -WARRIOR_SIZE / 2,
          width: WARRIOR_SIZE,
          height: WARRIOR_SIZE,
        },
        falling,
      ]}
    >
      <SiegeSoldier line={line} face={face} />
      <Text
        selectable={false}
        className="font-semibold"
        style={{ fontFamily: mapLabel, color: ink, fontSize: 6.5 }}
      >
        {value}
      </Text>
    </Animated.View>
  )
}
