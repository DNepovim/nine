import { Plural, Trans } from '@lingui/react/macro'
import { Text, View } from 'react-native'

import { AdminDialog } from '@/components/overlays/admin-dialog'
import { PrimaryButton } from '@/components/primary-button'
import { TYPE } from '@/constants/typography'
import { cn } from '@/lib/cn'

// The question before a live challenge is held back. Asked only when something is lost by
// it: the planned sessions come off the queue, and the ones behind them close up. A
// challenge with nothing planned changes without being asked.
export function ChallengeStateDialog({
  planned,
  busy,
  onConfirm,
  onKeep,
}: {
  // How many planned sessions will be removed.
  planned: number
  busy: boolean
  onConfirm: () => void
  onKeep: () => void
}) {
  return (
    <AdminDialog title={<Trans>TAKE IT OFF THE QUEUE?</Trans>} onDismiss={onKeep}>
      <Text selectable={false} className={cn(TYPE.hint, 'mb-2.5 text-dim')}>
        <Plural
          value={planned}
          one="# planned session will be removed from the queue and the ones behind it close up. A session running now stays, and players will no longer see it."
          other="# planned sessions will be removed from the queue and the ones behind them close up. A session running now stays, and players will no longer see it."
        />
      </Text>
      <View className="gap-2">
        <PrimaryButton
          id="admin.challenge_state_confirm"
          tone="danger"
          disabled={busy}
          onPress={onConfirm}
          label={<Trans>MAKE PENDING</Trans>}
        />
        <PrimaryButton
          id="admin.challenge_state_keep"
          tone="quiet"
          onPress={onKeep}
          label={<Trans>KEEP LIVE</Trans>}
        />
      </View>
    </AdminDialog>
  )
}
