import { Text, View } from 'react-native'

// One label + number pair in the best-scores line. The label stays in the shared
// dim ink; the number carries its own colour from the game spectrum so the four
// scores stay tellable apart at a glance.
export function BestScoreCell({
  label,
  value,
  color,
  digitFont,
}: {
  label: string
  value: number
  color: string
  digitFont: string
}) {
  return (
    <View className="flex-row items-baseline gap-1">
      <Text
        selectable={false}
        className="font-mono text-[8px] font-bold tracking-[1px] text-dim"
      >
        {label}
      </Text>
      <Text
        selectable={false}
        numberOfLines={1}
        className="text-[10px] tracking-[1px]"
        style={{ fontFamily: digitFont, color }}
      >
        {value}
      </Text>
    </View>
  )
}
