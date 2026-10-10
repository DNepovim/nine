import type { ReactNode } from 'react'
import { KeyboardAvoidingView, Modal, Platform, Pressable, View } from 'react-native'

import { HoldProvider, useDialogHold } from '@/components/overlays/dialog-hold'

// A platform modal with one of the app's cards inside it, and the nickname card is what it
// holds.
//
// A plain `Modal` rather than the app's `ModalCard`, and the one place that is the right
// call: this card has a keyboard under it, and a real platform modal is what gets
// `KeyboardAvoidingView` a window of its own to lift inside.
//
// It used to carry the address and the six digits too, in a single host whose contents
// swapped — because swapping two platform modals in one commit is how iOS came to drop the
// second: a presentation cannot begin while a dismissal is still running. Those two have
// gone to `EmailDialog`, which is the app's ordinary dialog rather than a window, so
// nothing is presented as this one dismisses and the hand-over is safe again. What is left
// here is the host and the reason it is a window at all.
//
// `visible` rather than mounting and unmounting: a platform modal animates itself out, and
// unmounting it is what cuts that in half.
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
  const hold = useDialogHold()

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
        {/* A tap beside the card is a way out here too, the way it is on `ModalCard` —
            under the card rather than around it, so a tap on the card stops at the card.
            Held shut while there is something typed in it: see `dialog-hold.ts`. */}
        <Pressable
          className="absolute inset-0"
          accessible={false}
          onPress={() => {
            if (hold.held.current) return
            onRequestClose()
          }}
        />
        {/* `zIndex` keeps the card over the scrim behind it on the web too, where an
            absolutely positioned sibling is otherwise painted over an in-flow one. */}
        <View className="w-full max-w-xs rounded-2xl bg-card p-6" style={{ zIndex: 1 }}>
          <HoldProvider value={hold.report}>{children}</HoldProvider>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  )
}
