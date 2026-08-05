import { Ionicons } from '@expo/vector-icons'
import { Pressable, Text, View } from 'react-native'

import { cn } from '@/lib/cn'

// Navigation sits at the top of the tutorial so the dial below can occupy the
// same space it does in the real game.
export function TutorialFooter({
  canAdvance,
  isFirst,
  isLast,
  dismissLabel,
  onPrev,
  onNext,
  onDismiss,
}: {
  canAdvance: boolean
  isFirst: boolean
  isLast: boolean
  dismissLabel: string
  onPrev: () => void
  onNext: () => void
  onDismiss: () => void
}) {
  return (
    <View className="mt-3 flex-row items-center gap-2">
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

      <Pressable
        onPress={onNext}
        disabled={!canAdvance}
        className={cn(
          'flex-row items-center justify-center gap-1 rounded-xl bg-strong px-5 py-2.5',
          !canAdvance && 'opacity-[0.3]',
        )}
      >
        <Text
          selectable={false}
          className="font-mono text-[11px] font-black tracking-[1.5px] text-on-strong"
        >
          {isLast ? 'PLAY TRAINEE' : 'NEXT'}
        </Text>
        <Ionicons name={isLast ? 'play' : 'chevron-forward'} size={13} color="#d8d2f4" />
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
