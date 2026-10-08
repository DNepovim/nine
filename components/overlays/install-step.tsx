import type { ReactNode } from 'react'
import { Text, View } from 'react-native'

import { TYPE } from '@/constants/typography'
import { cn } from '@/lib/cn'

// One numbered instruction. The glyph comes in as children because each step
// points at a different piece of browser furniture — one is an icon, the other
// is a shape Ionicons doesn't have.
export function InstallStep({
  step,
  label,
  children,
}: {
  step: number
  // A node so the caller can hand it a <Trans>.
  label: ReactNode
  children: ReactNode
}) {
  return (
    <View className="flex-row items-center gap-3 rounded-2xl bg-card px-4 py-3">
      <Text selectable={false} className={cn(TYPE.prose, 'text-dim')}>
        {step}
      </Text>
      {children}
      <Text selectable={false} className={cn(TYPE.prose, 'flex-1 text-primary')}>
        {label}
      </Text>
    </View>
  )
}
