import { Plural, Trans } from '@lingui/react/macro'
import { Text, View } from 'react-native'

import { AdminDialog } from '@/components/overlays/admin-dialog'
import { PrimaryButton } from '@/components/primary-button'
import { TYPE } from '@/constants/typography'
import { cn } from '@/lib/cn'

// The question before a live challenge is held back. Asked only when something is lost by
// it: a session it was the only candidate of comes off the queue (the ones behind it close
// up), and a session with another candidate keeps its date and that candidate, now alone.
// A challenge with nothing planned changes without being asked.
export function ChallengeStateDialog({
  removed,
  trimmed,
  busy,
  onConfirm,
  onKeep,
}: {
  // Sessions it is the only candidate of, which will be removed.
  removed: number
  // Sessions it is one of two candidates of, which keep the other.
  trimmed: number
  busy: boolean
  onConfirm: () => void
  onKeep: () => void
}) {
  return (
    <AdminDialog title={<Trans>HOLD THIS CHALLENGE BACK?</Trans>} onDismiss={onKeep}>
      <View className="mb-2.5 gap-1.5">
        {removed > 0 && (
          <Text selectable={false} className={cn(TYPE.hint, 'text-dim')}>
            <Plural
              value={removed}
              one="# planned session will be removed from the queue and the ones behind it close up."
              other="# planned sessions will be removed from the queue and the ones behind them close up."
            />
          </Text>
        )}
        {trimmed > 0 && (
          <Text selectable={false} className={cn(TYPE.hint, 'text-dim')}>
            <Plural
              value={trimmed}
              one="# session keeps its date and its other candidate, and its votes for this one are dropped."
              other="# sessions keep their dates and their other candidates, and their votes for this one are dropped."
            />
          </Text>
        )}
        <Text selectable={false} className={cn(TYPE.hint, 'text-dim')}>
          <Trans>A session running now stays, and players will no longer see it.</Trans>
        </Text>
      </View>
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
