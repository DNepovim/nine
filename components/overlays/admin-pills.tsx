import type { ReactNode } from 'react'
import { Text, View } from 'react-native'

import { TrackedPressable } from '@/components/tracked-pressable'
import type { ButtonId } from '@/constants/buttons'
import { TYPE } from '@/constants/typography'
import { cn } from '@/lib/cn'

// One of several, chosen by tapping it: the role on a person, the challenge a session
// airs, which window the analytics are read over.
//
// Four screens had written this row out — the tab row, the role picker, the challenge
// picker and the preview list — at three paddings and two label roles, and the drift was
// the kind nobody reports: the role pills were 1px shorter than the tabs above them. One
// row, one height, and a height that is now a thumb's rather than a caption's.
//
// A pill and not a dropdown, which is the shape these screens have always used: the
// catalog holds a couple of dozen challenges and the roles are a handful, so a row that
// wraps is the right failure for both, and a native picker per platform is not.
export type AdminPill<T> = {
  value: T
  // Not translated, by and large: these are role labels and database keys, which are rows
  // rather than copy. A caller whose options *are* copy passes nodes.
  label: ReactNode
}

export function AdminPills<T>({
  id,
  options,
  value,
  onSelect,
  busy = false,
  className,
}: {
  id: ButtonId
  options: readonly AdminPill<T>[]
  value: T
  onSelect: (value: T) => void
  // A write about the whole screen is in flight, so nothing here should answer. Dims the
  // options that are not the current one — the current one is already where the screen
  // says it is, and fading it would read as the choice being lost.
  busy?: boolean
  // Placement only — a margin. Never the shape.
  className?: string
}) {
  return (
    <View className={cn('flex-row flex-wrap gap-2', className)}>
      {options.map((option) => {
        const active = option.value === value
        return (
          <TrackedPressable
            key={String(option.value)}
            id={id}
            disabled={busy || active}
            onPress={() => {
              onSelect(option.value)
            }}
            // 40px tall, which is the row height the rest of this redesign settled on for
            // anything a thumb aims at. The pills used to be `py-1` — a 22px target in a
            // wrapping row of them.
            className={cn(
              'h-10 justify-center rounded-xl border px-3.5',
              active ? 'border-strong bg-strong' : 'border-muted bg-surface',
              busy && !active && 'opacity-40',
            )}
          >
            <Text
              selectable={false}
              className={cn(TYPE.buttonSm, active ? 'text-on-strong' : 'text-dim')}
            >
              {option.label}
            </Text>
          </TrackedPressable>
        )
      })}
    </View>
  )
}
