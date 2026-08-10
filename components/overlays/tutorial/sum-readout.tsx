import { View } from 'react-native'

import { ScoreDigit } from '@/components/game/score-digit'
import { useScoreDirection } from '@/hooks/use-score-direction'
import { valueProgress } from '@/lib/value-progress'

// The board total, rendered exactly as the game renders it above the dial.
export function SumReadout({ sum, isDark }: { sum: number; isDark: boolean }) {
  const direction = useScoreDirection(sum)

  return (
    <View className="flex-row justify-center">
      {String(sum)
        .split('')
        .map((digit, i, arr) => (
          <ScoreDigit
            key={arr.length - 1 - i}
            digit={digit}
            direction={direction}
            isDark={isDark}
            progress={valueProgress(sum)}
          />
        ))}
    </View>
  )
}
