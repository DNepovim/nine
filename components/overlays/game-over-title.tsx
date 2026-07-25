import { useEffect } from 'react'
import { View } from 'react-native'
import { Easing, useSharedValue, withRepeat, withTiming } from 'react-native-reanimated'

import { lerpColor, MODE_GRADIENT, type Mode } from '@/machines/game'

import { AnimatedLetter } from './animated-letter'

const ROWS = [
  ['G', 'A', 'M', 'E'],
  ['O', 'V', 'E', 'R'],
]
const TOTAL_LETTERS = 8

// The animated "GAME OVER" wordmark — two rows of gradient-cycling, floating
// letters. Shared between the game-over overlay and the in-game dying sequence
// so the title can hand off seamlessly from one to the other.
export function GameOverTitle({ gameMode }: { gameMode: Mode }) {
  const gradPhase = useSharedValue(0)
  const gradStartSv = useSharedValue<string>(MODE_GRADIENT[gameMode][0])
  const gradEndSv = useSharedValue<string>(MODE_GRADIENT[gameMode][1])

  useEffect(() => {
    gradPhase.value = withRepeat(
      withTiming(1, { duration: 2000, easing: Easing.linear }),
      -1,
      false,
    )
  }, [gradPhase])

  return (
    <View className="items-center gap-1">
      {ROWS.map((word, rowIndex) => (
        <View key={rowIndex} className="flex-row gap-3">
          {word.map((char, colIndex) => {
            const globalIndex = rowIndex * 4 + colIndex
            const tBase = globalIndex / (TOTAL_LETTERS - 1)
            return (
              <AnimatedLetter
                key={globalIndex}
                char={char}
                color={lerpColor(
                  MODE_GRADIENT[gameMode][0],
                  MODE_GRADIENT[gameMode][1],
                  tBase,
                )}
                tBase={tBase}
                gradStart={gradStartSv}
                gradEnd={gradEndSv}
                gradPhase={gradPhase}
                mode={gameMode}
                delay={globalIndex * 80}
                letterIndex={globalIndex % 4}
              />
            )
          })}
        </View>
      ))}
    </View>
  )
}
