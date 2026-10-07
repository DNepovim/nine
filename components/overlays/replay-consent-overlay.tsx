import { Ionicons } from '@expo/vector-icons'
import { Trans } from '@lingui/react/macro'
import { Text, View } from 'react-native'

import { ModalCard } from '@/components/overlays/modal-card'
import { TrackedPressable } from '@/components/tracked-pressable'
import { APP_VIOLET } from '@/constants/colors'

// The one ask GDPR actually requires before anything non-essential starts: whether this
// player is fine with their screen being recorded. Everything else analytics does —
// `run_started`, a hit's own numbers, an error — already happens without asking, on the
// reading `docs/analytics.md` lays out: an anonymous id, a player-chosen nickname that is
// already public on the boards, little here that is sensitive. A recording of the screen
// is a different thing, and the SDK is built to wait for this: `disable_session_recording`
// stays true until `useReplayConsent` says otherwise.
//
// Closing the card (the header's own dot) answers neither way and asks again next
// launch, the same as the install prompt beside it — a player who has not said yes has
// not said no either, and recording stays off regardless until one button below is
// pressed. Declining is itself a choice worth keeping, not a thing to nag past, so NO
// THANKS persists it and never asks again — see hooks/use-replay-consent.ts, which is
// also what a player who changes their mind calls to reopen the question from Options.
export function ReplayConsentOverlay({
  onAllow,
  onDecline,
  onDismiss,
}: {
  onAllow: () => void
  onDecline: () => void
  onDismiss: () => void
}) {
  return (
    <ModalCard
      title={<Trans>CAN WE LOOK UNDER YOUR THUMBS?</Trans>}
      onDismiss={onDismiss}
    >
      {(close) => (
        <>
          <View className="items-center pt-2">
            <View
              className="h-16 w-16 items-center justify-center rounded-2xl"
              style={{ backgroundColor: `${APP_VIOLET}26` }}
            >
              <Ionicons name="videocam-outline" size={30} color={APP_VIOLET} />
            </View>

            <Text
              selectable={false}
              className="mt-4 text-center font-mono text-[17px] font-black tracking-[2px]"
              style={{ color: APP_VIOLET }}
            >
              <Trans>HELP US SEE THE ROUGH EDGES</Trans>
            </Text>

            <Text
              selectable={false}
              className="mt-2 text-center font-mono text-[12px] leading-[18px] text-dim"
            >
              <Trans>
                With your OK, we'll record a replay of how you play — taps, swipes, what's
                on screen — so we can see bugs the numbers alone don't show. Every text
                field, nickname included, is blanked out before it ever leaves your
                device. Change your mind any time from OPTIONS.
              </Trans>
            </Text>
          </View>

          <View className="mt-5 flex-row gap-3">
            <TrackedPressable
              id="replay_consent.decline"
              onPress={() => {
                onDecline()
                close()
              }}
              className="flex-1 items-center rounded-xl bg-card py-3"
            >
              <Text
                selectable={false}
                className="font-mono text-[11px] font-black tracking-[1.5px] text-dim"
              >
                <Trans>NO THANKS</Trans>
              </Text>
            </TrackedPressable>

            <TrackedPressable
              id="replay_consent.allow"
              onPress={() => {
                onAllow()
                close()
              }}
              className="flex-1 items-center rounded-xl bg-primary py-3"
            >
              <Text
                selectable={false}
                className="font-mono text-[11px] font-black tracking-[1.5px] text-on-strong"
              >
                <Trans>ALLOW</Trans>
              </Text>
            </TrackedPressable>
          </View>
        </>
      )}
    </ModalCard>
  )
}
