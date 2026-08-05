import { Text, View } from 'react-native'

// Shared top block for every lesson: the screen's name and its explanation.
export function LessonHeading({
  title,
  color,
  children,
}: {
  title: string
  color: string
  children: string
}) {
  return (
    <View className="mt-4">
      <Text
        selectable={false}
        className="font-mono text-[19px] font-black tracking-[2.5px]"
        style={{ color }}
      >
        {title}
      </Text>
      <Text
        selectable={false}
        className="mt-2 font-mono text-[12px] font-medium leading-[19px] text-dim"
      >
        {children}
      </Text>
    </View>
  )
}
