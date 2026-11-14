import { LinearGradient } from 'expo-linear-gradient'
import type { ReactNode } from 'react'
import { Text } from 'react-native'

import { TrackedPressable } from '@/components/tracked-pressable'
import type { ButtonId } from '@/constants/buttons'
import { TYPE } from '@/constants/typography'
import { cn } from '@/lib/cn'

const shadow = {
  shadowColor: '#000',
  shadowOpacity: 0.3,
  shadowOffset: { width: 0, height: 6 },
  shadowRadius: 12,
}

// The intro's gradient call to action: PLAY GAME under the ALONE panel, CREATE ROOM in the
// WITH FRIENDS one. One button in the two places, so the pair cannot drift apart.
export function IntroCta({
  id,
  onPress,
  disabled,
  colors,
  label,
}: {
  id: ButtonId
  onPress: () => void
  // Drawn at 40% while it is.
  disabled: boolean
  // The dark pair the gradient runs across.
  colors: readonly [string, string]
  label: ReactNode
}) {
  return (
    <TrackedPressable
      id={id}
      onPress={onPress}
      disabled={disabled}
      className={cn('w-56 overflow-hidden rounded-2xl', disabled && 'opacity-40')}
      style={shadow}
    >
      <LinearGradient
        colors={[...colors]}
        start={{ x: 0, y: 0.5 }}
        end={{ x: 1, y: 0.5 }}
        className="items-center py-4"
      >
        <Text selectable={false} className={cn(TYPE.button, 'text-on-strong')}>
          {label}
        </Text>
      </LinearGradient>
    </TrackedPressable>
  )
}
