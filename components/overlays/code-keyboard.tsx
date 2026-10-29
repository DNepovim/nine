import { LinearGradient } from 'expo-linear-gradient'
import { Text, View } from 'react-native'

import { TrackedPressable } from '@/components/tracked-pressable'
import type { ButtonId } from '@/constants/buttons'
import { ON_STRONG_INK } from '@/constants/colors'

const KEY_ROWS = [
  [1, 2, 3],
  [4, 5, 6],
  [7, 8, 9],
] as const

// The nine keys, and nothing about what pressing one means — that is the caller's.
//
// It used to own the room code's four-digit cap and take the code itself as `value`,
// which made it a keypad for one field. The **rating** dialog is the caller that asked
// for it to be a keypad for anything: it presses one key to choose rather than four to
// spell, and wants the chosen key to stay lit. So `onKey` hands over the digit, the cap
// lives in `game-code-input.tsx`, and `lit` is the one key worn in full.
export function CodeKeyboard({
  id,
  onKey,
  accentColors,
  lit = null,
}: {
  id: ButtonId
  onKey: (key: number) => void
  accentColors: [string, string]
  // The key drawn chosen — the pair at full strength. Null for a keypad nothing is chosen on —
  // the room code, whose keys only flash under the finger.
  lit?: number | null
}) {
  const [c0, c1] = accentColors
  return (
    <View className="mt-3.5 gap-2">
      {KEY_ROWS.map((row, ri) => (
        <View key={ri} className="flex-row gap-2">
          {row.map((n) => (
            <TrackedPressable
              id={id}
              key={n}
              onPress={() => {
                onKey(n)
              }}
            >
              {({ pressed }) => {
                // A key flashed under the finger is a tint; a chosen key is the pair at
                // full strength with the strong-button ink on it. The two used to be the
                // same tint, and on a challenge with a pale pair the chosen key read as
                // barely a shade darker than its neighbours.
                const chosen = n === lit
                const fill: [string, string] = chosen
                  ? [c0, c1]
                  : [c0 + (pressed ? '80' : '4D'), c1 + (pressed ? '70' : '38')]
                return (
                  <LinearGradient
                    colors={fill}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                    className="w-17 h-17 rounded-full items-center justify-center"
                  >
                    <Text
                      selectable={false}
                      className="font-mono text-[24px] font-black"
                      style={{
                        color: chosen ? ON_STRONG_INK : c0,
                        includeFontPadding: false,
                      }}
                    >
                      {n}
                    </Text>
                  </LinearGradient>
                )
              }}
            </TrackedPressable>
          ))}
        </View>
      ))}
    </View>
  )
}
