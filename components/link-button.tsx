import { Ionicons } from '@expo/vector-icons'
import type { ComponentProps, ReactNode } from 'react'
import type { PressableProps } from 'react-native'
import { Text, View } from 'react-native'

import { TrackedPressable } from '@/components/tracked-pressable'
import type { ButtonId } from '@/constants/buttons'
import { DIM_INK } from '@/constants/colors'
import { TYPE } from '@/constants/typography'
import { cn } from '@/lib/cn'

// What a link fades to while it cannot be pressed — opacity, because there is no underline
// to drop. The same figure `email-code-modal.tsx` dims RESEND by.
const DISABLED_OPACITY = 0.4

// The quiet way out — CLOSE, NOT NOW, RESEND, CHANGE EMAIL: an icon, a 10pt label in dim
// ink, and no underline. `PrimaryButton`'s quiet sibling.
//
// One component because the link was written out by hand at every call site, and the
// hand-written copies drifted: some kept an underline and lost the icon, which is what
// a new dialog then copied. See the link rule in the design-guide skill.
export function LinkButton({
  id,
  onPress,
  icon,
  label,
  disabled = false,
  className,
}: {
  id: ButtonId
  onPress: PressableProps['onPress']
  // Required: the icon is what says "pressable" without an underline.
  icon: ComponentProps<typeof Ionicons>['name']
  label: ReactNode
  disabled?: boolean
  // Placement only — `mt-*`, `self-center`, padding around the hit area. Never the look.
  className?: string
}) {
  return (
    <TrackedPressable
      id={id}
      onPress={onPress}
      disabled={disabled}
      hitSlop={10}
      className={className}
      style={{ opacity: disabled ? DISABLED_OPACITY : 1 }}
    >
      <View className="flex-row items-center justify-center gap-1">
        <Ionicons name={icon} size={10} color={DIM_INK} />
        <Text selectable={false} className={cn(TYPE.quietAction, 'text-dim')}>
          {label}
        </Text>
      </View>
    </TrackedPressable>
  )
}
