import { useRef, type ReactNode } from 'react'
import { Text, View } from 'react-native'

import { LinkButton } from '@/components/link-button'
import { ModalCard } from '@/components/overlays/modal-card'
import { PrimaryButton } from '@/components/primary-button'
import type { ButtonId } from '@/constants/buttons'
import { TYPE } from '@/constants/typography'
import { cn } from '@/lib/cn'

// What turning a consent off asks first — SESSION RECORDING and NOTIFICATIONS.
//
// Switching one on is one tap, so switching it off could be one stray tap too — and the
// answer is the player's consent, which they should withdraw on purpose. The card names
// what is being given up and leaves the checkbox where it was until they say so.
//
// One card for both because the second consent arrived looking exactly like the first; the
// words and the two button ids are what each caller supplies.
export function WithdrawModal({
  title,
  body,
  confirmLabel,
  keepLabel,
  confirmId,
  keepId,
  onConfirm,
  onDismiss,
}: {
  title: ReactNode
  body: ReactNode
  confirmLabel: ReactNode
  keepLabel: ReactNode
  confirmId: ButtonId
  keepId: ButtonId
  onConfirm: () => void
  // Closed without withdrawing, by the keep link or the scrim.
  onDismiss: () => void
}) {
  // Which way the card was answered, read once the exit animation has played, so the
  // checkbox behind it does not flip while the card is still leaving.
  const confirmed = useRef(false)

  return (
    <ModalCard
      closeButton={false}
      onDismiss={() => {
        if (confirmed.current) onConfirm()
        else onDismiss()
      }}
    >
      {(close) => (
        <View className="items-center pb-1 pt-2">
          <Text
            selectable={false}
            className={cn(TYPE.button, 'mb-1.5 text-center text-primary')}
          >
            {title}
          </Text>
          <Text
            selectable={false}
            className={cn(TYPE.prose, 'mb-5 text-center text-dim')}
          >
            {body}
          </Text>

          <PrimaryButton
            id={confirmId}
            tone="danger"
            className="w-full"
            onPress={() => {
              confirmed.current = true
              close()
            }}
            label={confirmLabel}
          />

          <LinkButton
            id={keepId}
            onPress={close}
            icon="close-outline"
            label={keepLabel}
            className="mt-1 w-full py-3"
          />
        </View>
      )}
    </ModalCard>
  )
}
