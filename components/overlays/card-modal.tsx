import type { ReactNode } from 'react'
import { KeyboardAvoidingView, Modal, Platform, View } from 'react-native'

// One platform modal, however many cards pass through it.
//
// The nickname card hands over to the address card, which hands over to the six digits,
// and each of those used to carry a `<Modal>` of its own. Swapping two of them meant
// unmounting one and mounting the other in a single commit, which iOS answers by dropping
// the second: a presentation cannot begin while a dismissal is still running. The card
// that was supposed to appear immediately simply never appeared.
//
// So the host stays put and only its contents change. That also makes the hand-over
// instant — there is no exit animation to sit through and no gap where the player is
// looking at the screen behind — which is what "the card turns over" was always meant to
// describe.
//
// A plain `Modal` rather than the app's `ModalCard`, and the one place that is the right
// call: these cards have a keyboard under them, and a real platform modal is what gets
// `KeyboardAvoidingView` a window of its own to lift inside.
export function CardModal({
  visible,
  // The Android back button. Routed by the caller to whichever card is up, since only the
  // caller knows which that is.
  onRequestClose,
  children,
}: {
  visible: boolean
  onRequestClose: () => void
  children: ReactNode
}) {
  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onRequestClose}
    >
      <KeyboardAvoidingView
        className="flex-1 items-center justify-center bg-black/60 px-8"
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <View className="w-full max-w-xs rounded-2xl bg-card p-6">{children}</View>
      </KeyboardAvoidingView>
    </Modal>
  )
}
