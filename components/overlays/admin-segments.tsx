import type { ReactNode } from 'react'
import { Text, View } from 'react-native'

import { TrackedPressable } from '@/components/tracked-pressable'
import type { ButtonId } from '@/constants/buttons'
import { TYPE } from '@/constants/typography'
import { cn } from '@/lib/cn'

// A row of two to four states, as one control: the three objects the FEATURES screen is
// three views of, the three states a session can be in, the two a message can be in.
//
// One track with the chosen segment lifted out of it, rather than a row of loose pills.
// Loose pills had the problem a row of pills always has when it is *navigation*: nothing
// said the three belonged together, and only the chosen one was filled — so the two
// unchosen ones read as the buttons and the chosen one as a label.
//
// Deliberately short. This sits above a list, and every pixel it takes is a pixel of the
// list it is there to sort: 32 is the shortest a thumb can still hit reliably when the
// target is as wide as a third of the screen.
export function AdminSegments<T>({
  id,
  options,
  value,
  onSelect,
  className,
}: {
  id: ButtonId
  options: readonly { value: T; label: ReactNode }[]
  value: T
  onSelect: (value: T) => void
  // Placement only — a margin. Never the shape.
  className?: string
}) {
  return (
    <View
      className={cn('flex-row rounded-xl border border-muted bg-card p-0.5', className)}
    >
      {options.map((option) => {
        const active = option.value === value
        return (
          <TrackedPressable
            key={String(option.value)}
            id={id}
            onPress={() => {
              onSelect(option.value)
            }}
            className={cn(
              'h-8 flex-1 items-center justify-center rounded-lg',
              active && 'bg-surface',
            )}
          >
            <Text
              selectable={false}
              numberOfLines={1}
              className={cn(TYPE.rowLabel, active ? 'text-primary' : 'text-dim')}
            >
              {option.label}
            </Text>
          </TrackedPressable>
        )
      })}
    </View>
  )
}
