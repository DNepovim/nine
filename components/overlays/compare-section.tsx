import type { ReactNode } from 'react'
import { Text, View } from 'react-native'

// One named block of the comparison — the career, or the boards.
//
// The table used to run as one column of figures with a single label two thirds of the way
// down it, which made the seven lifetime rows and the six board rows read as thirteen rows
// of the same thing. They are not: one half is what a player has done, the other is where
// they did it. A label apiece and a card under each is the cheapest way to say so, and it is
// the surface the rest of the app already separates blocks with.
export function CompareSection({
  label,
  children,
}: {
  label: string
  children: ReactNode
}) {
  return (
    <View className="gap-1">
      <Text
        selectable={false}
        className="font-mono text-[9px] font-black tracking-[2px] text-dim"
      >
        {label}
      </Text>
      <View className="rounded-2xl bg-card px-3 py-1.5">{children}</View>
    </View>
  )
}
