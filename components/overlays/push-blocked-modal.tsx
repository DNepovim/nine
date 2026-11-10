import { Ionicons } from '@expo/vector-icons'
import { Trans } from '@lingui/react/macro'
import type { ReactNode } from 'react'
import { Text, View } from 'react-native'

import { ModalCard } from '@/components/overlays/modal-card'
import { PrimaryButton } from '@/components/primary-button'
import { APP_VIOLET } from '@/constants/colors'
import { TYPE } from '@/constants/typography'
import { cn } from '@/lib/cn'
import type { PushHelp } from '@/lib/push-reach'

// The steps by where nine is running. An installed app has no address bar to open a site's
// settings from, so on a phone the way back is the phone's own settings for the app.
const STEPS: Record<PushHelp, ReactNode> = {
  'ios-app': <Trans>Open Settings → Notifications → nine and turn on Allow.</Trans>,
  'android-app': (
    <Trans>Open Settings → Apps → nine → Notifications and turn them on.</Trans>
  ),
  browser: (
    <Trans>
      Open the site settings next to the address bar, set Notifications to Allow, then
      come back.
    </Trans>
  ),
}

// What the NOTIFICATIONS row opens when the browser has already refused. No code can ask
// again once it has, so the card says how to undo it instead; the row follows on its own
// when the player returns — see `watchPushReach`.
export function PushBlockedModal({
  help,
  onDismiss,
}: {
  help: PushHelp
  onDismiss: () => void
}) {
  return (
    <ModalCard
      closeButton={false}
      title={<Trans>NOTIFICATIONS ARE OFF</Trans>}
      onDismiss={onDismiss}
    >
      {(close) => (
        <View className="items-center pt-2">
          <View
            className="h-16 w-16 items-center justify-center rounded-2xl"
            style={{ backgroundColor: `${APP_VIOLET}26` }}
          >
            <Ionicons name="notifications-off-outline" size={30} color={APP_VIOLET} />
          </View>
          <Text
            selectable={false}
            className={cn(TYPE.prose, 'mb-5 mt-4 text-center text-dim')}
          >
            {STEPS[help]}
          </Text>
          <PrimaryButton
            id="push_blocked.close"
            className="w-full"
            onPress={close}
            label={<Trans>GOT IT</Trans>}
          />
        </View>
      )}
    </ModalCard>
  )
}
