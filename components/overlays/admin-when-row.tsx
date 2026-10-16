import type { ReactNode } from 'react'
import { Text, View } from 'react-native'

import { TYPE } from '@/constants/typography'
import { cn } from '@/lib/cn'

// One instant, stated rather than offered.
//
// What the session form draws in place of a `DateTimeField` once a window is live: the
// same label, the same figure, and no way in. A picker that refused on tap would say the
// same thing a beat later and only to somebody who tried.
export function WhenRow({ label, at }: { label: ReactNode; at: string }) {
  return (
    <View className="h-10 flex-row items-center justify-between">
      <Text selectable={false} className={cn(TYPE.caption, 'text-dim')}>
        {label}
      </Text>
      <Text selectable={false} className={cn(TYPE.rowLabel, 'text-primary')}>
        {at}
      </Text>
    </View>
  )
}
