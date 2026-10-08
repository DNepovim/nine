import { Ionicons } from '@expo/vector-icons'
import { Trans } from '@lingui/react/macro'
import { useEffect } from 'react'
import { Text, View } from 'react-native'

import { InstallSteps } from '@/components/overlays/install-steps'
import { ModalCard } from '@/components/overlays/modal-card'
import { PrimaryButton } from '@/components/primary-button'
import { APP_VIOLET } from '@/constants/colors'
import { TYPE } from '@/constants/typography'
import { track } from '@/lib/analytics'
import { cn } from '@/lib/cn'
import type { InstallableTarget } from '@/types/install'

type IoniconName = keyof typeof Ionicons.glyphMap

const CTA_LABEL = {
  prompt: 'INSTALL',
  'ios-safari': 'GOT IT',
  'ios-chrome': 'GOT IT',
  'ios-other': 'GOT IT',
  'open-in-safari': 'GOT IT',
  'open-in-chrome': 'GOT IT',
} as const satisfies Record<InstallableTarget, string>

const CTA_ICON = {
  prompt: 'download-outline',
  'ios-safari': 'checkmark',
  'ios-chrome': 'checkmark',
  'ios-other': 'checkmark',
  'open-in-safari': 'checkmark',
  'open-in-chrome': 'checkmark',
} as const satisfies Record<InstallableTarget, IoniconName>

// The install paths sell the result; the redirects have to explain the obstacle
// first, because the player can't act on anything until they move.
const PITCH = 'Full screen, no browser bar, and it keeps working offline.'

const BODY = {
  prompt: PITCH,
  'ios-safari': PITCH,
  'ios-chrome': PITCH,
  'ios-other': PITCH,
  'open-in-safari': `This app can't add to your home screen. Open nine in Safari and you can. ${PITCH}`,
  'open-in-chrome': `This app can't add to your home screen. Open nine in Chrome and you can. ${PITCH}`,
} as const satisfies Record<InstallableTarget, string>

// Where each browser keeps its Share button. `null` means this target shows no
// steps at all — the map doubles as the "are there steps?" decision, so adding a
// target forces an answer rather than silently falling through to none.
const STEP_ONE = {
  prompt: null,
  'ios-safari': 'Tap Share in the toolbar',
  'ios-chrome': 'Tap Share next to the address bar',
  'ios-other': "Open your browser's Share menu",
  'open-in-safari': null,
  'open-in-chrome': null,
} as const satisfies Record<InstallableTarget, string | null>

// Offers the home screen to a player who arrived in a mobile browser. Two
// bodies: a real install button where the browser gives us one, Safari's manual
// steps where it doesn't. `InstallableTarget` excludes 'none', so this can't be
// rendered with nothing to say.
export function InstallOverlay({
  target,
  onInstall,
  onDismiss,
}: {
  target: InstallableTarget
  onInstall: () => void
  onDismiss: () => void
}) {
  const stepOne = STEP_ONE[target]

  // Once per actual appearance, not once per time the target resolves: the two mount
  // sites (over the splash, and on the intro) each gate on their own popups and a
  // resolved target, so this is the only place that knows the card genuinely reached the
  // screen rather than losing to a release note or a winnings card still showing.
  useEffect(() => {
    track('install_prompt', { action: 'shown', target })
    // Empty on purpose: once per mount, not once per target change.
  }, [])

  return (
    <ModalCard title={<Trans>INSTALL</Trans>} onDismiss={onDismiss}>
      {(close) => (
        <>
          <View className="items-center pt-2">
            <View
              className="h-16 w-16 items-center justify-center rounded-2xl"
              style={{ backgroundColor: `${APP_VIOLET}26` }}
            >
              <Ionicons name="phone-portrait-outline" size={30} color={APP_VIOLET} />
            </View>

            <Text
              selectable={false}
              className={cn(TYPE.cardTitle, 'mt-4 text-center')}
              style={{ color: APP_VIOLET }}
            >
              <Trans>ADD TO HOME SCREEN</Trans>
            </Text>

            <Text
              selectable={false}
              className={cn(TYPE.prose, 'mt-2 text-center text-dim')}
            >
              {BODY[target]}
            </Text>
          </View>

          {stepOne !== null && <InstallSteps stepOne={stepOne} />}

          <View className="mt-4 flex-row items-center justify-center">
            <PrimaryButton
              id="install.action"
              onPress={() => {
                // No exit animation on the install path: prompt() has to stay
                // in the press to keep its user activation, and the browser's
                // own dialog covers the card the moment it opens.
                if (target === 'prompt') onInstall()
                else close()
              }}
              label={CTA_LABEL[target]}
              icon={<Ionicons name={CTA_ICON[target]} size={14} color="#d8d2f4" />}
            />
          </View>
        </>
      )}
    </ModalCard>
  )
}
