import type { ReactNode } from 'react'
import { Text, View } from 'react-native'

import { TYPE } from '@/constants/typography'
import { cn } from '@/lib/cn'

export function HowToPlayBullet({
  color,
  children,
}: {
  color: string
  children: ReactNode
}) {
  return (
    <View className="mt-2.5 flex-row gap-2.5">
      <View
        className="mt-[6px] h-1.5 w-1.5 rounded-full"
        style={{ backgroundColor: color }}
      />
      <Text selectable={false} className={cn(TYPE.prose, 'flex-1 text-primary')}>
        {children}
      </Text>
    </View>
  )
}
