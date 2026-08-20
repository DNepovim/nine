import { Ionicons } from '@expo/vector-icons'
import { Pressable, Text, View } from 'react-native'

import { TutorialNextButton } from '@/components/overlays/tutorial/tutorial-next-button'
import { cn } from '@/lib/cn'

// The top bar carries the whole of navigation: back, the dismiss link, and forward.
//
// Forward lives here rather than in the lesson because this row is the only place in
// the layout that costs nothing. Everything else on a dial screen is either fixed (the
// sum slot, the dial itself) or the single flexible band holding the target — and a
// button placed in that band, or in a new row above or below the dial, takes its height
// from the same leftover either way. On a short screen that band has around 118px for an
// 80px target, so a button anywhere in the column pushed the target up into the callout
// and itself down onto the sum readout. Here it takes none.
export function TutorialFooter({
  isFirst,
  isLast,
  showNext,
  nextLabel,
  dismissLabel,
  onPrev,
  onNext,
  onDismiss,
}: {
  isFirst: boolean
  isLast: boolean
  // Hidden while a gated screen is still waiting on its task — finishing it carries the
  // player forward without anything to press.
  showNext: boolean
  nextLabel: string
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

      <View className="flex-1" />

      <Pressable onPress={onDismiss} className="py-2.5">
        <Text
          selectable={false}
          className="font-mono text-[10px] font-bold tracking-[1px] text-dim underline"
        >
          {dismissLabel}
        </Text>
      </Pressable>

      {showNext && (
        <TutorialNextButton label={nextLabel} isLast={isLast} onPress={onNext} />
      )}
    </View>
  )
}
