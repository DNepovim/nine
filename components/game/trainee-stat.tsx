import { Text, View } from 'react-native'

// One labelled figure in the Trainee stat row. Its own file per the code guide —
// no named component lives inside another's.
export function TraineeStat({ label, value }: { label: string; value: string }) {
  return (
    <View className="items-center">
      <Text
        selectable={false}
        className="font-mono text-[8px] font-bold tracking-[1px] text-dim"
      >
        {label}
      </Text>
      <Text
        selectable={false}
        className="font-mono text-[12px] font-bold tracking-[1px] text-primary"
      >
        {value}
      </Text>
    </View>
  )
}
