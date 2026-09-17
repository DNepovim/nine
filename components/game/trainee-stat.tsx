import type { ReactNode } from 'react'
import { Text, View } from 'react-native'

// One labelled figure in the Trainee stat row. Its own file per the code guide —
// no named component lives inside another's.
// `label` is a node so the caller can hand it a <Trans>; it renders inside the
// <Text> below exactly as a literal did. `value` stays a string — it is a number.
export function TraineeStat({ label, value }: { label: ReactNode; value: string }) {
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
