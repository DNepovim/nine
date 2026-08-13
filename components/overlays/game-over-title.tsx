import { useEffect } from 'react'
import { View } from 'react-native'
import { Easing, useSharedValue, withRepeat, withTiming } from 'react-native-reanimated'

import type { TitleWords } from '@/lib/game-over-title'
import { lerpColor, MODE_GRADIENT, type Mode } from '@/machines/game'

import { AnimatedLetter } from './animated-letter'

const TOTAL_LETTERS = 8

// The animated wordmark over the game-over screen — two rows of gradient-cycling,
// floating letters. Shared between the game-over overlay and the in-game dying
// sequence so the title can hand off seamlessly from one to the other.
//
// The words come from `gameOverTitle`, which says what the run was worth rather than
// that it ended. Two four-letter words: the letter index, its colour along the mode
// gradient and its entrance delay are all derived from a position in a 4×2 grid, so a
// longer word would land off the end of that ramp.
export function GameOverTitle({
  gameMode,
  words,
}: {
  gameMode: Mode
  words: TitleWords
}) {
  const rows = words.map((word) => Array.from(word))
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
      {rows.map((word, rowIndex) => (
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
