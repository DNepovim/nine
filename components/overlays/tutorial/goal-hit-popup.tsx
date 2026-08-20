import { Ionicons } from '@expo/vector-icons'
import { Modal, Pressable, Text, View } from 'react-native'

// Shown the moment the opening screen's mock target actually resolves — a real hit,
// not the ring running out. Solving 137 answers "how?" before the tutorial has said a
// word about it, so rather than barrelling on it pauses to ask what to do with that:
// keep learning, or skip straight to a real run.
export function GoalHitPopup({
  onContinue,
  onSkip,
}: {
  onContinue: () => void
  onSkip: () => void
}) {
  return (
    <Modal visible transparent animationType="fade">
      <View className="flex-1 items-center justify-center bg-black/60 px-8">
        <View className="w-full max-w-xs items-center rounded-2xl bg-card p-6">
          <Text
            selectable={false}
            className="mb-1 text-center font-mono text-[13px] font-black tracking-[1.5px] text-primary"
          >
            NICE HIT
          </Text>
          <Text
            selectable={false}
            className="mb-5 text-center font-mono text-[11px] font-bold leading-[16px] text-dim"
          >
            {"You've got the idea. Keep going with the tutorial, or jump into a game?"}
          </Text>

          <Pressable
            onPress={onContinue}
            className="mb-3 w-full flex-row items-center justify-center gap-1.5 rounded-xl bg-strong py-3"
          >
            <Text
              selectable={false}
              className="font-mono text-[11px] font-black tracking-[1px] text-on-strong"
            >
              CONTINUE TUTORIAL
            </Text>
            <Ionicons name="arrow-forward" size={12} color="#d8d2f4" />
          </Pressable>

          <Pressable onPress={onSkip} hitSlop={8}>
            <Text
              selectable={false}
              className="font-mono text-[10px] font-bold tracking-[1px] text-dim underline"
            >
              SKIP TUTORIAL
            </Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  )
}
