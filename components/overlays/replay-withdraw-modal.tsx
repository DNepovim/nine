import { Trans } from '@lingui/react/macro'
import { useRef } from 'react'
import { Text, View } from 'react-native'

import { LinkButton } from '@/components/link-button'
import { ModalCard } from '@/components/overlays/modal-card'
import { PrimaryButton } from '@/components/primary-button'
import { TYPE } from '@/constants/typography'
import { cn } from '@/lib/cn'

// What turning SESSION RECORDING off asks first.
//
// Switching it on is one tap, so switching it off could be one stray tap too — and the
// answer is the player's consent, which they should withdraw on purpose. The card names
// what is being given up and leaves the checkbox where it was until they say so.
export function ReplayWithdrawModal({
  onConfirm,
  onDismiss,
}: {
  onConfirm: () => void
  // Closed without withdrawing, by KEEP RECORDING or the scrim.
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
            <Trans>Stop session recording?</Trans>
          </Text>
          <Text
            selectable={false}
            className={cn(TYPE.prose, 'mb-5 text-center text-dim')}
          >
            <Trans>
              You are withdrawing your consent. We will no longer watch replays to fix
              bugs.
            </Trans>
          </Text>

          <PrimaryButton
            id="replay_withdraw.confirm"
            tone="danger"
            className="w-full"
            onPress={() => {
              confirmed.current = true
              close()
            }}
            label={<Trans>STOP RECORDING</Trans>}
          />

          <LinkButton
            id="replay_withdraw.keep"
            onPress={close}
            icon="close-outline"
            label={<Trans>KEEP RECORDING</Trans>}
            className="mt-1 w-full py-3"
          />
        </View>
      )}
    </ModalCard>
  )
}
