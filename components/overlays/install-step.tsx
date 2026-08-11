import type { ReactNode } from 'react'
import { Text, View } from 'react-native'

// One numbered instruction. The glyph comes in as children because each step
// points at a different piece of browser furniture — one is an icon, the other
// is a shape Ionicons doesn't have.
export function InstallStep({
  step,
  label,
  children,
}: {
  step: number
  label: string
  children: ReactNode
}) {
  return (
    <View className="flex-row items-center gap-3 rounded-2xl bg-card px-4 py-3">
      <Text
        selectable={false}
        className="font-mono text-[12px] font-black tracking-[1px] text-dim"
      >
        {step}
      </Text>
      {children}
      <Text selectable={false} className="flex-1 font-mono text-[12px] text-primary">
        {label}
      </Text>
    </View>
  )
}
