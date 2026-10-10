import { Ionicons } from '@expo/vector-icons'
import type { MessageDescriptor } from '@lingui/core'
import { msg } from '@lingui/core/macro'
import { useLingui } from '@lingui/react/macro'
import { Text, View } from 'react-native'

import { TrackedPressable } from '@/components/tracked-pressable'
import type { ButtonId } from '@/constants/buttons'
import { DIM_INK } from '@/constants/colors'
import { TYPE } from '@/constants/typography'
import { cn } from '@/lib/cn'

const ICON = 11

// Where this profile's address has got to, which is three places and not two.
//
// The middle one is the one worth naming: an address that has been typed and not yet
// proved. It is on the account, it is in the dialog's hands, and it brings nothing
// anywhere until six digits land — so a card that sorted addresses into held and missing
// put a player with a code sitting in their inbox in front of a button offering to start
// again.
//
// And it outranks the other two, which is the correction a stuck player paid for: a
// player **changing** an address they already hold has a confirmed one and a pending one
// at the same time, and reading the confirmed one first offered them CHANGE YOUR EMAIL —
// the thing they had already done — while the code they were waiting on had no door at
// all. The line names what is owed, not what is settled.
type AddressState = 'none' | 'pending' | 'held'

// What the link says in each state: giving an address, finishing one, changing one.
//
// The middle line is word for word the intro's own — `AccountNotice`'s `confirm` — and
// deliberately the same string rather than a second way of saying it. The two are the same
// errand reached from two places, and a player who has read one of them on the intro should
// recognise it at the foot of their profile rather than wonder what else is owed.
const LINES = {
  none: msg`ADD YOUR EMAIL`,
  pending: msg`CONFIRM YOUR EMAIL`,
  held: msg`CHANGE YOUR EMAIL`,
} as const satisfies Record<AddressState, MessageDescriptor>

const IDS = {
  none: 'profile.add_email',
  pending: 'profile.confirm_email',
  held: 'profile.edit_email',
} as const satisfies Record<AddressState, ButtonId>

// The address, at the foot of your own profile and nowhere else.
//
// It sat at the top for a while, among the name and the motto, on the reasoning that
// those three are the whole of what a player decides about themselves. The reasoning was
// wrong about one of them: a name and a motto are things a player *says*, and both are on
// the card for anyone who opens it, while an address is a thing a player *gives* — the one
// piece of them that is not public data, printed where it was the third line of their
// introduction. So it keeps the company it belongs to instead: the controls under the
// career, where COMPARE WITH ME sits on a stranger's card, in the same quiet-link voice
// and the same place.
//
// The address itself goes under the line rather than into it — it is a fact to be checked
// against an inbox, not part of what pressing this does. Printed in both states that have
// one, including the unproved one, where it is the answer to the question the player
// actually has: not whether confirming is wanted, but which inbox to go and look in.
//
// The press does not open a field in any of the three. There is nothing to type over:
// giving an address means proving it and changing one means proving the new one, so this
// hands over to the dialog that does the proving — see `EmailDialog`.
export function ProfileEmail({
  // The confirmed address, or null.
  email,
  // The one given and not yet proved, or null. Both at once is an ordinary state and not
  // a passing one — it is every address change from the moment the code goes out until it
  // is typed, or abandoned.
  pendingEmail,
  // The address card, for a player with nothing to finish.
  onOpenEmail,
  // The code card, reopened on the address already sent to. A different door rather than
  // the same one with a branch behind it, because the dialog itself draws two cards and
  // this is the card the player is actually in the middle of.
  onEnterCode,
}: {
  email: string | null
  pendingEmail: string | null
  onOpenEmail: () => void
  onEnterCode: () => void
}) {
  const { t } = useLingui()
  // Pending first — see `AddressState`. And the address shown follows the state rather
  // than being picked separately: on a change in flight, the one worth printing is the
  // one the code went to, since the player is being asked to go and look in that inbox.
  const state: AddressState =
    pendingEmail !== null ? 'pending' : email !== null ? 'held' : 'none'
  const shown = state === 'pending' ? pendingEmail : email

  return (
    <View className="mt-3 items-center">
      <TrackedPressable
        id={IDS[state]}
        onPress={state === 'pending' ? onEnterCode : onOpenEmail}
        hitSlop={10}
        className="items-center"
      >
        <View className="flex-row items-center gap-1">
          <Ionicons name="mail-outline" size={ICON} color={DIM_INK} />
          <Text selectable={false} className={cn(TYPE.quietAction, 'text-dim')}>
            {t(LINES[state])}
          </Text>
        </View>
        {shown !== null && (
          <Text
            selectable={false}
            className={cn(TYPE.hint, 'mt-0.5 text-center text-dim')}
          >
            {shown}
          </Text>
        )}
      </TrackedPressable>
    </View>
  )
}
