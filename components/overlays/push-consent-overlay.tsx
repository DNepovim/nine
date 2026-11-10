import { Ionicons } from '@expo/vector-icons'
import { Trans } from '@lingui/react/macro'
import { Text, View } from 'react-native'

import { LinkButton } from '@/components/link-button'
import { ModalCard } from '@/components/overlays/modal-card'
import { PrimaryButton } from '@/components/primary-button'
import { APP_VIOLET } from '@/constants/colors'
import { TYPE } from '@/constants/typography'
import { cn } from '@/lib/cn'
import type { PushReach } from '@/lib/push-reach'

// The second step of the first-launch consent, and the dialog an existing player meets once
// the feature goes public: whether we may push to this device when the app is closed. The
// replay ask is the first step (components/overlays/replay-consent-overlay.tsx), and the
// card is shown behind it — see `pushStepDue`.
//
// What it asks for is narrow and the copy says so: one kind of notification, a rival taking
// a record, and nothing else. Closing with the dot answers neither way, as the replay card
// does; NO THANKS is a no worth keeping and never asks again. Revisited from OPTIONS.
//
// `install` is the one variant: iOS only grants push to a web app on the Home Screen, so
// from a tab the card cannot ask and instead says where to go. That is why it has no
// ENABLE — a button that would fail is worse than a sentence that will not.
export function PushConsentOverlay({
  reach,
  onAllow,
  onDecline,
  onDismiss,
}: {
  reach: PushReach
  onAllow: () => void
  onDecline: () => void
  onDismiss: () => void
}) {
  return (
    <ModalCard
      closeButton={false}
      title={<Trans>CAN WE TELL YOU WHEN IT HAPPENS?</Trans>}
      onDismiss={onDismiss}
    >
      {(close) => (
        <>
          <View className="items-center pt-2">
            <View
              className="h-16 w-16 items-center justify-center rounded-2xl"
              style={{ backgroundColor: `${APP_VIOLET}26` }}
            >
              <Ionicons name="notifications-outline" size={30} color={APP_VIOLET} />
            </View>

            <Text
              selectable={false}
              className={cn(TYPE.cardTitle, 'mt-4 text-center')}
              style={{ color: APP_VIOLET }}
            >
              <Trans>SOMEONE TOOK YOUR RECORD</Trans>
            </Text>

            <Text
              selectable={false}
              className={cn(TYPE.prose, 'mt-2 text-center text-dim')}
            >
              <Trans>
                With your OK, we'll send a notification when a rival takes a record you
                hold, even if the game is closed. Nothing else. Your device's address is
                kept until you switch this off in OPTIONS.
              </Trans>
            </Text>

            {reach === 'install' && (
              <Text
                selectable={false}
                className={cn(TYPE.prose, 'mt-3 text-center text-dim')}
              >
                <Trans>
                  On iPhone and iPad this works only once nine is on your Home Screen. Add
                  it from the Share menu, open it from there and you'll be asked again.
                </Trans>
              </Text>
            )}
          </View>

          <View className="mt-5">
            {reach === 'install' ? (
              <PrimaryButton
                id="push_consent.later"
                onPress={() => {
                  onDismiss()
                  close()
                }}
                label={<Trans>GOT IT</Trans>}
              />
            ) : (
              <>
                <PrimaryButton
                  id="push_consent.allow"
                  onPress={() => {
                    onAllow()
                    close()
                  }}
                  label={<Trans>ENABLE</Trans>}
                />
                <LinkButton
                  id="push_consent.decline"
                  className="mt-3 self-center"
                  icon="close-outline"
                  label={<Trans>NO THANKS</Trans>}
                  onPress={() => {
                    onDecline()
                    close()
                  }}
                />
              </>
            )}
          </View>
        </>
      )}
    </ModalCard>
  )
}
