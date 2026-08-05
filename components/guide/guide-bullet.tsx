import { Text, View } from 'react-native'

export function GuideBullet({ color, children }: { color: string; children: string }) {
  return (
    <View className="mt-2.5 flex-row gap-2.5">
      <View
        className="mt-[6px] h-1.5 w-1.5 rounded-full"
        style={{ backgroundColor: color }}
      />
      <Text
        selectable={false}
        className="flex-1 font-mono text-[12px] font-medium leading-[19px] text-primary"
      >
        {children}
      </Text>
    </View>
  )
}
