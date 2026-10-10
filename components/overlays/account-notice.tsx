import { msg } from '@lingui/core/macro'
import { Trans, useLingui } from '@lingui/react/macro'
import { Text } from 'react-native'
import Animated, { FadeIn, FadeOut } from 'react-native-reanimated'

import { TrackedPressable } from '@/components/tracked-pressable'
import { TYPE } from '@/constants/typography'
import { cn } from '@/lib/cn'

import { ProfilePill } from './profile-pill'

// The two things the intro has to say about an address, and it only ever says one of
// them. They cannot both be true: a device told its profile moved has been signed out and
// handed a fresh anonymous account, which has no address pending on it.
export type AccountNoticeKind = 'confirm' | 'moved'

// The louder of the two is a line of text and the quieter is a pill, which is the one
// place in the app where two kinds of the same thing are drawn as two different shapes —
// and the reason is that they are not two kinds of the same thing. A code waiting to be
// typed is a chore: it reads as a control because pressing it is the whole of what there
// is to do, so it borrows the pill the profile card offers a motto with, where the shape
// is already the app's word for *something of yours is unfinished*. A career that has
// left the building is news, and news is sentences — a pill would make the loss of a
// profile look like a setting.
const MOVED_LINE = msg`THIS PROFILE MOVED TO ANOTHER PHONE`
const MOVED_HINT = msg`TAP TO BRING IT BACK`

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
    <Animated.View
      entering={FadeIn.duration(260)}
      exiting={FadeOut.duration(160)}
      className="mb-2 items-center"
    >
      {kind === 'confirm' ? (
        // Word for word what the foot of the player's own profile says, and the same door
        // behind it — the code card, reopened on the address it was sent to. Two places
        // reach the one errand, so they are the one sentence; see `ProfileEmail`.
        <ProfilePill
          id="menu.confirm_email"
          icon="mail-outline"
          label={<Trans>CONFIRM YOUR EMAIL</Trans>}
          onPress={onPress}
        />
      ) : (
        <TrackedPressable id="menu.profile_moved" onPress={onPress} hitSlop={10}>
          <Text selectable={false} className={cn(TYPE.sectionLabel, 'text-primary')}>
            {t(MOVED_LINE)}
          </Text>
          <Text
            selectable={false}
            className={cn(TYPE.caption, 'mt-0.5 text-center text-dim underline')}
          >
            {t(MOVED_HINT)}
          </Text>
        </TrackedPressable>
      )}
    </Animated.View>
  )
}
