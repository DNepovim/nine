import type { ReactNode } from 'react'
import { Text, View } from 'react-native'

import { TYPE } from '@/constants/typography'
import { cn } from '@/lib/cn'

// One instant, stated rather than offered.
//
// What the session form draws for when a session runs. There was a picker here once; the
// **queue** sets the times now, so the form states them and offers no way in.
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
