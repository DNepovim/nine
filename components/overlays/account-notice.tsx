import type { MessageDescriptor } from '@lingui/core'
import { msg } from '@lingui/core/macro'
import { useLingui } from '@lingui/react/macro'
import { Text } from 'react-native'
import Animated, { FadeIn, FadeOut } from 'react-native-reanimated'

import { TrackedPressable } from '@/components/tracked-pressable'
import type { ButtonId } from '@/constants/buttons'
import { TYPE } from '@/constants/typography'
import { cn } from '@/lib/cn'

// The two things the intro has to say about an address, and it only ever says one of
// them. They cannot both be true: a device told its profile moved has been signed out and
// handed a fresh anonymous account, which has no address pending on it.
export type AccountNoticeKind = 'confirm' | 'moved'

const LINES = {
  confirm: msg`CONFIRM YOUR EMAIL`,
  moved: msg`THIS PROFILE MOVED TO ANOTHER PHONE`,
} as const satisfies Record<AccountNoticeKind, MessageDescriptor>

const HINTS = {
  confirm: msg`TAP TO ENTER YOUR CODE`,
  moved: msg`TAP TO BRING IT BACK`,
} as const satisfies Record<AccountNoticeKind, MessageDescriptor>

const IDS = {
  confirm: 'menu.confirm_email',
  moved: 'menu.profile_moved',
} as const satisfies Record<AccountNoticeKind, ButtonId>

// The louder of the two gets the primary ink. A code waiting to be typed is a chore; a
// career that has left the building is news, and reading as quietly as the medals line
// above it would be the app mentioning it in passing.
const INKS = {
  confirm: 'text-dim',
  moved: 'text-primary',
} as const satisfies Record<AccountNoticeKind, string>

// One line under the title, where the app already tells a player what has happened to
// them while they were away. Tappable, and the tap is the point: neither of these is worth
// saying without the thing that answers it one press away.
export function AccountNotice({
  kind,
  onPress,
}: {
  kind: AccountNoticeKind
  onPress: () => void
}) {
  const { t } = useLingui()
  return (
    <Animated.View entering={FadeIn.duration(260)} exiting={FadeOut.duration(160)}>
      <TrackedPressable
        id={IDS[kind]}
        onPress={onPress}
        hitSlop={10}
        className="mb-2 items-center"
      >
        <Text selectable={false} className={cn(TYPE.sectionLabel, INKS[kind])}>
          {t(LINES[kind])}
        </Text>
        <Text
          selectable={false}
          className={cn(TYPE.caption, 'mt-0.5 text-dim underline')}
        >
          {t(HINTS[kind])}
        </Text>
      </TrackedPressable>
    </Animated.View>
  )
}
