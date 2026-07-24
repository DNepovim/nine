import { LinearGradient } from 'expo-linear-gradient'
import { Pressable, Text, View } from 'react-native'

const KEY_ROWS = [
  [1, 2, 3],
  [4, 5, 6],
  [7, 8, 9],
] as const

export function CodeKeyboard({
  value,
  onChange,
  accentColors,
}: {
  value: string
  onChange: (v: string) => void
  accentColors: [string, string]
}) {
  const [c0, c1] = accentColors
  return (
    <View className="mt-3.5 gap-2">
      {KEY_ROWS.map((row, ri) => (
        <View key={ri} className="flex-row gap-2">
          {row.map((n) => (
            <Pressable
              key={n}
              onPress={() => {
                if (value.length < 4) onChange(value + String(n))
              }}
            >
              {({ pressed }) => (
                <LinearGradient
                  colors={[c0 + (pressed ? '80' : '4D'), c1 + (pressed ? '70' : '38')]}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                  className="w-17 h-17 rounded-full items-center justify-center"
                >
                  <Text
                    selectable={false}
                    className="font-mono text-[24px] font-black"
                    style={{ color: c0, includeFontPadding: false }}
                  >
                    {n}
                  </Text>
                </LinearGradient>
              )}
            </Pressable>
          ))}
        </View>
      ))}
    </View>
  )
}
