import type { ReactNode } from 'react'
import { Text, TextInput, View } from 'react-native'

import { TYPE } from '@/constants/typography'
import { cn } from '@/lib/cn'

// One labelled number on an admin form.
//
// Held as a string rather than a number, and that is the whole reason this is a component
// rather than a `TextInput` with a label over it: a half-typed figure is the admin's to
// finish, and a field that parsed per keystroke would turn "1" into one hour the moment
// somebody started typing "15". The caller parses when it commits.
export function AdminNumberField({
  label,
  value,
  onChange,
  editable = true,
  className,
}: {
  label: ReactNode
  value: string
  onChange: (next: string) => void
  editable?: boolean
  // Placement only — a margin. Never the shape.
  className?: string
}) {
  return (
    <View className={cn('flex-1 gap-1', className)}>
      <Text selectable={false} className={cn(TYPE.caption, 'text-dim')}>
        {label}
      </Text>
      <TextInput
        value={value}
        onChangeText={onChange}
        inputMode="numeric"
        autoCorrect={false}
        editable={editable}
        placeholder="0"
        className={cn(
          TYPE.rowLabel,
          'h-10 rounded-lg border border-muted bg-card px-2.5 text-primary',
        )}
      />
    </View>
  )
}
