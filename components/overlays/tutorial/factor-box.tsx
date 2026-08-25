import { Text, View } from 'react-native'

// One digit of the weight equation, boxed the way the multiplayer room code's
// digits are — the tutorial borrowing a shape the player has already met, rather
// than inventing a new one for a single screen.
export function FactorBox({ value, color }: { value: number; color: string }) {
  return (
    <View
      className="items-center justify-center rounded-[10px] border-2"
      style={{
        width: 40,
        height: 48,
        borderColor: `${color}80`,
        backgroundColor: `${color}12`,
      }}
    >
      <Text
        selectable={false}
        className="font-mono text-[20px] font-black"
        style={{ color }}
      >
        {value}
      </Text>
    </View>
  )
}
