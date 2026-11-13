import type { ReactNode } from 'react'
import { Text, View } from 'react-native'

import { TYPE } from '@/constants/typography'
import { cn } from '@/lib/cn'

export function KnowledgeSection({
  title,
  children,
}: {
  title: ReactNode
  children: ReactNode
}) {
  return (
    <View className="mb-4 gap-1">
      <Text selectable={false} className={cn(TYPE.heading, 'text-primary')}>
        {title}
      </Text>
      {children}
    </View>
  )
}
