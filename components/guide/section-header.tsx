import { Ionicons } from '@expo/vector-icons'
import { Text, View } from 'react-native'

export type IoniconName = keyof typeof Ionicons.glyphMap

export function SectionHeader({
  icon,
  title,
  color,
}: {
  icon: IoniconName
  title: string
  color: string
}) {
  return (
    <View className="mb-3 mt-8 flex-row items-center gap-2.5">
      <View
        className="h-7 w-7 items-center justify-center rounded-lg"
        style={{ backgroundColor: `${color}26` }}
      >
        <Ionicons name={icon} size={15} color={color} />
      </View>
      <Text
        selectable={false}
        className="font-mono text-[15px] font-black tracking-[2px] text-primary"
      >
        {title}
      </Text>
    </View>
  )
}
