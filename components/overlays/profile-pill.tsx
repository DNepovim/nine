import { Ionicons } from '@expo/vector-icons'
import type { ComponentProps, ReactNode } from 'react'
import { Text, View } from 'react-native'

import { TrackedPressable } from '@/components/tracked-pressable'
import type { ButtonId } from '@/constants/buttons'
import { DIM_INK } from '@/constants/colors'
import { TYPE } from '@/constants/typography'
import { cn } from '@/lib/cn'

// The one shape a door on your own profile wears, in its two states.
//
// A nickname and a motto are each either written or not, and the card says so the same
// way for both: with nothing there, a pill naming what is missing; with something there,
// the same pill shrunk to the pencil alone and set beside the line it rewrites. One
// component rather than four, because the pill had already been written twice — once for
// the motto and once for the address — and the two had drifted into two hit areas and two
// paddings for what is meant to read as one control.
//
// The label is what decides which state this is, and that is not a shortcut: a pill with
// a word in it is an invitation to write something, and a pill without one can only be
// about the thing it sits next to. So the icon follows the label — a plus when there is
// something to add, a pencil when there is something to change — and a caller only names
// one when its errand is neither: the intro's own confirm line, which borrows this shape
// to say that an address is waiting on its code and would be lying with a plus on it.
const ICON = 11

export function ProfilePill({
  id,
  // Omitted for the pencil-only circle. Given — ADD MOTTO, ADD NICKNAME — for the wide
  // pill that stands in for the missing line itself.
  label,
  // Only where neither default tells the truth. See the note on `ICON`.
  icon,
  onPress,
}: {
  id: ButtonId
  label?: ReactNode
  icon?: ComponentProps<typeof Ionicons>['name']
  onPress: () => void
}) {
  const bare = label === undefined
  return (
    <TrackedPressable
      id={id}
      onPress={onPress}
      // Generous on both, and more so on the circle: it is the smaller target of the two
      // and the only one with no word to aim at.
      hitSlop={bare ? 12 : 8}
      className={cn(
        'flex-row items-center rounded-full bg-card',
        bare ? 'p-1.5' : 'gap-1 px-3 py-1',
      )}
    >
      <Ionicons
        name={icon ?? (bare ? 'create-outline' : 'add')}
        size={ICON}
        color={DIM_INK}
      />
      {!bare && (
        <Text selectable={false} className={cn(TYPE.sectionLabel, 'text-dim')}>
          {label}
        </Text>
      )}
    </TrackedPressable>
  )
}

// What the circle takes up, for the two lines that float one beside themselves. They pad
// by this so a line that runs the width of the card wraps rather than running under the
// button — and pad by it on *both* sides, which is what keeps the text centred in the
// card rather than centred in what is left of it.
export const PILL_INSET = 'px-7'

// The circle, placed beside a line without taking part in centring it. Pinned to the
// right edge of the row and centred against however many lines the text came to, which
// for a fifty-character motto on a narrow phone is two.
export function ProfilePillFloat({ children }: { children: ReactNode }) {
  return (
    <View className="absolute bottom-0 right-0 top-0 justify-center">{children}</View>
  )
}
