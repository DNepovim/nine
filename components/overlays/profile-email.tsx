import { Ionicons } from '@expo/vector-icons'
import { Trans, useLingui } from '@lingui/react/macro'
import { Text, View } from 'react-native'

import { TrackedPressable } from '@/components/tracked-pressable'
import { DIM_INK } from '@/constants/colors'
import { TYPE } from '@/constants/typography'
import { cn } from '@/lib/cn'

const ICON = 11

// The address under the motto, on your own profile and nowhere else.
//
// It sits with the name and the motto because those three are the whole of what a player
// decides about themselves — and it is drawn in the same two states the motto is: a pill
// to add one, the thing itself with a pencil beside it once there is one. A player who
// has just written a motto knows what the pencil next to their address will do.
//
// It is not the same component as `ProfileMotto`, deliberately. The motto is a line of
// the player's own prose, set in sentence case because the app did not write it; an
// address is a fact to be checked against an inbox, set in the smallest type on the card
// for exactly that. One shell over both would have to take the type role as a prop,
// which is the point at which a shared component stops saying anything.
//
// The pencil does not open a field here. There is nothing to type over: changing an
// address means proving the new one, so this hands over to the same dialog that asked for
// the first — see `EmailDialog`.
export function ProfileEmail({
  // The confirmed address, or null for a player who has not given one. An address that
  // has been typed and not yet confirmed is not one of these: until the six digits land
  // it brings nothing anywhere, so this still reads as empty.
  email,
  onPress,
}: {
  email: string | null
  onPress: () => void
}) {
  const { t } = useLingui()

  if (email === null) {
    return (
      <View className="items-center gap-1">
        <TrackedPressable
          id="profile.add_email"
          onPress={onPress}
          hitSlop={8}
          className="flex-row items-center gap-1 self-center rounded-full bg-card px-3 py-1"
        >
          <Ionicons name="add" size={ICON} color={DIM_INK} />
          <Text selectable={false} className={cn(TYPE.sectionLabel, 'text-dim')}>
            <Trans>ADD EMAIL</Trans>
          </Text>
        </TrackedPressable>
        {/* Why anyone would. A pill reading ADD EMAIL answers nothing on a screen full of
            figures a player came to read, and the half of it that matters most — that a
            profile on another phone can be brought here — is the half nobody would guess
            from the word. */}
        <Text selectable={false} className={cn(TYPE.hint, 'text-center text-dim')}>
          {t`Keep this profile, or bring back one from another phone`}
        </Text>
      </View>
    )
  }

  return (
    <View className="flex-row items-center justify-center gap-1.5 px-2">
      {/* `shrink` so the pencil is never pushed off the card by a long address — the text
          wraps instead, which an address can need on a narrow phone. */}
      <Text selectable={false} className={cn(TYPE.hint, 'shrink text-center text-dim')}>
        {email}
      </Text>
      <TrackedPressable id="profile.edit_email" onPress={onPress} hitSlop={10}>
        <Ionicons name="create-outline" size={ICON} color={DIM_INK} />
      </TrackedPressable>
    </View>
  )
}
