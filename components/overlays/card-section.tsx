import type { ReactNode } from 'react'
import { Text, View } from 'react-native'

import { TYPE } from '@/constants/typography'
import { cn } from '@/lib/cn'

// One named block of a dialog: a label in the house's small caps, and the figures it
// names on a card under it.
//
// It started on the comparison, where a single column of thirteen figures with one label
// two thirds of the way down read as thirteen rows of the same thing. The profile and the
// medals dialog had the same problem and each had answered it differently — a bare heading
// over bare rows — so the three now share this. A reader moving between them is looking at
// one document in three places rather than three ways of drawing a table.
export function CardSection({
  // A node rather than a string: most callers have a `t` to hand, the medals dialog spells
  // its headings with `<Trans>` because one of them interpolates the length of the window.
  label,
  children,
}: {
  label: ReactNode
  children: ReactNode
}) {
  return (
    <View className="gap-1">
      <Text selectable={false} className={cn(TYPE.sectionLabel, 'text-dim')}>
        {label}
      </Text>
      <View className="rounded-2xl bg-card px-3 py-1.5">{children}</View>
    </View>
  )
}
