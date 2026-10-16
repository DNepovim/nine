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
//
// Two modes, as a discriminated union rather than a `multi` boolean beside a `value` that
// would then mean one thing or several:
//
//   `select`  one of them is chosen. The role on a person, the challenge a session airs.
//   `toggle`  any number are lit, and the set is the answer. The planner's status filters,
//             where picking one used to mean losing the other two.
//
// The filters were a segmented track before — one bordered rail with the chosen segment
// lifted out of it, which is the right shape for *navigation* between three views of one
// thing and the wrong one for a set. Loose chips with air between them read as several
// independent switches, because that is what they are.
type Mode<T> =
  | { mode?: 'select'; value: T; onSelect: (value: T) => void }
  | { mode: 'toggle'; lit: ReadonlySet<T>; onToggle: (value: T) => void }
export type AdminPill<T> = {
  value: T
  // Not translated, by and large: these are role labels and database keys, which are rows
  // rather than copy. A caller whose options *are* copy passes nodes.
  label: ReactNode
}

export function AdminPills<T>({
  id,
  options,
  busy = false,
  className,
  ...mode
}: {
  id: ButtonId
  options: readonly AdminPill<T>[]
  // A write about the whole screen is in flight, so nothing here should answer. Dims the
  // options that are not the current one — the current one is already where the screen
  // says it is, and fading it would read as the choice being lost.
  busy?: boolean
  // Placement only — a margin. Never the shape.
  className?: string
} & Mode<T>) {
  return (
    <View className={cn('flex-row flex-wrap gap-2', className)}>
      {options.map((option) => {
        const active =
          mode.mode === 'toggle'
            ? mode.lit.has(option.value)
            : option.value === mode.value
        return (
          <TrackedPressable
            key={String(option.value)}
            id={id}
            // A chosen pill in `select` mode is not pressable: it is already where the
            // screen says it is. A lit one in `toggle` mode very much is — turning it off
            // is half of what a toggle does.
            disabled={busy || (mode.mode !== 'toggle' && active)}
            onPress={() => {
              if (mode.mode === 'toggle') {
                mode.onToggle(option.value)
                return
              }
              mode.onSelect(option.value)
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
