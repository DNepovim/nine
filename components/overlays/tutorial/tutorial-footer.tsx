import { Ionicons } from '@expo/vector-icons'
import { Pressable, Text, View } from 'react-native'

import { cn } from '@/lib/cn'

// The top bar carries only Back and the dismiss link. Moving forward is the
// lesson's job — completing a task advances by itself, and screens with nothing
// to do place their own Next button somewhere that makes sense.
export function TutorialFooter({
  isFirst,
  dismissLabel,
  onPrev,
  onDismiss,
}: {
  isFirst: boolean
  dismissLabel: string
  onPrev: () => void
  onDismiss: () => void
}) {
  return (
    <View className="mt-3 flex-row items-center">
      <Pressable
        onPress={onPrev}
        disabled={isFirst}
        className={cn(
          'flex-row items-center gap-1 rounded-xl bg-card px-3 py-2.5',
          isFirst && 'opacity-[0.3]',
        )}
      >
        <Ionicons name="chevron-back" size={13} color="#aaa69e" />
        <Text
          selectable={false}
          className="font-mono text-[11px] font-black tracking-[1px] text-dim"
        >
          BACK
        </Text>
      </Pressable>

      <View className="flex-1" />

      <Pressable onPress={onDismiss} className="py-2.5 pl-2">
        <Text
          selectable={false}
          className="font-mono text-[10px] font-bold tracking-[1px] text-dim underline"
        >
          {dismissLabel}
        </Text>
      </Pressable>
    </View>
  )
}
