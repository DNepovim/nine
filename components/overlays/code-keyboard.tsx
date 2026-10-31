import { LinearGradient } from 'expo-linear-gradient'
import { Text, View } from 'react-native'

import { TrackedPressable } from '@/components/tracked-pressable'
import type { ButtonId } from '@/constants/buttons'
import { GLYPH } from '@/constants/typography'

const KEY_ROWS = [
  [1, 2, 3],
  [4, 5, 6],
  [7, 8, 9],
] as const

// What one key is painted in when the caller paints it rather than the keypad: a fill (two
// stops, the same twice for a flat one) and the ink its digit is drawn in.
export type KeyPaint = { fill: readonly [string, string]; ink: string }

// How the keys are painted: tinted from one accent pair, all alike — the room code — or
// key by key, by whatever the caller says each digit is worth — the **rating**, whose keys
// wear the colour a dial key wears at that value.
type Paint =
  | { accentColors: readonly [string, string]; keyPaint?: never }
  | { keyPaint: (key: number) => KeyPaint; accentColors?: never }

// The nine keys, and nothing about what pressing one means — that is the caller's.
//
// It used to own the room code's four-digit cap and take the code itself as `value`,
// which made it a keypad for one field. The **rating** dialog is the caller that asked
// for it to be a keypad for anything: one press answers rather than four spelling, its
// keys are painted by value, and its two ends are faces. So `onKey` hands over the digit,
// the cap lives in `game-code-input.tsx`, and `keyPaint` and `faces` are the rating's.
export function CodeKeyboard({
  id,
  onKey,
  faces = {},
  ...paint
}: {
  id: ButtonId
  onKey: (key: number) => void
  // A face drawn in place of a key's digit. Asked for by the **rating** dialog, whose two
  // ends say how the player felt rather than which number they pressed; the room code
  // leaves it empty, since its keys are digits and nothing else.
  faces?: Readonly<Partial<Record<number, string>>>
} & Paint) {
  // Under the finger: the accent tint deepens, as it always has; a key painted by value
  // dims instead, since there is no one tint to deepen and its colour is the point.
  const paintOf = (key: number, pressed: boolean): KeyPaint & { opacity: number } => {
    if (paint.keyPaint !== undefined) {
      return { ...paint.keyPaint(key), opacity: pressed ? 0.7 : 1 }
    }
    const [c0, c1] = paint.accentColors
    return {
      fill: [c0 + (pressed ? '80' : '4D'), c1 + (pressed ? '70' : '38')],
      ink: c0,
      opacity: 1,
    }
  }

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
                const { fill, ink, opacity } = paintOf(n, pressed)
                const face = faces[n]
                return (
                  <LinearGradient
                    colors={fill}
                    // Across, like the dial's own 9, for a key painted by value; corner to
                    // corner for the room code, as its keys always were.
                    start={
                      paint.keyPaint === undefined ? { x: 0, y: 0 } : { x: 0, y: 0.5 }
                    }
                    end={paint.keyPaint === undefined ? { x: 1, y: 1 } : { x: 1, y: 0.5 }}
                    className="w-17 h-17 rounded-full items-center justify-center"
                    style={{ opacity }}
                  >
                    {face === undefined ? (
                      <Text
                        selectable={false}
                        className="font-mono text-[24px] font-black"
                        style={{ color: ink, includeFontPadding: false }}
                      >
                        {n}
                      </Text>
                    ) : (
                      <Text
                        selectable={false}
                        className={GLYPH['3xl']}
                        style={{ includeFontPadding: false }}
                      >
                        {face}
                      </Text>
                    )}
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
