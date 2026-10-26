import { View } from 'react-native'

import { ScoreDigit } from '@/components/game/score-digit'

// A short figure in the top bar's rolling digits, one `ScoreDigit` per character, in a
// row of its own. Keyed from the right, so a figure that grows a digit adds it on the
// left and the ones already standing keep their places rather than all rolling at once.
//
// Shared by the two readouts at the top bar's centre — a run's average factor and, on a
// session measured by hits, its hit count — so a change to the digits' size or keying is
// made once.
export function DigitStrip({ text, direction }: { text: string; direction: 1 | -1 }) {
  return (
    <View className="flex-row">
      {text.split('').map((digit, i, arr) => (
        <ScoreDigit
          key={arr.length - 1 - i}
          digit={digit}
          direction={direction}
          progress={0}
          size={16}
        />
      ))}
    </View>
  )
}
